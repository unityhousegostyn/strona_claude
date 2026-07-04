import { redirect, notFound } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { buildYearlyTable, type SettlementApartment, type SettlementRate, type SettlementEntry } from '@/lib/settlementCalc'
import Link from 'next/link'

function pln(v: number) {
  return v.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
}

export default async function WezwaniaPage({
  searchParams,
}: {
  searchParams: Promise<{ communityId?: string; year?: string; minDebt?: string }>
}) {
  const { profile } = await getAuthProfile()
  if (profile.role !== 'super_admin' && profile.role !== 'admin') redirect('/admin/settlements')

  const sp = await searchParams
  const admin = getSupabaseAdminClient()

  const { data: communities } = await admin.from('communities').select('id, name').order('name')
  const available = profile.role === 'admin'
    ? (communities ?? []).filter(c => c.id === profile.community_id)
    : (communities ?? [])

  const communityId = sp.communityId ?? available[0]?.id ?? ''
  if (!communityId) redirect('/admin/settlements')
  if (profile.role === 'admin' && profile.community_id !== communityId) redirect('/admin/settlements')

  const year = parseInt(sp.year ?? '') || new Date().getFullYear()
  const minDebt = parseFloat(sp.minDebt ?? '0') || 0

  const communityName = available.find(c => c.id === communityId)?.name ?? ''

  const [aptsRes, ratesRes, communityRes] = await Promise.all([
    admin.from('settlement_apartments').select('*').eq('community_id', communityId).eq('active', true).order('number'),
    admin.from('settlement_rates').select('*').eq('community_id', communityId).order('effective_from', { ascending: false }),
    admin.from('communities').select('bank_account, address').eq('id', communityId).single(),
  ])

  const apts: SettlementApartment[] = (aptsRes.data ?? []) as SettlementApartment[]
  const rates: SettlementRate[] = (ratesRes.data ?? []) as SettlementRate[]
  const bankAccount = communityRes.data?.bank_account ?? null

  let entries: SettlementEntry[] = []
  if (apts.length > 0) {
    const { data: entData } = await admin
      .from('settlement_entries').select('*')
      .eq('year', year).in('apartment_id', apts.map(a => a.id))
    entries = (entData ?? []) as SettlementEntry[]
  }

  interface AptDebt {
    id: string; number: string; owner_name: string
    totalPaid: number; totalDue: number; balance: number
    openingBalance: number
  }

  // Opening balances
  const { data: openingBalances } = await admin
    .from('settlement_opening_balances')
    .select('apartment_id, balance')
    .eq('year', year)
    .in('apartment_id', apts.map(a => a.id))
  const obMap: Record<string, number> = {}
  for (const ob of openingBalances ?? []) obMap[ob.apartment_id] = Number(ob.balance)

  const debtors: AptDebt[] = []
  for (const apt of apts) {
    const aptEntries = entries.filter(e => e.apartment_id === apt.id)
    const rows = buildYearlyTable(apt, rates, aptEntries, year)
    const totalPaid = rows.reduce((s, r) => s + r.paid, 0)
    const totalDue  = rows.reduce((s, r) => s + r.total_due, 0)
    const openingBalance = obMap[apt.id] ?? 0
    const balance = openingBalance + totalPaid - totalDue

    if (balance < -minDebt) {
      debtors.push({
        id: apt.id, number: apt.number, owner_name: apt.owner_name,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalDue:  Math.round(totalDue  * 100) / 100,
        balance:   Math.round(balance   * 100) / 100,
        openingBalance: Math.round(openingBalance * 100) / 100,
      })
    }
  }

  debtors.sort((a, b) => a.balance - b.balance) // najwyższe zadłużenie na górze

  const printAllUrl = `/admin/settlements/wezwania/print?communityId=${communityId}&year=${year}&minDebt=${minDebt}`

  const years = [year - 1, year, year + 1]

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#115e59]">
        <Link href="/admin/settlements" className="hover:text-[#99f6e4] transition">Rozliczenia</Link>
        <span>›</span>
        <span className="text-[#99f6e4]">Wezwania do zapłaty</span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-[#f0fdfa]">⚠️ Wezwania do zapłaty</h2>
        {debtors.length > 0 && (
          <Link
            href={printAllUrl}
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition"
          >
            🖨 Drukuj wszystkie ({debtors.length})
          </Link>
        )}
      </div>

      {/* Filtry */}
      <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5 space-y-4">
        {profile.role === 'super_admin' && available.length > 1 && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-[#0f766e]">Wspólnota:</span>
            <div className="flex gap-1 flex-wrap">
              {available.map(c => (
                <Link key={c.id}
                  href={`/admin/settlements/wezwania?communityId=${c.id}&year=${year}`}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition border ${c.id === communityId ? 'bg-teal-600 text-white border-transparent' : 'border-[#0f2d2a] text-[#0f766e] hover:text-[#99f6e4]'}`}
                >{c.name}</Link>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-[#0f766e]">Rok:</span>
          <div className="flex gap-1">
            {years.map(y => (
              <Link key={y}
                href={`/admin/settlements/wezwania?communityId=${communityId}&year=${y}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${y === year ? 'bg-teal-600 text-white border-transparent' : 'border-[#0f2d2a] text-[#0f766e] hover:text-[#99f6e4]'}`}
              >{y}</Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#0f766e]">Min. zadłużenie:</span>
          <div className="flex gap-1">
            {[0, 100, 500, 1000].map(m => (
              <Link key={m}
                href={`/admin/settlements/wezwania?communityId=${communityId}&year=${year}&minDebt=${m}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${m === minDebt ? 'bg-teal-600 text-white border-transparent' : 'border-[#0f2d2a] text-[#0f766e] hover:text-[#99f6e4]'}`}
              >{m === 0 ? 'wszystko' : `>${m} PLN`}</Link>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4">
          <p className="text-xs text-[#115e59]">Dłużnicy</p>
          <p className="text-2xl font-bold text-red-400">{debtors.length}</p>
        </div>
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4">
          <p className="text-xs text-[#115e59]">Łączne zadłużenie</p>
          <p className="text-2xl font-bold text-red-400">
            {pln(Math.abs(debtors.reduce((s, d) => s + d.balance, 0)))}
          </p>
        </div>
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4">
          <p className="text-xs text-[#115e59]">Wszystkich lokali</p>
          <p className="text-2xl font-bold text-[#f0fdfa]">{apts.length}</p>
        </div>
      </div>

      {debtors.length === 0 ? (
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-10 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-sm text-[#0f766e]">Brak lokali z zadłużeniem w roku {year}.</p>
        </div>
      ) : (
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#0f2d2a]">
            <h3 className="text-sm font-semibold text-red-400">🔴 Lokale z niedopłatą — {year}</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#0f2d2a] bg-[#051210]">
                <th className="px-4 py-2 text-left text-[#0f766e] uppercase tracking-wide">Lokal</th>
                <th className="px-4 py-2 text-left text-[#0f766e] uppercase tracking-wide">Właściciel</th>
                <th className="px-4 py-2 text-right text-[#0f766e] uppercase tracking-wide">Saldo otwarcia</th>
                <th className="px-4 py-2 text-right text-[#0f766e] uppercase tracking-wide">Naliczono</th>
                <th className="px-4 py-2 text-right text-[#0f766e] uppercase tracking-wide">Wpłacono</th>
                <th className="px-4 py-2 text-right text-[#0f766e] uppercase tracking-wide">Zadłużenie</th>
                <th className="px-4 py-2 text-right text-[#0f766e] uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody>
              {debtors.map(d => (
                <tr key={d.id} className="border-b border-[#0f2d2a]/50 hover:bg-[#0c2220]/30">
                  <td className="px-4 py-2 font-medium text-[#99f6e4]">{d.number}</td>
                  <td className="px-4 py-2 text-[#ccfbf1]">{d.owner_name}</td>
                  <td className={`px-4 py-2 text-right ${d.openingBalance >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                    {d.openingBalance !== 0 ? pln(d.openingBalance) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-[#ccfbf1]">{pln(d.totalDue)}</td>
                  <td className="px-4 py-2 text-right text-teal-400">{pln(d.totalPaid)}</td>
                  <td className="px-4 py-2 text-right font-bold text-red-400">{pln(Math.abs(d.balance))}</td>
                  <td className="px-4 py-2 text-right flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/settlements/wezwania/print?communityId=${communityId}&year=${year}&apartmentId=${d.id}`}
                      target="_blank"
                      className="text-amber-400 hover:text-amber-300 transition whitespace-nowrap"
                    >
                      🖨 Wezwanie
                    </Link>
                    <Link
                      href={`/admin/settlements/${d.id}`}
                      className="text-[#0f766e] hover:text-[#99f6e4] transition whitespace-nowrap"
                    >
                      → Lokal
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

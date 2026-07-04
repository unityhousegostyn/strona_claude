import { redirect, notFound } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { getRatesForMonth, type SettlementRate } from '@/lib/settlementCalc'
import Link from 'next/link'

const MONTHS_SHORT = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru']
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']

function pln(v: number) {
  return v.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
}

function periodLabel(q: number, months: number) {
  const startM = (q - 1) * months + 1
  const endM = startM + months - 1
  return months === 1
    ? `${ROMAN[q - 1]} (${MONTHS_SHORT[startM - 1]})`
    : `${ROMAN[q - 1]} (${MONTHS_SHORT[startM - 1]}–${MONTHS_SHORT[endM - 1]})`
}

export default async function NotaWodyZbiorczyPage({
  searchParams,
}: {
  searchParams: Promise<{ communityId?: string; year?: string; quarter?: string }>
}) {
  const { profile } = await getAuthProfile()
  if (profile.role !== 'super_admin' && profile.role !== 'admin') redirect('/admin/settlements')

  const sp = await searchParams
  const admin = getSupabaseAdminClient()

  // Pobierz dostępne wspólnoty
  const commRes = await admin.from('communities')
    .select('id, name')
    .order('name')
  const communities = commRes.data ?? []

  // Filtruj dla admina
  const availableCommunities = profile.role === 'admin'
    ? communities.filter(c => c.id === profile.community_id)
    : communities

  const communityId = sp.communityId ?? availableCommunities[0]?.id ?? null
  if (!communityId) notFound()

  if (profile.role === 'admin' && profile.community_id !== communityId) redirect('/admin/settlements')

  const year = parseInt(sp.year ?? '') || new Date().getFullYear()

  // Pobierz stawki
  const ratesRes = await admin.from('settlement_rates').select('*')
    .eq('community_id', communityId)
    .order('effective_from', { ascending: false })
  const rates: SettlementRate[] = ratesRes.data ?? []
  const reconMonths = rates[0]?.water_reconciliation_months ?? 3
  const numPeriods = Math.floor(12 / reconMonths)

  const quarter = Math.min(Math.max(1, parseInt(sp.quarter ?? '1') || 1), numPeriods)

  // Pobierz lokale + rozliczenia wody dla tego okresu
  const [aptsRes, recsRes, communityRes] = await Promise.all([
    admin.from('settlement_apartments').select('id, number, owner_name')
      .eq('community_id', communityId).eq('active', true).order('number'),
    admin.from('settlement_water_reconciliation').select('*')
      .eq('year', year).eq('quarter', quarter)
      .in('apartment_id', []),  // placeholder — zastąpimy poniżej
    admin.from('communities').select('name').eq('id', communityId).single(),
  ])

  const apartments = aptsRes.data ?? []
  const communityName = communityRes.data?.name ?? ''

  // Pobierz rozliczenia dla wszystkich lokali naraz
  let reconciliations: Record<string, {
    actual_m3: number; ryczalt_m3: number; correction_amount: number;
    meter_reading_start: number; meter_reading_end: number; notes: string | null
  }> = {}

  if (apartments.length > 0) {
    const aptIds = apartments.map(a => a.id)
    const recs = await admin.from('settlement_water_reconciliation').select('*')
      .eq('year', year).eq('quarter', quarter).in('apartment_id', aptIds)
    ;(recs.data ?? []).forEach(r => { reconciliations[r.apartment_id] = r })
  }

  const periodRate = getRatesForMonth(rates, year, (quarter - 1) * reconMonths + 1)
  const waterPrice = periodRate?.water_price_m3 ?? 0

  const withRec = apartments.filter(a => reconciliations[a.id])
  const withoutRec = apartments.filter(a => !reconciliations[a.id])

  const printAllUrl = `/admin/settlements/nota-wody-zbiorczy/print-all?communityId=${communityId}&year=${year}&quarter=${quarter}`

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#115e59]">
        <Link href="/admin/settlements" className="hover:text-[#99f6e4] transition">Rozliczenia</Link>
        <span>›</span>
        <span className="text-[#99f6e4]">Noty wody — zbiorczo</span>
      </div>

      <h2 className="text-xl font-bold text-[#f0fdfa]">💧 Noty wody — wystawienie zbiorcze</h2>

      {/* Filtry */}
      <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5 space-y-4">
        {/* Wspólnota */}
        {profile.role === 'super_admin' && availableCommunities.length > 1 && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-[#0f766e]">Wspólnota:</span>
            <div className="flex gap-1 flex-wrap">
              {availableCommunities.map(c => (
                <Link key={c.id}
                  href={`/admin/settlements/nota-wody-zbiorczy?communityId=${c.id}&year=${year}&quarter=1`}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition border ${
                    c.id === communityId
                      ? 'bg-teal-600 text-white border-transparent'
                      : 'border-[#0f2d2a] text-[#0f766e] hover:text-[#99f6e4]'
                  }`}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Rok */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-[#0f766e]">Rok:</span>
          <div className="flex gap-1">
            {[year - 1, year, year + 1].map(y => (
              <Link key={y}
                href={`/admin/settlements/nota-wody-zbiorczy?communityId=${communityId}&year=${y}&quarter=${quarter}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
                  y === year
                    ? 'bg-teal-600 text-white border-transparent'
                    : 'border-[#0f2d2a] text-[#0f766e] hover:text-[#99f6e4]'
                }`}
              >
                {y}
              </Link>
            ))}
          </div>
        </div>

        {/* Okres */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-[#0f766e]">Okres:</span>
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: numPeriods }, (_, i) => i + 1).map(q => (
              <Link key={q}
                href={`/admin/settlements/nota-wody-zbiorczy?communityId=${communityId}&year=${year}&quarter=${q}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
                  q === quarter
                    ? 'bg-teal-600 text-white border-transparent'
                    : 'border-[#0f2d2a] text-[#0f766e] hover:text-[#99f6e4]'
                }`}
              >
                {periodLabel(q, reconMonths)}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4">
          <p className="text-xs text-[#115e59]">Rozliczone</p>
          <p className="text-2xl font-bold text-teal-400 mt-1">{withRec.length}</p>
        </div>
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4">
          <p className="text-xs text-[#115e59]">Brak rozliczenia</p>
          <p className="text-2xl font-bold text-[#f0fdfa] mt-1">{withoutRec.length}</p>
        </div>
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4">
          <p className="text-xs text-[#115e59]">Cena wody</p>
          <p className="text-2xl font-bold text-[#f0fdfa] mt-1">{pln(waterPrice)}/m³</p>
        </div>
      </div>

      {/* Akcje */}
      {withRec.length > 0 && (
        <div className="flex items-center gap-3">
          <Link
            href={printAllUrl}
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition"
          >
            🖨 Drukuj wszystkie ({withRec.length})
          </Link>
          <span className="text-xs text-[#115e59]">Otwiera noty dla wszystkich rozliczonych lokali w jednym oknie</span>
        </div>
      )}

      {/* Lista lokali z rozliczeniem */}
      {withRec.length > 0 && (
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#0f2d2a]">
            <h3 className="text-sm font-semibold text-[#99f6e4]">✅ Rozliczone ({withRec.length})</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#0f2d2a] bg-[#051210]">
                <th className="px-4 py-2 text-left text-[#0f766e] uppercase tracking-wide">Lokal</th>
                <th className="px-4 py-2 text-left text-[#0f766e] uppercase tracking-wide">Właściciel</th>
                <th className="px-4 py-2 text-right text-[#0f766e] uppercase tracking-wide">Odczyt start</th>
                <th className="px-4 py-2 text-right text-[#0f766e] uppercase tracking-wide">Odczyt koniec</th>
                <th className="px-4 py-2 text-right text-[#0f766e] uppercase tracking-wide">Zużycie</th>
                <th className="px-4 py-2 text-right text-[#0f766e] uppercase tracking-wide">Korekta</th>
                <th className="px-4 py-2 text-right text-[#0f766e] uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody>
              {withRec.map(apt => {
                const rec = reconciliations[apt.id]
                const isDop = (rec.correction_amount ?? 0) >= 0
                return (
                  <tr key={apt.id} className="border-b border-[#0f2d2a]/50 hover:bg-[#0c2220]/30">
                    <td className="px-4 py-2 font-medium text-[#99f6e4]">{apt.number}</td>
                    <td className="px-4 py-2 text-[#ccfbf1]">{apt.owner_name}</td>
                    <td className="px-4 py-2 text-right text-[#ccfbf1]">{Math.round(rec.meter_reading_start)} m³</td>
                    <td className="px-4 py-2 text-right text-[#ccfbf1]">{Math.round(rec.meter_reading_end)} m³</td>
                    <td className="px-4 py-2 text-right text-[#ccfbf1]">{Math.round(rec.actual_m3)} m³</td>
                    <td className={`px-4 py-2 text-right font-semibold ${isDop ? 'text-red-400' : 'text-teal-400'}`}>
                      {isDop ? '+' : ''}{pln(rec.correction_amount ?? 0)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/admin/settlements/${apt.id}/nota-wody/${year}/${quarter}`}
                        target="_blank"
                        className="text-amber-400 hover:text-amber-300 transition whitespace-nowrap"
                      >
                        🖨 Nota
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Lista lokali bez rozliczenia */}
      {withoutRec.length > 0 && (
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#0f2d2a]">
            <h3 className="text-sm font-semibold text-[#115e59]">⏳ Brak rozliczenia ({withoutRec.length}) — synchronizuj liczniki przed wystawieniem</h3>
          </div>
          <div className="divide-y divide-[#0f2d2a]/50">
            {withoutRec.map(apt => (
              <div key={apt.id} className="px-4 py-2 flex items-center justify-between">
                <span className="text-xs text-[#115e59]">
                  <span className="text-[#0f766e] font-medium">{apt.number}</span> — {apt.owner_name}
                </span>
                <Link
                  href={`/admin/settlements/${apt.id}?year=${year}`}
                  className="text-xs text-[#0f766e] hover:text-[#99f6e4] transition"
                >
                  → Idź do lokalu
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {apartments.length === 0 && (
        <p className="text-sm text-[#115e59]">Brak aktywnych lokali w tej wspólnocie.</p>
      )}
    </div>
  )
}

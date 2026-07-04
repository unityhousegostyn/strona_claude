import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import {
  buildYearlyTable, pln,
  type SettlementApartment, type SettlementRate, type SettlementEntry,
} from '@/lib/settlementCalc'
import Link from 'next/link'

const MONTHS = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru']
const MONTHS_LONG = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień']

function Badge({ children, color }: { children: React.ReactNode; color: 'teal' | 'red' | 'yellow' }) {
  const cls = {
    teal:   'bg-teal-900/40 text-teal-400 border border-teal-800/40',
    red:    'bg-red-900/40 text-red-400 border border-red-800/40',
    yellow: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800/40',
  }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls[color]}`}>{children}</span>
}

export default async function MojeKontoPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { user, profile } = await getAuthProfile()
  if (!['user', 'najemca'].includes(profile.role)) redirect('/admin/dashboard')

  const sp = await searchParams
  const currentYear = new Date().getFullYear()
  const selectedYear = parseInt(sp.year ?? '') || currentYear

  const admin = getSupabaseAdminClient()

  // Znajdź lokal
  const { data: apt } = await admin
    .from('settlement_apartments').select('*')
    .eq('owner_id', user.id).maybeSingle()

  if (!apt) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h2 className="text-xl font-bold text-[#f0fdfa]">💳 Moje konto</h2>
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-2xl p-10 text-center">
          <p className="text-2xl mb-2">🏠</p>
          <p className="text-sm text-[#0f766e]">Nie przypisano Ci jeszcze żadnego lokalu.</p>
          <p className="text-xs text-[#115e59] mt-2">Skontaktuj się z administratorem wspólnoty.</p>
        </div>
      </div>
    )
  }

  const apartment = apt as SettlementApartment

  // Dane dla wybranego roku
  const [ratesRes, entriesRes, communityRes] = await Promise.all([
    admin.from('settlement_rates').select('*')
      .eq('community_id', apartment.community_id)
      .order('effective_from', { ascending: false }),
    admin.from('settlement_entries').select('*')
      .eq('apartment_id', apartment.id).eq('year', selectedYear),
    admin.from('communities').select('name, address, bank_account').eq('id', apartment.community_id).single(),
  ])

  const rates = (ratesRes.data ?? []) as SettlementRate[]
  const entries = (entriesRes.data ?? []) as SettlementEntry[]
  const rows = buildYearlyTable(apartment, rates, entries, selectedYear)
  const community = communityRes.data

  // Salda otwarcia — pobierz dla ostatnich 3 lat
  const years = [currentYear - 2, currentYear - 1, currentYear]
  const { data: openingBalancesAll } = await admin
    .from('settlement_opening_balances')
    .select('year, balance')
    .eq('apartment_id', apartment.id)
    .in('year', years)

  const obMap: Record<number, number> = {}
  for (const ob of openingBalancesAll ?? []) obMap[ob.year] = Number(ob.balance)

  // Saldo końcowe wybranego roku
  const openingBalance = obMap[selectedYear] ?? 0
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0)
  const totalDue = rows.reduce((s, r) => s + r.total_due, 0)
  const finalBalance = openingBalance + totalPaid - totalDue

  // Historia nótek wody — kwartały dla wybranego roku
  const waterEntries = entries.filter(e => e.water_m3 > 0)
  const hasWaterMeter = apartment.has_meter

  // Roczne zestawienie - 3 lata
  interface YearStat { year: number; paid: number; due: number; ob: number; balance: number }
  const yearStats: YearStat[] = []
  for (const y of years) {
    const { data: yEntries } = await admin
      .from('settlement_entries').select('*')
      .eq('apartment_id', apartment.id).eq('year', y)
    const yRows = buildYearlyTable(apartment, rates, (yEntries ?? []) as SettlementEntry[], y)
    const yPaid = yRows.reduce((s, r) => s + r.paid, 0)
    const yDue = yRows.reduce((s, r) => s + r.total_due, 0)
    const yOb = obMap[y] ?? 0
    yearStats.push({ year: y, paid: yPaid, due: yDue, ob: yOb, balance: yOb + yPaid - yDue })
  }

  // Noty wody dla wybranego roku (linki)
  const { data: waterReconRows } = await admin
    .from('settlement_entries').select('month, water_m3, water_correction')
    .eq('apartment_id', apartment.id).eq('year', selectedYear)
    .gt('water_m3', 0).order('month')

  const currentMonth = new Date().getMonth() + 1

  // Max water for chart scale
  const maxWater = Math.max(...(waterReconRows ?? []).map(r => r.water_m3), 1)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#f0fdfa]">💳 Moje konto</h2>
          <p className="text-sm text-[#0f766e] mt-0.5">
            Lokal {apartment.number} · {apartment.owner_name} · {community?.name}
          </p>
        </div>
        <div className="flex gap-1">
          {[currentYear - 1, currentYear, currentYear + 1].map(y => (
            <Link key={y} href={`/admin/settlements/moje-konto?year=${y}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${y === selectedYear ? 'bg-teal-600 text-white border-transparent' : 'border-[#0f2d2a] text-[#0f766e] hover:text-[#99f6e4]'}`}
            >{y}</Link>
          ))}
        </div>
      </div>

      {/* Karta saldo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`rounded-2xl p-4 border ${finalBalance >= 0 ? 'bg-teal-950/30 border-teal-800/50' : 'bg-red-950/30 border-red-900/50'}`}>
          <p className="text-xs text-[#115e59] mb-1">Saldo {selectedYear}</p>
          <p className={`text-xl font-bold ${finalBalance >= 0 ? 'text-teal-400' : 'text-red-400'}`}>{pln(finalBalance)}</p>
          <p className={`text-xs mt-0.5 ${finalBalance >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
            {finalBalance >= 0 ? '✓ Nadpłata' : '⚠ Niedopłata'}
          </p>
        </div>
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-2xl p-4">
          <p className="text-xs text-[#115e59] mb-1">Saldo otwarcia</p>
          <p className={`text-xl font-bold ${openingBalance >= 0 ? 'text-[#99f6e4]' : 'text-red-400'}`}>
            {openingBalance >= 0 ? '+' : ''}{pln(openingBalance)}
          </p>
          <p className="text-xs text-[#115e59] mt-0.5">z poprzedniego roku</p>
        </div>
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-2xl p-4">
          <p className="text-xs text-[#115e59] mb-1">Naliczono {selectedYear}</p>
          <p className="text-xl font-bold text-[#f0fdfa]">{pln(totalDue)}</p>
          <p className="text-xs text-[#115e59] mt-0.5">łącznie</p>
        </div>
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-2xl p-4">
          <p className="text-xs text-[#115e59] mb-1">Wpłacono {selectedYear}</p>
          <p className="text-xl font-bold text-teal-400">{pln(totalPaid)}</p>
          <p className="text-xs text-[#115e59] mt-0.5">łącznie</p>
        </div>
      </div>

      {/* Historia lat */}
      <div className="bg-[#081918] border border-[#0f2d2a] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#0f2d2a]">
          <h3 className="text-sm font-semibold text-[#ccfbf1]">📅 Historia sald — ostatnie lata</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#0f2d2a] bg-[#051210]">
              <th className="px-4 py-2 text-left text-[#0f766e] uppercase text-xs tracking-wide">Rok</th>
              <th className="px-4 py-2 text-right text-[#0f766e] uppercase text-xs tracking-wide">Saldo otwarcia</th>
              <th className="px-4 py-2 text-right text-[#0f766e] uppercase text-xs tracking-wide">Naliczono</th>
              <th className="px-4 py-2 text-right text-[#0f766e] uppercase text-xs tracking-wide">Wpłacono</th>
              <th className="px-4 py-2 text-right text-[#0f766e] uppercase text-xs tracking-wide">Saldo końcowe</th>
            </tr>
          </thead>
          <tbody>
            {yearStats.map(ys => (
              <tr key={ys.year} className={`border-b border-[#0f2d2a]/50 hover:bg-[#0c2220]/30 ${ys.year === selectedYear ? 'bg-teal-950/20' : ''}`}>
                <td className="px-4 py-2.5 font-semibold text-[#99f6e4]">
                  <Link href={`/admin/settlements/moje-konto?year=${ys.year}`} className="hover:underline">
                    {ys.year} {ys.year === currentYear && <Badge color="yellow">bieżący</Badge>}
                  </Link>
                </td>
                <td className={`px-4 py-2.5 text-right ${ys.ob >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                  {ys.ob >= 0 ? '+' : ''}{pln(ys.ob)}
                </td>
                <td className="px-4 py-2.5 text-right text-[#ccfbf1]">{pln(ys.due)}</td>
                <td className="px-4 py-2.5 text-right text-teal-400">{pln(ys.paid)}</td>
                <td className={`px-4 py-2.5 text-right font-bold ${ys.balance >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                  {ys.balance >= 0 ? '+' : ''}{pln(ys.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Historia wpłat miesięczna */}
      <div className="bg-[#081918] border border-[#0f2d2a] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#0f2d2a] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#ccfbf1]">💰 Historia wpłat — {selectedYear}</h3>
          <Link href={`/admin/settlements/${apartment.id}`} className="text-xs text-teal-500 hover:underline">
            Pełne rozliczenie →
          </Link>
        </div>

        {/* Wykres słupkowy — paid vs due */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex gap-2 items-end h-16">
            {rows.map((row) => {
              const maxVal = Math.max(...rows.map(r => Math.max(r.total_due, r.paid)), 1)
              const dueH = Math.max(2, Math.round((row.total_due / maxVal) * 60))
              const paidH = Math.max(row.paid > 0 ? 2 : 0, Math.round((row.paid / maxVal) * 60))
              const isCurrent = row.month === currentMonth && selectedYear === currentYear
              return (
                <div key={row.month} className="flex-1 flex flex-col items-center gap-0.5" title={`${MONTHS_LONG[row.month-1]}: naliczono ${pln(row.total_due)}, wpłacono ${pln(row.paid)}`}>
                  <div className="w-full flex items-end justify-center gap-px h-16 relative">
                    {/* Due bar */}
                    {row.hasRates && (
                      <div style={{ height: `${dueH}px` }}
                        className={`flex-1 rounded-t-sm ${isCurrent ? 'bg-yellow-600/60' : 'bg-[#0c3330]'}`} />
                    )}
                    {/* Paid bar */}
                    {row.paid > 0 && (
                      <div style={{ height: `${paidH}px` }}
                        className={`flex-1 rounded-t-sm ${row.paid >= row.total_due ? 'bg-teal-500/80' : 'bg-teal-700/50'}`} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between text-[10px] text-[#115e59] mt-1 px-0.5">
            {MONTHS.map(m => <span key={m}>{m}</span>)}
          </div>
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1 text-xs text-[#0f766e]"><span className="w-2.5 h-2.5 rounded-sm bg-[#0c3330] inline-block" /> Naliczone</span>
            <span className="flex items-center gap-1 text-xs text-[#0f766e]"><span className="w-2.5 h-2.5 rounded-sm bg-teal-500/80 inline-block" /> Wpłacone</span>
          </div>
        </div>

        {/* Tabela miesięczna */}
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-xs min-w-[480px]">
            <thead>
              <tr className="border-t border-[#0f2d2a] bg-[#051210]">
                <th className="px-3 py-2 text-left text-[#0f766e] uppercase tracking-wide">Miesiąc</th>
                <th className="px-3 py-2 text-right text-[#0f766e] uppercase tracking-wide">Naliczono</th>
                <th className="px-3 py-2 text-right text-[#0f766e] uppercase tracking-wide">Wpłacono</th>
                <th className="px-3 py-2 text-right text-[#0f766e] uppercase tracking-wide">Woda m³</th>
                <th className="px-3 py-2 text-right text-[#0f766e] uppercase tracking-wide">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.month} className={`border-b border-[#0f2d2a]/40 ${row.month === currentMonth && selectedYear === currentYear ? 'bg-teal-950/20' : 'hover:bg-[#0c2220]/20'}`}>
                  <td className="px-3 py-2 text-[#99f6e4] font-medium whitespace-nowrap">
                    {MONTHS_LONG[row.month - 1]}
                    {row.month === currentMonth && selectedYear === currentYear && (
                      <span className="ml-1.5 text-[10px] bg-yellow-900/40 text-yellow-400 border border-yellow-800/40 rounded-full px-1.5 py-0.5">bieżący</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-[#ccfbf1]">
                    {row.hasRates ? pln(row.total_due) : <span className="text-[#115e59]">—</span>}
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${row.paid > 0 ? 'text-teal-400' : 'text-[#115e59]'}`}>
                    {row.paid > 0 ? pln(row.paid) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-[#ccfbf1]">
                    {row.entry?.water_m3 ? (
                      <span className="text-blue-400">{row.entry.water_m3.toFixed(2)} m³</span>
                    ) : '—'}
                  </td>
                  <td className={`px-3 py-2 text-right font-semibold ${row.balance_end >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                    {pln(row.balance_end)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-[#0f2d2a] bg-[#051210]">
                <td className="px-3 py-2 font-bold text-[#99f6e4]">RAZEM</td>
                <td className="px-3 py-2 text-right font-bold text-[#f0fdfa]">{pln(totalDue)}</td>
                <td className="px-3 py-2 text-right font-bold text-teal-400">{pln(totalPaid)}</td>
                <td className="px-3 py-2 text-right text-[#ccfbf1]">
                  {waterEntries.reduce((s, e) => s + e.water_m3, 0).toFixed(2)} m³
                </td>
                <td className={`px-3 py-2 text-right font-bold ${finalBalance >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                  {pln(finalBalance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Wykres zużycia wody */}
      {hasWaterMeter && (waterReconRows ?? []).length > 0 && (
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#ccfbf1]">🚿 Zużycie wody — {selectedYear}</h3>
            <span className="text-xs text-[#0f766e]">Licznik indywidualny</span>
          </div>

          {/* Bar chart */}
          <div className="flex gap-2 items-end h-24">
            {MONTHS.map((mLabel, idx) => {
              const m = idx + 1
              const wr = (waterReconRows ?? []).find(r => r.month === m)
              const val = wr?.water_m3 ?? 0
              const h = val > 0 ? Math.max(4, Math.round((val / maxWater) * 90)) : 0
              return (
                <div key={m} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center h-24">
                    {h > 0 ? (
                      <div
                        style={{ height: `${h}px` }}
                        title={`${MONTHS_LONG[idx]}: ${val.toFixed(2)} m³`}
                        className="w-full rounded-t-sm bg-blue-600/70 hover:bg-blue-500/80 transition"
                      />
                    ) : (
                      <div className="w-full" style={{ height: '2px' }} />
                    )}
                  </div>
                  <span className="text-[10px] text-[#115e59]">{mLabel}</span>
                </div>
              )
            })}
          </div>

          {/* Values */}
          <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
            {(waterReconRows ?? []).map(r => (
              <div key={r.month} className="bg-[#051210] rounded-lg p-2 text-center">
                <p className="text-[10px] text-[#115e59]">{MONTHS[r.month - 1]}</p>
                <p className="text-sm font-bold text-blue-400">{r.water_m3.toFixed(1)}</p>
                <p className="text-[10px] text-[#115e59]">m³</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-[#115e59] mt-3">
            Łączne zużycie {selectedYear}: <strong className="text-blue-400">
              {(waterReconRows ?? []).reduce((s, r) => s + r.water_m3, 0).toFixed(2)} m³
            </strong>
          </p>
        </div>
      )}

      {/* Noty wody — linki */}
      {hasWaterMeter && (
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[#ccfbf1] mb-3">📄 Noty rozliczeniowe wody</h3>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map(q => {
              const qYear = selectedYear
              const href = `/admin/settlements/${apartment.id}/nota-wody/${qYear}/${q}`
              return (
                <Link key={q} href={href} target="_blank"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-[#051210] border border-[#0f2d2a] rounded-lg text-xs font-medium text-[#99f6e4] hover:border-teal-700/50 hover:text-[#f0fdfa] transition">
                  🖨 Q{q} {qYear}
                </Link>
              )
            })}
          </div>
          <p className="text-xs text-[#115e59] mt-3">Noty drukujesz bezpośrednio z przeglądarki (Ctrl+P).</p>
        </div>
      )}

      {/* Numer konta */}
      {community?.bank_account && (
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[#ccfbf1] mb-2">🏦 Konto bankowe wspólnoty</h3>
          <p className="text-sm font-mono text-[#99f6e4] tracking-wide">{community.bank_account}</p>
          <p className="text-xs text-[#0f766e] mt-1">
            W tytule przelewu podaj: lokal {apartment.number} — {selectedYear}
          </p>
        </div>
      )}
    </div>
  )
}

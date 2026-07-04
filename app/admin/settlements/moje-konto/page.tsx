import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import {
  buildYearlyTable, pln,
  type SettlementApartment, type SettlementRate, type SettlementEntry,
} from '@/lib/settlementCalc'
import Link from 'next/link'

const MONTHS      = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru']
const MONTHS_LONG = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień']

/** Skrócony format kwoty bez groszy (dla osi Y wykresu) */
function plnShort(v: number): string {
  const abs = Math.abs(Math.round(v))
  const sign = v < 0 ? '-' : ''
  if (abs >= 10000) return `${sign}${Math.round(abs / 100) / 10} tys.`
  return `${sign}${abs.toLocaleString('pl-PL')} zł`
}

function Badge({ children, color }: { children: React.ReactNode; color: 'teal' | 'red' | 'yellow' }) {
  const cls = {
    teal:   'bg-teal-900/40 text-teal-400 border border-teal-800/40',
    red:    'bg-red-900/40 text-red-400 border border-red-800/40',
    yellow: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800/40',
  }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls[color]}`}>{children}</span>
}

/** SVG wykres liniowy salda — renderowany server-side */
function SaldoLineChart({ data }: { data: { label: string; value: number; tooltip: string }[] }) {
  if (data.length < 2) return null

  const W = 800, H = 160
  const PL = 70, PR = 16, PT = 20, PB = 28
  const iW = W - PL - PR
  const iH = H - PT - PB

  const vals = data.map(d => d.value)
  const rawMin = Math.min(...vals)
  const rawMax = Math.max(...vals)
  // zawsze pokaż 0 na osi; dodaj 10% marginesu
  const margin = (rawMax - rawMin) * 0.12 || 50
  const minV = Math.min(rawMin - margin, -margin * 0.5)
  const maxV = Math.max(rawMax + margin,  margin * 0.5)
  const range = maxV - minV

  const py = (v: number) => PT + iH - ((v - minV) / range) * iH
  const px = (i: number) => PL + (i / (data.length - 1)) * iW

  const zeroY = py(0)

  // Ścieżka linii
  const lineD = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${py(d.value).toFixed(1)}`).join(' ')

  // Ścieżka wypełnienia (do zera)
  const lastX = px(data.length - 1).toFixed(1)
  const firstX = px(0).toFixed(1)
  const zeroYf = zeroY.toFixed(1)
  const areaD = `${lineD} L${lastX} ${zeroYf} L${firstX} ${zeroYf}Z`

  // Etykiety osi Y — 3 wartości
  const yLabelValues = [rawMin, 0, rawMax].filter((v, i, arr) => {
    // usuń duplikaty i wartości zbyt blisko 0 (< 5% range)
    return arr.indexOf(v) === i && Math.abs(v) > Math.abs(rawMax - rawMin) * 0.05
  })
  const yLabels = [
    { v: maxV, text: plnShort(rawMax), y: PT + 4 },
    { v: 0,    text: '0 zł',          y: zeroY + 4 },
    ...(rawMin < -Math.abs(rawMax - rawMin) * 0.05
      ? [{ v: minV, text: plnShort(rawMin), y: PT + iH + 4 }]
      : []
    ),
  ]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 160 }}
      aria-label="Wykres salda — ostatnie 12 miesięcy"
    >
      <defs>
        <linearGradient id="sgFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#14b8a6" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="sgFillNeg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#f87171" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#f87171" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Linia siatki zerowej */}
      <line
        x1={PL} y1={zeroY.toFixed(1)}
        x2={W - PR} y2={zeroY.toFixed(1)}
        stroke="#0f2d2a" strokeDasharray="4 3" strokeWidth="1"
      />

      {/* Poziome linie siatki (górna i dolna) */}
      <line x1={PL} y1={PT}       x2={W - PR} y2={PT}       stroke="#0a1f1d" strokeWidth="0.5" />
      <line x1={PL} y1={PT + iH}  x2={W - PR} y2={PT + iH}  stroke="#0a1f1d" strokeWidth="0.5" />

      {/* Obszar wypełnienia */}
      <path d={areaD} fill={rawMax >= 0 ? 'url(#sgFill)' : 'url(#sgFillNeg)'} />

      {/* Linia główna */}
      <path
        d={lineD}
        fill="none"
        stroke="#14b8a6"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Punkty danych */}
      {data.map((d, i) => (
        <circle
          key={i}
          cx={px(i).toFixed(1)}
          cy={py(d.value).toFixed(1)}
          r="3.5"
          fill={d.value >= 0 ? '#14b8a6' : '#f87171'}
          stroke="#081918"
          strokeWidth="1.5"
        >
          <title>{d.tooltip}</title>
        </circle>
      ))}

      {/* Etykiety osi X */}
      {data.map((d, i) => (
        <text
          key={i}
          x={px(i).toFixed(1)}
          y={H - 5}
          textAnchor="middle"
          fontSize="10"
          fill="#4d7c78"
        >
          {d.label}
        </text>
      ))}

      {/* Etykiety osi Y */}
      {yLabels.map((l, i) => (
        <text
          key={i}
          x={PL - 5}
          y={l.y}
          textAnchor="end"
          fontSize="10"
          fill="#4d7c78"
        >
          {l.text}
        </text>
      ))}
    </svg>
  )
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
  const currentMonth = new Date().getMonth() + 1
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

  // ── Pobieranie danych równolegle ────────────────────────────────────────────
  const chartPrevYear = currentYear - 1

  const [ratesRes, entriesRes, communityRes, openingBalancesRes, chartPrevEntriesRes] = await Promise.all([
    admin.from('settlement_rates').select('*')
      .eq('community_id', apartment.community_id)
      .order('effective_from', { ascending: false }),
    admin.from('settlement_entries').select('*')
      .eq('apartment_id', apartment.id).eq('year', selectedYear),
    admin.from('communities').select('name, address, bank_account').eq('id', apartment.community_id).single(),
    admin.from('settlement_opening_balances').select('year, balance')
      .eq('apartment_id', apartment.id)
      .in('year', [currentYear - 2, currentYear - 1, currentYear]),
    admin.from('settlement_entries').select('*')
      .eq('apartment_id', apartment.id).eq('year', chartPrevYear),
  ])

  const rates    = (ratesRes.data    ?? []) as SettlementRate[]
  const entries  = (entriesRes.data  ?? []) as SettlementEntry[]
  const community = communityRes.data

  // mapa sald otwarcia
  const obMap: Record<number, number> = {}
  for (const ob of openingBalancesRes.data ?? []) obMap[ob.year] = Number(ob.balance)

  // wiersze dla wybranego roku (tabela)
  const rows = buildYearlyTable(apartment, rates, entries, selectedYear)

  // Podsumowanie wybranego roku
  const openingBalance = obMap[selectedYear] ?? 0
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0)
  const totalDue  = rows.reduce((s, r) => s + r.total_due, 0)
  const finalBalance = openingBalance + totalPaid - totalDue

  // ── Wykres salda — ostatnie 12 miesięcy ────────────────────────────────────
  // Wyznacz 12 miesięcy od currentMonth-11 do currentMonth
  const chartMonthDefs: { year: number; month: number; label: string }[] = []
  for (let i = 11; i >= 0; i--) {
    let m = currentMonth - i
    let y = currentYear
    if (m <= 0) { m += 12; y = currentYear - 1 }
    chartMonthDefs.push({ year: y, month: m, label: MONTHS[m - 1] })
  }

  // Wiersze z prawdziwym saldem otwarcia (dla wykresu)
  const chartPrevEntries = (chartPrevEntriesRes.data ?? []) as SettlementEntry[]
  // Dla currentYear: jeśli selectedYear === currentYear, reużyj; w p.p. pobierz
  let chartCurrEntries: SettlementEntry[] = []
  if (selectedYear === currentYear) {
    chartCurrEntries = entries
  } else {
    const { data: cce } = await admin.from('settlement_entries').select('*')
      .eq('apartment_id', apartment.id).eq('year', currentYear)
    chartCurrEntries = (cce ?? []) as SettlementEntry[]
  }

  const chartPrevRows = buildYearlyTable(apartment, rates, chartPrevEntries, chartPrevYear, obMap[chartPrevYear] ?? 0)
  const chartCurrRows = buildYearlyTable(apartment, rates, chartCurrEntries, currentYear,   obMap[currentYear]  ?? 0)

  const chartData = chartMonthDefs.map(({ year, month, label }) => {
    const yearRows = year === currentYear ? chartCurrRows : chartPrevRows
    const row = yearRows.find(r => r.month === month)
    const value = row ? row.balance_end : (obMap[year] ?? 0)
    return { label, value, tooltip: `${MONTHS_LONG[month - 1]} ${year}: ${pln(value)}` }
  })

  // ── Historia lat — 3 lata (stat table) ────────────────────────────────────
  const statYears = [currentYear - 2, currentYear - 1, currentYear]
  const statEntriesResults = await Promise.all(
    statYears.map(y =>
      admin.from('settlement_entries').select('*').eq('apartment_id', apartment.id).eq('year', y)
    )
  )

  interface YearStat { year: number; paid: number; due: number; ob: number; balance: number }
  const yearStats: YearStat[] = statYears.map((y, i) => {
    const yEntries = (statEntriesResults[i].data ?? []) as SettlementEntry[]
    const yRows = buildYearlyTable(apartment, rates, yEntries, y)
    const yPaid = yRows.reduce((s, r) => s + r.paid, 0)
    const yDue  = yRows.reduce((s, r) => s + r.total_due, 0)
    const yOb   = obMap[y] ?? 0
    return { year: y, paid: yPaid, due: yDue, ob: yOb, balance: yOb + yPaid - yDue }
  })

  // Noty wody dla wybranego roku
  const { data: waterReconRows } = await admin
    .from('settlement_entries').select('month, water_m3, water_correction')
    .eq('apartment_id', apartment.id).eq('year', selectedYear)
    .gt('water_m3', 0).order('month')

  const waterEntries = entries.filter(e => e.water_m3 > 0)
  const hasWaterMeter = apartment.has_meter
  const maxWater = Math.max(...(waterReconRows ?? []).map(r => r.water_m3), 1)

  return (
    <div className="space-y-6 max-w-4xl">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#f0fdfa]">💳 Moje konto</h2>
          <p className="text-sm text-[#0f766e] mt-0.5">
            Lokal {apartment.number} · {apartment.owner_name} · {community?.name}
          </p>
        </div>
      </div>

      {/* ── Karty KPI ──────────────────────────────────────────────────── */}
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

      {/* ── Wykres salda — ostatnie 12 miesięcy ───────────────────────── */}
      <div className="bg-[#081918] border border-[#0f2d2a] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-[#ccfbf1]">📈 Saldo — ostatnie 12 miesięcy</h3>
          <div className="flex gap-3 text-xs text-[#0f766e]">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-teal-500 rounded" />
              Nadpłata
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-[#f87171]" />
              Niedopłata
            </span>
          </div>
        </div>
        <SaldoLineChart data={chartData} />
        <p className="text-xs text-[#115e59] mt-2">
          Aktualne saldo:{' '}
          <strong className={chartData[chartData.length - 1]?.value >= 0 ? 'text-teal-400' : 'text-red-400'}>
            {pln(chartData[chartData.length - 1]?.value ?? 0)}
          </strong>
          {' '}· Najedź na punkt, aby zobaczyć wartość miesiąca.
        </p>
      </div>

      {/* ── Historia sald — ostatnie lata ─────────────────────────────── */}
      <div className="bg-[#081918] border border-[#0f2d2a] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#0f2d2a]">
          <h3 className="text-sm font-semibold text-[#ccfbf1]">📅 Historia sald — ostatnie lata</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#0f2d2a] bg-[#051210]">
              <th className="px-4 py-2 text-left   text-[#0f766e] uppercase text-xs tracking-wide">Rok</th>
              <th className="px-4 py-2 text-right  text-[#0f766e] uppercase text-xs tracking-wide">Saldo otwarcia</th>
              <th className="px-4 py-2 text-right  text-[#0f766e] uppercase text-xs tracking-wide">Naliczono</th>
              <th className="px-4 py-2 text-right  text-[#0f766e] uppercase text-xs tracking-wide">Wpłacono</th>
              <th className="px-4 py-2 text-right  text-[#0f766e] uppercase text-xs tracking-wide">Saldo końcowe</th>
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

      {/* ── Historia wpłat miesięczna ──────────────────────────────────── */}
      <div className="bg-[#081918] border border-[#0f2d2a] rounded-2xl overflow-hidden">

        {/* Nagłówek z selektorem roku i przyciskiem PDF */}
        <div className="px-5 py-3 border-b border-[#0f2d2a]">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-sm font-semibold text-[#ccfbf1]">💰 Historia wpłat</h3>
            {/* Selektor roku */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#115e59]">Rok:</span>
              <div className="flex gap-1">
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <Link
                    key={y}
                    href={`/admin/settlements/moje-konto?year=${y}`}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition border ${
                      y === selectedYear
                        ? 'bg-teal-600 text-white border-transparent'
                        : 'border-[#0f2d2a] text-[#0f766e] hover:text-[#99f6e4] hover:border-teal-800/50'
                    }`}
                  >
                    {y}
                  </Link>
                ))}
              </div>
              {/* Przycisk pobierz PDF */}
              <Link
                href={`/admin/settlements/${apartment.id}/print?year=${selectedYear}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#051210] border border-[#0f2d2a] rounded-lg text-xs font-medium text-[#99f6e4] hover:border-teal-700/50 hover:text-white hover:bg-teal-900/30 transition"
                title={`Pobierz wyciąg PDF za ${selectedYear}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
                Wyciąg PDF {selectedYear}
              </Link>
            </div>
          </div>
        </div>

        {/* Wykres słupkowy — paid vs due */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex gap-2 items-end h-16">
            {rows.map((row) => {
              const maxVal = Math.max(...rows.map(r => Math.max(r.total_due, r.paid)), 1)
              const dueH  = Math.max(2, Math.round((row.total_due / maxVal) * 60))
              const paidH = Math.max(row.paid > 0 ? 2 : 0, Math.round((row.paid / maxVal) * 60))
              const isCurrent = row.month === currentMonth && selectedYear === currentYear
              return (
                <div key={row.month} className="flex-1 flex flex-col items-center gap-0.5"
                  title={`${MONTHS_LONG[row.month-1]}: naliczono ${pln(row.total_due)}, wpłacono ${pln(row.paid)}`}>
                  <div className="w-full flex items-end justify-center gap-px h-16 relative">
                    {row.hasRates && (
                      <div style={{ height: `${dueH}px` }}
                        className={`flex-1 rounded-t-sm ${isCurrent ? 'bg-yellow-600/60' : 'bg-[#0c3330]'}`} />
                    )}
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
                <th className="px-3 py-2 text-left  text-[#0f766e] uppercase tracking-wide">Miesiąc</th>
                <th className="px-3 py-2 text-right text-[#0f766e] uppercase tracking-wide">Naliczono</th>
                <th className="px-3 py-2 text-right text-[#0f766e] uppercase tracking-wide">Wpłacono</th>
                <th className="px-3 py-2 text-right text-[#0f766e] uppercase tracking-wide">Woda</th>
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
                    {row.hasRates && row.water > 0 ? (
                      <span className="text-blue-400">
                        {pln(row.water)}
                        {(row.entry?.water_m3 ?? 0) > 0 && (
                          <span className="block text-[10px] text-blue-600">{row.entry!.water_m3.toFixed(2)} m³</span>
                        )}
                      </span>
                    ) : <span className="text-[#115e59]">—</span>}
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
                <td className="px-3 py-2 text-right text-blue-400 font-bold">
                  {pln(rows.reduce((s, r) => s + r.water, 0))}
                  {waterEntries.reduce((s, e) => s + e.water_m3, 0) > 0 && (
                    <span className="block text-[10px] text-blue-600 font-normal">
                      {waterEntries.reduce((s, e) => s + e.water_m3, 0).toFixed(2)} m³
                    </span>
                  )}
                </td>
                <td className={`px-3 py-2 text-right font-bold ${finalBalance >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                  {pln(finalBalance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Stopka z linkiem do pełnego rozliczenia */}
        <div className="px-5 py-3 border-t border-[#0f2d2a]/50 flex items-center justify-between">
          <p className="text-xs text-[#115e59]">
            Pobierz wyciąg za wybrany rok jako PDF — otwórz i użyj Ctrl+P.
          </p>
          <Link href={`/admin/settlements/${apartment.id}`} className="text-xs text-teal-500 hover:underline">
            Pełne rozliczenie →
          </Link>
        </div>
      </div>

      {/* ── Wykres wody ──────────────────────────────────────────────────── */}
      {(() => {
        const waterRows = rows.filter(r => r.hasRates && r.water > 0)
        if (waterRows.length === 0) return null
        const hasMeterData = hasWaterMeter && (waterReconRows ?? []).length > 0
        const maxWaterPln = Math.max(...waterRows.map(r => r.water), 1)
        return (
          <div className="bg-[#081918] border border-[#0f2d2a] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#ccfbf1]">🚿 Opłaty za wodę — {selectedYear}</h3>
              <span className="text-xs text-[#0f766e]">
                {hasMeterData ? 'Licznik indywidualny' : 'Ryczałt'}
              </span>
            </div>

            <div className="flex gap-2 items-end h-24">
              {MONTHS.map((mLabel, idx) => {
                const m = idx + 1
                const row = rows.find(r => r.month === m)
                if (hasMeterData) {
                  const wr = (waterReconRows ?? []).find(r => r.month === m)
                  const val = wr?.water_m3 ?? 0
                  const h = val > 0 ? Math.max(4, Math.round((val / maxWater) * 90)) : 0
                  return (
                    <div key={m} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center h-24">
                        {h > 0
                          ? <div style={{ height: `${h}px` }} title={`${MONTHS_LONG[idx]}: ${val.toFixed(2)} m³`} className="w-full rounded-t-sm bg-blue-600/70 hover:bg-blue-500/80 transition" />
                          : <div className="w-full" style={{ height: '2px' }} />}
                      </div>
                      <span className="text-[10px] text-[#115e59]">{mLabel}</span>
                    </div>
                  )
                } else {
                  const val = row?.water ?? 0
                  const h = val > 0 ? Math.max(4, Math.round((val / maxWaterPln) * 90)) : 0
                  return (
                    <div key={m} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center h-24">
                        {h > 0
                          ? <div style={{ height: `${h}px` }} title={`${MONTHS_LONG[idx]}: ${pln(val)}`} className="w-full rounded-t-sm bg-blue-600/70 hover:bg-blue-500/80 transition" />
                          : <div className="w-full" style={{ height: '2px' }} />}
                      </div>
                      <span className="text-[10px] text-[#115e59]">{mLabel}</span>
                    </div>
                  )
                }
              })}
            </div>

            {hasMeterData ? (
              <>
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
                  Łączne zużycie {selectedYear}:{' '}
                  <strong className="text-blue-400">
                    {(waterReconRows ?? []).reduce((s, r) => s + r.water_m3, 0).toFixed(2)} m³
                  </strong>
                </p>
              </>
            ) : (
              <p className="text-xs text-[#115e59] mt-3">
                Łączne opłaty za wodę {selectedYear}:{' '}
                <strong className="text-blue-400">
                  {pln(waterRows.reduce((s, r) => s + r.water, 0))}
                </strong>
                {' · '}rozliczenie ryczałtowe (bez licznika indywidualnego)
              </p>
            )}
          </div>
        )
      })()}

      {/* ── Noty wody ────────────────────────────────────────────────────── */}
      {hasWaterMeter && (
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[#ccfbf1] mb-3">📄 Noty rozliczeniowe wody</h3>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map(q => (
              <Link
                key={q}
                href={`/admin/settlements/${apartment.id}/nota-wody/${selectedYear}/${q}`}
                target="_blank"
                className="inline-flex items-center gap-2 px-3 py-2 bg-[#051210] border border-[#0f2d2a] rounded-lg text-xs font-medium text-[#99f6e4] hover:border-teal-700/50 hover:text-[#f0fdfa] transition"
              >
                🖨 Q{q} {selectedYear}
              </Link>
            ))}
          </div>
          <p className="text-xs text-[#115e59] mt-3">Noty drukujesz bezpośrednio z przeglądarki (Ctrl+P).</p>
        </div>
      )}

      {/* ── Konto bankowe ────────────────────────────────────────────────── */}
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

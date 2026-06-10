'use client'

import { useState, useRef } from 'react'
import { exportToExcel, exportMultiSheet } from '@/lib/exportExcel'

// ── Types ────────────────────────────────────────────────────────────────────

interface Apartment {
  id: string; number: string; owner_name: string; area_m2: number
  persons_count: number; has_meter: boolean; community_id: string; active: boolean
}
interface Rate {
  id: string; community_id: string; effective_from: string
  water_price_m3: number; water_ryczalt_m3: number; garbage_per_person: number
  renovation_rate_m2: number; operating_rate_m2: number
  manager_fee_type: 'per_m2' | 'fixed'; manager_fee_value: number
  water_billing_type: 'ryczalt' | 'meter'
}
interface Entry {
  apartment_id: string; community_id: string; year: number; month: number
  paid: number; water_m3: number; water_correction: number; notes: string | null
}
interface Expense {
  community_id: string; category: string; description: string
  amount: number; expense_date: string; year: number; month: number
  invoice_number?: string | null
}
interface CommunityIncome {
  community_id: string; category: string; description: string
  amount: number; income_date: string; year: number; month: number
}
interface Props {
  communities: { id: string; name: string }[]
  apartments: Apartment[]
  rates: Rate[]
  entries: Entry[]
  expenses: Expense[]
  communityIncome: CommunityIncome[]
  isSuperAdmin: boolean
  defaultCommunityId: string
  currentYear: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const pln = (v: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(v)
const MONTHS_FULL = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień']
const MONTHS_SHORT = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru']
const EXP_CAT_LABELS: Record<string, string> = {
  zarząd:'Zarządzanie', woda:'Woda/kanalizacja', śmieci:'Odpady/śmieci',
  remonty:'Remonty/naprawy', ubezpieczenie:'Ubezpieczenie',
  energia:'Energia/gaz', fundusz_remontowy:'Fundusz remontowy', inne:'Inne',
}

function getActiveRate(rates: Rate[], communityId: string, year: number, month: number): Rate | null {
  const date = `${year}-${String(month).padStart(2,'0')}-01`
  return rates
    .filter(r => r.community_id === communityId && r.effective_from <= date)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0] ?? null
}

function calcMonthlyCharge(apt: Apartment, rate: Rate): number {
  const water = rate.water_billing_type === 'ryczalt'
    ? rate.water_ryczalt_m3 * rate.water_price_m3
    : 0
  const garbage = rate.garbage_per_person * apt.persons_count
  const renovation = rate.renovation_rate_m2 * apt.area_m2
  const operating = rate.operating_rate_m2 * apt.area_m2
  const manager = rate.manager_fee_type === 'per_m2'
    ? rate.manager_fee_value * apt.area_m2
    : rate.manager_fee_value
  return water + garbage + renovation + operating + manager
}

// ── Report types ───────────────────────────────────────────────────────────────

type ReportType = 'sprawozdanie' | 'rozliczenie' | 'zadluzenia' | 'plan' | 'remontowy' | 'faktury'

const REPORTS: { type: ReportType; icon: string; title: string; subtitle: string; art: string }[] = [
  { type: 'sprawozdanie', icon: '📋', title: 'Roczne sprawozdanie finansowe', subtitle: 'Wpłaty, koszty, saldo — gotowe na zebranie roczne', art: 'Art. 29 UoWL' },
  { type: 'rozliczenie', icon: '🏠', title: 'Rozliczenie zaliczek per lokal', subtitle: 'Ile wpłacił każdy właściciel vs naliczone zaliczki', art: 'Art. 29 UoWL + orzecznictwo SA' },
  { type: 'zadluzenia', icon: '⚠️', title: 'Lista zadłużeń', subtitle: 'Lokale z zaległościami — podstawa windykacji', art: 'Art. 16 UoWL' },
  { type: 'plan', icon: '📊', title: 'Plan gospodarczy vs wykonanie', subtitle: 'Budżet vs faktyczne wydatki per kategoria', art: 'Art. 22 ust. 3 pkt 1 UoWL' },
  { type: 'remontowy', icon: '🔨', title: 'Fundusz remontowy', subtitle: 'Naliczenia vs wydatki na remonty — saldo skumulowane', art: 'Art. 29 ust. 1a UoWL' },
  { type: 'faktury', icon: '🧾', title: 'Rejestr faktur / Szczegółowy rejestr kosztów', subtitle: 'Każda faktura z datą, wystawcą i kwotą — rozbicie na miesiące', art: 'Art. 29 UoWL' },
]

// ── Main component ─────────────────────────────────────────────────────────────

export default function RaportyClient({
  communities, apartments, rates, entries, expenses, communityIncome,
  isSuperAdmin, defaultCommunityId, currentYear,
}: Props) {
  const [filterComm, setFilterComm] = useState(defaultCommunityId || communities[0]?.id || '')
  const [filterYear, setFilterYear] = useState(currentYear)
  const [activeReport, setActiveReport] = useState<ReportType | null>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  // ── Filtered data ────────────────────────────────────────────────────────
  const commApts = apartments.filter(a => a.community_id === filterComm)
  const commEntries = entries.filter(e => e.community_id === filterComm && e.year === filterYear)
  const commExpenses = expenses.filter(e => e.community_id === filterComm && e.year === filterYear)
  const commIncome = communityIncome.filter(i => i.community_id === filterComm && i.year === filterYear)
  const commName = communities.find(c => c.id === filterComm)?.name ?? '—'

  // ── Monthly aggregates ───────────────────────────────────────────────────
  const monthlyPaid: Record<number, number> = {}
  const monthlyExpenses: Record<number, number> = {}
  const monthlyOtherIncome: Record<number, number> = {}
  for (let m = 1; m <= 12; m++) {
    monthlyPaid[m] = commEntries.filter(e => e.month === m).reduce((s, e) => s + (e.paid ?? 0), 0)
    monthlyExpenses[m] = commExpenses.filter(e => e.month === m).reduce((s, e) => s + e.amount, 0)
    monthlyOtherIncome[m] = commIncome.filter(i => i.month === m).reduce((s, i) => s + i.amount, 0)
  }
  const totalPaid = Object.values(monthlyPaid).reduce((s, v) => s + v, 0)
  const totalExpenses = Object.values(monthlyExpenses).reduce((s, v) => s + v, 0)
  const totalOtherIncome = Object.values(monthlyOtherIncome).reduce((s, v) => s + v, 0)
  const totalIncome = totalPaid + totalOtherIncome
  const totalBalance = totalIncome - totalExpenses

  // ── Per-apartment reconciliation ─────────────────────────────────────────
  const aptReconciliation = commApts.map(apt => {
    const aptEntries = commEntries.filter(e => e.apartment_id === apt.id)
    const paid = aptEntries.reduce((s, e) => s + (e.paid ?? 0), 0)
    let charged = 0
    for (let m = 1; m <= 12; m++) {
      const rate = getActiveRate(rates, filterComm, filterYear, m)
      if (rate) charged += calcMonthlyCharge(apt, rate)
    }
    return { apt, paid, charged, balance: paid - charged, months: aptEntries.length }
  }).sort((a, b) => a.balance - b.balance)

  const totalCharged = aptReconciliation.reduce((s, r) => s + r.charged, 0)
  const totalAptPaid = aptReconciliation.reduce((s, r) => s + r.paid, 0)

  // ── Debt list ────────────────────────────────────────────────────────────
  const debtors = aptReconciliation.filter(r => r.balance < -0.01).sort((a, b) => a.balance - b.balance)
  const totalDebt = debtors.reduce((s, r) => s + Math.abs(r.balance), 0)

  // ── Plan vs execution ────────────────────────────────────────────────────
  const totalArea = commApts.reduce((s, a) => s + a.area_m2, 0)
  const totalPersons = commApts.reduce((s, a) => s + a.persons_count, 0)
  const latestRate = rates.filter(r => r.community_id === filterComm).sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]
  const planByCategory: Record<string, number> = {}
  if (latestRate) {
    planByCategory['woda'] = latestRate.water_ryczalt_m3 * latestRate.water_price_m3 * commApts.length * 12
    planByCategory['śmieci'] = latestRate.garbage_per_person * totalPersons * 12
    planByCategory['fundusz_remontowy'] = latestRate.renovation_rate_m2 * totalArea * 12
    planByCategory['zarząd'] = latestRate.manager_fee_type === 'per_m2'
      ? latestRate.manager_fee_value * totalArea * 12
      : latestRate.manager_fee_value * 12
    planByCategory['inne'] = latestRate.operating_rate_m2 * totalArea * 12
  }
  const executionByCategory: Record<string, number> = {}
  for (const e of commExpenses) {
    executionByCategory[e.category] = (executionByCategory[e.category] ?? 0) + e.amount
  }

  // ── Renovation fund ──────────────────────────────────────────────────────
  const allYears = [...new Set([...entries.filter(e => e.community_id === filterComm).map(e => e.year), ...expenses.filter(e => e.community_id === filterComm).map(e => e.year)])].sort()
  const renovFundRows = allYears.map(year => {
    const yearApts = apartments.filter(a => a.community_id === filterComm)
    let naliczenia = 0
    for (let m = 1; m <= 12; m++) {
      const rate = getActiveRate(rates, filterComm, year, m)
      if (rate) {
        for (const apt of yearApts) {
          naliczenia += rate.renovation_rate_m2 * apt.area_m2
        }
      }
    }
    const wydatki = expenses.filter(e => e.community_id === filterComm && e.year === year && e.category === 'fundusz_remontowy').reduce((s, e) => s + e.amount, 0)
    return { year, naliczenia, wydatki, saldo: naliczenia - wydatki }
  })
  let cumulative = 0
  const renovFundCumulative = renovFundRows.map(r => { cumulative += r.saldo; return { ...r, cumulative } })

  // ── Print / export ───────────────────────────────────────────────────────
  const handlePrint = () => {
    window.print()
  }

  const handleExportExcel = () => {
    if (!activeReport) return
    const fname = `${activeReport}_${commName}_${filterYear}`.replace(/\s/g, '_')

    if (activeReport === 'sprawozdanie') {
      const rows = Array.from({ length: 12 }, (_, i) => i + 1).map(m => ({
        'Miesiąc': MONTHS_FULL[m - 1],
        'Wpłaty mieszkańców': monthlyPaid[m] ?? 0,
        'Inne przychody': monthlyOtherIncome[m] ?? 0,
        'Koszty': monthlyExpenses[m] ?? 0,
        'Saldo': (monthlyPaid[m] + monthlyOtherIncome[m]) - monthlyExpenses[m],
      }))
      exportToExcel(rows, fname, 'Sprawozdanie')
    } else if (activeReport === 'rozliczenie') {
      const rows = aptReconciliation.map(r => ({
        'Lokal': r.apt.number,
        'Właściciel': r.apt.owner_name,
        'Powierzchnia (m²)': r.apt.area_m2,
        'Naliczone (zł)': Math.round(r.charged * 100) / 100,
        'Wpłacone (zł)': Math.round(r.paid * 100) / 100,
        'Saldo (zł)': Math.round(r.balance * 100) / 100,
        'Status': r.balance >= -0.01 ? 'OK' : 'Zaległość',
      }))
      exportToExcel(rows, fname, 'Rozliczenie')
    } else if (activeReport === 'zadluzenia') {
      const rows = debtors.map(r => ({
        'Lokal': r.apt.number,
        'Właściciel': r.apt.owner_name,
        'Zaległość (zł)': Math.round(Math.abs(r.balance) * 100) / 100,
        'Wpłacone': Math.round(r.paid * 100) / 100,
        'Naliczone': Math.round(r.charged * 100) / 100,
      }))
      exportToExcel(rows, fname, 'Zadłużenia')
    } else if (activeReport === 'plan') {
      const allCats = [...new Set([...Object.keys(planByCategory), ...Object.keys(executionByCategory)])]
      const rows = allCats.map(cat => ({
        'Kategoria': EXP_CAT_LABELS[cat] ?? cat,
        'Plan (zł)': Math.round((planByCategory[cat] ?? 0) * 100) / 100,
        'Wykonanie (zł)': Math.round((executionByCategory[cat] ?? 0) * 100) / 100,
        'Różnica (zł)': Math.round(((executionByCategory[cat] ?? 0) - (planByCategory[cat] ?? 0)) * 100) / 100,
      }))
      exportToExcel(rows, fname, 'Plan vs Wykonanie')
    } else if (activeReport === 'remontowy') {
      const rows = renovFundCumulative.map(r => ({
        'Rok': r.year,
        'Naliczenia (zł)': Math.round(r.naliczenia * 100) / 100,
        'Wydatki (zł)': Math.round(r.wydatki * 100) / 100,
        'Saldo roczne (zł)': Math.round(r.saldo * 100) / 100,
        'Saldo skumulowane (zł)': Math.round(r.cumulative * 100) / 100,
      }))
      exportToExcel(rows, fname, 'Fundusz remontowy')
    } else if (activeReport === 'faktury') {
      const rows = commExpenses.map(e => ({
        'Data': e.expense_date,
        'Opis': e.description,
        'Kategoria': EXP_CAT_LABELS[e.category] ?? e.category,
        'Kwota (zł)': e.amount,
        'Nr faktury': e.invoice_number ?? '',
      }))
      exportToExcel(rows, fname, 'Faktury')
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">📊 Raporty finansowe</h2>
          <p className="text-sm text-gray-500 mt-0.5">Dokumentacja zgodna z UoWL i KC</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {isSuperAdmin && (
            <select className="input text-sm" value={filterComm} onChange={e => setFilterComm(e.target.value)}>
              {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <select className="input text-sm" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
            {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Report picker */}
      {!activeReport && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {REPORTS.map(r => (
            <button
              key={r.type}
              onClick={() => setActiveReport(r.type)}
              className="text-left bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-5 transition group"
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl">{r.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-gray-100 group-hover:text-white">{r.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.subtitle}</p>
                  <span className="inline-block mt-2 text-xs bg-blue-950/50 text-blue-400 px-2 py-0.5 rounded-full">{r.art}</span>
                </div>
                <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Active report */}
      {activeReport && (
        <div>
          {/* Back + print */}
          <div className="flex items-center gap-3 mb-5 print:hidden">
            <button onClick={() => setActiveReport(null)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-100 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Wróć do listy raportów
            </button>
            <div className="flex-1" />
            <button onClick={handleExportExcel} className="flex items-center gap-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-lg transition">
              📊 Eksport Excel
            </button>
            <button onClick={handlePrint} className="flex items-center gap-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-lg transition">
              🖨️ Drukuj / zapisz PDF
            </button>
          </div>

          <div ref={reportRef} className="print-area">

            {/* ── 1. SPRAWOZDANIE FINANSOWE ── */}
            {activeReport === 'sprawozdanie' && (
              <div className="space-y-6">
                <ReportHeader
                  title="Roczne sprawozdanie finansowe"
                  subtitle={`Wspólnota Mieszkaniowa ${commName} · rok ${filterYear}`}
                  art="Art. 29 ust. 1 Ustawy o własności lokali z dnia 24 czerwca 1994 r."
                />

                {/* KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <KpiCard label="Łączne przychody" value={pln(totalIncome)} color="green" note={`w tym wpłaty: ${pln(totalPaid)}, inne: ${pln(totalOtherIncome)}`} />
                  <KpiCard label="Łączne koszty zarządu" value={pln(totalExpenses)} color="red" />
                  <KpiCard label="Saldo roku" value={pln(totalBalance)} color={totalBalance >= 0 ? 'green' : 'red'} note={totalBalance >= 0 ? 'Nadwyżka' : 'Niedobór'} />
                </div>

                {/* Tabela miesięczna */}
                <ReportSection title="Zestawienie miesięczne">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-2 pr-4 text-gray-400 font-medium">Miesiąc</th>
                          <th className="text-right py-2 px-3 text-gray-400 font-medium">Wpłaty</th>
                          <th className="text-right py-2 px-3 text-gray-400 font-medium">Inne przychody</th>
                          <th className="text-right py-2 px-3 text-gray-400 font-medium">Koszty</th>
                          <th className="text-right py-2 pl-3 text-gray-400 font-medium">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                          const inc = monthlyPaid[m] + monthlyOtherIncome[m]
                          const exp = monthlyExpenses[m]
                          const bal = inc - exp
                          const hasData = inc > 0 || exp > 0
                          return (
                            <tr key={m} className={`border-b border-gray-800/50 ${!hasData ? 'opacity-40' : ''}`}>
                              <td className="py-2 pr-4 text-gray-300">{MONTHS_FULL[m - 1]}</td>
                              <td className="text-right py-2 px-3 text-gray-200">{monthlyPaid[m] > 0 ? pln(monthlyPaid[m]) : '—'}</td>
                              <td className="text-right py-2 px-3 text-gray-200">{monthlyOtherIncome[m] > 0 ? pln(monthlyOtherIncome[m]) : '—'}</td>
                              <td className="text-right py-2 px-3 text-gray-200">{exp > 0 ? pln(exp) : '—'}</td>
                              <td className={`text-right py-2 pl-3 font-medium ${bal >= 0 ? 'text-green-400' : 'text-red-400'}`}>{hasData ? pln(bal) : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-600">
                          <td className="py-3 pr-4 font-bold text-gray-100">RAZEM</td>
                          <td className="text-right py-3 px-3 font-bold text-blue-400">{pln(totalPaid)}</td>
                          <td className="text-right py-3 px-3 font-bold text-yellow-400">{pln(totalOtherIncome)}</td>
                          <td className="text-right py-3 px-3 font-bold text-red-400">{pln(totalExpenses)}</td>
                          <td className={`text-right py-3 pl-3 font-bold ${totalBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{pln(totalBalance)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </ReportSection>

                {/* Koszty wg kategorii */}
                <ReportSection title="Koszty według kategorii">
                  {(() => {
                    const byCat: Record<string, number> = {}
                    for (const e of commExpenses) byCat[e.category] = (byCat[e.category] ?? 0) + e.amount
                    const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1])
                    if (sorted.length === 0) return <p className="text-gray-500 text-sm">Brak kosztów w tym roku.</p>
                    return (
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-gray-700"><th className="text-left py-2 text-gray-400 font-medium">Kategoria</th><th className="text-right py-2 text-gray-400 font-medium">Kwota</th><th className="text-right py-2 text-gray-400 font-medium">%</th></tr></thead>
                        <tbody>
                          {sorted.map(([cat, amt]) => (
                            <tr key={cat} className="border-b border-gray-800/50">
                              <td className="py-2 text-gray-300">{EXP_CAT_LABELS[cat] ?? cat}</td>
                              <td className="text-right py-2 text-gray-200">{pln(amt)}</td>
                              <td className="text-right py-2 text-gray-400">{totalExpenses > 0 ? Math.round(amt / totalExpenses * 100) : 0}%</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot><tr className="border-t border-gray-600"><td className="py-2 font-bold text-gray-100">Razem</td><td className="text-right py-2 font-bold text-red-400">{pln(totalExpenses)}</td><td /></tr></tfoot>
                      </table>
                    )
                  })()}
                </ReportSection>

                <LegalFooter text="Sprawozdanie sporządzone na podstawie art. 29 ust. 1 ustawy z dnia 24 czerwca 1994 r. o własności lokali (t.j. Dz.U. 2021 poz. 1048). Zarząd prowadzi ewidencję pozaksięgową kosztów zarządu nieruchomością wspólną oraz zaliczek uiszczanych na pokrycie tych kosztów." />
              </div>
            )}

            {/* ── 2. ROZLICZENIE PER LOKAL ── */}
            {activeReport === 'rozliczenie' && (
              <div className="space-y-6">
                <ReportHeader
                  title="Rozliczenie zaliczek — zestawienie lokali"
                  subtitle={`Wspólnota Mieszkaniowa ${commName} · rok ${filterYear}`}
                  art="Art. 29 ust. 1 UoWL · SA Warszawa I ACa 1/19"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <KpiCard label="Suma naliczonych zaliczek" value={pln(totalCharged)} color="blue" />
                  <KpiCard label="Suma wpłat" value={pln(totalAptPaid)} color="green" />
                  <KpiCard label={totalAptPaid - totalCharged >= 0 ? 'Łączna nadpłata' : 'Łączne zaległości'} value={pln(Math.abs(totalAptPaid - totalCharged))} color={totalAptPaid - totalCharged >= 0 ? 'green' : 'red'} />
                </div>

                <ReportSection title={`Rozliczenie per lokal (${commApts.length} lokali)`}>
                  {aptReconciliation.length === 0
                    ? <p className="text-gray-500 text-sm">Brak danych dla wybranej wspólnoty i roku.</p>
                    : <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-700">
                            <th className="text-left py-2 pr-3 text-gray-400 font-medium">Lokal</th>
                            <th className="text-left py-2 pr-3 text-gray-400 font-medium">Właściciel</th>
                            <th className="text-right py-2 px-2 text-gray-400 font-medium">m²</th>
                            <th className="text-right py-2 px-2 text-gray-400 font-medium">Naliczono</th>
                            <th className="text-right py-2 px-2 text-gray-400 font-medium">Wpłacono</th>
                            <th className="text-right py-2 pl-2 text-gray-400 font-medium">Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aptReconciliation.map(({ apt, paid, charged, balance }) => (
                            <tr key={apt.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                              <td className="py-2 pr-3 font-mono text-gray-200">{apt.number}</td>
                              <td className="py-2 pr-3 text-gray-300 truncate max-w-[160px]">{apt.owner_name}</td>
                              <td className="text-right py-2 px-2 text-gray-400">{apt.area_m2}</td>
                              <td className="text-right py-2 px-2 text-gray-300">{charged > 0 ? pln(charged) : '—'}</td>
                              <td className="text-right py-2 px-2 text-gray-300">{paid > 0 ? pln(paid) : '—'}</td>
                              <td className={`text-right py-2 pl-2 font-semibold ${balance > 0.01 ? 'text-green-400' : balance < -0.01 ? 'text-red-400' : 'text-gray-500'}`}>
                                {balance > 0.01 ? '+' : ''}{pln(balance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-gray-600">
                            <td colSpan={3} className="py-3 font-bold text-gray-100">RAZEM</td>
                            <td className="text-right py-3 font-bold text-blue-400">{pln(totalCharged)}</td>
                            <td className="text-right py-3 font-bold text-green-400">{pln(totalAptPaid)}</td>
                            <td className={`text-right py-3 font-bold ${totalAptPaid - totalCharged >= 0 ? 'text-green-400' : 'text-red-400'}`}>{pln(totalAptPaid - totalCharged)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>}
                </ReportSection>

                <LegalFooter text="Każdy właściciel lokalu ma prawo do uzyskania indywidualnego rozliczenia wpłaconych zaliczek (SA w Warszawie, sygn. I ACa 1/19). Zarząd obowiązany jest udostępnić rozliczenie na żądanie właściciela." />
              </div>
            )}

            {/* ── 3. ZADŁUŻENIA ── */}
            {activeReport === 'zadluzenia' && (
              <div className="space-y-6">
                <ReportHeader
                  title="Lista zadłużeń"
                  subtitle={`Wspólnota Mieszkaniowa ${commName} · stan na rok ${filterYear}`}
                  art="Art. 16 UoWL — podstawa przymusowej sprzedaży lokalu"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <KpiCard label="Lokale z zaległościami" value={String(debtors.length)} color="red" note={`z ${commApts.length} łącznie`} />
                  <KpiCard label="Łączna kwota zaległości" value={pln(totalDebt)} color="red" />
                  <KpiCard label="Lokale bez zaległości" value={String(commApts.length - debtors.length)} color="green" />
                </div>

                {debtors.length === 0
                  ? <div className="text-center py-12 bg-green-950/20 border border-green-900 rounded-xl"><p className="text-3xl mb-3">✅</p><p className="text-green-400 font-semibold">Brak zaległości w {filterYear} roku.</p></div>
                  : <ReportSection title={`Lokale z zaległościami (${debtors.length})`}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-700">
                            <th className="text-left py-2 pr-3 text-gray-400 font-medium">Lokal</th>
                            <th className="text-left py-2 pr-3 text-gray-400 font-medium">Właściciel</th>
                            <th className="text-right py-2 px-2 text-gray-400 font-medium">Naliczono</th>
                            <th className="text-right py-2 px-2 text-gray-400 font-medium">Wpłacono</th>
                            <th className="text-right py-2 pl-2 text-gray-400 font-medium">Zaległość</th>
                          </tr>
                        </thead>
                        <tbody>
                          {debtors.map(({ apt, paid, charged, balance }) => (
                            <tr key={apt.id} className="border-b border-gray-800/50">
                              <td className="py-2 pr-3 font-mono text-gray-200">{apt.number}</td>
                              <td className="py-2 pr-3 text-gray-300">{apt.owner_name}</td>
                              <td className="text-right py-2 px-2 text-gray-300">{pln(charged)}</td>
                              <td className="text-right py-2 px-2 text-gray-300">{pln(paid)}</td>
                              <td className="text-right py-2 pl-2 font-bold text-red-400">{pln(Math.abs(balance))}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-gray-600">
                            <td colSpan={4} className="py-3 font-bold text-gray-100">Łącznie zaległości</td>
                            <td className="text-right py-3 font-bold text-red-400">{pln(totalDebt)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </ReportSection>}

                <LegalFooter text="Właściciel lokalu, który zalega długotrwale z opłatami, może być zobowiązany do sprzedaży lokalu w drodze licytacji (art. 16 UoWL). Raport stanowi dokumentację do podjęcia uchwały o wezwaniu do zapłaty lub skierowania sprawy na drogę sądową." />
              </div>
            )}

            {/* ── 4. PLAN VS WYKONANIE ── */}
            {activeReport === 'plan' && (
              <div className="space-y-6">
                <ReportHeader
                  title="Plan gospodarczy vs wykonanie"
                  subtitle={`Wspólnota Mieszkaniowa ${commName} · rok ${filterYear}`}
                  art="Art. 22 ust. 3 pkt 1 UoWL — plan gospodarczy uchwalany przez zebranie właścicieli"
                />

                {!latestRate
                  ? <div className="text-center py-12 text-gray-500"><p className="text-3xl mb-3">⚙️</p><p>Brak zdefiniowanych stawek dla tej wspólnoty.</p></div>
                  : <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <KpiCard label="Plan roczny" value={pln(Object.values(planByCategory).reduce((s, v) => s + v, 0))} color="blue" note={`stawki z ${latestRate.effective_from}`} />
                      <KpiCard label="Wykonanie" value={pln(totalExpenses)} color="red" />
                      <KpiCard label="Odchylenie" value={pln(totalExpenses - Object.values(planByCategory).reduce((s, v) => s + v, 0))} color={totalExpenses <= Object.values(planByCategory).reduce((s, v) => s + v, 0) ? 'green' : 'red'} note={totalExpenses <= Object.values(planByCategory).reduce((s, v) => s + v, 0) ? 'W planie' : 'Przekroczenie'} />
                    </div>

                    <ReportSection title="Porównanie per kategoria">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-gray-700">
                          <th className="text-left py-2 pr-4 text-gray-400 font-medium">Kategoria</th>
                          <th className="text-right py-2 px-3 text-gray-400 font-medium">Plan</th>
                          <th className="text-right py-2 px-3 text-gray-400 font-medium">Wykonanie</th>
                          <th className="text-right py-2 pl-3 text-gray-400 font-medium">Różnica</th>
                        </tr></thead>
                        <tbody>
                          {Object.keys({ ...planByCategory, ...executionByCategory }).sort().map(cat => {
                            const plan = planByCategory[cat] ?? 0
                            const exec = executionByCategory[cat] ?? 0
                            const diff = exec - plan
                            return (
                              <tr key={cat} className="border-b border-gray-800/50">
                                <td className="py-2 pr-4 text-gray-300">{EXP_CAT_LABELS[cat] ?? cat}</td>
                                <td className="text-right py-2 px-3 text-gray-300">{plan > 0 ? pln(plan) : '—'}</td>
                                <td className="text-right py-2 px-3 text-gray-300">{exec > 0 ? pln(exec) : '—'}</td>
                                <td className={`text-right py-2 pl-3 font-medium ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-green-400' : 'text-gray-500'}`}>
                                  {plan > 0 || exec > 0 ? (diff > 0 ? '+' : '') + pln(diff) : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </ReportSection>
                  </>}

                <LegalFooter text="Plan gospodarczy uchwalany jest przez zebranie właścicieli (art. 22 ust. 3 pkt 1 UoWL). Zarząd zobowiązany jest do realizacji planu i informowania właścicieli o istotnych odchyleniach." />
              </div>
            )}

            {/* ── 5. FUNDUSZ REMONTOWY ── */}
            {activeReport === 'remontowy' && (
              <div className="space-y-6">
                <ReportHeader
                  title="Fundusz remontowy — ewidencja"
                  subtitle={`Wspólnota Mieszkaniowa ${commName}`}
                  art="Art. 29 ust. 1a UoWL — obowiązkowa ewidencja funduszu remontowego"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <KpiCard label="Łączne naliczenia" value={pln(renovFundCumulative.reduce((s, r) => s + r.naliczenia, 0))} color="blue" />
                  <KpiCard label="Łączne wydatki na remonty" value={pln(renovFundCumulative.reduce((s, r) => s + r.wydatki, 0))} color="red" />
                  <KpiCard label="Saldo skumulowane" value={pln(renovFundCumulative[renovFundCumulative.length - 1]?.cumulative ?? 0)} color={renovFundCumulative[renovFundCumulative.length - 1]?.cumulative >= 0 ? 'green' : 'red'} />
                </div>

                <ReportSection title="Historia funduszu remontowego">
                  {renovFundCumulative.length === 0
                    ? <p className="text-gray-500 text-sm">Brak danych.</p>
                    : <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-700">
                        <th className="text-left py-2 pr-4 text-gray-400 font-medium">Rok</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Naliczenia</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Wydatki na remonty</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Saldo roku</th>
                        <th className="text-right py-2 pl-3 text-gray-400 font-medium">Saldo skum.</th>
                      </tr></thead>
                      <tbody>
                        {renovFundCumulative.map(r => (
                          <tr key={r.year} className={`border-b border-gray-800/50 ${r.year === filterYear ? 'bg-blue-950/10' : ''}`}>
                            <td className="py-2 pr-4 text-gray-300 font-medium">{r.year}{r.year === filterYear && <span className="ml-2 text-xs text-blue-400">(bieżący)</span>}</td>
                            <td className="text-right py-2 px-3 text-gray-300">{pln(r.naliczenia)}</td>
                            <td className="text-right py-2 px-3 text-gray-300">{r.wydatki > 0 ? pln(r.wydatki) : '—'}</td>
                            <td className={`text-right py-2 px-3 font-medium ${r.saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>{pln(r.saldo)}</td>
                            <td className={`text-right py-2 pl-3 font-bold ${r.cumulative >= 0 ? 'text-green-400' : 'text-red-400'}`}>{pln(r.cumulative)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>}
                </ReportSection>

                <LegalFooter text="Zarząd prowadzi ewidencję funduszu remontowego zgodnie z art. 29 ust. 1a UoWL. Środki funduszu są własnością wspólnoty i nie podlegają podziałowi między właścicieli (uchwała SN z 21.12.2007, III CZP 65/07)." />
              </div>
            )}

            {/* ── 6. REJESTR FAKTUR ── */}
            {activeReport === 'faktury' && (
              <div className="space-y-6">
                <ReportHeader
                  title="Szczegółowy rejestr kosztów"
                  subtitle={`Wspólnota Mieszkaniowa ${commName} · rok ${filterYear}`}
                  art="Art. 29 ust. 1 UoWL — ewidencja pozaksięgowa kosztów zarządu"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <KpiCard label="Łączne koszty" value={pln(totalExpenses)} color="red" />
                  <KpiCard label="Liczba faktur / wpisów" value={String(commExpenses.length)} color="blue" />
                  <KpiCard label="Liczba kategorii" value={String(new Set(commExpenses.map(e => e.category)).size)} color="blue" />
                </div>

                {(() => {
                  // group by month
                  const months: number[] = []
                  for (let m = 1; m <= 12; m++) {
                    if (commExpenses.some(e => e.month === m)) months.push(m)
                  }
                  if (months.length === 0) return (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                      <p className="text-gray-500 text-sm">Brak kosztów w roku {filterYear}.</p>
                    </div>
                  )
                  let grandTotal = 0
                  return (
                    <div className="space-y-4">
                      {months.map(m => {
                        const rows = commExpenses
                          .filter(e => e.month === m)
                          .sort((a, b) => a.expense_date.localeCompare(b.expense_date))
                        const monthTotal = rows.reduce((s, e) => s + e.amount, 0)
                        grandTotal += monthTotal
                        return (
                          <ReportSection key={m} title={`${MONTHS_FULL[m - 1]} ${filterYear}`}>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-700">
                                    <th className="text-left py-2 pr-3 text-gray-400 font-medium w-24">Data</th>
                                    <th className="text-left py-2 pr-3 text-gray-400 font-medium">Od kogo / opis</th>
                                    <th className="text-left py-2 pr-3 text-gray-400 font-medium w-32">Kategoria</th>
                                    <th className="text-left py-2 pr-3 text-gray-400 font-medium w-28">Nr faktury</th>
                                    <th className="text-right py-2 text-gray-400 font-medium w-28">Kwota</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((e, i) => (
                                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                                      <td className="py-2 pr-3 text-gray-400 text-xs">{e.expense_date}</td>
                                      <td className="py-2 pr-3 text-gray-200">{e.description}</td>
                                      <td className="py-2 pr-3 text-gray-400 text-xs">{EXP_CAT_LABELS[e.category] ?? e.category}</td>
                                      <td className="py-2 pr-3 text-gray-400 text-xs font-mono">{e.invoice_number ?? '—'}</td>
                                      <td className="text-right py-2 text-gray-200 font-medium">{pln(e.amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t border-gray-600">
                                    <td colSpan={4} className="py-2 pr-3 text-sm font-semibold text-gray-300">Razem {MONTHS_SHORT[m - 1]}</td>
                                    <td className="text-right py-2 font-bold text-red-400">{pln(monthTotal)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </ReportSection>
                        )
                      })}

                      {/* Grand total */}
                      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 flex items-center justify-between">
                        <span className="font-bold text-gray-100 text-sm">SUMA ROCZNA {filterYear}</span>
                        <span className="font-bold text-red-400 text-lg">{pln(grandTotal)}</span>
                      </div>
                    </div>
                  )
                })()}

                <LegalFooter text="Rejestr faktur prowadzony zgodnie z art. 29 ust. 1 ustawy o własności lokali. Zarząd zobowiązany jest do przechowywania dokumentacji przez okres wynikający z przepisów prawa podatkowego i rachunkowego." />
              </div>
            )}

          </div>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          .print-area { color: black !important; }
          .print-area * { color: black !important; border-color: #ccc !important; background: white !important; }
          .print-area table { border-collapse: collapse; width: 100%; }
          .print-area th, .print-area td { border: 1px solid #ddd; padding: 6px 8px; }
          .print-area th { background: #f5f5f5 !important; }
        }
      `}</style>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ReportHeader({ title, subtitle, art }: { title: string; subtitle: string; art: string }) {
  return (
    <div className="border-b border-gray-700 pb-4">
      <p className="text-xs text-blue-400 font-medium mb-1">{art}</p>
      <h3 className="text-xl font-bold text-gray-100">{title}</h3>
      <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
      <p className="text-xs text-gray-600 mt-2">Wygenerowano: {new Date().toLocaleDateString('pl-PL')}</p>
    </div>
  )
}

function KpiCard({ label, value, color, note }: { label: string; value: string; color: 'green' | 'red' | 'blue'; note?: string }) {
  const colors = { green: 'text-green-400', red: 'text-red-400', blue: 'text-blue-400' }
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${colors[color]}`}>{value}</p>
      {note && <p className="text-xs text-gray-500 mt-0.5">{note}</p>}
    </div>
  )
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h4 className="text-sm font-semibold text-gray-400 mb-4">{title}</h4>
      {children}
    </div>
  )
}

function LegalFooter({ text }: { text: string }) {
  return (
    <div className="border-t border-gray-800 pt-4">
      <p className="text-xs text-gray-600 leading-relaxed">⚖️ <em>{text}</em></p>
    </div>
  )
}

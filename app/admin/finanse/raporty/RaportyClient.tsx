'use client'
import BackButton from '@/components/BackButton'

import { useState, useRef } from 'react'
import { exportToExcel, exportMultiSheet } from '@/lib/exportExcel'
import { NON_INCOME_CATEGORIES } from '../przychody/income-categories'

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
  invoice_number?: string | null; is_renovation_fund?: boolean | null
}
interface CommunityIncome {
  community_id: string; category: string; description: string
  amount: number; income_date: string; year: number; month: number
}
interface Deposit {
  community_id: string; type: 'lokata' | 'konto_oszczednosciowe'
  bank_name: string | null; description: string | null
  amount: number; interest_rate: number | null
  start_date: string; end_date: string | null; status: 'active' | 'closed'
}
interface Props {
  communities: { id: string; name: string }[]
  apartments: Apartment[]
  rates: Rate[]
  entries: Entry[]
  expenses: Expense[]
  communityIncome: CommunityIncome[]
  deposits: Deposit[]
  isSuperAdmin: boolean
  defaultCommunityId: string
  currentYear: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const pln = (v: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(v)
const MONTHS_FULL = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień']
const MONTHS_SHORT = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru']
const EXP_CAT_LABELS: Record<string, string> = {
  fundusz_remontowy:      'Fundusz remontowy',
  fundusz_eksploatacyjny: 'Fundusz eksploatacyjny',
  wynagrodzenie_zarządcy: 'Wynagrodzenie zarządcy',
  koszty_administracji:   'Koszty administracji',
  woda:                   'Woda / kanalizacja',
  śmieci:                 'Odpady / śmieci',
  sprzątanie:             'Sprzątanie',
  opłaty_bankowe:         'Opłaty bankowe',
  przeglądy_budynków:     'Przeglądy budynków',
  remonty:                'Remonty / naprawy',
  ubezpieczenie:          'Ubezpieczenie',
  energia:                'Energia / gaz',
  zarząd:                 'Zarządzanie (inne)',
  inne:                   'Inne',
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
  communities, apartments, rates, entries, expenses, communityIncome, deposits,
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
  const commDeposits = deposits.filter(d => d.community_id === filterComm)
  const activeDeposits = commDeposits.filter(d => d.status === 'active')
  const totalActiveDeposits = activeDeposits.reduce((s, d) => s + d.amount, 0)
  const commName = communities.find(c => c.id === filterComm)?.name ?? '—'

  // ── Monthly aggregates ───────────────────────────────────────────────────
  const monthlyPaid: Record<number, number> = {}
  const monthlyExpenses: Record<number, number> = {}
  const monthlyOtherIncome: Record<number, number> = {}
  const monthlyDepositTransfers: Record<number, number> = {}
  for (let m = 1; m <= 12; m++) {
    monthlyPaid[m] = commEntries.filter(e => e.month === m).reduce((s, e) => s + (e.paid ?? 0), 0)
    monthlyExpenses[m] = commExpenses.filter(e => e.month === m).reduce((s, e) => s + e.amount, 0)
    // Przelewy na lokaty (kategoria 'lokata') to nie przychód — liczymy osobno
    monthlyOtherIncome[m] = commIncome
      .filter(i => i.month === m && !NON_INCOME_CATEGORIES.includes(i.category as any))
      .reduce((s, i) => s + i.amount, 0)
    monthlyDepositTransfers[m] = commIncome
      .filter(i => i.month === m && i.category === 'lokata')
      .reduce((s, i) => s + i.amount, 0)
  }
  const totalPaid = Object.values(monthlyPaid).reduce((s, v) => s + v, 0)
  const totalExpenses = Object.values(monthlyExpenses).reduce((s, v) => s + v, 0)
  const totalOtherIncome = Object.values(monthlyOtherIncome).reduce((s, v) => s + v, 0)
  const totalDepositTransfers = Object.values(monthlyDepositTransfers).reduce((s, v) => s + v, 0)
  const totalIncome = totalPaid + totalOtherIncome
  const totalBalance = totalIncome - totalExpenses

  // ── Naliczone składniki zaliczek (suma po wszystkich lokalach i miesiącach) ─
  // Dla bieżącego roku liczymy tylko do bieżącego miesiąca włącznie,
  // żeby nie podwajać z przyszłymi miesiącami bez danych.
  const chargeBreakdown = { renovation: 0, operating: 0, manager: 0, water: 0, garbage: 0 }
  const nowDate   = new Date()
  const maxMonth  = filterYear < currentYear ? 12 : nowDate.getMonth() + 1  // bieżący miesiąc włącznie
  for (const apt of commApts) {
    for (let m = 1; m <= maxMonth; m++) {
      const rate = getActiveRate(rates, filterComm, filterYear, m)
      if (!rate) continue
      const water = rate.water_billing_type === 'ryczalt'
        ? rate.water_ryczalt_m3 * rate.water_price_m3
        : 0
      chargeBreakdown.renovation += rate.renovation_rate_m2 * apt.area_m2
      chargeBreakdown.operating  += rate.operating_rate_m2  * apt.area_m2
      chargeBreakdown.manager    += rate.manager_fee_type === 'per_m2'
        ? rate.manager_fee_value * apt.area_m2
        : rate.manager_fee_value
      chargeBreakdown.water   += water
      chargeBreakdown.garbage += rate.garbage_per_person * apt.persons_count
    }
  }
  const totalChargeBD = Object.values(chargeBreakdown).reduce((s, v) => s + v, 0)

  // ── Per-apartment reconciliation ─────────────────────────────────────────
  // Naliczone liczymy tylko do maxMonth (= bieżący miesiąc dla roku bieżącego,
  // = 12 dla lat poprzednich) — żeby nie wyprzedzać faktycznych wpłat.
  const aptReconciliation = commApts.map(apt => {
    const aptEntries = commEntries.filter(e => e.apartment_id === apt.id)
    const paid = aptEntries.reduce((s, e) => s + (e.paid ?? 0), 0)
    let charged = 0
    for (let m = 1; m <= maxMonth; m++) {
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
  // Plan gospodarczy posługuje się WYŁĄCZNIE kategorią "fundusz_eksploatacyjny"
  // (nie sumą wszystkich kategorii kosztowych poza remontowym) — zgodnie z wymogiem:
  // "w planie gospodarczym posługujemy się tylko wpłatami z funduszu eksploatacyjnego".
  // Plan = faktyczne wykonanie roku poprzedniego dla kategorii fundusz_eksploatacyjny
  const prevYearExpenses = expenses.filter(e => e.community_id === filterComm && e.year === filterYear - 1 && e.category === 'fundusz_eksploatacyjny')
  const planByCategory: Record<string, number> = {}
  for (const e of prevYearExpenses) {
    planByCategory[e.category] = (planByCategory[e.category] ?? 0) + e.amount
  }
  const hasPrevYearData = expenses.some(e => e.community_id === filterComm && e.year === filterYear - 1 && e.category === 'fundusz_eksploatacyjny')

  // Wykonanie = kategoria fundusz_eksploatacyjny bieżącego roku do maxMonth włącznie
  const executionByCategory: Record<string, number> = {}
  for (const e of commExpenses.filter(e => e.month <= maxMonth && e.category === 'fundusz_eksploatacyjny')) {
    executionByCategory[e.category] = (executionByCategory[e.category] ?? 0) + e.amount
  }
  const totalExecutionToDate = Object.values(executionByCategory).reduce((s, v) => s + v, 0)

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
    const wydatki = expenses.filter(e => e.community_id === filterComm && e.year === year && (e.is_renovation_fund || e.category === 'fundusz_remontowy')).reduce((s, e) => s + e.amount, 0)
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
      const depositRows = commDeposits.map(d => ({
        'Bank / opis': d.bank_name ?? d.description ?? '—',
        'Typ': d.type === 'lokata' ? 'Lokata' : 'Konto oszczędnościowe',
        'Kwota (zł)': d.amount,
        'Oprocentowanie (%)': d.interest_rate ?? '',
        'Założona': d.start_date,
        'Koniec': d.end_date ?? 'bezterminowa',
        'Status': d.status === 'active' ? 'Aktywna' : 'Zakończona',
      }))
      exportMultiSheet([
        { data: rows, name: 'Sprawozdanie' },
        ...(depositRows.length ? [{ data: depositRows, name: 'Lokaty' }] : []),
      ], fname)
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
      <BackButton />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-[#f0fdfa]">📊 Raporty finansowe</h2>
          <p className="text-sm text-[#115e59] mt-0.5">Dokumentacja zgodna z UoWL i KC</p>
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
              className="text-left bg-[#081918] border border-[#0f2d2a] hover:border-[#133835] rounded-xl p-5 transition group"
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl">{r.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-[#f0fdfa] group-hover:text-white">{r.title}</p>
                  <p className="text-xs text-[#115e59] mt-0.5">{r.subtitle}</p>
                  <span className="inline-block mt-2 text-xs bg-teal-950/50 text-teal-400 px-2 py-0.5 rounded-full">{r.art}</span>
                </div>
                <svg className="w-4 h-4 text-[#115e59] group-hover:text-[#0f766e] mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <button onClick={() => setActiveReport(null)} className="flex items-center gap-2 text-sm text-[#0f766e] hover:text-[#f0fdfa] transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Wróć do listy raportów
            </button>
            <div className="flex-1" />
            <button onClick={handleExportExcel} className="flex items-center gap-2 text-sm bg-[#0c2220] hover:bg-[#0a1f1d] text-[#ccfbf1] px-4 py-2 rounded-lg transition">
              📊 Eksport Excel
            </button>
            <button onClick={handlePrint} className="flex items-center gap-2 text-sm bg-[#0c2220] hover:bg-[#0a1f1d] text-[#ccfbf1] px-4 py-2 rounded-lg transition">
              🖨️ Drukuj / zapisz PDF
            </button>
          </div>

          <div ref={reportRef} className="print-area">
            {/* Nagłówek widoczny tylko w druku */}
            <header className="print-doc-header">
              <div className="print-doc-header-left">
                <h1>Panel Wspólnoty</h1>
                <p>Zarządzanie nieruchomościami wspólnymi</p>
              </div>
              <div className="print-doc-header-right">
                <p><strong>{commName}</strong></p>
                <p>Rok: {filterYear}</p>
                <p>Wygenerowano: {new Date().toLocaleDateString('pl-PL')}</p>
              </div>
            </header>

            {/* ── 1. SPRAWOZDANIE FINANSOWE ── */}
            {activeReport === 'sprawozdanie' && (
              <div className="space-y-6">
                <ReportHeader
                  title="Roczne sprawozdanie finansowe"
                  subtitle={`Wspólnota Mieszkaniowa ${commName} · rok ${filterYear}`}
                  art="Art. 29 ust. 1 Ustawy o własności lokali z dnia 24 czerwca 1994 r."
                />

                {/* KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print-kpi-row">
                  <KpiCard label="Łączne przychody" value={pln(totalIncome)} color="green"
                    note={`wpłaty: ${pln(totalPaid)}, inne: ${pln(totalOtherIncome)}${totalDepositTransfers > 0 ? ` · ⚠ przelew na lokatę ${pln(totalDepositTransfers)} (wyłączony z sumy)` : ''}`}
                    formula="wpłaty mieszkańców (Rozliczenia) + inne przychody (moduł Przychody, bez przelewów na lokaty)" />
                  <KpiCard label="Łączne koszty zarządu" value={pln(totalExpenses)} color="red"
                    formula="suma wszystkich wpisów z modułu Koszty" />
                  <KpiCard label="Saldo roku" value={pln(totalBalance)} color={totalBalance >= 0 ? 'green' : 'red'}
                    note={totalBalance >= 0 ? 'Nadwyżka' : 'Niedobór'}
                    formula="Łączne przychody − Łączne koszty zarządu" />
                </div>

                {/* Nota o przelewach na lokaty */}
                {totalDepositTransfers > 0 && (
                  <div className="p-3 bg-slate-950/40 border border-slate-700/40 rounded-lg text-xs text-slate-400">
                    ℹ️ W module Przychody zaewidencjonowano <strong>{pln(totalDepositTransfers)}</strong> jako „Przelew na lokatę (kapitał)" — kwota ta <strong>nie jest przychodem operacyjnym</strong> i została wyłączona z sumy łącznych przychodów. Odsetki z lokaty (jeśli ujęte jako „Odsetki od lokat") są w przychodach.
                  </div>
                )}

                {/* Naliczone składniki zaliczek */}
                {totalChargeBD > 0 && (
                  <ReportSection title="Naliczone składniki zaliczek (wg stawek)">
                    <p className="text-xs text-[#115e59] mb-3">
                      Suma naliczonych zaliczek per składnik dla wszystkich lokali aktywnych
                      {filterYear < currentYear
                        ? ` za cały rok ${filterYear}.`
                        : ` za styczeń–${['','Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'][maxMonth]} ${filterYear} (miesiące z danymi).`}
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#0f2d2a]">
                            <th className="text-left py-2 pr-4 text-[#0f766e] font-medium">Składnik</th>
                            <th className="text-right py-2 px-3 text-[#0f766e] font-medium">Kwota naliczona</th>
                            <th className="text-right py-2 pl-3 text-[#0f766e] font-medium">% sumy</th>
                          </tr>
                        </thead>
                        <tbody>
                          {([
                            ['Fundusz remontowy',      chargeBreakdown.renovation],
                            ['Fundusz eksploatacyjny', chargeBreakdown.operating],
                            ['Wynagrodzenie zarządcy', chargeBreakdown.manager],
                            ['Woda / kanalizacja',     chargeBreakdown.water],
                            ['Odpady / śmieci',        chargeBreakdown.garbage],
                          ] as [string, number][]).map(([label, amt]) => (
                            <tr key={label} className="border-b border-[#0f2d2a]/50">
                              <td className="py-2 pr-4 text-[#99f6e4]">{label}</td>
                              <td className="text-right py-2 px-3 text-[#ccfbf1]">{pln(Math.round(amt * 100) / 100)}</td>
                              <td className="text-right py-2 pl-3 text-[#0f766e]">
                                {totalChargeBD > 0 ? Math.round(amt / totalChargeBD * 100) : 0}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-[#133835]">
                            <td className="py-3 pr-4 font-bold text-[#f0fdfa]">Razem naliczono</td>
                            <td className="text-right py-3 px-3 font-bold text-teal-400">{pln(Math.round(totalChargeBD * 100) / 100)}</td>
                            <td className="text-right py-3 pl-3 text-[#115e59]">100%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </ReportSection>
                )}

                {/* Tabela miesięczna */}
                <ReportSection title="Zestawienie miesięczne">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#0f2d2a]">
                          <th className="text-left py-2 pr-4 text-[#0f766e] font-medium">Miesiąc</th>
                          <th className="text-right py-2 px-3 text-[#0f766e] font-medium">Wpłaty</th>
                          <th className="text-right py-2 px-3 text-[#0f766e] font-medium">Inne przychody</th>
                          <th className="text-right py-2 px-3 text-[#0f766e] font-medium">Koszty</th>
                          <th className="text-right py-2 pl-3 text-[#0f766e] font-medium">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                          const inc = monthlyPaid[m] + monthlyOtherIncome[m]
                          const exp = monthlyExpenses[m]
                          const bal = inc - exp
                          const hasData = inc > 0 || exp > 0
                          return (
                            <tr key={m} className={`border-b border-[#0f2d2a]/50 ${!hasData ? 'opacity-40' : ''}`}>
                              <td className="py-2 pr-4 text-[#99f6e4]">{MONTHS_FULL[m - 1]}</td>
                              <td className="text-right py-2 px-3 text-[#ccfbf1]">{monthlyPaid[m] > 0 ? pln(monthlyPaid[m]) : '—'}</td>
                              <td className="text-right py-2 px-3 text-[#ccfbf1]">{monthlyOtherIncome[m] > 0 ? pln(monthlyOtherIncome[m]) : '—'}</td>
                              <td className="text-right py-2 px-3 text-[#ccfbf1]">{exp > 0 ? pln(exp) : '—'}</td>
                              <td className={`text-right py-2 pl-3 font-medium ${bal >= 0 ? 'text-teal-400' : 'text-red-400'}`}>{hasData ? pln(bal) : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-[#133835]">
                          <td className="py-3 pr-4 font-bold text-[#f0fdfa]">RAZEM</td>
                          <td className="text-right py-3 px-3 font-bold text-teal-400">{pln(totalPaid)}</td>
                          <td className="text-right py-3 px-3 font-bold text-yellow-400">{pln(totalOtherIncome)}</td>
                          <td className="text-right py-3 px-3 font-bold text-red-400">{pln(totalExpenses)}</td>
                          <td className={`text-right py-3 pl-3 font-bold ${totalBalance >= 0 ? 'text-teal-400' : 'text-red-400'}`}>{pln(totalBalance)}</td>
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
                    if (sorted.length === 0) return <p className="text-[#115e59] text-sm">Brak kosztów w tym roku.</p>
                    return (
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-[#0f2d2a]"><th className="text-left py-2 text-[#0f766e] font-medium">Kategoria</th><th className="text-right py-2 text-[#0f766e] font-medium">Kwota</th><th className="text-right py-2 text-[#0f766e] font-medium">%</th></tr></thead>
                        <tbody>
                          {sorted.map(([cat, amt]) => (
                            <tr key={cat} className="border-b border-[#0f2d2a]/50">
                              <td className="py-2 text-[#99f6e4]">{EXP_CAT_LABELS[cat] ?? cat}</td>
                              <td className="text-right py-2 text-[#ccfbf1]">{pln(amt)}</td>
                              <td className="text-right py-2 text-[#0f766e]">{totalExpenses > 0 ? Math.round(amt / totalExpenses * 100) : 0}%</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot><tr className="border-t border-[#133835]"><td className="py-2 font-bold text-[#f0fdfa]">Razem</td><td className="text-right py-2 font-bold text-red-400">{pln(totalExpenses)}</td><td /></tr></tfoot>
                      </table>
                    )
                  })()}
                </ReportSection>

                {/* Szczegółowy rejestr kosztów — miesiąc po miesiącu */}
                {commExpenses.length > 0 && (
                  <ReportSection title="Szczegółowy rejestr kosztów">
                    {(() => {
                      const months: number[] = []
                      for (let m = 1; m <= 12; m++) {
                        if (commExpenses.some(e => e.month === m)) months.push(m)
                      }
                      // podsumowania kategoryczne
                      const catTotals: Record<string, number> = {}
                      for (const e of commExpenses) {
                        catTotals[e.category] = (catTotals[e.category] ?? 0) + e.amount
                      }
                      return (
                        <div>
                          {months.map(m => {
                            const rows = commExpenses
                              .filter(e => e.month === m)
                              .sort((a, b) => a.expense_date.localeCompare(b.expense_date))
                            const monthTotal = rows.reduce((s, e) => s + e.amount, 0)
                            return (
                              <div key={m} className="mb-4">
                                <p className="text-xs font-semibold text-[#0f766e] uppercase tracking-wide mb-1">{MONTHS_FULL[m - 1]}</p>
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-[#0f2d2a]">
                                      <th className="text-left py-1 pr-3 text-[#0f766e] font-medium w-24">Data</th>
                                      <th className="text-left py-1 pr-3 text-[#0f766e] font-medium">Odbiorca / opis</th>
                                      <th className="text-left py-1 pr-3 text-[#0f766e] font-medium w-36 hidden sm:table-cell">Kategoria</th>
                                      <th className="text-right py-1 text-[#0f766e] font-medium w-28">Kwota</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rows.map((e, i) => (
                                      <tr key={i} className="border-b border-[#0f2d2a]/40">
                                        <td className="py-1.5 pr-3 text-[#0f766e] text-xs">{e.expense_date}</td>
                                        <td className="py-1.5 pr-3 text-[#ccfbf1]">{e.description}</td>
                                        <td className="py-1.5 pr-3 text-[#0f766e] text-xs hidden sm:table-cell">{EXP_CAT_LABELS[e.category] ?? e.category}</td>
                                        <td className="text-right py-1.5 text-[#99f6e4] font-medium">{pln(e.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className="border-t border-[#133835]">
                                      <td colSpan={2} className="py-1.5 font-bold text-[#f0fdfa]">Suma {MONTHS_FULL[m - 1]}</td>
                                      <td className="hidden sm:table-cell" />
                                      <td className="text-right py-1.5 font-bold text-red-400">{pln(monthTotal)}</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            )
                          })}
                          {/* Podsumowanie roczne */}
                          <div className="mt-4 pt-3 border-t border-[#133835]">
                            <p className="text-xs font-semibold text-[#0f766e] uppercase tracking-wide mb-2">Podsumowanie roczne</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 text-sm">
                              <div>
                                {Object.entries(catTotals)
                                  .filter(([, v]) => v > 0)
                                  .sort((a, b) => b[1] - a[1])
                                  .map(([cat, amt]) => (
                                    <div key={cat} className="flex justify-between py-0.5 border-b border-[#0f2d2a]/30">
                                      <span className="text-[#99f6e4]">{EXP_CAT_LABELS[cat] ?? cat}</span>
                                      <span className="text-[#ccfbf1] font-medium ml-4">{pln(amt)}</span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                            <div className="flex justify-between mt-2 pt-1 border-t border-[#133835] font-bold">
                              <span className="text-[#f0fdfa]">Suma końcowa</span>
                              <span className="text-red-400">{pln(totalExpenses)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </ReportSection>
                )}

                {/* ── Oddzielne tabele dla wybranych kategorii ── */}
                {(['śmieci', 'woda', 'koszty_administracji'] as const).map(cat => {
                  const catExp = commExpenses.filter(e => e.category === cat)
                  if (catExp.length === 0) return null
                  const catTotal = catExp.reduce((s, e) => s + e.amount, 0)
                  const months: number[] = []
                  for (let m = 1; m <= 12; m++) {
                    if (catExp.some(e => e.month === m)) months.push(m)
                  }
                  return (
                    <ReportSection key={cat} title={EXP_CAT_LABELS[cat]}>
                      {months.map(m => {
                        const rows = catExp
                          .filter(e => e.month === m)
                          .sort((a, b) => a.expense_date.localeCompare(b.expense_date))
                        const monthTotal = rows.reduce((s, e) => s + e.amount, 0)
                        return (
                          <div key={m} className="mb-4">
                            <p className="text-xs font-semibold text-[#0f766e] uppercase tracking-wide mb-1">{MONTHS_FULL[m - 1]}</p>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-[#0f2d2a]">
                                  <th className="text-left py-1 pr-3 text-[#0f766e] font-medium w-24">Data</th>
                                  <th className="text-left py-1 pr-3 text-[#0f766e] font-medium">Odbiorca / opis</th>
                                  <th className="text-right py-1 text-[#0f766e] font-medium w-28">Kwota</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((e, i) => (
                                  <tr key={i} className="border-b border-[#0f2d2a]/40">
                                    <td className="py-1.5 pr-3 text-[#0f766e] text-xs">{e.expense_date}</td>
                                    <td className="py-1.5 pr-3 text-[#ccfbf1]">{e.description}</td>
                                    <td className="text-right py-1.5 text-[#99f6e4] font-medium">{pln(e.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-[#133835]">
                                  <td colSpan={2} className="py-1.5 font-bold text-[#f0fdfa]">Suma {MONTHS_FULL[m - 1]}</td>
                                  <td className="text-right py-1.5 font-bold text-red-400">{pln(monthTotal)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )
                      })}
                      <div className="flex justify-between mt-2 pt-2 border-t border-[#133835] font-bold text-sm">
                        <span className="text-[#f0fdfa]">Łącznie {EXP_CAT_LABELS[cat]}</span>
                        <span className="text-red-400">{pln(catTotal)}</span>
                      </div>
                    </ReportSection>
                  )
                })}

                {/* Lokaty bankowe */}
                {commDeposits.length > 0 && (
                  <ReportSection title="Lokaty bankowe i konta oszczędnościowe">
                    <p className="text-xs text-[#115e59] mb-3">
                      Kapitał lokat nie jest przychodem wspólnoty — to majątek zainwestowany na rachunku bankowym.
                      Odsetki z zamkniętych lokat są ujęte w pozycji &quot;Inne przychody&quot; powyżej.
                    </p>
                    {activeDeposits.length > 0 && (
                      <div className="mb-3 p-3 bg-teal-950/30 border border-teal-800/40 rounded-lg flex items-center justify-between">
                        <span className="text-sm text-[#99f6e4]">💰 Środki na aktywnych lokatach (poza rachunkiem bieżącym)</span>
                        <span className="font-bold text-teal-400 text-sm">{pln(totalActiveDeposits)}</span>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#0f2d2a]">
                            <th className="text-left py-2 pr-3 text-[#0f766e] font-medium">Bank / opis</th>
                            <th className="text-left py-2 pr-3 text-[#0f766e] font-medium">Typ</th>
                            <th className="text-right py-2 px-2 text-[#0f766e] font-medium">Kwota</th>
                            <th className="text-right py-2 px-2 text-[#0f766e] font-medium">Oprocentowanie</th>
                            <th className="text-right py-2 px-2 text-[#0f766e] font-medium">Założona</th>
                            <th className="text-right py-2 pl-2 text-[#0f766e] font-medium">Koniec / Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {commDeposits.map((d, i) => (
                            <tr key={i} className="border-b border-[#0f2d2a]/50">
                              <td className="py-2 pr-3 text-[#ccfbf1]">{d.bank_name ?? d.description ?? '—'}</td>
                              <td className="py-2 pr-3 text-[#0f766e] text-xs">{d.type === 'lokata' ? 'Lokata' : 'Konto oszczędnościowe'}</td>
                              <td className="text-right py-2 px-2 text-[#99f6e4] font-medium">{pln(d.amount)}</td>
                              <td className="text-right py-2 px-2 text-[#0f766e]">{d.interest_rate != null ? `${d.interest_rate}%` : '—'}</td>
                              <td className="text-right py-2 px-2 text-[#0f766e] text-xs">{d.start_date}</td>
                              <td className="text-right py-2 pl-2 text-xs">
                                {d.status === 'active'
                                  ? <span className="text-teal-400">{d.end_date ?? 'bezterminowa'}</span>
                                  : <span className="text-[#115e59]">Zakończona</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {commDeposits.length > 1 && (
                          <tfoot>
                            <tr className="border-t border-[#133835]">
                              <td colSpan={2} className="py-2 font-bold text-[#f0fdfa]">Razem aktywne lokaty</td>
                              <td className="text-right py-2 font-bold text-teal-400">{pln(totalActiveDeposits)}</td>
                              <td colSpan={3} />
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </ReportSection>
                )}

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
                  <KpiCard label="Suma naliczonych zaliczek" value={pln(totalCharged)} color="blue"
                    formula={`stawki × m² × ${maxMonth} mies. dla każdego lokalu (styczeń–${['','Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'][maxMonth]} ${filterYear})`} />
                  <KpiCard label="Suma wpłat" value={pln(totalAptPaid)} color="green"
                    formula="suma pola 'Wpłata' z kart rozliczeniowych wszystkich lokali" />
                  <KpiCard label={totalAptPaid - totalCharged >= 0 ? 'Łączna nadpłata' : 'Łączne zaległości'} value={pln(Math.abs(totalAptPaid - totalCharged))} color={totalAptPaid - totalCharged >= 0 ? 'green' : 'red'}
                    formula="Suma wpłat − Suma naliczonych zaliczek" />
                </div>

                <ReportSection title={`Rozliczenie per lokal (${commApts.length} lokali)`}>
                  {aptReconciliation.length === 0
                    ? <p className="text-[#115e59] text-sm">Brak danych dla wybranej wspólnoty i roku.</p>
                    : <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#0f2d2a]">
                            <th className="text-left py-2 pr-3 text-[#0f766e] font-medium">Lokal</th>
                            <th className="text-left py-2 pr-3 text-[#0f766e] font-medium">Właściciel</th>
                            <th className="text-right py-2 px-2 text-[#0f766e] font-medium">m²</th>
                            <th className="text-right py-2 px-2 text-[#0f766e] font-medium">Naliczono</th>
                            <th className="text-right py-2 px-2 text-[#0f766e] font-medium">Wpłacono</th>
                            <th className="text-right py-2 pl-2 text-[#0f766e] font-medium">Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aptReconciliation.map(({ apt, paid, charged, balance }) => (
                            <tr key={apt.id} className="border-b border-[#0f2d2a]/50 hover:bg-[#0c2220]/20">
                              <td className="py-2 pr-3 font-mono text-[#ccfbf1]">{apt.number}</td>
                              <td className="py-2 pr-3 text-[#99f6e4] truncate max-w-[160px]">{apt.owner_name}</td>
                              <td className="text-right py-2 px-2 text-[#0f766e]">{apt.area_m2}</td>
                              <td className="text-right py-2 px-2 text-[#99f6e4]">{charged > 0 ? pln(charged) : '—'}</td>
                              <td className="text-right py-2 px-2 text-[#99f6e4]">{paid > 0 ? pln(paid) : '—'}</td>
                              <td className={`text-right py-2 pl-2 font-semibold ${balance > 0.01 ? 'text-teal-400' : balance < -0.01 ? 'text-red-400' : 'text-[#115e59]'}`}>
                                {balance > 0.01 ? '+' : ''}{pln(balance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-[#133835]">
                            <td colSpan={3} className="py-3 font-bold text-[#f0fdfa]">RAZEM</td>
                            <td className="text-right py-3 font-bold text-teal-400">{pln(totalCharged)}</td>
                            <td className="text-right py-3 font-bold text-teal-400">{pln(totalAptPaid)}</td>
                            <td className={`text-right py-3 font-bold ${totalAptPaid - totalCharged >= 0 ? 'text-teal-400' : 'text-red-400'}`}>{pln(totalAptPaid - totalCharged)}</td>
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
                  <KpiCard label="Lokale z zaległościami" value={String(debtors.length)} color="red"
                    note={`z ${commApts.length} łącznie`}
                    formula="lokale gdzie wpłaty < naliczone zaliczki" />
                  <KpiCard label="Łączna kwota zaległości" value={pln(totalDebt)} color="red"
                    formula="suma różnic (naliczone − wpłacone) dla zadłużonych lokali" />
                  <KpiCard label="Lokale bez zaległości" value={String(commApts.length - debtors.length)} color="green"
                    formula="wszystkie lokale − lokale z zaległościami" />
                </div>

                {debtors.length === 0
                  ? <div className="text-center py-12 bg-teal-950/20 border border-teal-800 rounded-xl"><p className="text-3xl mb-3">✅</p><p className="text-teal-400 font-semibold">Brak zaległości w {filterYear} roku.</p></div>
                  : <ReportSection title={`Lokale z zaległościami (${debtors.length})`}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#0f2d2a]">
                            <th className="text-left py-2 pr-3 text-[#0f766e] font-medium">Lokal</th>
                            <th className="text-left py-2 pr-3 text-[#0f766e] font-medium">Właściciel</th>
                            <th className="text-right py-2 px-2 text-[#0f766e] font-medium">Naliczono</th>
                            <th className="text-right py-2 px-2 text-[#0f766e] font-medium">Wpłacono</th>
                            <th className="text-right py-2 pl-2 text-[#0f766e] font-medium">Zaległość</th>
                          </tr>
                        </thead>
                        <tbody>
                          {debtors.map(({ apt, paid, charged, balance }) => (
                            <tr key={apt.id} className="border-b border-[#0f2d2a]/50">
                              <td className="py-2 pr-3 font-mono text-[#ccfbf1]">{apt.number}</td>
                              <td className="py-2 pr-3 text-[#99f6e4]">{apt.owner_name}</td>
                              <td className="text-right py-2 px-2 text-[#99f6e4]">{pln(charged)}</td>
                              <td className="text-right py-2 px-2 text-[#99f6e4]">{pln(paid)}</td>
                              <td className="text-right py-2 pl-2 font-bold text-red-400">{pln(Math.abs(balance))}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-[#133835]">
                            <td colSpan={4} className="py-3 font-bold text-[#f0fdfa]">Łącznie zaległości</td>
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

                {!hasPrevYearData
                  ? <div className="text-center py-12 text-[#115e59]"><p className="text-3xl mb-3">📂</p><p>Brak danych kosztowych za rok {filterYear - 1} — plan nie może być wyznaczony.</p></div>
                  : (() => {
                    const totalPlan = Object.values(planByCategory).reduce((s, v) => s + v, 0)
                    const diff = totalExecutionToDate - totalPlan
                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <KpiCard label={`Plan ${filterYear}`} value={pln(totalPlan)} color="blue"
                            note={`wykonanie ${filterYear - 1}`}
                            formula={`faktyczne koszty roku ${filterYear - 1} per kategoria (podstawa planu)`} />
                          <KpiCard label={`Wykonanie do ${['','Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'][maxMonth]}`} value={pln(totalExecutionToDate)} color="red"
                            formula={`suma kosztów ${filterYear} od stycznia do ${['','Stycznia','Lutego','Marca','Kwietnia','Maja','Czerwca','Lipca','Sierpnia','Września','Października','Listopada','Grudnia'][maxMonth]}`} />
                          <KpiCard label="Odchylenie" value={pln(Math.abs(diff))} color={diff <= 0 ? 'green' : 'red'}
                            note={diff <= 0 ? 'W planie / oszczędność' : 'Przekroczenie planu'}
                            formula="Wykonanie − Plan (ujemne = oszczędność)" />
                        </div>

                        <ReportSection title={`Porównanie per kategoria (plan ${filterYear - 1} vs wykonanie ${filterYear} do ${['','Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'][maxMonth]})`}>
                          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[400px]">
                            <thead><tr className="border-b border-[#0f2d2a]">
                              <th className="text-left py-2 pr-4 text-[#0f766e] font-medium">Kategoria</th>
                              <th className="text-right py-2 px-3 text-[#0f766e] font-medium">Plan ({filterYear - 1})</th>
                              <th className="text-right py-2 px-3 text-[#0f766e] font-medium">Wykonanie ({filterYear})</th>
                              <th className="text-right py-2 pl-3 text-[#0f766e] font-medium">Różnica</th>
                            </tr></thead>
                            <tbody>
                              {Object.keys({ ...planByCategory, ...executionByCategory }).sort().map(cat => {
                                const plan = planByCategory[cat] ?? 0
                                const exec = executionByCategory[cat] ?? 0
                                const d = exec - plan
                                return (
                                  <tr key={cat} className="border-b border-[#0f2d2a]/50">
                                    <td className="py-2 pr-4 text-[#99f6e4]">{EXP_CAT_LABELS[cat] ?? cat}</td>
                                    <td className="text-right py-2 px-3 text-[#99f6e4]">{plan > 0 ? pln(plan) : '—'}</td>
                                    <td className="text-right py-2 px-3 text-[#99f6e4]">{exec > 0 ? pln(exec) : '—'}</td>
                                    <td className={`text-right py-2 pl-3 font-medium ${d > 0 ? 'text-red-400' : d < 0 ? 'text-teal-400' : 'text-[#115e59]'}`}>
                                      {plan > 0 || exec > 0 ? (d > 0 ? '+' : '') + pln(d) : '—'}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-[#133835]">
                                <td className="py-2 font-bold text-[#f0fdfa]">Razem</td>
                                <td className="text-right py-2 font-bold text-[#99f6e4]">{pln(totalPlan)}</td>
                                <td className="text-right py-2 font-bold text-red-400">{pln(totalExecutionToDate)}</td>
                                <td className={`text-right py-2 font-bold ${diff > 0 ? 'text-red-400' : 'text-teal-400'}`}>{(diff > 0 ? '+' : '') + pln(diff)}</td>
                              </tr>
                            </tfoot>
                          </table></div>
                        </ReportSection>
                      </>
                    )
                  })()}

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
                  <KpiCard label="Łączne naliczenia" value={pln(renovFundCumulative.reduce((s, r) => s + r.naliczenia, 0))} color="blue"
                    formula="stawka funduszu rem. × m² × 12 mies. × lokale (wszystkie lata)" />
                  <KpiCard label="Łączne wydatki na remonty" value={pln(renovFundCumulative.reduce((s, r) => s + r.wydatki, 0))} color="red"
                    formula="koszty z kategorią 'Remonty / naprawy' (wszystkie lata)" />
                  <KpiCard label="Saldo skumulowane" value={pln(renovFundCumulative[renovFundCumulative.length - 1]?.cumulative ?? 0)} color={renovFundCumulative[renovFundCumulative.length - 1]?.cumulative >= 0 ? 'green' : 'red'}
                    formula="suma (naliczenia − wydatki) od początku historii" />
                </div>

                <ReportSection title="Historia funduszu remontowego">
                  {renovFundCumulative.length === 0
                    ? <p className="text-[#115e59] text-sm">Brak danych.</p>
                    : <div className="overflow-x-auto"><table className="w-full text-sm min-w-[480px]">
                      <thead><tr className="border-b border-[#0f2d2a]">
                        <th className="text-left py-2 pr-4 text-[#0f766e] font-medium">Rok</th>
                        <th className="text-right py-2 px-3 text-[#0f766e] font-medium">Naliczenia</th>
                        <th className="text-right py-2 px-3 text-[#0f766e] font-medium">Wydatki na remonty</th>
                        <th className="text-right py-2 px-3 text-[#0f766e] font-medium">Saldo roku</th>
                        <th className="text-right py-2 pl-3 text-[#0f766e] font-medium">Saldo skum.</th>
                      </tr></thead>
                      <tbody>
                        {renovFundCumulative.map(r => (
                          <tr key={r.year} className={`border-b border-[#0f2d2a]/50 ${r.year === filterYear ? 'bg-teal-950/10' : ''}`}>
                            <td className="py-2 pr-4 text-[#99f6e4] font-medium">{r.year}{r.year === filterYear && <span className="ml-2 text-xs text-teal-400">(bieżący)</span>}</td>
                            <td className="text-right py-2 px-3 text-[#99f6e4]">{pln(r.naliczenia)}</td>
                            <td className="text-right py-2 px-3 text-[#99f6e4]">{r.wydatki > 0 ? pln(r.wydatki) : '—'}</td>
                            <td className={`text-right py-2 px-3 font-medium ${r.saldo >= 0 ? 'text-teal-400' : 'text-red-400'}`}>{pln(r.saldo)}</td>
                            <td className={`text-right py-2 pl-3 font-bold ${r.cumulative >= 0 ? 'text-teal-400' : 'text-red-400'}`}>{pln(r.cumulative)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>}
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
                    <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5">
                      <p className="text-[#115e59] text-sm">Brak kosztów w roku {filterYear}.</p>
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
                                  <tr className="border-b border-[#0f2d2a]">
                                    <th className="text-left py-2 pr-3 text-[#0f766e] font-medium w-24">Data</th>
                                    <th className="text-left py-2 pr-3 text-[#0f766e] font-medium">Od kogo / opis</th>
                                    <th className="text-left py-2 pr-3 text-[#0f766e] font-medium w-32">Kategoria</th>
                                    <th className="text-left py-2 pr-3 text-[#0f766e] font-medium w-28">Nr faktury</th>
                                    <th className="text-right py-2 text-[#0f766e] font-medium w-28">Kwota</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((e, i) => (
                                    <tr key={i} className="border-b border-[#0f2d2a]/50 hover:bg-[#0c2220]/20">
                                      <td className="py-2 pr-3 text-[#0f766e] text-xs">{e.expense_date}</td>
                                      <td className="py-2 pr-3 text-[#ccfbf1]">{e.description}</td>
                                      <td className="py-2 pr-3 text-[#0f766e] text-xs">{EXP_CAT_LABELS[e.category] ?? e.category}</td>
                                      <td className="py-2 pr-3 text-[#0f766e] text-xs font-mono">{e.invoice_number ?? '—'}</td>
                                      <td className="text-right py-2 text-[#ccfbf1] font-medium">{pln(e.amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t border-[#133835]">
                                    <td colSpan={4} className="py-2 pr-3 text-sm font-semibold text-[#99f6e4]">Razem {MONTHS_SHORT[m - 1]}</td>
                                    <td className="text-right py-2 font-bold text-red-400">{pln(monthTotal)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </ReportSection>
                        )
                      })}

                      {/* Grand total */}
                      <div className="bg-[#0c2220]/60 border border-[#0f2d2a] rounded-xl p-4 flex items-center justify-between">
                        <span className="font-bold text-[#f0fdfa] text-sm">SUMA ROCZNA {filterYear}</span>
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
        @page { size: A4 portrait; margin: 16mm 14mm 20mm 14mm; }

        /* Nagłówek druku — ukryty na ekranie */
        .print-doc-header { display: none; }

        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          /* ── Białe tło strony — kluczowe! body i html nie są objęte "body *" ── */
          html, body { background-color: #ffffff !important; background: #ffffff !important; }

          /* ── Ukryj wszystko, pokaż tylko print-area ── */
          body * { visibility: hidden !important; }
          .print-area, .print-area *,
          .print-doc-header, .print-doc-header * { visibility: visible !important; }

          /* Pozycja print-area */
          .print-area {
            position: absolute !important; top: 0 !important; left: 0 !important;
            width: 100% !important; font-family: 'Segoe UI', Arial, sans-serif !important;
            font-size: 10pt !important;
          }

          /* ── RESET KOLORÓW — najważniejsze ── */
          .print-area *,
          .print-area div, .print-area p, .print-area span,
          .print-area li, .print-area label, .print-area section {
            background-color: #ffffff !important;
            color: #111111 !important;
            border-color: #cccccc !important;
          }

          /* ── Nagłówek dokumentu ── */
          .print-doc-header {
            display: flex !important; justify-content: space-between !important;
            align-items: flex-start !important; padding-bottom: 8pt !important;
            margin-bottom: 14pt !important; border-bottom: 2pt solid #0f766e !important;
          }
          .print-doc-header-left h1 { font-size: 14pt !important; font-weight: 700 !important; color: #0f766e !important; margin: 0 0 2pt !important; }
          .print-doc-header-left p  { font-size: 8pt !important; color: #666 !important; margin: 0 !important; }
          .print-doc-header-right   { text-align: right !important; font-size: 8.5pt !important; color: #333 !important; }

          /* ── Nagłówki ── */
          .print-area h3 { font-size: 13pt !important; font-weight: 700 !important; color: #111 !important; margin: 0 0 4pt !important; }
          .print-area h4 { font-size: 8.5pt !important; font-weight: 700 !important; color: #0a6c62 !important;
            text-transform: uppercase !important; letter-spacing: 0.04em !important;
            border-bottom: 0.75pt solid #ccc !important; padding-bottom: 4pt !important; margin-bottom: 6pt !important; }

          /* ── KPI karty ── */
          .print-kpi-row {
            display: flex !important; gap: 0 !important;
            border: 1pt solid #ccc !important; margin-bottom: 11pt !important; break-inside: avoid !important;
          }
          .print-kpi-row > div {
            flex: 1 !important; padding: 7pt 9pt !important; border-right: 1pt solid #ccc !important; border-radius: 0 !important;
          }
          .print-kpi-row > div:last-child { border-right: none !important; }
          .print-kpi-row > div > p:first-child { font-size: 6.5pt !important; color: #666 !important; text-transform: uppercase !important; margin-bottom: 2pt !important; }
          .kpi-val       { font-size: 12pt !important; font-weight: 700 !important; color: #111 !important; }
          .kpi-val.green { color: #0a6c62 !important; }
          .kpi-val.red   { color: #b91c1c !important; }
          .kpi-formula   { font-size: 6.5pt !important; color: #777 !important; border-top: 0.5pt solid #e0e0e0 !important; padding-top: 3pt !important; margin-top: 3pt !important; }

          /* ── Sekcje raportu — każdy kontener ── */
          .print-area > div > div,
          .print-area .space-y-6 > div { border: 0.75pt solid #ccc !important; padding: 8pt 10pt !important; margin-bottom: 8pt !important; break-inside: avoid !important; }

          /* ── Tabele ── */
          .print-area table { border-collapse: collapse !important; width: 100% !important; font-size: 8.5pt !important; }
          .print-area th {
            background-color: #f0fdf9 !important; color: #0a6c62 !important;
            font-weight: 600 !important; font-size: 7.5pt !important;
            padding: 4pt 5pt !important; border: 0.5pt solid #bbb !important;
          }
          .print-area td { padding: 3.5pt 5pt !important; border: 0.5pt solid #ddd !important; }
          .print-area tbody tr:nth-child(even) td { background-color: #f7fffe !important; }
          .print-area tfoot td { background-color: #e6faf5 !important; font-weight: 700 !important; border-top: 1pt solid #0f766e !important; }

          /* Wyrównanie */
          .print-area [class*="text-right"] { text-align: right !important; }
          .print-area [class*="text-left"]  { text-align: left !important; }

          /* Kolory semantyczne — kwoty */
          .print-area [class*="text-teal"]  { color: #0a6c62 !important; }
          .print-area [class*="text-red"]   { color: #b91c1c !important; }
          .print-area [class*="text-cyan"]  { color: #0e7490 !important; }
          .print-area [class*="text-amber"] { color: #b45309 !important; }
          .print-area [class*="opacity-40"] { opacity: 0.35 !important; }

          /* Ukryj przyciski */
          .print-area button, .print-area svg { display: none !important; visibility: hidden !important; }

          /* Stopka prawna */
          .print-area em { font-size: 7pt !important; color: #777 !important; }

          /* Łamania stron */
          .print-area .space-y-6 > * + * { break-inside: avoid !important; }
        }
      `}</style>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ReportHeader({ title, subtitle, art }: { title: string; subtitle: string; art: string }) {
  return (
    <div className="border-b border-[#0f2d2a] pb-4">
      <p className="text-xs text-teal-400 font-medium mb-1">{art}</p>
      <h3 className="text-xl font-bold text-[#f0fdfa]">{title}</h3>
      <p className="text-sm text-[#0f766e] mt-0.5">{subtitle}</p>
      <p className="text-xs text-[#115e59] mt-2">Wygenerowano: {new Date().toLocaleDateString('pl-PL')}</p>
    </div>
  )
}

function KpiCard({ label, value, color, note, formula }: { label: string; value: string; color: 'green' | 'red' | 'blue'; note?: string; formula?: string }) {
  const colors = { green: 'text-teal-400', red: 'text-red-400', blue: 'text-teal-400' }
  return (
    <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4 text-center">
      <p className="text-xs text-[#115e59] mb-1">{label}</p>
      <p className={`kpi-val ${color} text-xl font-bold ${colors[color]}`}>{value}</p>
      {note && <p className="text-xs text-[#115e59] mt-0.5">{note}</p>}
      {formula && (
        <p className="kpi-formula text-[10px] text-[#0f766e]/70 mt-1.5 leading-tight border-t border-[#0f2d2a] pt-1.5">
          <span className="opacity-60">= </span>{formula}
        </p>
      )}
    </div>
  )
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5">
      <h4 className="text-sm font-semibold text-[#0f766e] mb-4">{title}</h4>
      {children}
    </div>
  )
}

function LegalFooter({ text }: { text: string }) {
  return (
    <div className="border-t border-[#0f2d2a] pt-4">
      <p className="text-xs text-[#115e59] leading-relaxed">⚖️ <em>{text}</em></p>
    </div>
  )
}

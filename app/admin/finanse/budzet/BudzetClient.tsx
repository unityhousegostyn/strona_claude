'use client'

import { useState, useTransition, useCallback } from 'react'
import { getBudget, saveBudgetItems, getPreviousYearExecution, getAvailableYears } from './actions'
import type { BudgetData } from './actions'
import { BUDGET_FUNDS, catLabel } from './constants'

function pln(v: number) {
  return v.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
}

function pct(v: number) {
  return v > 900 ? '>999%' : `${v}%`
}

function badgeCls(p: number) {
  if (p > 110) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  if (p >= 85)  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
}

function barColor(p: number) {
  if (p > 110) return 'bg-red-500'
  if (p >= 85)  return 'bg-amber-500'
  return 'bg-teal-500'
}

interface Props {
  communities: { id: string; name: string }[]
  initialBudget: BudgetData | null
  initialYears: number[]
  isSuperAdmin: boolean
}

export default function BudzetClient({ communities, initialBudget, initialYears, isSuperAdmin }: Props) {
  const [isPending, startTransition] = useTransition()
  const [communityId, setCommunityId] = useState(communities[0]?.id ?? '')
  const [year, setYear] = useState(new Date().getFullYear())
  const [years, setYears] = useState(initialYears)
  const [budget, setBudget] = useState<BudgetData | null>(initialBudget)

  // Modal stanu planu
  const [planOpen, setPlanOpen] = useState(false)
  const [planMap, setPlanMap] = useState<Record<string, string>>({})
  const [prevExec, setPrevExec] = useState<Record<string, number>>({})
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const reload = useCallback((cid: string, yr: number) => {
    startTransition(async () => {
      const [res, yrs] = await Promise.all([getBudget(cid, yr), getAvailableYears(cid)])
      setBudget(res.data)
      setYears(yrs)
    })
  }, [])

  function handleCommunity(cid: string) {
    setCommunityId(cid)
    reload(cid, year)
  }

  function handleYear(yr: number) {
    setYear(yr)
    reload(communityId, yr)
  }

  // ── Otwórz modal planu ──
  async function openPlanModal() {
    // Pre-fill z istniejącego planu
    const existing: Record<string, string> = {}
    for (const item of budget?.items ?? []) {
      if (item.planned > 0) existing[item.category] = String(item.planned)
    }
    setPlanMap(existing)
    setSaveMsg(null)

    // Pobierz wykonanie z poprzedniego roku
    startTransition(async () => {
      const res = await getPreviousYearExecution(communityId, year - 1)
      setPrevExec(res.data)
      setPlanOpen(true)
    })
  }

  // ── Kopiuj z N-1 ──
  function handleCopyPrev() {
    const copied: Record<string, string> = {}
    for (const [cat, val] of Object.entries(prevExec)) {
      if (val > 0) copied[cat] = String(val)
    }
    setPlanMap(copied)
  }

  // ── Zapisz plan ──
  function handleSavePlan() {
    const items = Object.entries(planMap)
      .map(([category, val]) => ({ category, planned_amount: parseFloat(val) || 0 }))
      .filter(i => i.planned_amount > 0)

    startTransition(async () => {
      const res = await saveBudgetItems(communityId, year, items)
      if (res.error) {
        setSaveMsg({ ok: false, text: res.error })
      } else {
        setSaveMsg({ ok: true, text: 'Plan zapisany.' })
        setPlanOpen(false)
        reload(communityId, year)
      }
    })
  }

  // ── Live suma planu w modalu ──
  const modalTotal = Object.values(planMap).reduce((s, v) => s + (parseFloat(v) || 0), 0)

  // ── Eksport CSV ──
  function handleExport() {
    if (!budget) return
    const communityName = communities.find(c => c.id === communityId)?.name ?? communityId
    const rows = [
      ['Kategoria', 'Plan (PLN)', 'Wydano (PLN)', 'Pozostało (PLN)', '% planu', 'Prognoza roczna (PLN)'],
      ...budget.items.map(i => [
        catLabel(i.category),
        i.planned.toFixed(2),
        i.actual.toFixed(2),
        i.remaining.toFixed(2),
        i.planned > 0 ? pct(i.pct) : '—',
        i.forecast != null ? i.forecast.toFixed(2) : '—',
      ]),
      [],
      ['RAZEM',
        budget.totalPlanned.toFixed(2),
        budget.totalActual.toFixed(2),
        budget.totalRemaining.toFixed(2),
        '',
        budget.totalForecast != null ? budget.totalForecast.toFixed(2) : '—',
      ],
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `budzet_${communityName}_${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Wylicz sumy per fundusz ──
  function fundTotals(fundKey: string) {
    if (!budget) return { planned: 0, actual: 0, remaining: 0, forecast: null as number | null }
    const items = budget.items.filter(i =>
      (BUDGET_FUNDS.find(f => f.key === fundKey)?.categories ?? []).some(c => c.value === i.category)
    )
    const planned   = items.reduce((s, i) => s + i.planned, 0)
    const actual    = items.reduce((s, i) => s + i.actual, 0)
    const remaining = planned - actual
    const forecasts = items.map(i => i.forecast).filter((f): f is number => f !== null)
    const forecast  = forecasts.length > 0 ? forecasts.reduce((s, f) => s + f, 0) : null
    return { planned, actual, remaining, forecast }
  }

  const overBudget = budget?.items.filter(i => i.overBudget) ?? []
  const totalPct = budget && budget.totalPlanned > 0
    ? Math.round((budget.totalActual / budget.totalPlanned) * 100)
    : null
  const barW = Math.min(totalPct ?? 0, 100)
  const currentYear = new Date().getFullYear()

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 print:px-0 print:py-0">

      {/* ── Nagłówek ── */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] dark:text-[#f0fdfa]">Budżet roczny</h1>
          <p className="text-sm text-[#6b7280]">Plan kosztów vs wykonanie — podział na fundusze</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isSuperAdmin && (
            <button
              onClick={openPlanModal}
              disabled={isPending}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
            >
              ✏️ Ustaw plan {year}
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={!budget}
            className="px-4 py-2 bg-[#f3f4f6] dark:bg-[#374151] text-[#374151] dark:text-[#d1d5db] rounded-lg text-sm hover:bg-[#e5e7eb] disabled:opacity-50"
          >
            📥 Eksport CSV
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-[#f3f4f6] dark:bg-[#374151] text-[#374151] dark:text-[#d1d5db] rounded-lg text-sm hover:bg-[#e5e7eb]"
          >
            🖨️ Drukuj
          </button>
        </div>
      </div>

      {/* ── Filtry ── */}
      <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow px-4 py-3 mb-5 flex items-center gap-3 flex-wrap print:hidden">
        {communities.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-[#374151] dark:text-[#d1d5db]">Wspólnota:</label>
            <select
              value={communityId}
              onChange={e => handleCommunity(e.target.value)}
              className="rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#111827] text-[#111827] dark:text-white px-3 py-1.5 text-sm"
            >
              {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#374151] dark:text-[#d1d5db]">Rok:</label>
          <select
            value={year}
            onChange={e => handleYear(Number(e.target.value))}
            className="rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#111827] text-[#111827] dark:text-white px-3 py-1.5 text-sm"
          >
            {years.map(y => <option key={y} value={y}>{y}{y === currentYear ? ' (bieżący)' : ''}</option>)}
          </select>
        </div>
        {isPending && <span className="text-xs text-[#9ca3af]">Ładowanie…</span>}
      </div>

      {/* ── Alerty przekroczenia ── */}
      {overBudget.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-5">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
            ⚠ {overBudget.length === 1 ? 'Kategoria przekroczyła' : `${overBudget.length} kategorie przekroczyły`} budżet o &gt;10%:
          </p>
          <p className="text-sm text-red-600 dark:text-red-300">
            {overBudget.map(i => `${catLabel(i.category)} (${pct(i.pct)})`).join(' · ')}
          </p>
        </div>
      )}

      {!budget || budget.items.length === 0 ? (
        <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow px-6 py-10 text-center text-[#6b7280]">
          {isSuperAdmin
            ? 'Brak danych budżetowych. Kliknij „Ustaw plan" aby wprowadzić plan na ten rok.'
            : 'Brak danych budżetowych dla wybranego roku.'}
        </div>
      ) : (
        <>
          {/* ── KPI cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow px-4 py-3">
              <p className="text-xs text-[#6b7280] mb-1">Budżet roczny</p>
              <p className="text-lg font-bold text-teal-600 dark:text-teal-400">{pln(budget.totalPlanned)}</p>
              {budget.totalPlanned === 0 && (
                <p className="text-[11px] text-[#9ca3af] mt-0.5">brak planu</p>
              )}
            </div>
            <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow px-4 py-3">
              <p className="text-xs text-[#6b7280] mb-1">
                Wydano {year === currentYear ? `(do ${budget.forecastMonth} mies.)` : ''}
              </p>
              <p className="text-lg font-bold text-[#111827] dark:text-white">{pln(budget.totalActual)}</p>
              {totalPct !== null && (
                <p className="text-[11px] text-[#9ca3af] mt-0.5">{totalPct}% planu</p>
              )}
            </div>
            <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow px-4 py-3">
              <p className="text-xs text-[#6b7280] mb-1">Pozostało</p>
              <p className={`text-lg font-bold ${budget.totalRemaining >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-red-600 dark:text-red-400'}`}>
                {pln(budget.totalRemaining)}
              </p>
              <p className="text-[11px] text-[#9ca3af] mt-0.5">
                {budget.totalRemaining >= 0 ? 'w budżecie' : 'przekroczony'}
              </p>
            </div>
            <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow px-4 py-3">
              <p className="text-xs text-[#6b7280] mb-1">Prognoza roczna</p>
              {budget.totalForecast != null ? (
                <>
                  <p className={`text-lg font-bold ${budget.totalForecast > budget.totalPlanned * 1.05 ? 'text-amber-600 dark:text-amber-400' : 'text-[#111827] dark:text-white'}`}>
                    {pln(budget.totalForecast)}
                  </p>
                  {budget.totalPlanned > 0 && (
                    <p className="text-[11px] text-[#9ca3af] mt-0.5">
                      {budget.totalForecast > budget.totalPlanned
                        ? `+${pln(budget.totalForecast - budget.totalPlanned)} ponad plan`
                        : `${pln(budget.totalPlanned - budget.totalForecast)} poniżej planu`}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-lg font-bold text-[#9ca3af]">—</p>
              )}
            </div>
          </div>

          {/* ── Pasek całkowitego wykonania ── */}
          {totalPct !== null && budget.totalPlanned > 0 && (
            <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow px-5 py-4 mb-5">
              <div className="flex justify-between text-xs text-[#6b7280] mb-2">
                <span>Stopień wykonania budżetu {year}</span>
                <span className="font-semibold text-[#111827] dark:text-white">{totalPct}%</span>
              </div>
              <div className="w-full h-3 bg-[#f3f4f6] dark:bg-[#374151] rounded-full overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all ${barColor(totalPct)}`}
                  style={{ width: `${barW}%` }}
                />
              </div>
              <div className="flex gap-5 mt-2 text-[11px] text-[#9ca3af]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500 inline-block"/> W normie (&lt;85%)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/> Uwaga (85–110%)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/> Przekroczony (&gt;110%)</span>
              </div>
            </div>
          )}

          {/* ── Tabela z podziałem na fundusze ── */}
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow overflow-hidden mb-5">
            {/* Nagłówek kolumn */}
            <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_90px_1fr] gap-0 px-4 py-2 bg-[#f9fafb] dark:bg-[#111827] border-b border-[#e5e7eb] dark:border-[#374151]">
              {['Kategoria', 'Plan', 'Wydano', 'Pozostało', '% planu', 'Prognoza'].map(h => (
                <div key={h} className={`text-xs font-semibold text-[#6b7280] ${h === 'Kategoria' ? '' : 'text-right'}`}>{h}</div>
              ))}
            </div>

            {BUDGET_FUNDS.map(fund => {
              const fundItems = budget.items.filter(i =>
                fund.categories.some(c => c.value === i.category)
              )
              if (fundItems.length === 0) return null

              const ft = fundTotals(fund.key)
              const fPct = ft.planned > 0 ? Math.round((ft.actual / ft.planned) * 100) : null

              return (
                <div key={fund.key}>
                  {/* Nagłówek funduszu */}
                  <div className="px-4 py-2 bg-[#f3f4f6] dark:bg-[#0d1f1c] border-b border-[#e5e7eb] dark:border-[#374151]">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#374151] dark:text-[#99f6e4]">
                      {fund.label}
                    </span>
                  </div>

                  {/* Wiersze kategorii */}
                  {fundItems.map(item => (
                    <div
                      key={item.category}
                      className={`grid grid-cols-[2fr_1fr_1fr_1fr_90px_1fr] gap-0 px-4 py-2.5 border-b border-[#e5e7eb] dark:border-[#374151] text-sm
                        ${item.overBudget ? 'bg-red-50/40 dark:bg-red-900/10' : 'hover:bg-[#f9fafb] dark:hover:bg-[#111827]/60'}`}
                    >
                      <div className="text-[#111827] dark:text-[#f0fdfa] text-sm">{catLabel(item.category)}</div>
                      <div className="text-right text-[#374151] dark:text-[#d1d5db]">
                        {item.planned > 0 ? pln(item.planned) : <span className="text-[#9ca3af]">—</span>}
                      </div>
                      <div className="text-right font-medium text-[#111827] dark:text-white">
                        {item.actual > 0 ? pln(item.actual) : <span className="text-[#9ca3af]">—</span>}
                      </div>
                      <div className={`text-right font-medium ${
                        item.planned === 0 ? 'text-[#9ca3af]'
                        : item.remaining >= 0 ? 'text-teal-600 dark:text-teal-400'
                        : 'text-red-600 dark:text-red-400'}`}>
                        {item.planned > 0 || item.actual > 0
                          ? pln(item.remaining)
                          : '—'}
                      </div>
                      <div className="text-right">
                        {item.pct > 0 ? (
                          <div>
                            <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${badgeCls(item.pct)}`}>
                              {pct(item.pct)}
                            </span>
                            <div className="mt-1 h-1 rounded-full overflow-hidden bg-[#f3f4f6] dark:bg-[#374151]">
                              <div className={`h-1 rounded-full ${barColor(item.pct)}`} style={{ width: `${Math.min(item.pct, 100)}%` }} />
                            </div>
                          </div>
                        ) : <span className="text-[#9ca3af] text-xs">—</span>}
                      </div>
                      <div className="text-right text-[#6b7280] dark:text-[#9ca3af] text-xs">
                        {item.forecast != null ? pln(item.forecast) : '—'}
                      </div>
                    </div>
                  ))}

                  {/* Suma funduszu */}
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_90px_1fr] gap-0 px-4 py-2 bg-[#f9fafb] dark:bg-[#111827]/50 border-b-2 border-[#e5e7eb] dark:border-[#374151] text-sm font-semibold">
                    <div className="text-[#374151] dark:text-[#99f6e4]">{fund.label} razem</div>
                    <div className="text-right text-teal-600 dark:text-teal-400">{pln(ft.planned)}</div>
                    <div className="text-right text-[#111827] dark:text-white">{pln(ft.actual)}</div>
                    <div className={`text-right ${ft.remaining >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-red-600 dark:text-red-400'}`}>
                      {pln(ft.remaining)}
                    </div>
                    <div className="text-right">
                      {fPct !== null
                        ? <span className={`text-xs font-semibold ${badgeCls(fPct)}`}>{pct(fPct)}</span>
                        : <span className="text-[#9ca3af] text-xs">—</span>}
                    </div>
                    <div className="text-right text-[#6b7280] dark:text-[#9ca3af] text-xs">
                      {ft.forecast != null ? pln(ft.forecast) : '—'}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Wiersz RAZEM */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_90px_1fr] gap-0 px-4 py-3 bg-teal-50/50 dark:bg-teal-900/10 text-sm font-bold">
              <div className="text-[#111827] dark:text-[#f0fdfa]">RAZEM</div>
              <div className="text-right text-teal-600 dark:text-teal-400">{pln(budget.totalPlanned)}</div>
              <div className="text-right text-[#111827] dark:text-white">{pln(budget.totalActual)}</div>
              <div className={`text-right ${budget.totalRemaining >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-red-600 dark:text-red-400'}`}>
                {pln(budget.totalRemaining)}
              </div>
              <div className="text-right">
                {totalPct !== null
                  ? <span className={`text-xs font-semibold ${badgeCls(totalPct)}`}>{pct(totalPct)}</span>
                  : <span className="text-[#9ca3af] text-xs">—</span>}
              </div>
              <div className="text-right text-[#6b7280] dark:text-[#9ca3af] text-xs font-medium">
                {budget.totalForecast != null ? pln(budget.totalForecast) : '—'}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Print header ── */}
      <div className="hidden print:block mb-6">
        <h1 className="text-xl font-bold">Budżet roczny {year}</h1>
        <p className="text-sm text-gray-600">{communities.find(c => c.id === communityId)?.name}</p>
      </div>

      {/* ══════════════════════════════
          MODAL: Ustaw plan budżetu
      ══════════════════════════════ */}
      {planOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a1f1d] border border-[#e5e7eb] dark:border-[#0f2d2a] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

            {/* Nagłówek modalu */}
            <div className="px-6 py-4 border-b border-[#e5e7eb] dark:border-[#0f2d2a] flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-[#111827] dark:text-[#f0fdfa]">Plan budżetu na rok {year}</h3>
                <p className="text-xs text-[#6b7280]">{communities.find(c => c.id === communityId)?.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyPrev}
                  disabled={Object.keys(prevExec).length === 0}
                  title={`Wstaw wykonanie ${year - 1} jako punkt startowy`}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 disabled:opacity-40 transition"
                >
                  📋 Kopiuj z {year - 1}
                </button>
                <button
                  onClick={() => setPlanOpen(false)}
                  className="text-[#9ca3af] hover:text-[#111827] dark:hover:text-white text-xl leading-none"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Ciało modalu — przewijalne */}
            <div className="overflow-y-auto flex-1">
              {/* Nagłówek kolumn */}
              <div className="grid grid-cols-[1fr_110px_130px] gap-0 px-6 py-2 bg-[#f9fafb] dark:bg-[#051210] border-b border-[#e5e7eb] dark:border-[#0f2d2a] sticky top-0">
                <span className="text-xs font-semibold text-[#6b7280]">Kategoria</span>
                <span className="text-xs font-semibold text-right text-[#6b7280]">Wykonanie {year - 1}</span>
                <span className="text-xs font-semibold text-right text-[#6b7280]">Plan {year} (zł)</span>
              </div>

              {BUDGET_FUNDS.map(fund => (
                <div key={fund.key}>
                  <div className="px-6 py-1.5 bg-[#f3f4f6] dark:bg-[#0d1f1c] border-b border-[#e5e7eb] dark:border-[#0f2d2a]">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#374151] dark:text-[#99f6e4]">
                      {fund.label}
                    </span>
                  </div>
                  {fund.categories.map(cat => {
                    const prev = prevExec[cat.value]
                    const val  = planMap[cat.value] ?? ''
                    return (
                      <div
                        key={cat.value}
                        className="grid grid-cols-[1fr_110px_130px] gap-0 px-6 py-2 border-b border-[#f3f4f6] dark:border-[#0f2d2a]/50 hover:bg-[#f9fafb] dark:hover:bg-[#0c2220]/20 items-center"
                      >
                        <label className="text-sm text-[#111827] dark:text-[#f0fdfa]" htmlFor={`plan-${cat.value}`}>
                          {cat.label}
                        </label>
                        <span className="text-xs text-right text-[#9ca3af] pr-4">
                          {prev && prev > 0 ? pln(prev) : '—'}
                        </span>
                        <input
                          id={`plan-${cat.value}`}
                          type="number"
                          min="0"
                          step="1"
                          value={val}
                          placeholder="0"
                          onChange={e => setPlanMap(prev => ({ ...prev, [cat.value]: e.target.value }))}
                          className="w-full text-right rounded-lg border border-[#e5e7eb] dark:border-[#0f2d2a] bg-white dark:bg-[#051210] text-[#111827] dark:text-[#f0fdfa] px-3 py-1.5 text-sm focus:outline-none focus:border-teal-500"
                        />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Stopka modalu */}
            <div className="px-6 py-4 border-t border-[#e5e7eb] dark:border-[#0f2d2a] flex items-center justify-between shrink-0 bg-[#f9fafb] dark:bg-[#051210]">
              <div>
                <p className="text-xs text-[#6b7280]">Łączny plan</p>
                <p className="text-lg font-bold text-[#111827] dark:text-[#f0fdfa]">{pln(modalTotal)}</p>
              </div>
              {saveMsg && (
                <p className={`text-sm font-medium ${saveMsg.ok ? 'text-teal-600' : 'text-red-600'}`}>
                  {saveMsg.text}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setPlanOpen(false)}
                  className="px-4 py-2 border border-[#e5e7eb] dark:border-[#0f2d2a] text-[#374151] dark:text-[#9ca3af] rounded-lg text-sm hover:bg-[#f3f4f6] dark:hover:bg-[#0c2220] transition"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleSavePlan}
                  disabled={isPending}
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
                >
                  {isPending ? '⏳ Zapisuję…' : `Zapisz plan ${year}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

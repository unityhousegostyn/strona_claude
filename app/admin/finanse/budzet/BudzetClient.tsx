'use client'

import { useState, useTransition, useCallback } from 'react'
import { getBudget, saveBudgetItems, getAvailableYears } from './actions'
import type { BudgetData } from './actions'
import { BUDGET_CATEGORIES } from './constants'

function pln(v: number) {
  return v.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
}

function catLabel(cat: string) {
  return BUDGET_CATEGORIES.find(c => c.value === cat)?.label ?? cat
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
  const [editMap, setEditMap] = useState<Record<string, string>>({})
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [editMode, setEditMode] = useState(false)

  const reload = useCallback((cid: string, yr: number) => {
    startTransition(async () => {
      const [res, yrs] = await Promise.all([
        getBudget(cid, yr),
        getAvailableYears(cid),
      ])
      setBudget(res.data)
      setYears(yrs)
      setEditMap({})
      setSaveMsg(null)
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

  function handleEditChange(cat: string, val: string) {
    setEditMap(prev => ({ ...prev, [cat]: val }))
  }

  function handleSave() {
    if (!budget) return
    const items = budget.items.map(item => ({
      category: item.category,
      planned_amount: parseFloat(editMap[item.category] ?? String(item.planned)) || 0,
    }))
    // Dodaj też kategorie z BUDGET_CATEGORIES bez wierszy (żeby można było zaplanować od zera)
    for (const cat of BUDGET_CATEGORIES) {
      if (!items.find(i => i.category === cat.value) && editMap[cat.value]) {
        items.push({ category: cat.value, planned_amount: parseFloat(editMap[cat.value]) || 0 })
      }
    }
    startTransition(async () => {
      const res = await saveBudgetItems(communityId, year, items.filter(i => i.planned_amount > 0))
      if (res.error) {
        setSaveMsg({ ok: false, text: res.error })
      } else {
        setSaveMsg({ ok: true, text: 'Budżet zapisany.' })
        setEditMode(false)
        reload(communityId, year)
      }
    })
  }

  // Excel export
  function handleExcelExport() {
    if (!budget) return
    const communityName = communities.find(c => c.id === communityId)?.name ?? communityId

    // Buduj CSV jako fallback jeśli nie ma biblioteki
    const rows = [
      ['Kategoria', 'Plan (PLN)', 'Wykonanie (PLN)', 'Odchylenie (PLN)', '% wykorzystania'],
      ...budget.items.map(item => [
        catLabel(item.category),
        item.planned.toFixed(2),
        item.actual.toFixed(2),
        item.variance.toFixed(2),
        item.planned > 0 ? item.pct + '%' : '-',
      ]),
      [],
      ['RAZEM', budget.totalPlanned.toFixed(2), budget.totalActual.toFixed(2), budget.totalVariance.toFixed(2), ''],
    ]

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const bom = '﻿'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `budzet_${communityName}_${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // PDF print
  function handlePrint() {
    window.print()
  }

  const overBudgetItems = budget?.items.filter(i => i.overBudget) ?? []
  const maxBar = budget ? Math.max(...budget.items.map(i => Math.max(i.planned, i.actual)), 1) : 1

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 print:px-0 print:py-0">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] dark:text-white">Budżet roczny</h1>
          <p className="text-sm text-[#6b7280]">Plan kosztów vs wykonanie per kategoria</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isSuperAdmin && (
            <button
              onClick={() => { setEditMode(e => !e); setSaveMsg(null) }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                editMode
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                  : 'bg-[#f3f4f6] dark:bg-[#374151] text-[#374151] dark:text-[#d1d5db]'
              }`}
            >
              {editMode ? '✏️ Tryb edycji (aktywny)' : '✏️ Edytuj plan'}
            </button>
          )}
          <button
            onClick={handleExcelExport}
            disabled={!budget}
            className="px-4 py-2 bg-[#f3f4f6] dark:bg-[#374151] text-[#374151] dark:text-[#d1d5db] rounded-lg text-sm hover:bg-[#e5e7eb] disabled:opacity-50"
          >
            📥 Eksport CSV
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-[#f3f4f6] dark:bg-[#374151] text-[#374151] dark:text-[#d1d5db] rounded-lg text-sm hover:bg-[#e5e7eb]"
          >
            🖨️ Drukuj / PDF
          </button>
        </div>
      </div>

      {/* Filtry */}
      <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow px-4 py-3 mb-4 flex items-center gap-3 flex-wrap print:hidden">
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
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#374151] dark:text-[#d1d5db]">Rok:</label>
          <select
            value={year}
            onChange={e => handleYear(Number(e.target.value))}
            className="rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#111827] text-[#111827] dark:text-white px-3 py-1.5 text-sm"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {isPending && <span className="text-xs text-[#9ca3af]">Ładowanie…</span>}
      </div>

      {/* Ostrzeżenia */}
      {overBudgetItems.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
            ⚠ {overBudgetItems.length} {overBudgetItems.length === 1 ? 'kategoria przekroczyła' : 'kategorie przekroczyły'} budżet o &gt;10%:
          </p>
          <p className="text-sm text-red-600 dark:text-red-300">
            {overBudgetItems.map(i => `${catLabel(i.category)} (${i.pct}%)`).join(' · ')}
          </p>
        </div>
      )}

      {!budget?.items.length ? (
        <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow px-6 py-10 text-center text-[#6b7280]">
          Brak danych budżetowych. {isSuperAdmin ? 'Kliknij „Edytuj plan" aby wprowadzić planowane kwoty.' : ''}
        </div>
      ) : (
        <>
          {/* Karty podsumowujące */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              { label: 'Plan', value: budget.totalPlanned, color: 'text-[#0f766e]' },
              { label: 'Wykonanie', value: budget.totalActual, color: 'text-[#111827] dark:text-white' },
              {
                label: 'Odchylenie',
                value: budget.totalVariance,
                color: budget.totalVariance > 0 ? 'text-red-600' : 'text-teal-600',
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white dark:bg-[#1f2937] rounded-xl shadow px-4 py-3">
                <p className="text-xs text-[#6b7280] mb-1">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{pln(value)}</p>
              </div>
            ))}
          </div>

          {/* Wykres słupkowy */}
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow p-5 mb-5">
            <h2 className="font-semibold text-[#111827] dark:text-white mb-4 text-sm">
              Plan vs wykonanie — {year}
            </h2>
            <div className="space-y-3">
              {budget.items.filter(i => i.planned > 0 || i.actual > 0).map(item => {
                const planW = Math.round((item.planned / maxBar) * 100)
                const actW  = Math.round((item.actual  / maxBar) * 100)
                return (
                  <div key={item.category}>
                    <div className="flex justify-between text-xs text-[#6b7280] mb-1">
                      <span>{catLabel(item.category)}</span>
                      <span className={item.overBudget ? 'text-red-500 font-semibold' : ''}>
                        {item.pct > 0 ? `${item.pct}%` : '—'}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#9ca3af] w-14 shrink-0">Plan</span>
                        <div className="flex-1 bg-[#f3f4f6] dark:bg-[#374151] rounded-full h-2">
                          <div
                            className="bg-[#0f766e]/40 h-2 rounded-full transition-all"
                            style={{ width: `${planW}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-[#6b7280] w-24 text-right shrink-0">{pln(item.planned)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#9ca3af] w-14 shrink-0">Wykon.</span>
                        <div className="flex-1 bg-[#f3f4f6] dark:bg-[#374151] rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${item.overBudget ? 'bg-red-500' : 'bg-[#0f766e]'}`}
                            style={{ width: `${actW}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-[#6b7280] w-24 text-right shrink-0">{pln(item.actual)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 mt-4 text-xs text-[#6b7280]">
              <span className="flex items-center gap-1"><span className="w-3 h-2 bg-[#0f766e]/40 rounded-full inline-block"/> Plan</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 bg-[#0f766e] rounded-full inline-block"/> Wykonanie</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-500 rounded-full inline-block"/> Przekroczony</span>
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow overflow-hidden mb-5">
            <div className="px-6 py-4 border-b border-[#e5e7eb] dark:border-[#374151] flex items-center justify-between">
              <h2 className="font-semibold text-[#111827] dark:text-white">
                Szczegóły budżetu — {communities.find(c => c.id === communityId)?.name} · {year}
              </h2>
              {editMode && (
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="px-4 py-1.5 bg-[#0f766e] text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                  >
                    {isPending ? 'Zapisuję…' : 'Zapisz plan'}
                  </button>
                  <button
                    onClick={() => { setEditMode(false); setEditMap({}) }}
                    className="px-4 py-1.5 bg-[#f3f4f6] dark:bg-[#374151] text-[#374151] dark:text-[#d1d5db] rounded-lg text-sm"
                  >
                    Anuluj
                  </button>
                </div>
              )}
            </div>

            {saveMsg && (
              <div className={`px-6 py-2 text-sm ${saveMsg.ok ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-700'}`}>
                {saveMsg.text}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f9fafb] dark:bg-[#111827]">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-[#6b7280]">Kategoria</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-[#6b7280]">Plan</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-[#6b7280]">Wykonanie</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-[#6b7280]">Odchylenie</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-[#6b7280]">%</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Jeśli editMode — pokaż wszystkie kategorie */}
                  {(editMode ? BUDGET_CATEGORIES : budget.items.filter(i => i.planned > 0 || i.actual > 0)).map(item => {
                    const cat = 'value' in item ? item.value : item.category
                    const row = budget.items.find(i => i.category === cat)
                    const planned = row?.planned ?? 0
                    const actual  = row?.actual  ?? 0
                    const variance = actual - planned
                    const pct = planned > 0 ? Math.round((actual / planned) * 100) : (actual > 0 ? 999 : 0)
                    const over = pct > 110 && planned > 0
                    const editVal = editMap[cat] !== undefined ? editMap[cat] : (planned > 0 ? String(planned) : '')

                    return (
                      <tr key={cat} className={`border-t border-[#e5e7eb] dark:border-[#374151] ${over ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                        <td className="px-4 py-2 text-[#111827] dark:text-white">{catLabel(cat)}</td>
                        <td className="px-4 py-2 text-right">
                          {editMode ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editVal}
                              onChange={e => handleEditChange(cat, e.target.value)}
                              placeholder="0.00"
                              className="w-28 text-right rounded border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#111827] text-[#111827] dark:text-white px-2 py-1 text-xs"
                            />
                          ) : (
                            <span className="text-[#374151] dark:text-[#d1d5db]">{planned > 0 ? pln(planned) : '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-[#111827] dark:text-white">
                          {actual > 0 ? pln(actual) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {planned > 0 || actual > 0 ? (
                            <span className={variance > 0 ? 'text-red-600 font-semibold' : variance < 0 ? 'text-teal-600' : 'text-[#9ca3af]'}>
                              {variance > 0 ? '+' : ''}{pln(variance)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {pct > 0 ? (
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              over ? 'bg-red-100 text-red-700'
                              : pct >= 90 ? 'bg-amber-100 text-amber-700'
                              : 'bg-teal-100 text-teal-700'
                            }`}>
                              {pct > 900 ? '>999%' : `${pct}%`}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#e5e7eb] dark:border-[#374151] bg-[#f9fafb] dark:bg-[#111827] font-semibold">
                    <td className="px-4 py-2 text-[#111827] dark:text-white">RAZEM</td>
                    <td className="px-4 py-2 text-right text-[#0f766e]">{pln(budget.totalPlanned)}</td>
                    <td className="px-4 py-2 text-right text-[#111827] dark:text-white">{pln(budget.totalActual)}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={budget.totalVariance > 0 ? 'text-red-600' : 'text-teal-600'}>
                        {budget.totalVariance > 0 ? '+' : ''}{pln(budget.totalVariance)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {budget.totalPlanned > 0 ? (
                        <span className={`text-[11px] font-semibold ${
                          (budget.totalActual / budget.totalPlanned) > 1.1 ? 'text-red-600' : 'text-teal-600'
                        }`}>
                          {Math.round((budget.totalActual / budget.totalPlanned) * 100)}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Print header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-xl font-bold">Budżet roczny {year}</h1>
        <p className="text-sm text-gray-600">{communities.find(c => c.id === communityId)?.name}</p>
      </div>
    </div>
  )
}

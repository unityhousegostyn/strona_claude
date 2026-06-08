'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  buildYearlyTable, pln, type SettlementApartment,
  type SettlementRate, type SettlementEntry, type MonthlyRow
} from '@/lib/settlementCalc'
import { upsertEntry, upsertWaterReconciliation } from '../actions'

interface Reconciliation {
  id: string
  apartment_id: string
  year: number
  quarter: number
  meter_reading_start: number
  meter_reading_end: number
  actual_m3: number
  ryczalt_m3: number
  correction_m3: number
  correction_amount: number
  notes: string | null
}

interface Props {
  apartment: SettlementApartment
  rates: SettlementRate[]
  entries: SettlementEntry[]
  reconciliations: Reconciliation[]
  year: number
  readonly?: boolean
}

export default function MonthlyTable({ apartment, rates, entries, reconciliations, year, readonly = false }: Props) {
  const router = useRouter()
  const [editMonth, setEditMonth] = useState<number | null>(null)
  const [editPaid, setEditPaid] = useState('')
  const [editCorrection, setEditCorrection] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [initialBalance, setInitialBalance] = useState(0)
  const [showBalanceInput, setShowBalanceInput] = useState(false)

  // Rozliczenie kwartalne state
  const [editQuarter, setEditQuarter] = useState<number | null>(null)
  const [qStart, setQStart] = useState('')
  const [qEnd, setQEnd] = useState('')
  const [qNotes, setQNotes] = useState('')
  const [qSaving, setQSaving] = useState(false)
  const [qError, setQError] = useState<string | null>(null)

  const rows = buildYearlyTable(apartment, rates, entries, year, initialBalance)

  const totalPaid = rows.reduce((s, r) => s + r.paid, 0)
  const totalDue = rows.reduce((s, r) => s + r.total_due, 0)
  const totalRenovation = rows.reduce((s, r) => s + r.renovation, 0)
  const totalOperating = rows.reduce((s, r) => s + r.operating, 0)
  const totalManager = rows.reduce((s, r) => s + r.manager, 0)
  const totalWater = rows.reduce((s, r) => s + r.water, 0)
  const totalGarbage = rows.reduce((s, r) => s + r.garbage, 0)
  const totalCorrection = rows.reduce((s, r) => s + r.correction, 0)
  const finalBalance = rows[11]?.balance_end ?? 0

  // Aktualny ryczałt m³ dla ostatnich stawek
  const latestRates = rates[0] ?? null

  function openEdit(row: MonthlyRow) {
    setEditMonth(row.month)
    setEditPaid(row.entry?.paid != null ? String(row.entry.paid) : '')
    setEditCorrection(row.entry?.water_correction != null ? String(row.entry.water_correction) : '')
    setEditNotes(row.entry?.notes ?? '')
    setSaveError(null)
  }

  function closeEdit() {
    setEditMonth(null)
    setSaveError(null)
  }

  async function saveEntry() {
    if (editMonth === null) return
    setSaving(true)
    setSaveError(null)
    const res = await upsertEntry({
      apartment_id: apartment.id,
      community_id: apartment.community_id,
      year,
      month: editMonth,
      paid: parseFloat(editPaid || '0'),
      water_correction: parseFloat(editCorrection || '0'),
      notes: editNotes || null,
    })
    setSaving(false)
    if (res.error) {
      setSaveError(res.error)
    } else {
      setEditMonth(null)
      router.refresh()
    }
  }

  function openQuarter(q: number) {
    const existing = reconciliations.find(r => r.quarter === q)
    setEditQuarter(q)
    setQStart(existing ? String(existing.meter_reading_start) : '')
    setQEnd(existing ? String(existing.meter_reading_end) : '')
    setQNotes(existing?.notes ?? '')
    setQError(null)
  }

  async function saveReconciliation() {
    if (editQuarter === null || !latestRates) return
    setQSaving(true)
    setQError(null)
    const startM = (editQuarter - 1) * 3 + 1
    const monthsInQ = [startM, startM + 1, startM + 2]
    const ryczalt = monthsInQ.reduce((s, m) => {
      const row = rows.find(r => r.month === m)
      return s + (row?.water ?? 0) / (latestRates.water_price_m3 || 1)
    }, 0)

    const res = await upsertWaterReconciliation({
      apartment_id: apartment.id,
      year,
      quarter: editQuarter,
      meter_reading_start: parseFloat(qStart || '0'),
      meter_reading_end: parseFloat(qEnd || '0'),
      ryczalt_m3: parseFloat(qStart || '0') === 0 ? latestRates.water_ryczalt_m3 * 3 : ryczalt,
      water_price_m3: latestRates.water_price_m3,
      notes: qNotes || null,
    })
    setQSaving(false)
    if (res.error) {
      setQError(res.error)
    } else {
      setEditQuarter(null)
      router.refresh()
    }
  }

  const colClass = 'px-2 py-2 text-right text-xs'
  const headerClass = 'px-2 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wide'

  return (
    <div className="space-y-6">
      {/* Saldo początkowe */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">Saldo na 1 stycznia {year}:</span>
        {showBalanceInput ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              value={initialBalance}
              onChange={e => setInitialBalance(parseFloat(e.target.value) || 0)}
              className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            />
            <span className="text-sm text-gray-500">zł</span>
            <button
              onClick={() => setShowBalanceInput(false)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >Zatwierdź</button>
          </div>
        ) : (
          <button
            onClick={() => setShowBalanceInput(true)}
            className={`text-sm font-semibold px-3 py-1 rounded-lg border transition ${
              finalBalance >= 0
                ? 'text-green-400 border-green-800 bg-green-900/20'
                : 'text-red-400 border-red-800 bg-red-900/20'
            }`}
          >
            {pln(initialBalance)} (kliknij aby zmienić)
          </button>
        )}
      </div>

      {/* Tabela miesięczna */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-950">
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide w-28">Miesiąc</th>
                <th className={headerClass}>Saldo pocz.</th>
                <th className={headerClass}>Wpłacono</th>
                <th className={headerClass}>Fund. rem.</th>
                <th className={headerClass}>Fund. ekspl.</th>
                <th className={headerClass}>Zarządca</th>
                <th className={headerClass}>Ryczałt wody</th>
                <th className={headerClass}>Śmieci</th>
                <th className={headerClass}>Korekta</th>
                <th className={headerClass + ' font-bold text-gray-300'}>Razem</th>
                <th className={headerClass}>Saldo końc.</th>
                <th className="px-2 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isEditing = editMonth === row.month
                return (
                  <>
                    <tr
                      key={row.month}
                      className={`border-b border-gray-800/50 transition ${
                        isEditing ? 'bg-blue-950/30' : 'hover:bg-gray-800/30'
                      }`}
                    >
                      <td className="px-3 py-2 text-sm text-gray-300 font-medium">{row.monthName}</td>
                      <td className={colClass + ' ' + (row.balance_start >= 0 ? 'text-green-400' : 'text-red-400')}>
                        {pln(row.balance_start)}
                      </td>
                      <td className={colClass + ' text-blue-300 font-medium'}>{pln(row.paid)}</td>
                      <td className={colClass + ' text-gray-300'}>{row.hasRates ? pln(row.renovation) : '—'}</td>
                      <td className={colClass + ' text-gray-300'}>{row.hasRates ? pln(row.operating) : '—'}</td>
                      <td className={colClass + ' text-gray-300'}>{row.hasRates ? pln(row.manager) : '—'}</td>
                      <td className={colClass + ' text-gray-300'}>{row.hasRates ? pln(row.water) : '—'}</td>
                      <td className={colClass + ' text-gray-300'}>{row.hasRates ? pln(row.garbage) : '—'}</td>
                      <td className={colClass + ' ' + (row.correction !== 0 ? 'text-yellow-400' : 'text-gray-500')}>
                        {row.correction !== 0 ? pln(row.correction) : '—'}
                      </td>
                      <td className={colClass + ' text-gray-100 font-semibold'}>{row.hasRates ? pln(row.total_due) : '—'}</td>
                      <td className={colClass + ' font-semibold ' + (row.balance_end >= 0 ? 'text-green-400' : 'text-red-400')}>
                        {pln(row.balance_end)}
                      </td>
                      {!readonly && (
                        <td className="px-2 py-2">
                          <button
                            onClick={() => isEditing ? closeEdit() : openEdit(row)}
                            className="text-xs text-blue-400 hover:text-blue-300 transition"
                          >
                            {isEditing ? 'Anuluj' : '✏️'}
                          </button>
                        </td>
                      )}
                      {readonly && <td />}
                    </tr>

                    {/* Formularz edycji */}
                    {isEditing && !readonly && (
                      <tr key={`edit-${row.month}`} className="bg-blue-950/20 border-b border-blue-900/30">
                        <td colSpan={12} className="px-4 py-3">
                          <div className="flex flex-wrap items-end gap-3">
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Wpłacono (zł)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editPaid}
                                onChange={e => setEditPaid(e.target.value)}
                                placeholder="0.00"
                                className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Korekta wody (zł)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={editCorrection}
                                onChange={e => setEditCorrection(e.target.value)}
                                placeholder="0.00"
                                className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="flex-1 min-w-40">
                              <label className="text-xs text-gray-400 block mb-1">Uwagi</label>
                              <input
                                type="text"
                                value={editNotes}
                                onChange={e => setEditNotes(e.target.value)}
                                placeholder="opcjonalnie..."
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <button
                              onClick={saveEntry}
                              disabled={saving}
                              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
                            >
                              {saving ? 'Zapisuję...' : 'Zapisz'}
                            </button>
                            {saveError && (
                              <span className="text-red-400 text-xs">{saveError}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>

            {/* Podsumowanie */}
            <tfoot>
              <tr className="bg-gray-800/60 border-t-2 border-gray-700 font-semibold">
                <td className="px-3 py-2.5 text-sm text-gray-200">RAZEM {year}</td>
                <td className="px-2 py-2.5 text-right text-xs text-gray-500">—</td>
                <td className={colClass + ' text-blue-300 font-bold'}>{pln(totalPaid)}</td>
                <td className={colClass + ' text-gray-200'}>{pln(totalRenovation)}</td>
                <td className={colClass + ' text-gray-200'}>{pln(totalOperating)}</td>
                <td className={colClass + ' text-gray-200'}>{pln(totalManager)}</td>
                <td className={colClass + ' text-gray-200'} title={`Ryczałt wody`}>{pln(totalWater)}</td>
                <td className={colClass + ' text-gray-200'}>{pln(totalGarbage)}</td>
                <td className={colClass + ' text-yellow-400'}>{totalCorrection !== 0 ? pln(totalCorrection) : '—'}</td>
                <td className={colClass + ' text-gray-100 font-bold'}>{pln(totalDue)}</td>
                <td className={colClass + ' font-bold ' + (finalBalance >= 0 ? 'text-green-400' : 'text-red-400')}>
                  {pln(finalBalance)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Podsumowanie Ma/Winien */}
        <div className="border-t border-gray-800 px-4 py-3 flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Łącznie naliczono:</span>
            <span className="text-sm font-semibold text-gray-100">{pln(totalDue)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Łącznie wpłacono:</span>
            <span className="text-sm font-semibold text-blue-400">{pln(totalPaid)}</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${
            finalBalance >= 0 ? 'bg-green-900/30 border border-green-800' : 'bg-red-900/30 border border-red-800'
          }`}>
            <span className="text-xs text-gray-400">{finalBalance >= 0 ? '✓ Nadpłata:' : '✗ Niedopłata:'}</span>
            <span className={`text-sm font-bold ${finalBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {pln(Math.abs(finalBalance))}
            </span>
          </div>
        </div>
      </div>

      {/* Rozliczenie kwartalne wody */}
      {apartment.has_meter && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-gray-200">💧 Rozliczenie kwartalne wody</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Ryczałt {latestRates?.water_ryczalt_m3 ?? '?'} m³/mies × {pln(latestRates?.water_price_m3 ?? 0)}/m³
            </p>
          </div>
          <div className="divide-y divide-gray-800">
            {[1, 2, 3, 4].map(q => {
              const rec = reconciliations.find(r => r.quarter === q)
              const qLabel = ['I (sty–mar)', 'II (kwi–cze)', 'III (lip–wrz)', 'IV (paź–gru)'][q - 1]
              const isEditingQ = editQuarter === q

              return (
                <div key={q} className={`px-4 py-3 ${isEditingQ ? 'bg-blue-950/20' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-300 font-medium w-36">Kwartał {qLabel}</span>
                      {rec ? (
                        <div className="flex flex-wrap items-center gap-4 text-xs">
                          <span className="text-gray-400">
                            Odczyt: {rec.meter_reading_start} → {rec.meter_reading_end} m³
                          </span>
                          <span className="text-gray-400">Zużycie: {rec.actual_m3} m³</span>
                          <span className="text-gray-400">Ryczałt: {rec.ryczalt_m3} m³</span>
                          <span className={`font-semibold ${rec.correction_amount >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {rec.correction_amount >= 0 ? 'Dopłata' : 'Nadpłata'}: {pln(Math.abs(rec.correction_amount))}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">Brak odczytu</span>
                      )}
                    </div>
                    {!readonly && (
                      <button
                        onClick={() => isEditingQ ? setEditQuarter(null) : openQuarter(q)}
                        className="text-xs text-blue-400 hover:text-blue-300 transition ml-4"
                      >
                        {isEditingQ ? 'Anuluj' : (rec ? '✏️ Edytuj' : '+ Dodaj odczyt')}
                      </button>
                    )}
                  </div>

                  {isEditingQ && (
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Stan pocz. (m³)</label>
                        <input
                          type="number"
                          step="0.001"
                          value={qStart}
                          onChange={e => setQStart(e.target.value)}
                          placeholder="0.000"
                          className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Stan końc. (m³)</label>
                        <input
                          type="number"
                          step="0.001"
                          value={qEnd}
                          onChange={e => setQEnd(e.target.value)}
                          placeholder="0.000"
                          className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="flex-1 min-w-40">
                        <label className="text-xs text-gray-400 block mb-1">Uwagi</label>
                        <input
                          type="text"
                          value={qNotes}
                          onChange={e => setQNotes(e.target.value)}
                          placeholder="opcjonalnie..."
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <button
                        onClick={saveReconciliation}
                        disabled={qSaving}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
                      >
                        {qSaving ? 'Zapisuję...' : 'Zapisz'}
                      </button>
                      {qError && <span className="text-red-400 text-xs">{qError}</span>}
                      {qStart && qEnd && latestRates && (
                        <span className="text-xs text-gray-400">
                          Korekta: {Math.round((parseFloat(qEnd) - parseFloat(qStart) - latestRates.water_ryczalt_m3 * 3) * 100) / 100} m³
                          = {pln(Math.round((parseFloat(qEnd) - parseFloat(qStart) - latestRates.water_ryczalt_m3 * 3) * latestRates.water_price_m3 * 100) / 100)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

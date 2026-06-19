'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  buildYearlyTable, pln, type SettlementApartment,
  type SettlementRate, type SettlementEntry, type MonthlyRow
} from '@/lib/settlementCalc'
import { upsertEntry, upsertWaterReconciliation, upsertOpeningBalance } from '../actions'

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
  savedOpeningBalance?: number
}

export default function MonthlyTable({ apartment, rates, entries, reconciliations, year, readonly = false, savedOpeningBalance = 0 }: Props) {
  const router = useRouter()
  const [editMonth, setEditMonth] = useState<number | null>(null)
  const [editPaid, setEditPaid] = useState('')
  const [editCorrection, setEditCorrection] = useState('')
  const [editWaterM3, setEditWaterM3] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editPersons, setEditPersons] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [initialBalance, setInitialBalance] = useState(savedOpeningBalance)
  const [showBalanceInput, setShowBalanceInput] = useState(false)
  const [balanceSaving, setBalanceSaving] = useState(false)

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

  // Aktualny model wody i stawki
  const latestRates = rates[0] ?? null
  const billingType = latestRates?.water_billing_type ?? 'ryczalt'
  const isMeterBilling = billingType === 'meter'
  const isZaliczkaBilling = billingType === 'zaliczka'

  // Stałe opłaty (bez wody) dla aktualnie edytowanego miesiąca — do podglądu
  // wyliczonej wody w modelu "zaliczka mieszkańca" (woda = wpłata − to poniżej)
  function fixedChargesExceptWater(persons: number): number {
    if (!latestRates) return 0
    const renovation = latestRates.renovation_rate_m2 * apartment.area_m2
    const operating = latestRates.operating_rate_m2 * apartment.area_m2
    const manager = latestRates.manager_fee_type === 'per_m2'
      ? latestRates.manager_fee_value * apartment.area_m2
      : latestRates.manager_fee_value
    const garbage = persons * latestRates.garbage_per_person
    return renovation + operating + manager + garbage
  }

  // Stan narastająco (opłaty stałe / wpłaty / już rozliczona woda) ze wszystkich
  // miesięcy PRZED danym miesiącem — żeby podgląd na żywo w modelu "zaliczka"
  // zgadzał się z tym, co policzy buildYearlyTable (zaległości stałe mają
  // priorytet przed wodą, więc spóźniona wpłata nie "wpada" cała w wodę).
  function cumulativeBeforeMonth(month: number): { fixedDue: number; paid: number; waterAttributed: number } {
    let fixedDue = 0, paid = 0, waterAttributed = 0
    for (const row of rows) {
      if (row.month >= month) break
      fixedDue += row.renovation + row.operating + row.manager + row.garbage + row.correction
      paid += row.paid
      waterAttributed += row.water
    }
    return { fixedDue, paid, waterAttributed }
  }

  function openEdit(row: MonthlyRow) {
    setEditMonth(row.month)
    setEditPaid(row.entry?.paid != null ? String(row.entry.paid) : '')
    setEditCorrection(row.entry?.water_correction != null ? String(row.entry.water_correction) : '')
    setEditWaterM3(row.entry?.water_m3 != null ? String(row.entry.water_m3) : '')
    setEditNotes(row.entry?.notes ?? '')
    setEditPersons(row.entry?.persons_count != null ? String(row.entry.persons_count) : '')
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
      water_m3: parseFloat(editWaterM3 || '0'),
      notes: editNotes || null,
      persons_count: editPersons.trim() !== '' ? parseInt(editPersons, 10) : null,
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

  // Bazowy m³ za kwartał — suma "wody" naliczonej w 3 miesiącach / cena za m³.
  // Dla modelu 'zaliczka' row.water to już kwota z wpłaty mieszkańca, więc ta
  // suma jest dokładnie m³-odpowiednikiem tego, co faktycznie wpłacił za wodę.
  function quarterPaidWaterM3(quarter: number): number {
    if (!latestRates) return 0
    const startM = (quarter - 1) * 3 + 1
    const monthsInQ = [startM, startM + 1, startM + 2]
    const sumWater = monthsInQ.reduce((s, m) => {
      const row = rows.find(r => r.month === m)
      return s + (row?.water ?? 0)
    }, 0)
    return latestRates.water_price_m3 > 0 ? sumWater / latestRates.water_price_m3 : 0
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
    // Model 'zaliczka' nie ma ryczałtu jako bazy — zawsze porównujemy do tego,
    // co faktycznie wpłacono za wodę. Dla 'ryczalt' zachowanie 1:1 jak dotychczas.
    const baseline_m3 = isZaliczkaBilling
      ? quarterPaidWaterM3(editQuarter)
      : (parseFloat(qStart || '0') === 0 ? latestRates.water_ryczalt_m3 * 3 : ryczalt)

    const res = await upsertWaterReconciliation({
      apartment_id: apartment.id,
      year,
      quarter: editQuarter,
      meter_reading_start: parseFloat(qStart || '0'),
      meter_reading_end: parseFloat(qEnd || '0'),
      ryczalt_m3: baseline_m3,
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
  const headerClass = 'px-2 py-2 text-right text-xs font-medium text-[#0f766e] uppercase tracking-wide'

  return (
    <div className="space-y-6">
      {/* Saldo początkowe */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-[#0f766e]">Saldo na 1 stycznia {year}:</span>
        {showBalanceInput ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              value={initialBalance}
              onChange={e => setInitialBalance(parseFloat(e.target.value) || 0)}
              className="w-28 bg-[#0c2220] border border-[#0f2d2a] rounded-lg px-3 py-1.5 text-sm text-[#f0fdfa] focus:outline-none focus:border-green-500"
            />
            <span className="text-sm text-[#115e59]">zł</span>
            <button
              onClick={async () => {
                setBalanceSaving(true)
                await upsertOpeningBalance(apartment.id, year, initialBalance)
                setBalanceSaving(false)
                setShowBalanceInput(false)
                router.refresh()
              }}
              disabled={balanceSaving}
              className="text-xs text-teal-400 hover:text-teal-300 disabled:opacity-50"
            >{balanceSaving ? 'Zapisuję...' : 'Zatwierdź'}</button>
          </div>
        ) : (
          <button
            onClick={() => setShowBalanceInput(true)}
            className={`text-sm font-semibold px-3 py-1 rounded-lg border transition ${
              finalBalance >= 0
                ? 'text-teal-400 border-teal-700 bg-teal-900/20'
                : 'text-red-400 border-red-800 bg-red-900/20'
            }`}
          >
            {pln(initialBalance)} (kliknij aby zmienić)
          </button>
        )}
      </div>

      {/* Tabela miesięczna */}
      <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-[#0f2d2a] bg-[#051210]">
                <th className="px-3 py-2 text-left text-xs font-medium text-[#0f766e] uppercase tracking-wide w-28">Miesiąc</th>
                <th className={headerClass}>Saldo pocz.</th>
                <th className={headerClass}>Wpłacono</th>
                <th className={headerClass}>Fund. rem.</th>
                <th className={headerClass}>Fund. ekspl.</th>
                <th className={headerClass}>Zarządca</th>
                <th className={headerClass}>{isMeterBilling ? 'Woda (m³)' : isZaliczkaBilling ? 'Woda (z zaliczki)' : 'Ryczałt wody'}</th>
                <th className={headerClass}>Śmieci</th>
                <th className={headerClass}>Korekta</th>
                <th className={headerClass + ' font-bold text-[#99f6e4]'}>Razem</th>
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
                      className={`border-b border-[#0f2d2a]/50 transition ${
                        isEditing ? 'bg-teal-950/30' : 'hover:bg-[#0c2220]/30'
                      }`}
                    >
                      <td className="px-3 py-2 text-sm text-[#99f6e4] font-medium">{row.monthName}</td>
                      <td className={colClass + ' ' + (row.balance_start >= 0 ? 'text-teal-400' : 'text-red-400')}>
                        {pln(row.balance_start)}
                      </td>
                      <td className={colClass + ' text-teal-300 font-medium'}>{pln(row.paid)}</td>
                      <td className={colClass + ' text-[#99f6e4]'}>{row.hasRates ? pln(row.renovation) : '—'}</td>
                      <td className={colClass + ' text-[#99f6e4]'}>{row.hasRates ? pln(row.operating) : '—'}</td>
                      <td className={colClass + ' text-[#99f6e4]'}>{row.hasRates ? pln(row.manager) : '—'}</td>
                      <td className={colClass + ' text-[#99f6e4]'}>{row.hasRates ? pln(row.water) : '—'}</td>
                      <td className={colClass + ' text-[#99f6e4]'}>
                        {row.hasRates ? (
                          <span className="inline-flex items-center gap-1">
                            {pln(row.garbage)}
                            {row.entry?.persons_count != null && (
                              <span title={`Nadpisano: ${row.persons_used} os.`} className="text-amber-400 text-[10px]">👤{row.persons_used}</span>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                      <td className={colClass + ' ' + (row.correction !== 0 ? 'text-yellow-400' : 'text-[#115e59]')}>
                        {row.correction !== 0 ? pln(row.correction) : '—'}
                      </td>
                      <td className={colClass + ' text-[#f0fdfa] font-semibold'}>{row.hasRates ? pln(row.total_due) : '—'}</td>
                      <td className={colClass + ' font-semibold ' + (row.balance_end >= 0 ? 'text-teal-400' : 'text-red-400')}>
                        {pln(row.balance_end)}
                      </td>
                      {!readonly && (
                        <td className="px-2 py-2">
                          <button
                            onClick={() => isEditing ? closeEdit() : openEdit(row)}
                            className="text-xs text-teal-400 hover:text-teal-300 transition"
                          >
                            {isEditing ? 'Anuluj' : '✏️'}
                          </button>
                        </td>
                      )}
                      {readonly && <td />}
                    </tr>

                    {/* Formularz edycji */}
                    {isEditing && !readonly && (
                      <tr key={`edit-${row.month}`} className="bg-teal-950/20 border-b border-teal-800/30">
                        <td colSpan={12} className="px-4 py-3">
                          <div className="flex flex-wrap items-end gap-3">
                            <div>
                              <label className="text-xs text-[#0f766e] block mb-1">Wpłacono (zł)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editPaid}
                                onChange={e => setEditPaid(e.target.value)}
                                placeholder="0.00"
                                className="w-28 bg-[#0c2220] border border-[#0f2d2a] rounded-lg px-3 py-1.5 text-sm text-[#f0fdfa] focus:outline-none focus:border-green-500"
                              />
                            </div>
                            {isMeterBilling ? (
                              <div>
                                <label className="text-xs text-[#0f766e] block mb-1">Zużycie wody (m³)</label>
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  value={editWaterM3}
                                  onChange={e => setEditWaterM3(e.target.value)}
                                  placeholder="0.000"
                                  className="w-28 bg-[#0c2220] border border-[#0f2d2a] rounded-lg px-3 py-1.5 text-sm text-[#f0fdfa] focus:outline-none focus:border-green-500"
                                />
                                {editWaterM3 && latestRates && (
                                  <p className="text-xs text-[#115e59] mt-1">
                                    = {(parseFloat(editWaterM3 || '0') * latestRates.water_price_m3).toFixed(2)} zł
                                  </p>
                                )}
                              </div>
                            ) : isZaliczkaBilling ? (
                              <div>
                                <label className="text-xs text-[#0f766e] block mb-1">Woda (wyliczana automatycznie)</label>
                                {(() => {
                                  const persons = editPersons.trim() !== '' ? parseInt(editPersons, 10) : apartment.persons_count
                                  const { fixedDue: prevFixedDue, paid: prevPaid, waterAttributed: prevWaterAttributed } = cumulativeBeforeMonth(editMonth ?? 1)
                                  const cumFixedDue = prevFixedDue + fixedChargesExceptWater(persons)
                                  const cumPaidNow = prevPaid + parseFloat(editPaid || '0')
                                  const totalWaterAvailable = Math.max(0, cumPaidNow - cumFixedDue)
                                  const waterZl = totalWaterAvailable - prevWaterAttributed
                                  const waterM3 = latestRates && latestRates.water_price_m3 > 0 ? waterZl / latestRates.water_price_m3 : 0
                                  const arrears = Math.max(0, cumFixedDue - cumPaidNow)
                                  return (
                                    <>
                                      <p className="w-44 text-sm text-[#99f6e4] py-1.5">
                                        {waterZl.toFixed(2)} zł
                                        <span className="text-[#115e59] text-xs ml-1">≈ {waterM3.toFixed(2)} m³</span>
                                      </p>
                                      {arrears > 0 && (
                                        <p className="text-[10px] text-amber-400 mt-0.5">
                                          ⚠ najpierw pokryto {arrears.toFixed(2)} zł zaległości stałych — nic nie zostało na wodę
                                        </p>
                                      )}
                                    </>
                                  )
                                })()}
                                <p className="text-[10px] text-[#115e59] mt-0.5">= wpłaty narastająco − zaległe i bieżące opłaty stałe</p>
                              </div>
                            ) : (
                              <div>
                                <label className="text-xs text-[#0f766e] block mb-1">Korekta wody (zł)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editCorrection}
                                  onChange={e => setEditCorrection(e.target.value)}
                                  placeholder="0.00"
                                  className="w-28 bg-[#0c2220] border border-[#0f2d2a] rounded-lg px-3 py-1.5 text-sm text-[#f0fdfa] focus:outline-none focus:border-green-500"
                                />
                              </div>
                            )}
                            <div>
                              <label className="text-xs text-[#0f766e] block mb-1">
                                Liczba osób (śmieci)
                                <span className="text-[#115e59] ml-1">domyślnie: {apartment.persons_count}</span>
                              </label>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={editPersons}
                                onChange={e => setEditPersons(e.target.value)}
                                placeholder={String(apartment.persons_count)}
                                className="w-24 bg-[#0c2220] border border-[#0f2d2a] rounded-lg px-3 py-1.5 text-sm text-[#f0fdfa] focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            <div className="flex-1 min-w-40">
                              <label className="text-xs text-[#0f766e] block mb-1">Uwagi</label>
                              <input
                                type="text"
                                value={editNotes}
                                onChange={e => setEditNotes(e.target.value)}
                                placeholder="opcjonalnie..."
                                className="w-full bg-[#0c2220] border border-[#0f2d2a] rounded-lg px-3 py-1.5 text-sm text-[#f0fdfa] focus:outline-none focus:border-green-500"
                              />
                            </div>
                            <button
                              onClick={saveEntry}
                              disabled={saving}
                              className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
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
              <tr className="bg-[#0c2220]/60 border-t-2 border-[#0f2d2a] font-semibold">
                <td className="px-3 py-2.5 text-sm text-[#ccfbf1]">RAZEM {year}</td>
                <td className="px-2 py-2.5 text-right text-xs text-[#115e59]">—</td>
                <td className={colClass + ' text-teal-300 font-bold'}>{pln(totalPaid)}</td>
                <td className={colClass + ' text-[#ccfbf1]'}>{pln(totalRenovation)}</td>
                <td className={colClass + ' text-[#ccfbf1]'}>{pln(totalOperating)}</td>
                <td className={colClass + ' text-[#ccfbf1]'}>{pln(totalManager)}</td>
                <td className={colClass + ' text-[#ccfbf1]'} title={`Ryczałt wody`}>{pln(totalWater)}</td>
                <td className={colClass + ' text-[#ccfbf1]'}>{pln(totalGarbage)}</td>
                <td className={colClass + ' text-yellow-400'}>{totalCorrection !== 0 ? pln(totalCorrection) : '—'}</td>
                <td className={colClass + ' text-[#f0fdfa] font-bold'}>{pln(totalDue)}</td>
                <td className={colClass + ' font-bold ' + (finalBalance >= 0 ? 'text-teal-400' : 'text-red-400')}>
                  {pln(finalBalance)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Podsumowanie Ma/Winien */}
        <div className="border-t border-[#0f2d2a] px-4 py-3 flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#115e59]">Łącznie naliczono:</span>
            <span className="text-sm font-semibold text-[#f0fdfa]">{pln(totalDue)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#115e59]">Łącznie wpłacono:</span>
            <span className="text-sm font-semibold text-teal-400">{pln(totalPaid)}</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${
            finalBalance >= 0 ? 'bg-teal-900/30 border border-teal-700' : 'bg-red-900/30 border border-red-800'
          }`}>
            <span className="text-xs text-[#0f766e]">{finalBalance >= 0 ? '✓ Nadpłata:' : '✗ Niedopłata:'}</span>
            <span className={`text-sm font-bold ${finalBalance >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
              {pln(Math.abs(finalBalance))}
            </span>
          </div>
        </div>
      </div>

      {/* Rozliczenie kwartalne wody — dla modelu ryczałtowego i zaliczki mieszkańca */}
      {apartment.has_meter && (billingType === 'ryczalt' || isZaliczkaBilling) && (
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#0f2d2a]">
            <h3 className="text-sm font-semibold text-[#ccfbf1]">💧 Rozliczenie kwartalne wody</h3>
            <p className="text-xs text-[#115e59] mt-0.5">
              {isZaliczkaBilling
                ? <>Porównanie z sumą zaliczek wpłaconych na wodę w kwartale × {pln(latestRates?.water_price_m3 ?? 0)}/m³</>
                : <>Ryczałt {latestRates?.water_ryczalt_m3 ?? '?'} m³/mies × {pln(latestRates?.water_price_m3 ?? 0)}/m³</>
              }
            </p>
          </div>
          <div className="divide-y divide-gray-800">
            {[1, 2, 3, 4].map(q => {
              const rec = reconciliations.find(r => r.quarter === q)
              const qLabel = ['I (sty–mar)', 'II (kwi–cze)', 'III (lip–wrz)', 'IV (paź–gru)'][q - 1]
              const isEditingQ = editQuarter === q

              return (
                <div key={q} className={`px-4 py-3 ${isEditingQ ? 'bg-teal-950/20' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-[#99f6e4] font-medium w-36">Kwartał {qLabel}</span>
                      {rec ? (
                        <div className="flex flex-wrap items-center gap-4 text-xs">
                          <span className="text-[#0f766e]">
                            Odczyt: {rec.meter_reading_start} → {rec.meter_reading_end} m³
                          </span>
                          <span className="text-[#0f766e]">Zużycie: {rec.actual_m3} m³</span>
                          <span className="text-[#0f766e]">{isZaliczkaBilling ? 'Z wpłat' : 'Ryczałt'}: {rec.ryczalt_m3} m³</span>
                          <span className={`font-semibold ${rec.correction_amount >= 0 ? 'text-red-400' : 'text-teal-400'}`}>
                            {rec.correction_amount >= 0 ? 'Dopłata' : 'Nadpłata'}: {pln(Math.abs(rec.correction_amount))}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#115e59]">Brak odczytu</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      {rec && (
                        <a
                          href={`/admin/settlements/${apartment.id}/nota-wody/${year}/${q}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-amber-400 hover:text-amber-300 transition whitespace-nowrap"
                        >
                          🖨 Wystaw notę
                        </a>
                      )}
                      {!readonly && (
                        <button
                          onClick={() => isEditingQ ? setEditQuarter(null) : openQuarter(q)}
                          className="text-xs text-teal-400 hover:text-teal-300 transition whitespace-nowrap"
                        >
                          {isEditingQ ? 'Anuluj' : (rec ? '✏️ Edytuj' : '+ Dodaj odczyt')}
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditingQ && (
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <div>
                        <label className="text-xs text-[#0f766e] block mb-1">Stan pocz. (m³)</label>
                        <input
                          type="number"
                          step="0.001"
                          value={qStart}
                          onChange={e => setQStart(e.target.value)}
                          placeholder="0.000"
                          className="w-28 bg-[#0c2220] border border-[#0f2d2a] rounded-lg px-3 py-1.5 text-sm text-[#f0fdfa] focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#0f766e] block mb-1">Stan końc. (m³)</label>
                        <input
                          type="number"
                          step="0.001"
                          value={qEnd}
                          onChange={e => setQEnd(e.target.value)}
                          placeholder="0.000"
                          className="w-28 bg-[#0c2220] border border-[#0f2d2a] rounded-lg px-3 py-1.5 text-sm text-[#f0fdfa] focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <div className="flex-1 min-w-40">
                        <label className="text-xs text-[#0f766e] block mb-1">Uwagi</label>
                        <input
                          type="text"
                          value={qNotes}
                          onChange={e => setQNotes(e.target.value)}
                          placeholder="opcjonalnie..."
                          className="w-full bg-[#0c2220] border border-[#0f2d2a] rounded-lg px-3 py-1.5 text-sm text-[#f0fdfa] focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <button
                        onClick={saveReconciliation}
                        disabled={qSaving}
                        className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
                      >
                        {qSaving ? 'Zapisuję...' : 'Zapisz'}
                      </button>
                      {qError && <span className="text-red-400 text-xs">{qError}</span>}
                      {qStart && qEnd && latestRates && !isZaliczkaBilling && (
                        <span className="text-xs text-[#0f766e]">
                          Korekta: {Math.round((parseFloat(qEnd) - parseFloat(qStart) - latestRates.water_ryczalt_m3 * 3) * 100) / 100} m³
                          = {pln(Math.round((parseFloat(qEnd) - parseFloat(qStart) - latestRates.water_ryczalt_m3 * 3) * latestRates.water_price_m3 * 100) / 100)}
                        </span>
                      )}
                      {qStart && qEnd && latestRates && isZaliczkaBilling && (() => {
                        const baseline = quarterPaidWaterM3(q)
                        const correctionM3 = Math.round((parseFloat(qEnd) - parseFloat(qStart) - baseline) * 1000) / 1000
                        const correctionZl = Math.round(correctionM3 * latestRates.water_price_m3 * 100) / 100
                        return (
                          <span className="text-xs text-[#0f766e]">
                            Zużycie: {(parseFloat(qEnd) - parseFloat(qStart)).toFixed(3)} m³, wpłacono za wodę: {baseline.toFixed(3)} m³ ({pln(baseline * latestRates.water_price_m3)})
                            <br />
                            {correctionZl >= 0 ? 'Dopłata' : 'Nadpłata'}: {pln(Math.abs(correctionZl))}
                          </span>
                        )
                      })()}
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

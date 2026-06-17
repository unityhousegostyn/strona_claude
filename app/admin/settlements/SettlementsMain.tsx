'use client'

import { useState, useTransition, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createApartment, deleteApartment, createRates, deleteRates, updateRates, importEntriesCSV } from './actions'
import { pln, shareStr, buildYearlyTable } from '@/lib/settlementCalc'
import type { SettlementApartment, SettlementRate, SettlementEntry } from '@/lib/settlementCalc'

interface Community { id: string; name: string }

interface Props {
  communities: Community[]
  selectedCommunityId: string | null
  apartments: SettlementApartment[]
  rates: SettlementRate[]
  entries?: SettlementEntry[]
  isAdmin?: boolean
}

const EMPTY_APT = {
  number: '', owner_name: '', area_m2: '', share_numerator: '',
  share_denominator: '', persons_count: '1', has_meter: true, floor: '', notes: '',
}

const EMPTY_RATES = {
  effective_from: '', water_price_m3: '', water_ryczalt_m3: '',
  garbage_per_person: '', renovation_rate_m2: '', operating_rate_m2: '',
  manager_fee_type: 'per_m2' as 'per_m2' | 'fixed', manager_fee_value: '',
  water_billing_type: 'ryczalt' as 'ryczalt' | 'meter',
}

export default function SettlementsMain({ communities, selectedCommunityId, apartments, rates, entries = [], isAdmin = false }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<'apartments' | 'rates' | 'report' | 'import'>('apartments')
  const [reportFilter, setReportFilter] = useState<'all' | 'debt' | 'overpay'>('all')
  const [showAptForm, setShowAptForm] = useState(false)
  const [showRatesForm, setShowRatesForm] = useState(false)
  const [aptForm, setAptForm] = useState(EMPTY_APT)
  const [ratesForm, setRatesForm] = useState(EMPTY_RATES)
  const [error, setError] = useState<string | null>(null)
  const [editRateId, setEditRateId] = useState<string | null>(null)
  const [editRateForm, setEditRateForm] = useState(EMPTY_RATES)

  // Import CSV
  const [csvDragOver, setCsvDragOver] = useState(false)
  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [csvText, setCsvText] = useState<string | null>(null)
  const [csvPreview, setCsvPreview] = useState<string[][]>([])
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    if (!file) return
    setCsvFileName(file.name)
    setImportResult(null)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      setCsvText(text)
      const lines = text.split('\n').filter(l => l.trim())
      setCsvPreview(lines.slice(0, 6).map(l => l.split(/[;,]/).map(p => p.trim().replace(/^"|"$/g, ''))))
    }
    reader.readAsText(file, 'utf-8')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setCsvDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleImport = () => {
    if (!csvText || !selectedCommunityId) return
    setImporting(true)
    startTransition(async () => {
      const result = await importEntriesCSV(selectedCommunityId, csvText)
      setImportResult(result)
      setImporting(false)
      if (result.imported > 0) { setCsvText(null); setCsvFileName(null); setCsvPreview([]); router.refresh() }
    })
  }

  const downloadTemplate = () => {
    const header = 'lokal;rok;miesiac;wplata;woda_m3;korekta_wody;uwagi'
    const example = '14;2026;1;350.00;3.5;0;\n14;2026;2;350.00;3.2;0;'
    const blob = new Blob([header + '\n' + example], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'szablon_wplat.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleCommunityChange = (id: string) => {
    router.push(`/admin/settlements?community=${id}`)
  }

  const handleAddApt = () => {
    if (!selectedCommunityId) return
    setError(null)
    startTransition(async () => {
      const result = await createApartment({
        community_id: selectedCommunityId,
        number: aptForm.number,
        owner_name: aptForm.owner_name,
        area_m2: parseFloat(aptForm.area_m2),
        share_numerator: aptForm.share_numerator ? parseInt(aptForm.share_numerator) : null,
        share_denominator: aptForm.share_denominator ? parseInt(aptForm.share_denominator) : null,
        persons_count: parseInt(aptForm.persons_count),
        has_meter: aptForm.has_meter,
        floor: aptForm.floor ? parseInt(aptForm.floor) : null,
        notes: aptForm.notes || null,
      })
      if (result.error) { setError(result.error); return }
      setAptForm(EMPTY_APT)
      setShowAptForm(false)
      router.refresh()
    })
  }

  const handleDeleteApt = (id: string) => {
    if (!confirm('Zarchiwizować ten lokal?')) return
    startTransition(async () => {
      await deleteApartment(id)
      router.refresh()
    })
  }

  const handleAddRates = () => {
    if (!selectedCommunityId) return
    setError(null)
    startTransition(async () => {
      const result = await createRates({
        community_id: selectedCommunityId,
        effective_from: ratesForm.effective_from,
        water_price_m3: parseFloat(ratesForm.water_price_m3) || 0,
        water_ryczalt_m3: parseFloat(ratesForm.water_ryczalt_m3) || 0,
        garbage_per_person: parseFloat(ratesForm.garbage_per_person) || 0,
        renovation_rate_m2: parseFloat(ratesForm.renovation_rate_m2) || 0,
        operating_rate_m2: parseFloat(ratesForm.operating_rate_m2) || 0,
        manager_fee_type: ratesForm.manager_fee_type,
        manager_fee_value: parseFloat(ratesForm.manager_fee_value) || 0,
        water_billing_type: ratesForm.water_billing_type,
      })
      if (result.error) { setError(result.error); return }
      setRatesForm(EMPTY_RATES)
      setShowRatesForm(false)
      router.refresh()
    })
  }

  const handleDeleteRates = (id: string) => {
    if (!confirm('Usunąć te stawki?')) return
    startTransition(async () => {
      await deleteRates(id)
      router.refresh()
    })
  }

  const handleEditRateOpen = (r: import('@/lib/settlementCalc').SettlementRate) => {
    setEditRateId(r.id)
    setEditRateForm({
      effective_from: r.effective_from,
      water_price_m3: String(r.water_price_m3),
      water_ryczalt_m3: String(r.water_ryczalt_m3),
      garbage_per_person: String(r.garbage_per_person),
      renovation_rate_m2: String(r.renovation_rate_m2),
      operating_rate_m2: String(r.operating_rate_m2),
      manager_fee_type: r.manager_fee_type,
      manager_fee_value: String(r.manager_fee_value),
      water_billing_type: r.water_billing_type ?? 'ryczalt',
    })
    setError(null)
  }

  const handleUpdateRates = () => {
    if (!editRateId) return
    setError(null)
    startTransition(async () => {
      const result = await updateRates(editRateId, {
        effective_from: editRateForm.effective_from,
        water_price_m3: parseFloat(editRateForm.water_price_m3) || 0,
        water_ryczalt_m3: parseFloat(editRateForm.water_ryczalt_m3) || 0,
        garbage_per_person: parseFloat(editRateForm.garbage_per_person) || 0,
        renovation_rate_m2: parseFloat(editRateForm.renovation_rate_m2) || 0,
        operating_rate_m2: parseFloat(editRateForm.operating_rate_m2) || 0,
        manager_fee_type: editRateForm.manager_fee_type,
        manager_fee_value: parseFloat(editRateForm.manager_fee_value) || 0,
        water_billing_type: editRateForm.water_billing_type,
      })
      if (result.error) { setError(result.error); return }
      setEditRateId(null)
      setEditRateForm(EMPTY_RATES)
      router.refresh()
    })
  }

  const totalArea = apartments.reduce((s, a) => s + Number(a.area_m2), 0)
  const currentRates = rates[0] ?? null

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#fef9ee]">Rozliczenia</h2>
          <p className="text-sm text-[#a16207] mt-0.5">Moduł rozliczeń wspólnoty — tylko super admin</p>
        </div>
        {communities.length > 0 && !isAdmin && (
          <select
            value={selectedCommunityId ?? ''}
            onChange={e => handleCommunityChange(e.target.value)}
            className="input text-sm py-1.5"
          >
            {communities.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {!selectedCommunityId && (
        <p className="text-sm text-[#a16207]">Brak wspólnot. Dodaj najpierw wspólnotę.</p>
      )}

      {selectedCommunityId && (
        <>
          {/* Zakładki */}
          <div className="flex gap-1 bg-[#1e1409] rounded-xl p-1 w-fit border border-[#33200d]">
            {(['apartments', 'rates', 'report', 'import'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  tab === t ? 'bg-[#271a0c] text-[#fef9ee]' : 'text-[#a16207] hover:text-[#fde68a]'
                }`}
              >
                {t === 'apartments' ? `🏠 Lokale (${apartments.length})`
                  : t === 'rates' ? '📊 Stawki'
                  : t === 'report' ? '📋 Raport'
                  : '📥 Import'}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-950/30 border border-red-900 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* ── LOKALE ── */}
          {tab === 'apartments' && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-[#1e1409] border border-[#33200d] rounded-xl p-4">
                  <p className="text-xs text-[#a16207]">Lokale</p>
                  <p className="text-2xl font-bold text-[#fef9ee] mt-1">{apartments.length}</p>
                </div>
                <div className="bg-[#1e1409] border border-[#33200d] rounded-xl p-4">
                  <p className="text-xs text-[#a16207]">Łączna powierzchnia</p>
                  <p className="text-2xl font-bold text-[#fef9ee] mt-1">{totalArea.toFixed(2)} m²</p>
                </div>
                <div className="bg-[#1e1409] border border-[#33200d] rounded-xl p-4">
                  <p className="text-xs text-[#a16207]">Stawki od</p>
                  <p className="text-2xl font-bold text-[#fef9ee] mt-1">
                    {currentRates ? new Date(currentRates.effective_from).toLocaleDateString('pl-PL') : '—'}
                  </p>
                </div>
              </div>

              {/* Przycisk dodaj */}
              <div className="flex justify-end">
                <button
                  onClick={() => setShowAptForm(!showAptForm)}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                >
                  + Dodaj lokal
                </button>
              </div>

              {/* Formularz dodania lokalu */}
              {showAptForm && (
                <div className="bg-[#1e1409] border border-[#33200d] rounded-xl p-5 space-y-4">
                  <h3 className="font-semibold text-[#fef3c7]">Nowy lokal</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#b45309] mb-1">Nr lokalu *</label>
                      <input className="input w-full" placeholder="np. 14" value={aptForm.number}
                        onChange={e => setAptForm(p => ({ ...p, number: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-[#b45309] mb-1">Właściciel *</label>
                      <input className="input w-full" placeholder="Jan Kowalski" value={aptForm.owner_name}
                        onChange={e => setAptForm(p => ({ ...p, owner_name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-[#b45309] mb-1">Powierzchnia m² (z KW) *</label>
                      <input className="input w-full" type="number" step="0.0001" placeholder="47.12" value={aptForm.area_m2}
                        onChange={e => setAptForm(p => ({ ...p, area_m2: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-[#b45309] mb-1">Liczba osób *</label>
                      <input className="input w-full" type="number" min="1" value={aptForm.persons_count}
                        onChange={e => setAptForm(p => ({ ...p, persons_count: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-[#b45309] mb-1">Udział z KW (licznik)</label>
                      <input className="input w-full" type="number" placeholder="4712" value={aptForm.share_numerator}
                        onChange={e => setAptForm(p => ({ ...p, share_numerator: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-[#b45309] mb-1">Udział z KW (mianownik)</label>
                      <input className="input w-full" type="number" placeholder="100000" value={aptForm.share_denominator}
                        onChange={e => setAptForm(p => ({ ...p, share_denominator: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-[#b45309] mb-1">Piętro</label>
                      <input className="input w-full" type="number" placeholder="2" value={aptForm.floor}
                        onChange={e => setAptForm(p => ({ ...p, floor: e.target.value }))} />
                    </div>
                    <div className="flex items-center gap-3 pt-5">
                      <input type="checkbox" id="has_meter" checked={aptForm.has_meter}
                        onChange={e => setAptForm(p => ({ ...p, has_meter: e.target.checked }))}
                        className="w-4 h-4 accent-green-600" />
                      <label htmlFor="has_meter" className="text-sm text-[#fde68a]">Ma wodomierz</label>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-[#b45309] mb-1">Uwagi</label>
                      <input className="input w-full" placeholder="Opcjonalnie" value={aptForm.notes}
                        onChange={e => setAptForm(p => ({ ...p, notes: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleAddApt} disabled={isPending}
                      className="bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                      {isPending ? 'Zapisywanie...' : 'Zapisz lokal'}
                    </button>
                    <button onClick={() => setShowAptForm(false)} className="text-sm text-[#a16207] hover:text-[#fde68a]">Anuluj</button>
                  </div>
                </div>
              )}

              {/* Lista lokali */}
              {apartments.length === 0 ? (
                <p className="text-sm text-[#a16207]">Brak lokali. Dodaj pierwszy lokal.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-[#33200d]">
                        {['Nr', 'Właściciel', 'Pow. m²', 'Udział KW', 'Osoby', 'Wodomierz', `Saldo ${new Date().getFullYear()}`, ''].map(h => (
                          <th key={h} className="text-left text-xs text-[#a16207] font-medium pb-2 pr-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {apartments.map(apt => (
                        <tr key={apt.id} className="border-b border-[#33200d]/50 hover:bg-[#1e1409]/50 transition">
                          <td className="py-3 pr-4 font-semibold text-[#fef9ee]">{apt.number}</td>
                          <td className="py-3 pr-4 text-[#fde68a]">{apt.owner_name}</td>
                          <td className="py-3 pr-4 text-[#fde68a]">{Number(apt.area_m2).toFixed(4)}</td>
                          <td className="py-3 pr-4 text-[#b45309] text-xs">{shareStr(apt)}</td>
                          <td className="py-3 pr-4 text-[#b45309]">{apt.persons_count}</td>
                          <td className="py-3 pr-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${apt.has_meter ? 'bg-amber-900/30 text-amber-400' : 'bg-[#271a0c] text-[#a16207]'}`}>
                              {apt.has_meter ? 'Tak' : 'Nie'}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            {(() => {
                              const aptEntries = entries.filter(e => e.apartment_id === apt.id)
                              const rows = buildYearlyTable(apt, rates, aptEntries, new Date().getFullYear())
                              const balance = rows[rows.length - 1]?.balance_end ?? 0
                              if (balance === 0) return <span className="text-xs text-[#a16207]">—</span>
                              return (
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${balance > 0 ? 'bg-amber-900/30 text-amber-400' : 'bg-red-900/30 text-red-400'}`}>
                                  {balance > 0 ? '+' : ''}{pln(balance)}
                                </span>
                              )
                            })()}
                          </td>
                          <td className="py-3 flex items-center gap-3">
                            <Link href={`/admin/settlements/${apt.id}`}
                              className="text-xs text-amber-400 hover:text-amber-300 transition font-medium">
                              Rozliczenie →
                            </Link>
                            <button onClick={() => handleDeleteApt(apt.id)} disabled={isPending}
                              className="text-xs text-[#a16207] hover:text-red-400 transition">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── STAWKI ── */}
          {tab === 'rates' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => setShowRatesForm(!showRatesForm)}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                  + Nowe stawki
                </button>
              </div>

              {showRatesForm && (
                <div className="bg-[#1e1409] border border-[#33200d] rounded-xl p-5 space-y-4">
                  <h3 className="font-semibold text-[#fef3c7]">Nowe stawki</h3>
                  <p className="text-xs text-[#a16207]">Stawki obowiązują od podanej daty do momentu wprowadzenia następnych.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="block text-xs text-[#b45309] mb-1">Obowiązuje od *</label>
                      <input className="input w-48" type="date" value={ratesForm.effective_from}
                        onChange={e => setRatesForm(p => ({ ...p, effective_from: e.target.value }))} />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="block text-xs text-[#b45309] mb-1">Model rozliczania wody</label>
                      <select className="input w-full max-w-xs" value={ratesForm.water_billing_type}
                        onChange={e => setRatesForm(p => ({ ...p, water_billing_type: e.target.value as 'ryczalt' | 'meter' }))}>
                        <option value="ryczalt">Ryczałt (stała m³/miesiąc)</option>
                        <option value="meter">Licznik (odczyt co miesiąc)</option>
                      </select>
                    </div>
                    {[
                      { key: 'water_price_m3', label: 'Cena wody (zł/m³)' },
                      ...(ratesForm.water_billing_type === 'ryczalt' ? [{ key: 'water_ryczalt_m3', label: 'Ryczałt wody (m³/mies.)' }] : []),
                      { key: 'garbage_per_person', label: 'Śmieci (zł/os./mies.)' },
                      { key: 'renovation_rate_m2', label: 'Fundusz remontowy (zł/m²)' },
                      { key: 'operating_rate_m2', label: 'Fundusz eksploatacyjny (zł/m²)' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs text-[#b45309] mb-1">{f.label}</label>
                        <input className="input w-full" type="number" step="0.0001" placeholder="0.00"
                          value={(ratesForm as any)[f.key]}
                          onChange={e => setRatesForm(p => ({ ...p, [f.key]: e.target.value }))} />
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs text-[#b45309] mb-1">Zarządca — typ</label>
                      <select className="input w-full" value={ratesForm.manager_fee_type}
                        onChange={e => setRatesForm(p => ({ ...p, manager_fee_type: e.target.value as 'per_m2' | 'fixed' }))}>
                        <option value="per_m2">Wg m² (zł/m²)</option>
                        <option value="fixed">Stała kwota (zł/lokal)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#b45309] mb-1">
                        Zarządca — {ratesForm.manager_fee_type === 'per_m2' ? 'stawka zł/m²' : 'kwota stała zł/lokal'}
                      </label>
                      <input className="input w-full" type="number" step="0.01" placeholder="0.00"
                        value={ratesForm.manager_fee_value}
                        onChange={e => setRatesForm(p => ({ ...p, manager_fee_value: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleAddRates} disabled={isPending}
                      className="bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                      {isPending ? 'Zapisywanie...' : 'Zapisz stawki'}
                    </button>
                    <button onClick={() => setShowRatesForm(false)} className="text-sm text-[#a16207] hover:text-[#fde68a]">Anuluj</button>
                  </div>
                </div>
              )}

              {rates.length === 0 ? (
                <p className="text-sm text-[#a16207]">Brak stawek. Dodaj pierwsze stawki.</p>
              ) : (
                <div className="space-y-3">
                  {rates.map((r, i) => (
                    <div key={r.id} className="bg-[#1e1409] border border-[#33200d] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-[#fef9ee]">
                            Od: {r.effective_from.split('-').slice(0,2).reverse().join('.')+'.'+r.effective_from.split('-')[0]}
                          </span>
                          {i === 0 && (
                            <span className="text-xs bg-amber-900/30 text-amber-400 px-2 py-0.5 rounded-full">Aktualne</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => editRateId === r.id ? setEditRateId(null) : handleEditRateOpen(r)}
                            disabled={isPending}
                            className="text-xs text-amber-400 hover:text-amber-300 transition">
                            {editRateId === r.id ? 'Zwiń' : '✏ Edytuj'}
                          </button>
                          <button onClick={() => handleDeleteRates(r.id)} disabled={isPending}
                            className="text-xs text-[#a16207] hover:text-red-400 transition">✕ Usuń</button>
                        </div>
                      </div>

                      {/* Inline edit form */}
                      {editRateId === r.id ? (
                        <div className="space-y-4 pt-2 border-t border-[#33200d]">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div className="sm:col-span-2 lg:col-span-3">
                              <label className="block text-xs text-[#b45309] mb-1">Obowiązuje od *</label>
                              <input className="input w-48" type="date" value={editRateForm.effective_from}
                                onChange={e => setEditRateForm(p => ({ ...p, effective_from: e.target.value }))} />
                            </div>
                            <div className="sm:col-span-2 lg:col-span-3">
                              <label className="block text-xs text-[#b45309] mb-1">Model rozliczania wody</label>
                              <select className="input w-full max-w-xs" value={editRateForm.water_billing_type}
                                onChange={e => setEditRateForm(p => ({ ...p, water_billing_type: e.target.value as 'ryczalt' | 'meter' }))}>
                                <option value="ryczalt">Ryczałt (stała m³/miesiąc)</option>
                                <option value="meter">Licznik (odczyt co miesiąc)</option>
                              </select>
                            </div>
                            {[
                              { key: 'water_price_m3', label: 'Cena wody (zł/m³)' },
                              ...(editRateForm.water_billing_type === 'ryczalt' ? [{ key: 'water_ryczalt_m3', label: 'Ryczałt wody (m³/mies.)' }] : []),
                              { key: 'garbage_per_person', label: 'Śmieci (zł/os./mies.)' },
                              { key: 'renovation_rate_m2', label: 'Fundusz remontowy (zł/m²)' },
                              { key: 'operating_rate_m2', label: 'Fundusz eksploatacyjny (zł/m²)' },
                            ].map(f => (
                              <div key={f.key}>
                                <label className="block text-xs text-[#b45309] mb-1">{f.label}</label>
                                <input className="input w-full" type="number" step="0.0001" placeholder="0.00"
                                  value={(editRateForm as any)[f.key]}
                                  onChange={e => setEditRateForm(p => ({ ...p, [f.key]: e.target.value }))} />
                              </div>
                            ))}
                            <div>
                              <label className="block text-xs text-[#b45309] mb-1">Zarządca — typ</label>
                              <select className="input w-full" value={editRateForm.manager_fee_type}
                                onChange={e => setEditRateForm(p => ({ ...p, manager_fee_type: e.target.value as 'per_m2' | 'fixed' }))}>
                                <option value="per_m2">Wg m² (zł/m²)</option>
                                <option value="fixed">Stała kwota (zł/lokal)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-[#b45309] mb-1">
                                Zarządca — {editRateForm.manager_fee_type === 'per_m2' ? 'stawka zł/m²' : 'kwota stała zł/lokal'}
                              </label>
                              <input className="input w-full" type="number" step="0.01" placeholder="0.00"
                                value={editRateForm.manager_fee_value}
                                onChange={e => setEditRateForm(p => ({ ...p, manager_fee_value: e.target.value }))} />
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button onClick={handleUpdateRates} disabled={isPending}
                              className="bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                              {isPending ? 'Zapisywanie...' : 'Zapisz zmiany'}
                            </button>
                            <button onClick={() => setEditRateId(null)} className="text-sm text-[#a16207] hover:text-[#fde68a]">Anuluj</button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          {[
                            { label: 'Cena wody', value: `${r.water_price_m3} zł/m³` },
                            { label: 'Woda — model', value: (r.water_billing_type ?? 'ryczalt') === 'meter' ? `Licznik m³` : `Ryczałt ${r.water_ryczalt_m3} m³/mies.` },
                            { label: 'Śmieci', value: `${r.garbage_per_person} zł/os.` },
                            { label: 'Fund. remontowy', value: `${r.renovation_rate_m2} zł/m²` },
                            { label: 'Fund. eksploat.', value: `${r.operating_rate_m2} zł/m²` },
                            { label: 'Zarządca', value: r.manager_fee_type === 'per_m2' ? `${r.manager_fee_value} zł/m²` : `${r.manager_fee_value} zł/lokal (stała)` },
                          ].map(item => (
                            <div key={item.label}>
                              <p className="text-[#a16207]">{item.label}</p>
                              <p className="text-[#fef3c7] font-medium mt-0.5">{item.value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── RAPORT ── */}
          {tab === 'report' && (() => {
            const year = new Date().getFullYear()

            const reportRows = apartments.map(apt => {
              const aptEntries = entries.filter(e => e.apartment_id === apt.id)
              const rows = buildYearlyTable(apt, rates, aptEntries, year)
              const totalPaid = rows.reduce((s, r) => s + r.paid, 0)
              const totalDue  = rows.reduce((s, r) => s + r.total_due, 0)
              const balance   = rows[rows.length - 1]?.balance_end ?? 0
              return { apt, totalPaid, totalDue, balance }
            })

            const filtered = reportRows.filter(r =>
              reportFilter === 'all' ? true :
              reportFilter === 'debt' ? r.balance < 0 :
              r.balance > 0
            )

            const sumPaid = reportRows.reduce((s, r) => s + r.totalPaid, 0)
            const sumDue  = reportRows.reduce((s, r) => s + r.totalDue, 0)
            const sumBalance = reportRows.reduce((s, r) => s + r.balance, 0)
            const debtCount  = reportRows.filter(r => r.balance < 0).length
            const overpayCount = reportRows.filter(r => r.balance > 0).length

            return (
              <div className="space-y-4">
                {/* Karty podsumowania */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#1e1409] border border-[#33200d] rounded-xl p-4">
                    <p className="text-xs text-[#a16207]">Łącznie naliczono</p>
                    <p className="text-xl font-bold text-[#fef9ee] mt-1">{pln(sumDue)}</p>
                  </div>
                  <div className="bg-[#1e1409] border border-[#33200d] rounded-xl p-4">
                    <p className="text-xs text-[#a16207]">Łącznie wpłacono</p>
                    <p className="text-xl font-bold text-amber-400 mt-1">{pln(sumPaid)}</p>
                  </div>
                  <div className={`bg-[#1e1409] border rounded-xl p-4 ${sumBalance >= 0 ? 'border-amber-800' : 'border-red-900'}`}>
                    <p className="text-xs text-[#a16207]">Saldo wspólnoty</p>
                    <p className={`text-xl font-bold mt-1 ${sumBalance >= 0 ? 'text-amber-400' : 'text-red-400'}`}>{pln(sumBalance)}</p>
                  </div>
                  <div className="bg-[#1e1409] border border-[#33200d] rounded-xl p-4">
                    <p className="text-xs text-[#a16207]">Zalegający / nadpłacający</p>
                    <p className="text-xl font-bold mt-1">
                      <span className="text-red-400">{debtCount}</span>
                      <span className="text-[#a16207] mx-1">/</span>
                      <span className="text-amber-400">{overpayCount}</span>
                    </p>
                  </div>
                </div>

                {/* Filtr */}
                <div className="flex gap-2">
                  {(['all', 'debt', 'overpay'] as const).map(f => (
                    <button key={f} onClick={() => setReportFilter(f)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition border ${
                        reportFilter === f
                          ? f === 'debt' ? 'bg-red-900/30 border-red-800 text-red-400'
                            : f === 'overpay' ? 'bg-amber-900/30 border-amber-700 text-amber-400'
                            : 'bg-[#271a0c] border-[#33200d] text-[#fef9ee]'
                          : 'border-[#33200d] text-[#a16207] hover:text-[#fde68a]'
                      }`}>
                      {f === 'all' ? `Wszystkie (${reportRows.length})` : f === 'debt' ? `⚠ Zaległości (${debtCount})` : `✓ Nadpłaty (${overpayCount})`}
                    </button>
                  ))}
                </div>

                {/* Tabela */}
                <div className="bg-[#1e1409] border border-[#33200d] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[700px]">
                      <thead>
                        <tr className="border-b border-[#33200d] bg-[#18110a]">
                          {['Nr', 'Właściciel', 'Pow. m²', 'Osoby', 'Naliczono', 'Wpłacono', 'Saldo', ''].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-xs font-medium text-[#b45309] uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(({ apt, totalPaid, totalDue, balance }) => (
                          <tr key={apt.id} className="border-b border-[#33200d]/50 hover:bg-[#271a0c]/30 transition">
                            <td className="px-3 py-2.5 font-semibold text-[#fef9ee]">{apt.number}</td>
                            <td className="px-3 py-2.5 text-[#fde68a]">{apt.owner_name}</td>
                            <td className="px-3 py-2.5 text-[#b45309] text-xs">{Number(apt.area_m2).toFixed(2)}</td>
                            <td className="px-3 py-2.5 text-[#b45309]">{apt.persons_count}</td>
                            <td className="px-3 py-2.5 text-[#fef3c7]">{pln(totalDue)}</td>
                            <td className="px-3 py-2.5 text-amber-300 font-medium">{pln(totalPaid)}</td>
                            <td className="px-3 py-2.5">
                              {balance === 0
                                ? <span className="text-[#a16207] text-xs">—</span>
                                : <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${balance > 0 ? 'bg-amber-900/30 text-amber-400' : 'bg-red-900/30 text-red-400'}`}>
                                    {balance > 0 ? '+' : ''}{pln(balance)}
                                  </span>
                              }
                            </td>
                            <td className="px-3 py-2.5">
                              <Link href={`/admin/settlements/${apt.id}`}
                                className="text-xs text-amber-400 hover:text-amber-300 transition font-medium">
                                Szczegóły →
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#271a0c]/60 border-t-2 border-[#33200d] font-semibold">
                          <td colSpan={4} className="px-3 py-2.5 text-sm text-[#b45309]">RAZEM {year}</td>
                          <td className="px-3 py-2.5 text-sm text-[#fef3c7]">{pln(sumDue)}</td>
                          <td className="px-3 py-2.5 text-sm text-amber-300">{pln(sumPaid)}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-sm font-bold ${sumBalance >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                              {sumBalance > 0 ? '+' : ''}{pln(sumBalance)}
                            </span>
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )
          })()}
          {/* ── IMPORT CSV ── */}
          {tab === 'import' && (
            <div className="space-y-5 max-w-2xl">
              <div>
                <h3 className="text-lg font-semibold text-[#fef9ee]">Import wpłat z CSV</h3>
                <p className="text-sm text-[#a16207] mt-1">
                  Zaimportuj wpłaty mieszkańców hurtowo. Istniejące wpisy (lokal + rok + miesiąc) zostaną nadpisane.
                </p>
              </div>

              {/* Format */}
              <div className="bg-[#1e1409] border border-[#33200d] rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-[#b45309] uppercase tracking-wide">Format CSV</p>
                <code className="block text-xs text-amber-400 bg-[#18110a] rounded p-3 font-mono">
                  lokal;rok;miesiac;wplata;woda_m3;korekta_wody;uwagi<br />
                  14;2026;1;350.00;3.5;0;<br />
                  7;2026;1;280.00;0;0;
                </code>
                <p className="text-xs text-[#a16207]">Kolumny <span className="text-[#fde68a]">woda_m3, korekta_wody, uwagi</span> są opcjonalne (domyślnie 0).</p>
                <button onClick={downloadTemplate}
                  className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 transition">
                  Pobierz szablon CSV
                </button>
              </div>

              {/* Drag & drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setCsvDragOver(true) }}
                onDragLeave={() => setCsvDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all p-10 text-center select-none ${
                  csvDragOver
                    ? 'border-green-500 bg-amber-950/20 scale-[1.01]'
                    : csvFileName
                    ? 'border-green-700 bg-amber-950/20'
                    : 'border-[#33200d] bg-[#1e1409]/50 hover:border-[#3d2008] hover:bg-[#1e1409]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
                <div className="text-4xl mb-3">{csvFileName ? '✅' : '📂'}</div>
                {csvFileName ? (
                  <>
                    <p className="text-sm font-semibold text-amber-400">{csvFileName}</p>
                    <p className="text-xs text-[#a16207] mt-1">Kliknij żeby wybrać inny plik</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-[#fde68a]">Przeciągnij plik CSV tutaj</p>
                    <p className="text-xs text-[#a16207] mt-1">lub kliknij żeby wybrać z dysku</p>
                  </>
                )}
              </div>

              {/* Podgląd */}
              {csvPreview.length > 0 && (
                <div className="bg-[#1e1409] border border-[#33200d] rounded-xl overflow-hidden">
                  <p className="text-xs text-[#b45309] px-4 py-2 border-b border-[#33200d]">
                    Podgląd (pierwsze {csvPreview.length} wierszy)
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <tbody>
                        {csvPreview.map((row, i) => (
                          <tr key={i} className={`border-b border-[#33200d]/50 ${i === 0 ? 'bg-[#271a0c]/40 text-[#b45309]' : 'text-[#fde68a]'}`}>
                            {row.map((cell, j) => (
                              <td key={j} className="px-3 py-1.5 whitespace-nowrap">{cell || <span className="text-stone-300">—</span>}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Wynik importu */}
              {importResult && (
                <div className={`rounded-xl border p-4 text-sm space-y-1 ${
                  importResult.errors.length === 0
                    ? 'bg-amber-950/30 border-amber-700 text-amber-400'
                    : 'bg-yellow-950/30 border-yellow-800 text-yellow-400'
                }`}>
                  <p className="font-semibold">
                    ✓ Zaimportowano {importResult.imported} wpis{importResult.imported === 1 ? '' : importResult.imported < 5 ? 'y' : 'ów'}
                    {importResult.skipped > 0 && <span className="text-[#b45309] font-normal"> · pominięto {importResult.skipped}</span>}
                  </p>
                  {importResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-400">⚠ {e}</p>
                  ))}
                </div>
              )}

              {/* Przycisk import */}
              {csvText && (
                <button
                  onClick={handleImport}
                  disabled={importing || isPending}
                  className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition"
                >
                  {importing || isPending ? 'Importowanie...' : '📥 Importuj wpłaty'}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

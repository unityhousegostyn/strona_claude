'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createApartment, deleteApartment, createRates, deleteRates } from './actions'
import { pln, shareStr } from '@/lib/settlementCalc'
import type { SettlementApartment, SettlementRate } from '@/lib/settlementCalc'

interface Community { id: string; name: string }

interface Props {
  communities: Community[]
  selectedCommunityId: string | null
  apartments: SettlementApartment[]
  rates: SettlementRate[]
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
}

export default function SettlementsMain({ communities, selectedCommunityId, apartments, rates, isAdmin = false }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<'apartments' | 'rates'>('apartments')
  const [showAptForm, setShowAptForm] = useState(false)
  const [showRatesForm, setShowRatesForm] = useState(false)
  const [aptForm, setAptForm] = useState(EMPTY_APT)
  const [ratesForm, setRatesForm] = useState(EMPTY_RATES)
  const [error, setError] = useState<string | null>(null)

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

  const totalArea = apartments.reduce((s, a) => s + Number(a.area_m2), 0)
  const currentRates = rates[0] ?? null

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Rozliczenia</h2>
          <p className="text-sm text-gray-500 mt-0.5">Moduł rozliczeń wspólnoty — tylko super admin</p>
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
        <p className="text-sm text-gray-500">Brak wspólnot. Dodaj najpierw wspólnotę.</p>
      )}

      {selectedCommunityId && (
        <>
          {/* Zakładki */}
          <div className="flex gap-1 bg-gray-900 rounded-xl p-1 w-fit border border-gray-800">
            {(['apartments', 'rates'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  tab === t ? 'bg-gray-800 text-gray-100' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t === 'apartments' ? `🏠 Lokale (${apartments.length})` : '📊 Stawki'}
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
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500">Lokale</p>
                  <p className="text-2xl font-bold text-gray-100 mt-1">{apartments.length}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500">Łączna powierzchnia</p>
                  <p className="text-2xl font-bold text-gray-100 mt-1">{totalArea.toFixed(2)} m²</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500">Stawki od</p>
                  <p className="text-2xl font-bold text-gray-100 mt-1">
                    {currentRates ? new Date(currentRates.effective_from).toLocaleDateString('pl-PL') : '—'}
                  </p>
                </div>
              </div>

              {/* Przycisk dodaj */}
              <div className="flex justify-end">
                <button
                  onClick={() => setShowAptForm(!showAptForm)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                >
                  + Dodaj lokal
                </button>
              </div>

              {/* Formularz dodania lokalu */}
              {showAptForm && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                  <h3 className="font-semibold text-gray-200">Nowy lokal</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Nr lokalu *</label>
                      <input className="input w-full" placeholder="np. 14" value={aptForm.number}
                        onChange={e => setAptForm(p => ({ ...p, number: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Właściciel *</label>
                      <input className="input w-full" placeholder="Jan Kowalski" value={aptForm.owner_name}
                        onChange={e => setAptForm(p => ({ ...p, owner_name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Powierzchnia m² (z KW) *</label>
                      <input className="input w-full" type="number" step="0.0001" placeholder="47.12" value={aptForm.area_m2}
                        onChange={e => setAptForm(p => ({ ...p, area_m2: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Liczba osób *</label>
                      <input className="input w-full" type="number" min="1" value={aptForm.persons_count}
                        onChange={e => setAptForm(p => ({ ...p, persons_count: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Udział z KW (licznik)</label>
                      <input className="input w-full" type="number" placeholder="4712" value={aptForm.share_numerator}
                        onChange={e => setAptForm(p => ({ ...p, share_numerator: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Udział z KW (mianownik)</label>
                      <input className="input w-full" type="number" placeholder="100000" value={aptForm.share_denominator}
                        onChange={e => setAptForm(p => ({ ...p, share_denominator: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Piętro</label>
                      <input className="input w-full" type="number" placeholder="2" value={aptForm.floor}
                        onChange={e => setAptForm(p => ({ ...p, floor: e.target.value }))} />
                    </div>
                    <div className="flex items-center gap-3 pt-5">
                      <input type="checkbox" id="has_meter" checked={aptForm.has_meter}
                        onChange={e => setAptForm(p => ({ ...p, has_meter: e.target.checked }))}
                        className="w-4 h-4 accent-blue-600" />
                      <label htmlFor="has_meter" className="text-sm text-gray-300">Ma wodomierz</label>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-gray-400 mb-1">Uwagi</label>
                      <input className="input w-full" placeholder="Opcjonalnie" value={aptForm.notes}
                        onChange={e => setAptForm(p => ({ ...p, notes: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleAddApt} disabled={isPending}
                      className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                      {isPending ? 'Zapisywanie...' : 'Zapisz lokal'}
                    </button>
                    <button onClick={() => setShowAptForm(false)} className="text-sm text-gray-500 hover:text-gray-300">Anuluj</button>
                  </div>
                </div>
              )}

              {/* Lista lokali */}
              {apartments.length === 0 ? (
                <p className="text-sm text-gray-500">Brak lokali. Dodaj pierwszy lokal.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        {['Nr', 'Właściciel', 'Pow. m²', 'Udział KW', 'Osoby', 'Wodomierz', ''].map(h => (
                          <th key={h} className="text-left text-xs text-gray-500 font-medium pb-2 pr-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {apartments.map(apt => (
                        <tr key={apt.id} className="border-b border-gray-800/50 hover:bg-gray-900/50 transition">
                          <td className="py-3 pr-4 font-semibold text-gray-100">{apt.number}</td>
                          <td className="py-3 pr-4 text-gray-300">{apt.owner_name}</td>
                          <td className="py-3 pr-4 text-gray-300">{Number(apt.area_m2).toFixed(4)}</td>
                          <td className="py-3 pr-4 text-gray-400 text-xs">{shareStr(apt)}</td>
                          <td className="py-3 pr-4 text-gray-400">{apt.persons_count}</td>
                          <td className="py-3 pr-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${apt.has_meter ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                              {apt.has_meter ? 'Tak' : 'Nie'}
                            </span>
                          </td>
                          <td className="py-3 flex items-center gap-3">
                            <Link href={`/admin/settlements/${apt.id}`}
                              className="text-xs text-blue-400 hover:text-blue-300 transition font-medium">
                              Rozliczenie →
                            </Link>
                            <button onClick={() => handleDeleteApt(apt.id)} disabled={isPending}
                              className="text-xs text-gray-600 hover:text-red-400 transition">✕</button>
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
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                  + Nowe stawki
                </button>
              </div>

              {showRatesForm && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                  <h3 className="font-semibold text-gray-200">Nowe stawki</h3>
                  <p className="text-xs text-gray-500">Stawki obowiązują od podanej daty do momentu wprowadzenia następnych.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="block text-xs text-gray-400 mb-1">Obowiązuje od *</label>
                      <input className="input w-48" type="date" value={ratesForm.effective_from}
                        onChange={e => setRatesForm(p => ({ ...p, effective_from: e.target.value }))} />
                    </div>
                    {[
                      { key: 'water_price_m3', label: 'Cena wody (zł/m³)' },
                      { key: 'water_ryczalt_m3', label: 'Ryczałt wody (m³/mies.)' },
                      { key: 'garbage_per_person', label: 'Śmieci (zł/os./mies.)' },
                      { key: 'renovation_rate_m2', label: 'Fundusz remontowy (zł/m²)' },
                      { key: 'operating_rate_m2', label: 'Fundusz eksploatacyjny (zł/m²)' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs text-gray-400 mb-1">{f.label}</label>
                        <input className="input w-full" type="number" step="0.0001" placeholder="0.00"
                          value={(ratesForm as any)[f.key]}
                          onChange={e => setRatesForm(p => ({ ...p, [f.key]: e.target.value }))} />
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Zarządca — typ</label>
                      <select className="input w-full" value={ratesForm.manager_fee_type}
                        onChange={e => setRatesForm(p => ({ ...p, manager_fee_type: e.target.value as 'per_m2' | 'fixed' }))}>
                        <option value="per_m2">Wg m² (zł/m²)</option>
                        <option value="fixed">Stała kwota (zł/lokal)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Zarządca — {ratesForm.manager_fee_type === 'per_m2' ? 'stawka zł/m²' : 'kwota stała zł/lokal'}
                      </label>
                      <input className="input w-full" type="number" step="0.01" placeholder="0.00"
                        value={ratesForm.manager_fee_value}
                        onChange={e => setRatesForm(p => ({ ...p, manager_fee_value: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleAddRates} disabled={isPending}
                      className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                      {isPending ? 'Zapisywanie...' : 'Zapisz stawki'}
                    </button>
                    <button onClick={() => setShowRatesForm(false)} className="text-sm text-gray-500 hover:text-gray-300">Anuluj</button>
                  </div>
                </div>
              )}

              {rates.length === 0 ? (
                <p className="text-sm text-gray-500">Brak stawek. Dodaj pierwsze stawki.</p>
              ) : (
                <div className="space-y-3">
                  {rates.map((r, i) => (
                    <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-100">
                            Od: {new Date(r.effective_from).toLocaleDateString('pl-PL')}
                          </span>
                          {i === 0 && (
                            <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full">Aktualne</span>
                          )}
                        </div>
                        <button onClick={() => handleDeleteRates(r.id)} disabled={isPending}
                          className="text-xs text-gray-600 hover:text-red-400 transition">✕ Usuń</button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        {[
                          { label: 'Cena wody', value: `${r.water_price_m3} zł/m³` },
                          { label: 'Ryczałt wody', value: `${r.water_ryczalt_m3} m³/mies.` },
                          { label: 'Śmieci', value: `${r.garbage_per_person} zł/os.` },
                          { label: 'Fund. remontowy', value: `${r.renovation_rate_m2} zł/m²` },
                          { label: 'Fund. eksploat.', value: `${r.operating_rate_m2} zł/m²` },
                          { label: 'Zarządca', value: r.manager_fee_type === 'per_m2' ? `${r.manager_fee_value} zł/m²` : `${r.manager_fee_value} zł/lokal (stała)` },
                        ].map(item => (
                          <div key={item.label}>
                            <p className="text-gray-500">{item.label}</p>
                            <p className="text-gray-200 font-medium mt-0.5">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

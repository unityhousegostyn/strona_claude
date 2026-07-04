'use client'

import { useState, useTransition } from 'react'
import { closeYear, reopenYear, previewYearClose } from './actions'
import type { YearClosureSummary, ApartmentClosingSummary } from './actions'

function pln(v: number) {
  return v.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
}

interface Props {
  communityId: string
  communityName: string
  closures: YearClosureSummary[]
  currentYear: number
  isSuperAdmin: boolean
}

export default function ZamkniecieClient({
  communityId, communityName, closures: initialClosures,
  currentYear, isSuperAdmin,
}: Props) {
  function printUrl(year: number) {
    return `/admin/finanse/zamkniecie-roku/raport?communityId=${communityId}&year=${year}`
  }
  const [isPending, startTransition] = useTransition()
  const [closures, setClosures] = useState(initialClosures)
  const [selectedYear, setSelectedYear] = useState(currentYear - 1)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmNotes, setConfirmNotes] = useState('')
  const [preview, setPreview] = useState<{ apartments: ApartmentClosingSummary[]; totalPaid: number; totalDue: number; totalBalance: number } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const closedYears = new Set(closures.map(c => c.year))
  const isSelectedClosed = closedYears.has(selectedYear)

  const years: number[] = []
  for (let y = currentYear; y >= Math.max(2020, currentYear - 5); y--) years.push(y)

  function handlePreview() {
    setPreviewLoading(true)
    startTransition(async () => {
      const res = await previewYearClose(communityId, selectedYear)
      setPreview(res)
      setPreviewLoading(false)
      setConfirmOpen(true)
    })
  }

  function handleClose() {
    startTransition(async () => {
      const res = await closeYear(communityId, selectedYear, confirmNotes)
      if (res.error) {
        setMsg({ ok: false, text: res.error })
      } else {
        setMsg({ ok: true, text: `Rok ${selectedYear} został zamknięty. Salda otwarcia ${selectedYear + 1} ustawione.` })
        setConfirmOpen(false)
        setConfirmNotes('')
        // Reload closures
        const { getYearClosures } = await import('./actions')
        const updated = await getYearClosures(communityId)
        setClosures(updated)
      }
    })
  }

  function handleReopen(year: number) {
    if (!confirm(`Na pewno otworzyć rok ${year}? Salda otwarcia ${year + 1} zostają — edytuj je ręcznie.`)) return
    startTransition(async () => {
      const res = await reopenYear(communityId, year)
      if (res.error) {
        setMsg({ ok: false, text: res.error })
      } else {
        setMsg({ ok: true, text: `Rok ${year} ponownie otwarty.` })
        const { getYearClosures } = await import('./actions')
        const updated = await getYearClosures(communityId)
        setClosures(updated)
      }
    })
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Nagłówek */}
      <div>
        <h2 className="text-xl font-bold text-[#f0fdfa]">📅 Zamknięcie roku finansowego</h2>
        <p className="text-sm text-[#115e59] mt-1">{communityName}</p>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.ok ? 'bg-teal-900/30 border border-teal-700 text-teal-300' : 'bg-red-900/30 border border-red-700 text-red-300'}`}>
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-3 text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Akcja zamknięcia */}
      {isSuperAdmin && (
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#99f6e4] mb-3">Zamknij rok</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={selectedYear}
              onChange={e => { setSelectedYear(Number(e.target.value)); setPreview(null) }}
              className="rounded-lg border border-[#0f2d2a] bg-[#051210] text-[#f0fdfa] px-3 py-2 text-sm"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}{y === currentYear ? ' (bieżący)' : ''}</option>
              ))}
            </select>
            {isSelectedClosed ? (
              <span className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800 rounded-lg px-3 py-1.5">
                ✅ Rok {selectedYear} jest już zamknięty
              </span>
            ) : (
              <button
                onClick={handlePreview}
                disabled={isPending || previewLoading}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
              >
                {previewLoading ? '⏳ Obliczam…' : '🔒 Zamknij rok ' + selectedYear}
              </button>
            )}
          </div>
          <p className="text-xs text-[#115e59] mt-3">
            Zamknięcie roku: przelicza salda końcowe wszystkich lokali i ustawia je jako salda otwarcia na rok {selectedYear + 1}.
            Rozliczenia za {selectedYear} zostaną zablokowane przed edycją.
          </p>
        </div>
      )}

      {/* Historia zamknięć */}
      <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#0f2d2a]">
          <h3 className="text-sm font-semibold text-[#99f6e4]">Historia zamknięć</h3>
        </div>
        {closures.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#115e59] text-center">Brak zamkniętych lat dla tej wspólnoty.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#0f2d2a] bg-[#051210]">
                <th className="px-4 py-2 text-left text-[#0f766e] uppercase tracking-wide">Rok</th>
                <th className="px-4 py-2 text-right text-[#0f766e] uppercase tracking-wide">Wpłacono</th>
                <th className="px-4 py-2 text-right text-[#0f766e] uppercase tracking-wide">Naliczono</th>
                <th className="px-4 py-2 text-right text-[#0f766e] uppercase tracking-wide">Saldo łączne</th>
                <th className="px-4 py-2 text-right text-[#0f766e] uppercase tracking-wide">Lokali</th>
                <th className="px-4 py-2 text-right text-[#0f766e] uppercase tracking-wide">Zamknięto</th>
                <th className="px-4 py-2 text-right text-[#0f766e] uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody>
              {closures.map(c => (
                <tr key={c.id} className="border-b border-[#0f2d2a]/50 hover:bg-[#0c2220]/30">
                  <td className="px-4 py-2 font-bold text-[#99f6e4]">{c.year}</td>
                  <td className="px-4 py-2 text-right text-[#ccfbf1]">{pln(c.total_paid)}</td>
                  <td className="px-4 py-2 text-right text-[#ccfbf1]">{pln(c.total_due)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${c.total_balance >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                    {c.total_balance >= 0 ? '+' : ''}{pln(c.total_balance)}
                  </td>
                  <td className="px-4 py-2 text-right text-[#115e59]">{c.total_apartments}</td>
                  <td className="px-4 py-2 text-right text-[#115e59]">
                    {new Date(c.closed_at).toLocaleDateString('pl-PL')}
                  </td>
                  <td className="px-4 py-2 text-right flex items-center justify-end gap-2">
                    <a
                      href={printUrl(c.year)}
                      target="_blank"
                      className="text-amber-400 hover:text-amber-300 transition whitespace-nowrap"
                    >
                      🖨 Raport
                    </a>
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleReopen(c.year)}
                        disabled={isPending}
                        className="text-[#115e59] hover:text-red-400 transition text-xs"
                        title="Otwórz rok ponownie"
                      >
                        🔓
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal potwierdzenia */}
      {confirmOpen && preview && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a1f1d] border border-[#0f2d2a] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#0f2d2a] flex items-center justify-between">
              <h3 className="text-base font-bold text-[#f0fdfa]">Potwierdź zamknięcie roku {selectedYear}</h3>
              <button onClick={() => setConfirmOpen(false)} className="text-[#115e59] hover:text-white text-lg">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Podsumowanie */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#051210] border border-[#0f2d2a] rounded-xl p-3 text-center">
                  <p className="text-xs text-[#115e59]">Wpłacono łącznie</p>
                  <p className="text-base font-bold text-teal-400">{pln(preview.totalPaid)}</p>
                </div>
                <div className="bg-[#051210] border border-[#0f2d2a] rounded-xl p-3 text-center">
                  <p className="text-xs text-[#115e59]">Naliczono łącznie</p>
                  <p className="text-base font-bold text-[#f0fdfa]">{pln(preview.totalDue)}</p>
                </div>
                <div className={`border rounded-xl p-3 text-center ${preview.totalBalance >= 0 ? 'bg-teal-900/20 border-teal-800' : 'bg-red-900/20 border-red-800'}`}>
                  <p className="text-xs text-[#115e59]">Saldo łączne</p>
                  <p className={`text-base font-bold ${preview.totalBalance >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                    {preview.totalBalance >= 0 ? '+' : ''}{pln(preview.totalBalance)}
                  </p>
                </div>
              </div>

              {/* Tabela lokali */}
              <div className="max-h-64 overflow-y-auto rounded-xl border border-[#0f2d2a]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#051210]">
                    <tr className="border-b border-[#0f2d2a]">
                      <th className="px-3 py-2 text-left text-[#0f766e]">Lokal</th>
                      <th className="px-3 py-2 text-right text-[#0f766e]">Wpłacono</th>
                      <th className="px-3 py-2 text-right text-[#0f766e]">Naliczono</th>
                      <th className="px-3 py-2 text-right text-[#0f766e]">Saldo → otwarcie {selectedYear + 1}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.apartments.map(apt => (
                      <tr key={apt.id} className="border-b border-[#0f2d2a]/50">
                        <td className="px-3 py-1.5">
                          <span className="font-medium text-[#99f6e4]">{apt.number}</span>
                          <span className="text-[#115e59] ml-1">— {apt.owner_name}</span>
                        </td>
                        <td className="px-3 py-1.5 text-right text-[#ccfbf1]">{pln(apt.total_paid)}</td>
                        <td className="px-3 py-1.5 text-right text-[#ccfbf1]">{pln(apt.total_due)}</td>
                        <td className={`px-3 py-1.5 text-right font-semibold ${apt.balance >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                          {apt.balance >= 0 ? '+' : ''}{pln(apt.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="text-xs text-[#0f766e] block mb-1">Notatka (opcjonalna)</label>
                <textarea
                  value={confirmNotes}
                  onChange={e => setConfirmNotes(e.target.value)}
                  placeholder="np. Rok zamknięty po uchwale nr 1/2026"
                  rows={2}
                  className="w-full rounded-lg border border-[#0f2d2a] bg-[#051210] text-[#f0fdfa] px-3 py-2 text-sm resize-none"
                />
              </div>

              <div className="bg-amber-900/20 border border-amber-800 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-300">
                  ⚠ Po zamknięciu roku rozliczenia za {selectedYear} zostaną zablokowane.
                  Salda końcowe zostaną przeniesione jako salda otwarcia roku {selectedYear + 1}.
                  Operacja jest odwracalna tylko przez super_admin.
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="px-4 py-2 border border-[#0f2d2a] text-[#0f766e] rounded-lg text-sm hover:text-white transition"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleClose}
                  disabled={isPending}
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
                >
                  {isPending ? '⏳ Zamykam…' : `✅ Zamknij rok ${selectedYear}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

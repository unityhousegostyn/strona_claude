'use client'

import { useState, useCallback, useRef } from 'react'
import { parseMT940, matchTransactions, type MatchResult, type Apartment } from '@/lib/parseMT940'
import { bulkImportMT940, type BulkImportItem } from './actions'

const MONTHS_PL = ['', 'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']

function pln(v: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(v)
}

interface Props {
  communityId: string
  communityName: string
  apartments: Apartment[]
}

export default function MT940Client({ communityId, communityName, apartments }: Props) {
  const [matches, setMatches]   = useState<MatchResult[]>([])
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing]   = useState(false)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [accountNo, setAccountNo] = useState('')

  // Per-row overrides: apartmentId and month
  const [overrides, setOverrides] = useState<Record<number, { aptId?: string; month?: number; year?: number; skip?: boolean }>>({})

  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  const now = new Date()
  const defaultYear  = now.getFullYear()
  const defaultMonth = now.getMonth() + 1  // bieżący miesiąc

  function handleFile(file: File) {
    setMatches([])
    setParseErrors([])
    setImportResult(null)
    setOverrides({})
    setFileName(file.name)
    setParsing(true)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const stmt = parseMT940(text)
      setAccountNo(stmt.accountNumber ?? '')
      if (stmt.rawErrors.length) setParseErrors(stmt.rawErrors)
      const results = matchTransactions(stmt.transactions, apartments)
      setMatches(results)
      setParsing(false)
    }
    reader.readAsText(file, 'windows-1250')  // polskie banki często używają CP1250
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function setOverride(i: number, patch: Partial<typeof overrides[0]>) {
    setOverrides(prev => ({ ...prev, [i]: { ...prev[i], ...patch } }))
  }

  async function handleImport() {
    setImporting(true)
    setImportResult(null)

    const items: BulkImportItem[] = []
    matches.forEach((m, i) => {
      const ov = overrides[i] ?? {}
      if (ov.skip) return
      const aptId = ov.aptId ?? m.apartment?.id
      if (!aptId) return  // skip unmatched without override

      const month = ov.month ?? defaultMonth
      const year  = ov.year  ?? defaultYear

      items.push({
        apartment_id: aptId,
        community_id: communityId,
        year,
        month,
        amount: m.tx.amount,
      })
    })

    const result = await bulkImportMT940(items)
    setImportResult(result)
    setImporting(false)
  }

  const matchedCount  = matches.filter((m, i) => !overrides[i]?.skip && (overrides[i]?.aptId ?? m.apartment?.id)).length
  const unmatchedCount = matches.filter((m, i) => !overrides[i]?.skip && !(overrides[i]?.aptId ?? m.apartment?.id)).length

  return (
    <div className="space-y-6">

      {/* Drop zone */}
      {matches.length === 0 && !parsing && (
        <div
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          className="border-2 border-dashed border-[#0f2d2a] rounded-xl p-12 text-center hover:border-teal-700/60 transition cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          <div className="text-5xl mb-4">🏦</div>
          <p className="text-[#f0fdfa] font-semibold mb-1">Przeciągnij plik MT940 lub kliknij</p>
          <p className="text-xs text-[#115e59]">Formaty: .sta, .mt940, .txt — wyciąg bankowy SWIFT MT940</p>
          <input ref={fileRef} type="file" accept=".sta,.mt940,.txt,.csv" className="hidden" onChange={onFileChange} />
        </div>
      )}

      {parsing && (
        <div className="flex items-center gap-3 p-6">
          <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#99f6e4]">Parsowanie pliku…</p>
        </div>
      )}

      {parseErrors.length > 0 && (
        <div className="bg-yellow-950/20 border border-yellow-900/40 rounded-xl p-4 space-y-1">
          <p className="text-xs font-semibold text-yellow-400 mb-2">Ostrzeżenia parsera</p>
          {parseErrors.map((e, i) => <p key={i} className="text-xs text-yellow-600">{e}</p>)}
        </div>
      )}

      {/* Wyniki parsowania */}
      {matches.length > 0 && (
        <>
          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-[#081918] border border-[#0f2d2a] rounded-lg px-4 py-2">
              <span className="text-xs text-[#115e59]">Plik:</span>
              <span className="text-xs font-medium text-[#f0fdfa]">{fileName}</span>
              {accountNo && <span className="text-xs text-[#115e59]">· konto: {accountNo}</span>}
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-950/40 text-teal-400 border border-teal-800/40">
                ✓ {matchedCount} dopasowanych
              </span>
              {unmatchedCount > 0 && (
                <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-950/40 text-yellow-400 border border-yellow-800/40">
                  ? {unmatchedCount} bez dopasowania
                </span>
              )}
            </div>
            <button
              onClick={() => { setMatches([]); setFileName(''); setOverrides({}); setImportResult(null) }}
              className="ml-auto text-xs text-[#115e59] hover:text-[#99f6e4] transition"
            >
              ← Wczytaj inny plik
            </button>
          </div>

          {/* Tabela */}
          <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#0f2d2a]">
                    {['Data', 'Kwota', 'Nadawca / Tytuł', 'Lokal', 'Miesiąc', 'Rok', 'Pewność', 'Pomiń'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#115e59] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0a1e1c]">
                  {matches.map((m, i) => {
                    const ov = overrides[i] ?? {}
                    const skipped = ov.skip ?? false
                    const aptId = ov.aptId ?? m.apartment?.id ?? ''
                    const month = ov.month ?? defaultMonth
                    const year  = ov.year  ?? defaultYear
                    const conf  = m.confidence

                    return (
                      <tr key={i} className={`transition ${skipped ? 'opacity-30' : 'hover:bg-[#051210]'}`}>
                        <td className="px-4 py-3 tabular-nums text-[#99f6e4] whitespace-nowrap">{m.tx.valueDate}</td>
                        <td className="px-4 py-3 tabular-nums font-semibold text-teal-400 whitespace-nowrap">{pln(m.tx.amount)}</td>
                        <td className="px-4 py-3 max-w-[200px]">
                          {m.tx.counterparty && <p className="text-[#f0fdfa] font-medium truncate">{m.tx.counterparty}</p>}
                          {m.tx.title && <p className="text-[#115e59] truncate" title={m.tx.title}>{m.tx.title}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={aptId}
                            onChange={e => setOverride(i, { aptId: e.target.value || undefined })}
                            className={`w-full text-xs rounded-lg px-2 py-1 border bg-[#051210] text-[#f0fdfa] ${
                              aptId ? 'border-teal-800/40' : 'border-yellow-800/40 text-yellow-400'
                            }`}
                          >
                            <option value="">— wybierz lokal —</option>
                            {apartments.map(a => (
                              <option key={a.id} value={a.id}>{a.number} — {a.owner_name}</option>
                            ))}
                          </select>
                          {m.matchReason !== 'brak dopasowania' && (
                            <p className="text-[10px] text-[#115e59] mt-0.5">auto: {m.matchReason}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={month}
                            onChange={e => setOverride(i, { month: Number(e.target.value) })}
                            className="text-xs rounded-lg px-2 py-1 border border-[#0f2d2a] bg-[#051210] text-[#f0fdfa]"
                          >
                            {MONTHS_PL.slice(1).map((name, mi) => (
                              <option key={mi + 1} value={mi + 1}>{name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={year}
                            onChange={e => setOverride(i, { year: Number(e.target.value) })}
                            className="text-xs rounded-lg px-2 py-1 border border-[#0f2d2a] bg-[#051210] text-[#f0fdfa]"
                          >
                            {[defaultYear - 1, defaultYear, defaultYear + 1].map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full font-medium ${
                            conf >= 80 ? 'bg-teal-950/40 text-teal-400 border border-teal-800/40'
                            : conf >= 50 ? 'bg-yellow-950/40 text-yellow-400 border border-yellow-800/40'
                            : 'bg-red-950/40 text-red-400 border border-red-800/40'
                          }`}>{conf}%</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setOverride(i, { skip: !ov.skip })}
                            className={`w-6 h-6 rounded border flex items-center justify-center transition ${
                              skipped ? 'bg-red-900/40 border-red-700/60 text-red-400' : 'border-[#0f2d2a] hover:border-red-700/60'
                            }`}
                            title={skipped ? 'Cofnij pominięcie' : 'Pomiń tę transakcję'}
                          >
                            {skipped ? '✕' : ''}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import button */}
          {importResult ? (
            <div className={`rounded-xl p-5 border ${importResult.errors.length > 0 ? 'bg-yellow-950/20 border-yellow-900/40' : 'bg-teal-950/20 border-teal-800/40'}`}>
              <p className="font-semibold text-[#f0fdfa] mb-1">
                {importResult.imported > 0 ? `✓ Zaimportowano ${importResult.imported} wpłat` : 'Import zakończony'}
              </p>
              {importResult.skipped > 0 && (
                <p className="text-sm text-yellow-400">Pominięto: {importResult.skipped}</p>
              )}
              {importResult.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-400 mt-1">{e}</p>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <button
                onClick={handleImport}
                disabled={importing || matchedCount === 0}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition flex items-center gap-2"
              >
                {importing && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {importing ? 'Importowanie…' : `Importuj ${matchedCount} wpłat`}
              </button>
              {unmatchedCount > 0 && (
                <p className="text-xs text-yellow-500">{unmatchedCount} transakcji zostanie pominiętych (brak dopasowania)</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

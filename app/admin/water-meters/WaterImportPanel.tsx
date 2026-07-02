'use client'

import { useRef, useState, useTransition } from 'react'
import * as XLSX from 'xlsx'
import { importWaterReadingsAdmin, getApartmentNumbers, type ImportWaterRow } from './actions'
import { useToast } from '@/components/ToastContext'

interface Community { id: string; name: string }

// Miesięczne kolumny w pliku: indeks 27=Sty(2026), 28=Lut, 29=Mar, 30=Kwi, 31=Maj, 32=Cze
// indeks 33=Lip(2025), 34=Sie, 35=Wrz, 36=Paź, 37=Lis, 38=Gru
const MONTH_COLS: { col: number; yearMonth: string; label: string }[] = [
  { col: 33, yearMonth: '2025-07', label: 'Lip 2025' },
  { col: 34, yearMonth: '2025-08', label: 'Sie 2025' },
  { col: 35, yearMonth: '2025-09', label: 'Wrz 2025' },
  { col: 36, yearMonth: '2025-10', label: 'Paź 2025' },
  { col: 37, yearMonth: '2025-11', label: 'Lis 2025' },
  { col: 38, yearMonth: '2025-12', label: 'Gru 2025' },
  { col: 27, yearMonth: '2026-01', label: 'Sty 2026' },
  { col: 28, yearMonth: '2026-02', label: 'Lut 2026' },
  { col: 29, yearMonth: '2026-03', label: 'Mar 2026' },
  { col: 30, yearMonth: '2026-04', label: 'Kwi 2026' },
  { col: 31, yearMonth: '2026-05', label: 'Maj 2026' },
  { col: 32, yearMonth: '2026-06', label: 'Cze 2026' },
]

function lastDayOf(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

interface ParsedRow {
  address: string
  fullAptId: string           // pełny ID: "7/1", "7a/1", "7/4a"
  name: string
  note: string | null
  meterSerial: string | null
  monthlyValues: Record<string, number>  // "2026-06" → 273.476
}

function buildFullAptId(rawId: unknown, address: string, nr: unknown): string {
  if (typeof rawId === 'string' && rawId.includes('/')) return rawId.trim()
  // rawId był datą (Excel zinterpretował "7/1" jako 7 stycznia) — rekonstruujemy z adresu
  const building = address.trim().split(/\s+/).pop() ?? ''
  return `${building}/${String(nr ?? '').trim()}`
}

function parseXlsx(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true })

        const parsed: ParsedRow[] = []
        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i] as unknown[]
          if (!row || row.length < 13) continue

          const rawId = row[1]
          const meterSerial = row[2] ? String(row[2]).trim() : null
          const address = row[5] ? String(row[5]).trim() : ''
          const nrRaw = row[6]
          const name = row[7] ? String(row[7]).trim() : ''
          const note = row[11] ? String(row[11]).trim() : null

          const fullAptId = buildFullAptId(rawId, address, nrRaw)
          if (!address || !fullAptId) continue

          // Zbierz wartości dla wszystkich miesięcy
          const monthlyValues: Record<string, number> = {}
          for (const mc of MONTH_COLS) {
            const v = row[mc.col]
            if (typeof v === 'number' && v > 0) monthlyValues[mc.yearMonth] = v
          }

          parsed.push({ address, fullAptId, name, note, meterSerial, monthlyValues })
        }
        resolve(parsed)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

export default function WaterImportPanel({
  communities,
  onClose,
}: {
  communities: Community[]
  onClose: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()
  const [, startTransition] = useTransition()

  const [parsed, setParsed] = useState<ParsedRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [communityMap, setCommunityMap] = useState<Record<string, string>>({})
  const [dbNumbers, setDbNumbers] = useState<string[]>([])
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [result, setResult] = useState<{ imported: number; skipped: { apt: string; reason: string }[] } | null>(null)
  const [importing, setImporting] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  const uniqueAddresses = parsed ? [...new Set(parsed.map(r => r.address))] : []

  // Miesiące, dla których co najmniej jeden lokal ma wartość
  const availableMonths = MONTH_COLS.filter(mc =>
    (parsed ?? []).some(r => mc.yearMonth in r.monthlyValues)
  )

  // Liczba wierszy do importu = liczba lokali z mapowaniem × liczba wybranych miesięcy (gdzie jest wartość)
  const importCount = selectedMonths.reduce((sum, ym) => {
    return sum + (parsed ?? []).filter(r => communityMap[r.address] && ym in r.monthlyValues).length
  }, 0)

  const handleFile = async (file: File) => {
    setParseError(null)
    setResult(null)
    setParsed(null)
    setSelectedMonths([])
    setFileName(file.name)
    try {
      const rows = await parseXlsx(file)
      setParsed(rows)
      // Auto-select community if only one
      if (communities.length === 1) {
        const map: Record<string, string> = {}
        for (const addr of [...new Set(rows.map(r => r.address))]) map[addr] = communities[0].id
        setCommunityMap(map)
        const res = await getApartmentNumbers(communities[0].id)
        setDbNumbers(res.numbers)
      }
      // Default: wybierz ostatni dostępny miesiąc
      const lastMonth = MONTH_COLS.filter(mc => rows.some(r => mc.yearMonth in r.monthlyValues)).pop()
      if (lastMonth) setSelectedMonths([lastMonth.yearMonth])
    } catch (e: unknown) {
      setParseError((e as Error)?.message ?? 'Błąd parsowania pliku')
    }
  }

  const toggleMonth = (ym: string) => {
    setSelectedMonths(prev => prev.includes(ym) ? prev.filter(m => m !== ym) : [...prev, ym])
  }

  const handleImport = () => {
    if (!importCount) return
    setImporting(true)
    const importRows: ImportWaterRow[] = []
    for (const ym of selectedMonths) {
      const date = lastDayOf(ym)
      for (const r of parsed ?? []) {
        const val = r.monthlyValues[ym]
        if (val == null || !communityMap[r.address]) continue
        importRows.push({
          community_id: communityMap[r.address],
          apt_number: r.fullAptId,
          reading_value: val,
          reading_date: date,
          note: r.note,
          meter_serial: r.meterSerial,
        })
      }
    }
    startTransition(async () => {
      const res = await importWaterReadingsAdmin(importRows)
      setImporting(false)
      setResult(res)
      if (res.imported > 0) showToast(`Zaimportowano ${res.imported} odczytów`, 'success')
    })
  }

  // Preview: pokaż wartości dla pierwszego wybranego miesiąca (lub ostatniego dostępnego)
  const previewMonth = selectedMonths[selectedMonths.length - 1] ?? availableMonths[availableMonths.length - 1]?.yearMonth

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#081918] border border-[#0f2d2a] rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-2xl space-y-5 overflow-y-auto max-h-[92dvh]">

        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#f0fdfa]">Import odczytów z XLSX</h3>
          <button onClick={onClose} className="text-[#115e59] hover:text-[#f0fdfa] text-xl leading-none">✕</button>
        </div>

        {/* Step 1: Upload */}
        <div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          <button onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-[#0f766e]/40 rounded-xl py-6 text-center text-sm text-[#0f766e] hover:border-[#0f766e] hover:text-[#99f6e4] transition">
            {fileName ? `📄 ${fileName}` : '📂 Kliknij, aby wybrać plik XLSX z odczytami'}
          </button>
          {parseError && <p className="text-red-400 text-xs mt-2">{parseError}</p>}
        </div>

        {parsed && (
          <>
            {/* Step 2: Mapping adresów → wspólnoty */}
            {uniqueAddresses.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#0f766e] uppercase tracking-wide">Przypisz adresy do wspólnot</p>
                {uniqueAddresses.map(addr => (
                  <div key={addr} className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-[#f0fdfa] min-w-[180px]">{addr}</span>
                    <select value={communityMap[addr] ?? ''}
                      onChange={async e => {
                        const cid = e.target.value
                        setCommunityMap(prev => ({ ...prev, [addr]: cid }))
                        if (cid) { const res = await getApartmentNumbers(cid); setDbNumbers(res.numbers) }
                      }}
                      className="input text-sm py-1 px-2 flex-1 min-w-[200px]">
                      <option value="">— wybierz wspólnotę —</option>
                      {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {/* Diagnostyka numerów (ukryta gdy wszystko OK) */}
            {dbNumbers.length > 0 && (
              <details className="text-xs">
                <summary className="text-[#0f766e] cursor-pointer">Numery lokali w bazie ({dbNumbers.length}) ▾</summary>
                <p className="text-[#99f6e4] font-mono break-all mt-1">{dbNumbers.join(', ')}</p>
              </details>
            )}

            {/* Step 3: Wybór miesięcy */}
            {availableMonths.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#0f766e] uppercase tracking-wide">Miesiące do importu</p>
                <div className="flex flex-wrap gap-2">
                  {availableMonths.map(mc => (
                    <button key={mc.yearMonth}
                      onClick={() => toggleMonth(mc.yearMonth)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                        selectedMonths.includes(mc.yearMonth)
                          ? 'bg-teal-700 border-teal-600 text-white'
                          : 'border-[#0f2d2a] text-[#0f766e] hover:border-teal-700 hover:text-[#99f6e4]'
                      }`}>
                      {mc.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Preview */}
            {previewMonth && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#0f766e] uppercase tracking-wide">
                  Podgląd — {MONTH_COLS.find(m => m.yearMonth === previewMonth)?.label}
                </p>
                <div className="overflow-auto max-h-52 rounded-lg border border-[#0f2d2a]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#051210] text-[#0f766e]">
                        <th className="text-left px-3 py-2">Lokal</th>
                        <th className="text-left px-3 py-2">Mieszkaniec</th>
                        <th className="text-right px-3 py-2">m³</th>
                        <th className="text-left px-3 py-2">Uwagi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.map((r, i) => {
                        const val = r.monthlyValues[previewMonth]
                        return (
                          <tr key={i} className={`border-t border-[#0f2d2a] ${val == null ? 'opacity-40' : ''}`}>
                            <td className="px-3 py-1.5 text-[#f0fdfa] font-mono">{r.fullAptId}</td>
                            <td className="px-3 py-1.5 text-[#99f6e4]">{r.name}</td>
                            <td className="px-3 py-1.5 text-right font-bold text-[#f0fdfa]">
                              {val != null ? val.toFixed(3) : <span className="text-red-400">brak</span>}
                            </td>
                            <td className="px-3 py-1.5 text-[#0f766e] italic">{r.note ?? ''}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className={`rounded-lg px-4 py-3 text-sm space-y-1 ${result.imported > 0 ? 'bg-green-950/40 border border-green-800/40' : 'bg-red-950/40 border border-red-800/40'}`}>
                <p className="font-semibold text-[#f0fdfa]">✓ Zaimportowano: {result.imported} · Pominięto: {result.skipped.length}</p>
                {result.skipped.map((s, i) => (
                  <p key={i} className="text-xs text-red-300">Lokal {s.apt}: {s.reason}</p>
                ))}
              </div>
            )}

            {/* Import button */}
            {!result && (
              <button onClick={handleImport}
                disabled={importing || importCount === 0 || uniqueAddresses.some(a => !communityMap[a]) || !selectedMonths.length}
                className="w-full bg-teal-700 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition text-sm">
                {importing ? 'Importowanie…' : `Importuj ${importCount} odczytów jako zatwierdzone`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

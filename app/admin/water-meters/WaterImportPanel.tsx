'use client'

import { useRef, useState, useTransition } from 'react'
import * as XLSX from 'xlsx'
import { importWaterReadingsAdmin, type ImportWaterRow } from './actions'
import { useToast } from '@/components/ToastContext'

interface Community { id: string; name: string }

interface ParsedRow {
  address: string
  aptNumber: string
  name: string
  m3: number | null
  note: string | null
  meterSerial: string | null
}

function parseAptNumber(rawId: unknown, nr: unknown): string {
  if (typeof rawId === 'string' && rawId.includes('/')) return rawId.split('/').pop()!.trim()
  return String(nr ?? '').trim()
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
          // col[4] = CW/ZW type (we import all)
          const address = row[5] ? String(row[5]).trim() : ''
          const nrRaw = row[6]
          const name = row[7] ? String(row[7]).trim() : ''
          const note = row[11] ? String(row[11]).trim() : null
          const m3Raw = row[12]
          const m3 = typeof m3Raw === 'number' && m3Raw > 0 ? m3Raw : null

          const aptNumber = parseAptNumber(rawId, nrRaw)
          if (!address || !aptNumber) continue

          parsed.push({ address, aptNumber, name, m3, note, meterSerial })
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
  const [readingDate, setReadingDate] = useState(() => {
    // Default: last day of previous month
    const d = new Date()
    d.setDate(0) // last day of prev month
    return d.toISOString().slice(0, 10)
  })
  // community mapping: address → community_id
  const [communityMap, setCommunityMap] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ imported: number; skipped: { apt: string; reason: string }[] } | null>(null)
  const [importing, setImporting] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  // Unique addresses from parsed rows
  const uniqueAddresses = parsed ? [...new Set(parsed.map(r => r.address))] : []

  // Rows that will be imported (m3 > 0, community mapped)
  const readyRows = (parsed ?? []).filter(r => r.m3 !== null && communityMap[r.address])
  const skippedPreview = (parsed ?? []).filter(r => r.m3 === null)

  const handleFile = async (file: File) => {
    setParseError(null)
    setResult(null)
    setParsed(null)
    setFileName(file.name)
    try {
      const rows = await parseXlsx(file)
      setParsed(rows)
      // Auto-select community if only one
      if (communities.length === 1) {
        const map: Record<string, string> = {}
        for (const addr of [...new Set(rows.map(r => r.address))]) map[addr] = communities[0].id
        setCommunityMap(map)
      }
    } catch (e: unknown) {
      setParseError((e as Error)?.message ?? 'Błąd parsowania pliku')
    }
  }

  const handleImport = () => {
    if (!readyRows.length) return
    setImporting(true)
    const importRows: ImportWaterRow[] = readyRows.map(r => ({
      community_id: communityMap[r.address],
      apt_number: r.aptNumber,
      reading_value: r.m3!,
      reading_date: readingDate,
      note: r.note,
      meter_serial: r.meterSerial,
    }))
    startTransition(async () => {
      const res = await importWaterReadingsAdmin(importRows)
      setImporting(false)
      setResult(res)
      if (res.imported > 0) showToast(`Zaimportowano ${res.imported} odczytów`, 'success')
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#081918] border border-[#0f2d2a] rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-2xl space-y-5 overflow-y-auto max-h-[92dvh]">

        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#f0fdfa]">Import odczytów z XLSX</h3>
          <button onClick={onClose} className="text-[#115e59] hover:text-[#f0fdfa] text-xl leading-none">✕</button>
        </div>

        {/* Step 1: Upload file */}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-[#0f766e]/40 rounded-xl py-6 text-center text-sm text-[#0f766e] hover:border-[#0f766e] hover:text-[#99f6e4] transition"
          >
            {fileName ? `📄 ${fileName}` : '📂 Kliknij, aby wybrać plik XLSX z odczytami'}
          </button>
          {parseError && <p className="text-red-400 text-xs mt-2">{parseError}</p>}
        </div>

        {parsed && (
          <>
            {/* Step 2: Data de odczytu */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-[#0f766e] whitespace-nowrap">Data odczytu:</label>
              <input
                type="date"
                value={readingDate}
                onChange={e => setReadingDate(e.target.value)}
                className="input text-sm py-1 px-2"
              />
            </div>

            {/* Step 3: Mapping adresów → wspólnoty */}
            {uniqueAddresses.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#0f766e] uppercase tracking-wide">Przypisz adresy do wspólnot</p>
                {uniqueAddresses.map(addr => (
                  <div key={addr} className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-[#f0fdfa] min-w-[180px]">{addr}</span>
                    <select
                      value={communityMap[addr] ?? ''}
                      onChange={e => setCommunityMap(prev => ({ ...prev, [addr]: e.target.value }))}
                      className="input text-sm py-1 px-2 flex-1 min-w-[200px]"
                    >
                      <option value="">— wybierz wspólnotę —</option>
                      {communities.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {/* Step 4: Preview */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#0f766e] uppercase tracking-wide">
                Podgląd ({readyRows.length} do importu{skippedPreview.length ? `, ${skippedPreview.length} bez odczytu` : ''})
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
                    {parsed.map((r, i) => (
                      <tr key={i} className={`border-t border-[#0f2d2a] ${r.m3 === null ? 'opacity-40' : ''}`}>
                        <td className="px-3 py-1.5 text-[#f0fdfa] font-mono">{r.aptNumber}</td>
                        <td className="px-3 py-1.5 text-[#99f6e4]">{r.name}</td>
                        <td className="px-3 py-1.5 text-right font-bold text-[#f0fdfa]">
                          {r.m3 !== null ? r.m3.toFixed(3) : <span className="text-red-400">brak</span>}
                        </td>
                        <td className="px-3 py-1.5 text-[#0f766e] italic">{r.note ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Result */}
            {result && (
              <div className={`rounded-lg px-4 py-3 text-sm space-y-1 ${result.imported > 0 ? 'bg-green-950/40 border border-green-800/40' : 'bg-red-950/40 border border-red-800/40'}`}>
                <p className="font-semibold text-[#f0fdfa]">
                  ✓ Zaimportowano: {result.imported} · Pominięto: {result.skipped.length}
                </p>
                {result.skipped.map((s, i) => (
                  <p key={i} className="text-xs text-red-300">Lokal {s.apt}: {s.reason}</p>
                ))}
              </div>
            )}

            {/* Import button */}
            {!result && (
              <button
                onClick={handleImport}
                disabled={importing || readyRows.length === 0 || uniqueAddresses.some(a => !communityMap[a])}
                className="w-full bg-teal-700 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition text-sm"
              >
                {importing ? 'Importowanie…' : `Importuj ${readyRows.length} odczytów jako zatwierdzone`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

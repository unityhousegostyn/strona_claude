'use client'

import { useState } from 'react'
import { submitWaterReading } from '@/app/admin/water-meters/actions'

export default function WaterMeterForm({ apartmentId }: { apartmentId: string }) {
  const [value, setValue] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseFloat(value.replace(',', '.'))
    if (isNaN(num) || num < 0) return setResult({ error: 'Podaj prawidłowy odczyt' })
    setLoading(true)
    const res = await submitWaterReading({ apartment_id: apartmentId, reading_value: num, reading_date: date, note })
    setLoading(false)
    if (res.error) setResult({ error: res.error })
    else { setResult({ success: true }); setValue(''); setNote('') }
  }

  return (
    <div className="bg-[#1a1610] border border-[#2a2218] rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0v10l-8 4m-8-4V7m8 4v10"/>
        </svg>
        <h3 className="text-sm font-semibold text-[#b8a898]">Zgłoś odczyt licznika wody</h3>
      </div>

      {result?.success ? (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
          Odczyt przesłany — oczekuje na potwierdzenie przez administratora.
          <button onClick={() => setResult(null)} className="text-xs text-[#6a5a48] hover:underline ml-2">Zgłoś kolejny</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#7a6a58] mb-1 uppercase tracking-wide">Odczyt (m³) *</label>
              <input
                type="number" step="0.001" min="0"
                value={value} onChange={e => setValue(e.target.value)}
                placeholder="np. 123.456"
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#7a6a58] mb-1 uppercase tracking-wide">Data odczytu</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-full" required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#7a6a58] mb-1 uppercase tracking-wide">Uwagi (opcjonalnie)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="np. odczyt z wodomierza kuchennego" className="input w-full" />
          </div>
          {result?.error && <p className="text-sm text-red-400 bg-red-950/20 border border-red-900/40 rounded-lg px-3 py-2">{result.error}</p>}
          <button type="submit" disabled={loading}
            className="w-full text-sm bg-blue-800 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50">
            {loading ? 'Wysyłam…' : 'Prześlij odczyt'}
          </button>
        </form>
      )}
    </div>
  )
}

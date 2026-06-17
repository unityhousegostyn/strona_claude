'use client'

import { useState, useTransition } from 'react'
import { confirmReading, rejectReading } from './actions'
import { useToast } from '@/components/ToastContext'

interface Reading {
  id: string
  reading_value: number
  reading_date: string
  status: 'pending' | 'confirmed' | 'rejected'
  note: string | null
  rejection_reason: string | null
  created_at: string
  confirmed_at: string | null
  apartment: { number: string } | null
  community: { id: string; name: string } | null
  user: { full_name: string | null; email: string | null } | null
}

export default function WaterMetersClient({ readings, isSuperAdmin }: { readings: Reading[]; isSuperAdmin: boolean }) {
  const [filter, setFilter] = useState<'pending' | 'confirmed' | 'rejected' | 'all'>('pending')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [, startTransition] = useTransition()
  const { showToast } = useToast()

  const filtered = readings.filter(r => filter === 'all' ? true : r.status === filter)

  const statusBadge = (s: string) => ({
    pending:   { text: 'Oczekuje', cls: 'bg-amber-950/40 text-amber-400 border border-amber-800/40' },
    confirmed: { text: 'Zatwierdzone', cls: 'bg-green-950/40 text-green-400 border border-green-800/40' },
    rejected:  { text: 'Odrzucone', cls: 'bg-red-950/40 text-red-400 border border-red-800/40' },
  }[s] ?? { text: s, cls: 'bg-[#271a0c] text-[#b45309]' })

  const handleConfirm = (id: string) => {
    startTransition(async () => {
      const res = await confirmReading(id)
      if (res.error) showToast(res.error, 'error')
      else showToast('Odczyt zatwierdzony', 'success')
    })
  }

  const handleReject = () => {
    if (!rejectId) return
    startTransition(async () => {
      const res = await rejectReading(rejectId, rejectReason)
      if (res.error) showToast(res.error, 'error')
      else { showToast('Odczyt odrzucony', 'success'); setRejectId(null); setRejectReason('') }
    })
  }

  const counts = {
    pending:   readings.filter(r => r.status === 'pending').length,
    confirmed: readings.filter(r => r.status === 'confirmed').length,
    rejected:  readings.filter(r => r.status === 'rejected').length,
  }

  return (
    <div className="space-y-4">
      {/* Filtry */}
      <div className="flex gap-1 bg-[#1e1409] rounded-lg p-1 w-fit flex-wrap">
        {(['pending','confirmed','rejected','all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${filter === f ? 'bg-[#18110a] text-[#fef9ee]' : 'text-[#a16207] hover:text-[#fde68a]'}`}>
            {f === 'pending' ? 'Oczekujące' : f === 'confirmed' ? 'Zatwierdzone' : f === 'rejected' ? 'Odrzucone' : 'Wszystkie'}
            {f !== 'all' && <span className={`ml-1 text-xs font-bold ${f === 'pending' ? 'text-amber-500' : f === 'confirmed' ? 'text-green-500' : 'text-red-400'}`}>{counts[f]}</span>}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[#b45309]">Brak odczytów.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const { text, cls } = statusBadge(r.status)
            return (
              <div key={r.id} className="bg-[#1e1409] border border-[#33200d] rounded-xl px-4 py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{text}</span>
                      {isSuperAdmin && r.community && (
                        <span className="text-xs text-amber-500/80">{r.community.name}</span>
                      )}
                      <span className="text-xs text-[#a16207]">Lokal {r.apartment?.number ?? '—'}</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-2xl font-bold text-[#fef9ee]">{r.reading_value} m³</span>
                      <span className="text-sm text-[#b45309]">{new Date(r.reading_date).toLocaleDateString('pl-PL')}</span>
                    </div>
                    <p className="text-xs text-[#a16207]">
                      {r.user?.full_name ?? r.user?.email ?? '—'} · zgłoszono {new Date(r.created_at).toLocaleDateString('pl-PL')}
                    </p>
                    {r.note && <p className="text-xs text-[#b45309] italic">„{r.note}"</p>}
                    {r.rejection_reason && <p className="text-xs text-red-400">Powód odrzucenia: {r.rejection_reason}</p>}
                  </div>

                  {r.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleConfirm(r.id)}
                        className="text-sm bg-amber-700 hover:bg-amber-600 text-white font-semibold px-3 py-1.5 rounded-lg transition">
                        Zatwierdź
                      </button>
                      <button onClick={() => { setRejectId(r.id); setRejectReason('') }}
                        className="text-sm border border-red-900 text-red-400 hover:bg-red-950/30 font-semibold px-3 py-1.5 rounded-lg transition">
                        Odrzuć
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal odrzucenia */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setRejectId(null)}/>
          <div className="relative bg-[#1e1409] border border-[#33200d] rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm space-y-4 overflow-y-auto max-h-[92dvh]">
            <h3 className="text-base font-bold text-[#fef9ee]">Odrzuć odczyt</h3>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Powód odrzucenia (opcjonalnie)…"
              rows={3}
              className="input w-full text-sm resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setRejectId(null)} className="flex-1 text-sm border border-[#33200d] text-[#b45309] py-2 rounded-lg hover:bg-[#18110a] transition">Anuluj</button>
              <button onClick={handleReject} className="flex-1 text-sm bg-red-800 hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition">Odrzuć</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

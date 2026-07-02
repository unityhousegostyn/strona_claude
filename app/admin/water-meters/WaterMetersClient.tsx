'use client'

import { useState, useTransition } from 'react'
import { confirmReading, rejectReading, syncWaterToSettlements } from './actions'
import { useToast } from '@/components/ToastContext'
import BackButton from '@/components/BackButton'
import WaterImportPanel from './WaterImportPanel'

interface Community { id: string; name: string }

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

export default function WaterMetersClient({
  readings,
  isSuperAdmin,
  communities,
}: {
  readings: Reading[]
  isSuperAdmin: boolean
  communities: Community[]
}) {
  const [filter, setFilter] = useState<'pending' | 'confirmed' | 'rejected' | 'all'>('pending')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [showSync, setShowSync] = useState(false)
  const [syncCommunityId, setSyncCommunityId] = useState(communities[0]?.id ?? '')
  const [syncYear, setSyncYear] = useState(new Date().getFullYear())
  const [syncOverwrite, setSyncOverwrite] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ model: string; synced: number; skipped: number; errors: string[] } | null>(null)
  const [, startTransition] = useTransition()
  const { showToast } = useToast()

  const handleSync = () => {
    if (!syncCommunityId) return
    setSyncing(true)
    setSyncResult(null)
    startTransition(async () => {
      const res = await syncWaterToSettlements(syncCommunityId, syncYear, syncOverwrite)
      setSyncing(false)
      setSyncResult(res)
      if (res.synced > 0) showToast(`Zsynchronizowano ${res.synced} wpisów`, 'success')
      else if (res.errors.length) showToast(res.errors[0], 'error')
    })
  }

  const filtered = readings.filter(r => filter === 'all' ? true : r.status === filter)

  const statusBadge = (s: string) => ({
    pending:   { text: 'Oczekuje', cls: 'bg-teal-950/40 text-teal-400 border border-teal-800/40' },
    confirmed: { text: 'Zatwierdzone', cls: 'bg-green-950/40 text-green-400 border border-green-800/40' },
    rejected:  { text: 'Odrzucone', cls: 'bg-red-950/40 text-red-400 border border-red-800/40' },
  }[s] ?? { text: s, cls: 'bg-[#0c2220] text-[#0f766e]' })

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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <BackButton />
        {isSuperAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="text-sm bg-[#0f2d2a] hover:bg-[#0f3d38] border border-[#0f766e]/30 text-[#99f6e4] font-medium px-3 py-1.5 rounded-lg transition"
            >
              📥 Import XLSX
            </button>
            <button
              onClick={() => { setShowSync(true); setSyncResult(null) }}
              className="text-sm bg-[#0f2d2a] hover:bg-[#0f3d38] border border-[#0f766e]/30 text-[#99f6e4] font-medium px-3 py-1.5 rounded-lg transition"
            >
              🔄 Sync → Rozliczenia
            </button>
          </div>
        )}
      </div>

      {/* Filtry */}
      <div className="flex gap-1 bg-[#081918] rounded-lg p-1 w-fit flex-wrap">
        {(['pending','confirmed','rejected','all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${filter === f ? 'bg-[#051210] text-[#f0fdfa]' : 'text-[#115e59] hover:text-[#99f6e4]'}`}>
            {f === 'pending' ? 'Oczekujące' : f === 'confirmed' ? 'Zatwierdzone' : f === 'rejected' ? 'Odrzucone' : 'Wszystkie'}
            {f !== 'all' && <span className={`ml-1 text-xs font-bold ${f === 'pending' ? 'text-teal-500' : f === 'confirmed' ? 'text-green-500' : 'text-red-400'}`}>{counts[f]}</span>}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[#0f766e]">Brak odczytów.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const { text, cls } = statusBadge(r.status)
            return (
              <div key={r.id} className="bg-[#081918] border border-[#0f2d2a] rounded-xl px-4 py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{text}</span>
                      {isSuperAdmin && r.community && (
                        <span className="text-xs text-teal-500/80">{r.community.name}</span>
                      )}
                      <span className="text-xs text-[#115e59]">Lokal {r.apartment?.number ?? '—'}</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-2xl font-bold text-[#f0fdfa]">{r.reading_value} m³</span>
                      <span className="text-sm text-[#0f766e]">{new Date(r.reading_date).toLocaleDateString('pl-PL')}</span>
                    </div>
                    <p className="text-xs text-[#115e59]">
                      {r.user?.full_name ?? r.user?.email ?? '—'} · zgłoszono {new Date(r.created_at).toLocaleDateString('pl-PL')}
                    </p>
                    {r.note && <p className="text-xs text-[#0f766e] italic">„{r.note}"</p>}
                    {r.rejection_reason && <p className="text-xs text-red-400">Powód odrzucenia: {r.rejection_reason}</p>}
                  </div>

                  {r.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleConfirm(r.id)}
                        className="text-sm bg-teal-700 hover:bg-teal-600 text-white font-semibold px-3 py-1.5 rounded-lg transition">
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

      {/* Modal importu XLSX */}
      {showImport && (
        <WaterImportPanel communities={communities} onClose={() => setShowImport(false)} />
      )}

      {/* Modal sync → rozliczenia */}
      {showSync && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowSync(false)} />
          <div className="relative bg-[#081918] border border-[#0f2d2a] rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-md space-y-4 overflow-y-auto max-h-[92dvh]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#f0fdfa]">Sync odczytów → Rozliczenia</h3>
              <button onClick={() => setShowSync(false)} className="text-[#115e59] hover:text-[#f0fdfa] text-xl leading-none">✕</button>
            </div>
            <p className="text-xs text-[#0f766e]">
              Automatycznie wypełnia rozliczenia wody na podstawie zatwierdzonych odczytów z liczników.
              Model (miesięczny/kwartalny/…) jest odczytywany ze stawek.
            </p>

            <div className="space-y-3">
              {communities.length > 1 && (
                <div>
                  <label className="text-xs text-[#0f766e] block mb-1">Wspólnota</label>
                  <select value={syncCommunityId} onChange={e => setSyncCommunityId(e.target.value)} className="input text-sm py-1.5 px-2 w-full">
                    {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-[#0f766e] block mb-1">Rok</label>
                <input type="number" value={syncYear} onChange={e => setSyncYear(parseInt(e.target.value))}
                  min={2020} max={2099} className="input text-sm py-1.5 px-2 w-28" />
              </div>
              <label className="flex items-center gap-2 text-sm text-[#99f6e4] cursor-pointer">
                <input type="checkbox" checked={syncOverwrite} onChange={e => setSyncOverwrite(e.target.checked)}
                  className="accent-teal-500" />
                Nadpisz istniejące wpisy
              </label>
            </div>

            {syncResult && (
              <div className={`rounded-lg px-4 py-3 text-sm space-y-1 ${syncResult.synced > 0 ? 'bg-green-950/40 border border-green-800/40' : 'bg-[#0c2220] border border-[#0f2d2a]'}`}>
                <p className="font-semibold text-[#f0fdfa]">
                  Model: {syncResult.model} · Zsync: {syncResult.synced} · Pominięto: {syncResult.skipped}
                </p>
                {syncResult.errors.map((e, i) => <p key={i} className="text-xs text-red-300">{e}</p>)}
              </div>
            )}

            <button onClick={handleSync} disabled={syncing || !syncCommunityId}
              className="w-full bg-teal-700 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition text-sm">
              {syncing ? 'Synchronizuję…' : '🔄 Uruchom synchronizację'}
            </button>
          </div>
        </div>
      )}

      {/* Modal odrzucenia */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setRejectId(null)}/>
          <div className="relative bg-[#081918] border border-[#0f2d2a] rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm space-y-4 overflow-y-auto max-h-[92dvh]">
            <h3 className="text-base font-bold text-[#f0fdfa]">Odrzuć odczyt</h3>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Powód odrzucenia (opcjonalnie)…"
              rows={3}
              className="input w-full text-sm resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setRejectId(null)} className="flex-1 text-sm border border-[#0f2d2a] text-[#0f766e] py-2 rounded-lg hover:bg-[#051210] transition">Anuluj</button>
              <button onClick={handleReject} className="flex-1 text-sm bg-red-800 hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition">Odrzuć</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

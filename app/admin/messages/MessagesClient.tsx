'use client'

import { useState, useTransition } from 'react'
import { sendMessageToResidents, getResidentsForMessage } from './actions'

type Resident = { id: string; full_name: string | null; email: string }
type Community = { id: string; name: string }

export default function MessagesClient({
  communities,
  initialResidents,
  isSuperAdmin,
}: {
  communities: Community[]
  initialResidents: Resident[]
  isSuperAdmin: boolean
}) {
  const [communityId, setCommunityId] = useState(communities[0]?.id ?? '')
  const [residents, setResidents] = useState<Resident[]>(initialResidents)
  const [mode, setMode] = useState<'all' | 'selected'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [result, setResult] = useState<{ error?: string; sent?: number } | null>(null)
  const [loadingResidents, setLoadingResidents] = useState(false)
  const [, startTransition] = useTransition()
  const [sending, setSending] = useState(false)

  const handleCommunityChange = async (id: string) => {
    setCommunityId(id)
    setSelected(new Set())
    setLoadingResidents(true)
    const data = await getResidentsForMessage(id)
    setResidents(data)
    setLoadingResidents(false)
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    const visible = filtered.map(r => r.id)
    const allSelected = visible.every(id => selected.has(id))
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) visible.forEach(id => next.delete(id))
      else visible.forEach(id => next.add(id))
      return next
    })
  }

  const filtered = residents.filter(r =>
    !search || (r.full_name ?? '').toLowerCase().includes(search.toLowerCase()) || r.email.toLowerCase().includes(search.toLowerCase())
  )

  const recipientCount = mode === 'all' ? residents.length : selected.size

  const handleSend = async () => {
    setResult(null)
    if (!subject.trim()) return setResult({ error: 'Podaj temat wiadomości' })
    if (!body.trim()) return setResult({ error: 'Wpisz treść wiadomości' })
    if (mode === 'selected' && selected.size === 0) return setResult({ error: 'Zaznacz przynajmniej jednego odbiorcę' })

    setSending(true)
    startTransition(async () => {
      const res = await sendMessageToResidents({
        subject,
        body,
        recipient_ids: mode === 'all' ? 'all' : Array.from(selected),
        community_id: communityId,
      })
      setSending(false)
      setResult(res)
      if (res.sent) {
        setSubject('')
        setBody('')
        setSelected(new Set())
      }
    })
  }

  return (
    <div className="space-y-5">

      {/* Wspólnota (super_admin) */}
      {isSuperAdmin && communities.length > 1 && (
        <div className="bg-[#121c15] border border-[#1e3324] rounded-xl p-4">
          <label className="block text-xs font-semibold text-[#6b9478] mb-2 uppercase tracking-wide">Wspólnota</label>
          <select
            value={communityId}
            onChange={e => handleCommunityChange(e.target.value)}
            className="input w-full"
          >
            {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {/* Odbiorcy */}
      <div className="bg-[#121c15] border border-[#1e3324] rounded-xl overflow-hidden">
        <div className="flex border-b border-[#1e3324]">
          {(['all', 'selected'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-3 text-sm font-semibold transition ${mode === m ? 'bg-[#0d1410] text-[#ecfdf5]' : 'text-[#4d7a5f] hover:text-[#a7f3d0]'}`}>
              {m === 'all'
                ? `Wszyscy mieszkańcy ${residents.length > 0 ? `(${residents.length})` : ''}`
                : `Wybrani ${selected.size > 0 ? `(${selected.size})` : ''}`}
            </button>
          ))}
        </div>

        {mode === 'selected' && (
          <div className="p-4 space-y-3">
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Szukaj po nazwisku lub emailu…"
              className="input w-full text-sm"
            />
            {loadingResidents ? (
              <p className="text-sm text-[#4d7a5f] py-2">Ładowanie…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-[#4d7a5f] py-2">Brak mieszkańców</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                {/* Zaznacz wszystkich */}
                <label className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-[#0d1410] cursor-pointer">
                  <input type="checkbox"
                    checked={filtered.length > 0 && filtered.every(r => selected.has(r.id))}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded accent-emerald-600"
                  />
                  <span className="text-xs font-semibold text-[#6b9478] uppercase tracking-wide">Zaznacz wszystkich</span>
                </label>
                <div className="border-t border-[#162418] my-1"/>
                {filtered.map(r => (
                  <label key={r.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#0d1410] cursor-pointer">
                    <input type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      className="w-4 h-4 rounded accent-emerald-600 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-[#ecfdf5] font-medium truncate">{r.full_name ?? '—'}</p>
                      <p className="text-xs text-[#4d7a5f] truncate">{r.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === 'all' && (
          <div className="px-4 py-3 text-sm text-[#6b9478]">
            Wiadomość zostanie wysłana do <span className="font-semibold text-[#a7f3d0]">{residents.length}</span> aktywnych mieszkańców.
          </div>
        )}
      </div>

      {/* Treść */}
      <div className="bg-[#121c15] border border-[#1e3324] rounded-xl p-4 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#6b9478] mb-2 uppercase tracking-wide">Temat *</label>
          <input
            value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="np. Zebranie mieszkańców — 15 marca"
            className="input w-full"
            maxLength={200}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#6b9478] mb-2 uppercase tracking-wide">Treść wiadomości *</label>
          <textarea
            value={body} onChange={e => setBody(e.target.value)}
            placeholder="Szanowni Mieszkańcy,&#10;&#10;informujemy, że…"
            rows={8}
            className="input w-full resize-none text-sm leading-relaxed"
          />
          <p className="text-xs text-[#2a4a2a] mt-1 text-right">{body.length} znaków</p>
        </div>
      </div>

      {/* Rezultat */}
      {result?.error && (
        <div className="bg-red-950/20 border border-red-900/40 text-red-400 text-sm rounded-xl px-4 py-3">{result.error}</div>
      )}
      {result?.sent && (
        <div className="bg-green-950/20 border border-green-900/40 text-green-400 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
          Wiadomość wysłana do <strong className="mx-1">{result.sent}</strong> {result.sent === 1 ? 'osoby' : result.sent < 5 ? 'osób' : 'osób'}.
        </div>
      )}

      {/* Wyślij */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#2a4a2a]">
          {recipientCount > 0
            ? <>Odbiorcy: <span className="text-[#6b9478] font-semibold">{recipientCount} {recipientCount === 1 ? 'osoba' : 'osób'}</span></>
            : <span className="text-[#1e3324]">Brak wybranych odbiorców</span>}
        </p>
        <button
          onClick={handleSend}
          disabled={sending || recipientCount === 0}
          className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-40"
        >
          {sending ? (
            <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Wysyłam…</>
          ) : (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>Wyślij wiadomość</>
          )}
        </button>
      </div>

    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleTicketStatus, createTicket } from './actions'
import Pagination from '@/components/Pagination'

type Tab = 'open' | 'closed'

interface Ticket {
  id: string
  title: string
  description: string | null
  status: string
  created_at: string
  community_id: string
  community: { name: string } | null
}

interface Props {
  tickets: Ticket[]
  communities: { id: string; name: string }[]
  userId: string
  communityId: string | null
  isAdmin: boolean
  isSuperAdmin: boolean
}

const PAGE_SIZE = 20

export default function TicketsClient({ tickets: initial, communities, userId, communityId, isAdmin, isSuperAdmin }: Props) {
  const router = useRouter()
  const [tickets, setTickets] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<Tab>('open')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [selectedComm, setSelectedComm] = useState(communityId ?? '')

  const handleStatusToggle = (ticket: Ticket) => {
    startTransition(async () => {
      try {
        const newStatus = await toggleTicketStatus(ticket.id, ticket.status)
        setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: newStatus } : t))
      } catch (e: any) {
        alert(e.message ?? 'Błąd podczas zmiany statusu')
      }
    })
  }

  const handleSubmitTicket = async () => {
    setFormError(null)
    const formData = new FormData()
    formData.append('title', title)
    formData.append('description', description)
    const commId = isSuperAdmin ? selectedComm : (communityId ?? '')
    if (!commId) { setFormError('Wybierz wspólnotę'); return }
    formData.append('communityId', commId)
    if (attachment) formData.append('attachment', attachment)

    startTransition(async () => {
      const result = await createTicket(formData)
      if (result?.error) {
        setFormError(result.error)
      } else {
        setTitle(''); setDescription(''); setAttachment(null); setShowForm(false)
        router.refresh()
      }
    })
  }

  const filtered = tickets.filter(t => {
    if (t.status !== (tab === 'open' ? 'open' : 'closed')) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      return t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
    }
    return true
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const openCount = tickets.filter(t => t.status === 'open').length
  const closedCount = tickets.filter(t => t.status === 'closed').length

  const handleTabChange = (t: Tab) => { setTab(t); setPage(1) }
  const handleSearch = (v: string) => { setSearch(v); setPage(1) }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#f0ebe0]">Zgłoszenia</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          + Nowe zgłoszenie
        </button>
      </div>

      {/* Wyszukiwarka */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a5a48] text-sm">🔍</span>
        <input
          className="input w-full pl-8 text-sm"
          placeholder="Szukaj zgłoszeń..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => handleSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6a5a48] hover:text-[#b8a898] text-xs">✕</button>
        )}
      </div>

      {/* Zakładki */}
      <div className="flex gap-1 bg-[#241e14] rounded-xl p-1 w-fit">
        {(['open', 'closed'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t ? 'bg-[#2a2218] text-[#f0ebe0] shadow-lg shadow-black/30' : 'text-[#6a5a48] hover:text-[#b8a898]'
            }`}
          >
            {t === 'open' ? 'Aktywne' : 'Archiwum'}
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
              t === 'open' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-[#2a2218] text-[#7a6a58]'
            }`}>
              {t === 'open' ? openCount : closedCount}
            </span>
          </button>
        ))}
      </div>

      {/* Formularz nowego zgłoszenia */}
      {showForm && tab === 'open' && (
        <div className="bg-[#241e14] border border-[#3a2e1e] rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-[#ddd5c5]">Nowe zgłoszenie</h3>
          {formError && (
            <div className="bg-red-950/30 border border-red-900 text-red-400 text-sm rounded-lg px-3 py-2">{formError}</div>
          )}
          {isSuperAdmin && (
            <select className="input w-full" value={selectedComm} onChange={e => setSelectedComm(e.target.value)}>
              <option value="">— wybierz wspólnotę —</option>
              {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <input className="input w-full" placeholder="Tytuł (min. 3 znaki)" value={title} onChange={e => setTitle(e.target.value)} />
          <textarea className="input w-full min-h-[80px]" placeholder="Opis problemu (min. 10 znaków)" value={description} onChange={e => setDescription(e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-[#b8a898] mb-1">
              Załącznik <span className="text-[#7a6a58] font-normal">(opcjonalnie, max 10 MB)</span>
            </label>
            <input
              type="file"
              onChange={e => setAttachment(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-[#7a6a58] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-amber-950/40 file:text-amber-400 hover:file:bg-amber-900/40 transition"
            />
            {attachment && <p className="text-xs text-[#6a5a48] mt-1">Wybrany: {attachment.name}</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={handleSubmitTicket} disabled={isPending} className="bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
              {isPending ? 'Wysyłanie...' : 'Wyślij'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-[#6a5a48] hover:text-[#b8a898]">Anuluj</button>
          </div>
        </div>
      )}

      {/* Lista zgłoszeń */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-sm text-[#7a6a58]">
            {search ? `Brak wyników dla "${search}".` : tab === 'open' ? 'Brak aktywnych zgłoszeń.' : 'Brak zgłoszeń w archiwum.'}
          </p>
        )}
        {paginated.map(t => (
          <div
            key={t.id}
            className={`bg-[#241e14] border rounded-xl p-4 flex items-start justify-between gap-4 cursor-pointer transition ${
              tab === 'closed' ? 'border-[#3a2e1e] opacity-75 hover:opacity-100 hover:border-[#3a2e1e]' : 'border-[#3a2e1e] hover:border-green-700'
            }`}
            onClick={() => router.push(`/admin/tickets/${t.id}`)}
          >
            <div className="min-w-0">
              <p className={`font-semibold truncate ${tab === 'closed' ? 'text-[#6a5a48]' : 'text-[#f0ebe0]'}`}>{t.title}</p>
              <p className="text-sm text-[#6a5a48] mt-1 line-clamp-1">{t.description}</p>
              <p className="text-xs text-[#7a6a58] mt-2">
                {t.community?.name} · {new Date(t.created_at).toLocaleDateString('pl-PL')}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                t.status === 'open' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-amber-900/40 text-amber-400'
              }`}>
                {t.status === 'open' ? 'Otwarte' : 'Zamknięte'}
              </span>
              {isAdmin && (
                <button
                  onClick={e => { e.stopPropagation(); handleStatusToggle(t) }}
                  disabled={isPending}
                  className="text-xs text-amber-400 hover:underline disabled:opacity-50"
                >
                  {t.status === 'open' ? 'Zamknij' : 'Wznów'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  )
}

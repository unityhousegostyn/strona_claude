'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import { toggleTicketStatus, createTicket } from './actions'

type Tab = 'open' | 'closed'

export default function TicketsPage() {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const [tickets, setTickets] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<Tab>('open')

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([])
  const [selectedComm, setSelectedComm] = useState('')

  const fetchTickets = async (p: any) => {
    const query = supabase
      .from('tickets')
      .select('*, community:communities(name)')
      .order('created_at', { ascending: false })

    if (p.role === 'user' || p.role === 'admin') {
      query.eq('community_id', p.community_id)
    }

    const { data } = await query
    setTickets(data ?? [])
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      await fetchTickets(p)
      if (p?.role === 'super_admin') {
        const { data: comms } = await supabase.from('communities').select('id, name').order('name')
        setCommunities(comms ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleStatusToggle = (ticket: any) => {
    startTransition(async () => {
      try {
        const newStatus = await toggleTicketStatus(ticket.id, ticket.status)
        setTickets((prev) => prev.map((t) => t.id === ticket.id ? { ...t, status: newStatus } : t))
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
    const commId = profile.role === 'super_admin' ? selectedComm : profile.community_id
    if (!commId) { setFormError('Wybierz wspólnotę'); return }
    formData.append('communityId', commId)
    if (attachment) formData.append('attachment', attachment)

    startTransition(async () => {
      const result = await createTicket(formData)
      if (result?.error) {
        setFormError(result.error)
      } else {
        setTitle('')
        setDescription('')
        setAttachment(null)
        setShowForm(false)
        await fetchTickets(profile)
      }
    })
  }

  const visible = tickets.filter((t) => t.status === (tab === 'open' ? 'open' : 'closed'))
  const openCount = tickets.filter((t) => t.status === 'open').length
  const closedCount = tickets.filter((t) => t.status === 'closed').length

  if (loading) return <p className="text-sm text-gray-400">Ładowanie...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-100">Zgłoszenia</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          + Nowe zgłoszenie
        </button>
      </div>

      {/* Zakładki */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('open')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'open'
              ? 'bg-gray-900 text-gray-100 shadow-lg shadow-black/30'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Aktywne
          {openCount > 0 && (
            <span className="bg-yellow-900/40 text-yellow-400 text-xs font-semibold px-1.5 py-0.5 rounded-full">
              {openCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('closed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'closed'
              ? 'bg-gray-900 text-gray-100 shadow-lg shadow-black/30'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Archiwum
          {closedCount > 0 && (
            <span className="bg-gray-200 text-gray-400 text-xs font-semibold px-1.5 py-0.5 rounded-full">
              {closedCount}
            </span>
          )}
        </button>
      </div>

      {/* Formularz nowego zgłoszenia */}
      {showForm && tab === 'open' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-gray-200">Nowe zgłoszenie</h3>
          {formError && (
            <div className="bg-red-950/30 border border-red-900 text-red-400 text-sm rounded-lg px-3 py-2">
              {formError}
            </div>
          )}
          {profile?.role === 'super_admin' && (
            <select className="input w-full" value={selectedComm} onChange={e => setSelectedComm(e.target.value)}>
              <option value="">— wybierz wspólnotę —</option>
              {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <input
            className="input w-full"
            placeholder="Tytuł (min. 3 znaki)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="input w-full min-h-[80px]"
            placeholder="Opis problemu (min. 10 znaków)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Załącznik <span className="text-gray-400 font-normal">(opcjonalnie, max 10 MB)</span>
            </label>
            <input
              type="file"
              onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-950/40 file:text-blue-400 hover:file:bg-blue-900/40 transition"
            />
            {attachment && (
              <p className="text-xs text-gray-500 mt-1">Wybrany: {attachment.name}</p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSubmitTicket}
              disabled={isPending}
              className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {isPending ? 'Wysyłanie...' : 'Wyślij'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-300">
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Lista zgłoszeń */}
      <div className="space-y-3">
        {visible.length === 0 && (
          <p className="text-sm text-gray-400">
            {tab === 'open' ? 'Brak aktywnych zgłoszeń.' : 'Brak zgłoszeń w archiwum.'}
          </p>
        )}
        {visible.map((t: any) => (
          <div
            key={t.id}
            className={`bg-gray-900 border rounded-xl p-4 flex items-start justify-between gap-4 cursor-pointer transition ${
              tab === 'closed'
                ? 'border-gray-800 opacity-75 hover:opacity-100 hover:border-gray-700'
                : 'border-gray-800 hover:border-blue-700'
            }`}
            onClick={() => router.push(`/admin/tickets/${t.id}`)}
          >
            <div>
              <p className={`font-semibold ${tab === 'closed' ? 'text-gray-500' : 'text-gray-100'}`}>
                {t.title}
              </p>
              <p className="text-sm text-gray-500 mt-1 line-clamp-1">{t.description}</p>
              <p className="text-xs text-gray-400 mt-2">
                {t.community?.name} · {new Date(t.created_at).toLocaleDateString('pl-PL')}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                t.status === 'open' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-green-100 text-green-400'
              }`}>
                {t.status === 'open' ? 'Otwarte' : 'Zamknięte'}
              </span>
              {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleStatusToggle(t) }}
                  disabled={isPending}
                  className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                >
                  {t.status === 'open' ? 'Zamknij' : 'Wznów'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

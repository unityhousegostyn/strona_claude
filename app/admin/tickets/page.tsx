'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import { toggleTicketStatus, createTicket } from './actions'

export default function TicketsPage() {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const [tickets, setTickets] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

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
    formData.append('communityId', profile.community_id)
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

  const statusBadge = (status: string) =>
    status === 'open' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'

  if (loading) return <p className="text-sm text-gray-400">Ładowanie...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Zgłoszenia</h2>
        {profile?.role === 'user' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            + Nowe zgłoszenie
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-gray-800">Nowe zgłoszenie</h3>
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {formError}
            </div>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Załącznik <span className="text-gray-400 font-normal">(opcjonalnie, max 10 MB)</span>
            </label>
            <input
              type="file"
              onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition"
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
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700">
              Anuluj
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {tickets.length === 0 && <p className="text-sm text-gray-400">Brak zgłoszeń.</p>}
        {tickets.map((t: any) => (
          <div
            key={t.id}
            className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4 cursor-pointer hover:border-blue-200 transition"
            onClick={() => router.push(`/admin/tickets/${t.id}`)}
          >
            <div>
              <p className="font-semibold text-gray-900">{t.title}</p>
              <p className="text-sm text-gray-500 mt-1 line-clamp-1">{t.description}</p>
              <p className="text-xs text-gray-400 mt-2">
                {t.community?.name} · {new Date(t.created_at).toLocaleDateString('pl-PL')}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusBadge(t.status)}`}>
                {t.status === 'open' ? 'Otwarte' : 'Zamknięte'}
              </span>
              {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleStatusToggle(t) }}
                  disabled={isPending}
                  className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                >
                  Zmień status
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

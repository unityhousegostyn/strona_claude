'use client'

import { useState, useTransition } from 'react'
import { addComment } from './actions'
import { toggleTicketStatus } from '../actions'
import { useToast } from '@/components/ToastContext'

interface Comment {
  id: string
  content: string
  created_at: string
  author_id: string
  author: { full_name: string | null; email: string } | null
}

interface Props {
  ticketId: string
  comments: Comment[]
  currentUserId: string
  canChangeStatus: boolean
  ticketStatus: string
}

export default function TicketComments({ ticketId, comments: initial, currentUserId, canChangeStatus, ticketStatus }: Props) {
  const { showToast } = useToast()
  const [comments, setComments] = useState(initial)
  const [content, setContent] = useState('')
  const [status, setStatus] = useState(ticketStatus)
  const [isPending, startTransition] = useTransition()

  const handleAdd = () => {
    if (!content.trim()) return
    startTransition(async () => {
      try {
        const comment = await addComment(ticketId, content.trim())
        setComments((prev) => [...prev, comment])
        setContent('')
        showToast('Komentarz dodany')
      } catch (e: any) {
        showToast(e.message ?? 'Błąd', 'error')
      }
    })
  }

  const handleToggleStatus = () => {
    startTransition(async () => {
      try {
        const newStatus = await toggleTicketStatus(ticketId, status)
        setStatus(newStatus)
        showToast(`Status zmieniony na: ${newStatus === 'open' ? 'Otwarte' : 'Zamknięte'}`)
      } catch (e: any) {
        showToast(e.message ?? 'Błąd', 'error')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#fef3c7]">Komentarze ({comments.length})</h3>
        {canChangeStatus && (
          <button
            onClick={handleToggleStatus}
            disabled={isPending}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition disabled:opacity-50 ${
              status === 'open'
                ? 'border-amber-800 text-amber-400 hover:bg-amber-950/30'
                : 'border-yellow-900 text-yellow-400 hover:bg-yellow-950/30'
            }`}
          >
            {status === 'open' ? 'Zamknij zgłoszenie' : 'Otwórz ponownie'}
          </button>
        )}
      </div>

      {comments.length === 0 && (
        <p className="text-sm text-[#b45309]">Brak komentarzy. Dodaj pierwszy.</p>
      )}

      <div className="space-y-3">
        {comments.map((c) => {
          const isOwn = c.author_id === currentUserId
          return (
            <div key={c.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
              <div className="w-7 h-7 rounded-full bg-[#271a0c] text-[#b45309] text-xs font-bold flex items-center justify-center flex-shrink-0">
                {(c.author?.full_name ?? c.author?.email ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                <div className={`rounded-xl px-4 py-2.5 text-sm ${
                  isOwn ? 'bg-amber-600 text-white' : 'bg-[#1e1409] border border-[#33200d] text-[#fef3c7]'
                }`}>
                  {c.content}
                </div>
                <p className="text-xs text-[#b45309] px-1">
                  {c.author?.full_name ?? c.author?.email ?? '—'} · {new Date(c.created_at).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-2 pt-2">
        <input
          className="input flex-1"
          placeholder="Napisz komentarz..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={isPending || !content.trim()}
          className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50"
        >
          Wyślij
        </button>
      </div>
    </div>
  )
}

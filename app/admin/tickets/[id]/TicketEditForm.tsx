'use client'

import { useState, useTransition } from 'react'
import { updateTicket } from '../actions'
import { useRouter } from 'next/navigation'

interface Props {
  ticketId: string
  initialTitle: string
  initialDescription: string
}

export default function TicketEditForm({ ticketId, initialTitle, initialDescription }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const result = await updateTicket(ticketId, { title, description })
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-[#6a5a48] hover:text-[#b8a898] border border-[#3a2e1e] px-3 py-1.5 rounded-lg transition"
      >
        ✏️ Edytuj zgłoszenie
      </button>
    )
  }

  return (
    <div className="space-y-3 pt-2 border-t border-[#3a2e1e]">
      <h4 className="text-sm font-medium text-[#b8a898]">Edytuj zgłoszenie</h4>
      {error && <p className="text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">{error}</p>}
      <input
        className="input w-full"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Tytuł"
      />
      <textarea
        className="input w-full min-h-[80px]"
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Opis"
      />
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition"
        >
          {isPending ? 'Zapisywanie...' : 'Zapisz'}
        </button>
        <button onClick={() => { setOpen(false); setTitle(initialTitle); setDescription(initialDescription) }} className="text-sm text-[#6a5a48] hover:text-[#b8a898]">
          Anuluj
        </button>
      </div>
    </div>
  )
}

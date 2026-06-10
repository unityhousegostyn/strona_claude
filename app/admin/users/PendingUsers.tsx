'use client'

import { useState, useTransition } from 'react'
import { approveUser, rejectUser } from './actions'
import { Community } from '@/types'
import { useToast } from '@/components/ToastContext'

interface PendingUser {
  id: string
  full_name: string | null
  email?: string
  created_at: string
}

interface Apartment {
  id: string
  number: string
  community_id: string
}

interface Props {
  users: PendingUser[]
  communities: Community[]
  apartments: Apartment[]
  isSuperAdmin: boolean
  adminCommunityId: string | null
}

export default function PendingUsers({ users, communities, apartments, isSuperAdmin, adminCommunityId }: Props) {
  const [selectedCommunity, setSelectedCommunity] = useState<Record<string, string>>({})
  const [selectedApartment, setSelectedApartment] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const { showToast } = useToast()

  if (users.length === 0) return null

  const handleApprove = (userId: string) => {
    const communityId = isSuperAdmin ? selectedCommunity[userId] : (adminCommunityId ?? '')
    if (!communityId) return alert('Wybierz wspólnotę.')
    const apartmentId = selectedApartment[userId] || null
    startTransition(async () => {
      const result = await approveUser(userId, communityId, apartmentId)
      if (result?.error) showToast(result.error, 'error')
    })
  }

  const handleReject = (userId: string) => {
    if (!confirm('Czy na pewno odrzucić i usunąć to konto?')) return
    startTransition(() => rejectUser(userId))
  }

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-orange-400 flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-900/40 text-orange-400 text-xs font-bold">
          {users.length}
        </span>
        Oczekujące na akceptację
      </h3>
      <div className="space-y-2">
        {users.map((u) => {
          const communityId = isSuperAdmin ? selectedCommunity[u.id] : (adminCommunityId ?? '')
          const availableApts = apartments.filter(a => a.community_id === communityId)

          return (
            <div
              key={u.id}
              className="bg-orange-950/20 border border-orange-800 rounded-xl px-4 py-3 flex items-center justify-between gap-4 flex-wrap"
            >
              <div>
                <p className="font-medium text-gray-200 text-sm">
                  {u.full_name ?? <span className="italic text-gray-400">Brak nazwy</span>}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Zarejestrowany {new Date(u.created_at).toLocaleDateString('pl-PL')}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {isSuperAdmin && (
                  <select
                    value={selectedCommunity[u.id] ?? ''}
                    onChange={(e) => {
                      setSelectedCommunity(prev => ({ ...prev, [u.id]: e.target.value }))
                      setSelectedApartment(prev => ({ ...prev, [u.id]: '' }))
                    }}
                    className="text-sm bg-gray-900 text-gray-200 border border-gray-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-400"
                  >
                    <option value="">Wybierz wspólnotę…</option>
                    {communities.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}

                {/* Dropdown lokalu — pojawia się gdy wspólnota wybrana */}
                {communityId && (
                  <select
                    value={selectedApartment[u.id] ?? ''}
                    onChange={(e) => setSelectedApartment(prev => ({ ...prev, [u.id]: e.target.value }))}
                    className="text-sm bg-gray-900 text-gray-200 border border-gray-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-400"
                  >
                    <option value="">Lokal (opcjonalnie)…</option>
                    {availableApts.map((a) => (
                      <option key={a.id} value={a.id}>Lokal {a.number}</option>
                    ))}
                  </select>
                )}

                <button
                  onClick={() => handleApprove(u.id)}
                  disabled={isPending}
                  className="text-sm bg-green-600 hover:bg-green-700 text-white font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                >
                  Zatwierdź
                </button>
                <button
                  onClick={() => handleReject(u.id)}
                  disabled={isPending}
                  className="text-sm bg-red-950/30 hover:bg-red-100 text-red-400 font-semibold px-3 py-1.5 rounded-lg border border-red-900 transition disabled:opacity-50"
                >
                  Odrzuć
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

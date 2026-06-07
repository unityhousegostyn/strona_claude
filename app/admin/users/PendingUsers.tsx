'use client'

import { useState, useTransition } from 'react'
import { approveUser, rejectUser } from './actions'
import { Community } from '@/types'

interface PendingUser {
  id: string
  full_name: string | null
  email?: string
  created_at: string
}

interface Props {
  users: PendingUser[]
  communities: Community[]
  isSuperAdmin: boolean
  adminCommunityId: string | null
}

export default function PendingUsers({ users, communities, isSuperAdmin, adminCommunityId }: Props) {
  const [selectedCommunity, setSelectedCommunity] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  if (users.length === 0) return null

  const handleApprove = (userId: string) => {
    const communityId = isSuperAdmin ? selectedCommunity[userId] : adminCommunityId
    if (!communityId) return alert('Wybierz wspólnotę.')
    startTransition(() => approveUser(userId, communityId))
  }

  const handleReject = (userId: string) => {
    if (!confirm('Czy na pewno odrzucić i usunąć to konto?')) return
    startTransition(() => rejectUser(userId))
  }

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-orange-700 flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
          {users.length}
        </span>
        Oczekujące na akceptację
      </h3>
      <div className="space-y-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4 flex-wrap"
          >
            <div>
              <p className="font-medium text-gray-900 text-sm">
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
                  onChange={(e) => setSelectedCommunity((prev) => ({ ...prev, [u.id]: e.target.value }))}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Wybierz wspólnotę…</option>
                  {communities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
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
                className="text-sm bg-red-50 hover:bg-red-100 text-red-600 font-semibold px-3 py-1.5 rounded-lg border border-red-200 transition disabled:opacity-50"
              >
                Odrzuć
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

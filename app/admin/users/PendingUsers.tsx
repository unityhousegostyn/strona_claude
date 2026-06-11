'use client'

import { useState, useTransition } from 'react'
import { approveUser, rejectUser, activateInvitedUser } from './actions'
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
  invitedUsers: (PendingUser & { community?: { name: string } | null; community_id?: string | null })[]
  communities: Community[]
  apartments: Apartment[]
  isSuperAdmin: boolean
  adminCommunityId: string | null
}

export default function PendingUsers({ users, invitedUsers, communities, apartments, isSuperAdmin, adminCommunityId }: Props) {
  const [selectedCommunity, setSelectedCommunity] = useState<Record<string, string>>({})
  const [selectedApartment, setSelectedApartment] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const { showToast } = useToast()

  if (users.length === 0 && invitedUsers.length === 0) return null

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
                <p className="font-medium text-[#d1fae5] text-sm">
                  {u.full_name ?? <span className="italic text-[#6b9478]">Brak nazwy</span>}
                </p>
                <p className="text-xs text-[#4d7a5f] mt-0.5">
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
                    className="text-sm bg-[#121c15] text-[#d1fae5] border border-[#1e3324] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
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
                    className="text-sm bg-[#121c15] text-[#d1fae5] border border-[#1e3324] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
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
                  className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                >
                  Zatwierdź
                </button>
                <button
                  onClick={() => handleReject(u.id)}
                  disabled={isPending}
                  className="text-sm bg-red-950/30 hover:bg-red-950/50 text-red-400 font-semibold px-3 py-1.5 rounded-lg border border-red-900 transition disabled:opacity-50"
                >
                  Odrzuć
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {invitedUsers.length > 0 && (
        <div className="space-y-3 mt-4">
          <h3 className="text-base font-semibold text-emerald-400 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-900/40 text-emerald-400 text-xs font-bold">
              {invitedUsers.length}
            </span>
            Zaproszeni — oczekują na aktywację
          </h3>
          <div className="space-y-2">
            {invitedUsers.map((u) => {
              const communityId = u.community_id ?? (isSuperAdmin ? selectedCommunity[u.id] : (adminCommunityId ?? ''))
              const availableApts = apartments.filter(a => a.community_id === communityId)
              return (
                <div key={u.id} className="bg-emerald-950/10 border border-emerald-800/40 rounded-xl px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-medium text-[#d1fae5] text-sm">{u.full_name ?? <span className="italic text-[#6b9478]">Brak nazwy</span>}</p>
                    <p className="text-xs text-[#4d7a5f] mt-0.5">
                      {u.community?.name ?? '—'} · Zarejestrowany {new Date(u.created_at).toLocaleDateString('pl-PL')}
                    </p>
                    <p className="text-xs text-emerald-700 mt-0.5">Email zweryfikowany — wymaga ręcznej aktywacji</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {communityId && (
                      <select
                        value={selectedApartment[u.id] ?? ''}
                        onChange={(e) => setSelectedApartment(prev => ({ ...prev, [u.id]: e.target.value }))}
                        className="text-sm bg-[#121c15] text-[#d1fae5] border border-[#1e3324] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      >
                        <option value="">Lokal (opcjonalnie)…</option>
                        {availableApts.map((a) => (
                          <option key={a.id} value={a.id}>Lokal {a.number}</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => {
                        const aptId = selectedApartment[u.id] || null
                        startTransition(async () => {
                          if (aptId && communityId) {
                            await approveUser(u.id, communityId, aptId)
                          } else {
                            const res = await activateInvitedUser(u.id)
                            if (res?.error) showToast(res.error, 'error')
                          }
                        })
                      }}
                      disabled={isPending}
                      className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                    >
                      Aktywuj
                    </button>
                    <button
                      onClick={() => handleReject(u.id)}
                      disabled={isPending}
                      className="text-sm bg-red-950/30 hover:bg-red-950/50 text-red-400 font-semibold px-3 py-1.5 rounded-lg border border-red-900 transition disabled:opacity-50"
                    >
                      Usuń
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

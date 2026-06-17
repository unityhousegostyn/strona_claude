'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateUser, deactivateUser, deleteUserPermanently, assignApartment, sendPasswordResetLink } from './actions'
import { useToast } from '@/components/ToastContext'

interface Community { id: string; name: string }
interface Apartment { id: string; number: string; community_id: string; owner_id: string | null }

interface Props {
  userId: string
  currentUserId: string
  initialFullName: string
  initialRole: string
  initialCommunityId: string | null
  communities: Community[]
  apartments: Apartment[]
  currentApartmentId: string | null
  isSelf: boolean
}

export default function UserEditForm({
  userId, currentUserId, initialFullName, initialRole, initialCommunityId, communities, apartments, currentApartmentId, isSelf
}: Props) {
  const router = useRouter()
  const { showToast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [fullName, setFullName] = useState(initialFullName)
  const [role, setRole] = useState(initialRole)
  const [communityId, setCommunityId] = useState(initialCommunityId ?? '')
  const [apartmentId, setApartmentId] = useState(currentApartmentId ?? '')
  const [resetSending, setResetSending] = useState(false)

  const handleSendPasswordReset = async () => {
    setResetSending(true)
    try {
      const result = await sendPasswordResetLink(userId)
      if (result.error) showToast(result.error, 'error')
      else showToast('Link do resetowania hasła wysłany na e-mail użytkownika ✓')
    } catch (e: any) {
      showToast(e.message ?? 'Błąd', 'error')
    } finally {
      setResetSending(false)
    }
  }

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateUser(userId, {
          full_name: fullName,
          role,
          community_id: role === 'super_admin' ? null : (communityId || null),
        })
        // Zapisz mieszkanie razem z resztą danych
        await assignApartment(userId, apartmentId || null)
        showToast('Użytkownik zaktualizowany')
        router.push('/admin/users')
      } catch (e: any) {
        showToast(e.message ?? 'Błąd podczas zapisywania', 'error')
      }
    })
  }

  const handleDeactivate = () => {
    if (!confirm('Dezaktywować tego użytkownika? Straci dostęp do systemu.')) return
    startTransition(async () => {
      try {
        await deactivateUser(userId)
        showToast('Użytkownik dezaktywowany')
        router.push('/admin/users')
      } catch (e: any) {
        showToast(e.message ?? 'Błąd', 'error')
      }
    })
  }

  const handleDelete = () => {
    if (!confirm('Na pewno usunąć tego użytkownika? Operacja jest nieodwracalna.')) return
    startTransition(async () => {
      try {
        await deleteUserPermanently(userId)
        showToast('Użytkownik usunięty')
        router.push('/admin/users')
      } catch (e: any) {
        showToast(e.message ?? 'Błąd', 'error')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-[#0f766e] uppercase tracking-wide">Edytuj dane</h3>

        <div>
          <label className="block text-sm font-medium text-[#99f6e4] mb-1">Imię i nazwisko</label>
          <input
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jan Kowalski"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#99f6e4] mb-1">Rola</label>
          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={isSelf}
          >
            <option value="user">Mieszkaniec</option>
            <option value="admin">Administrator</option>
            <option value="super_admin">Super Admin</option>
          </select>
          {isSelf && <p className="text-xs text-[#0f766e] mt-1">Nie możesz zmienić własnej roli.</p>}
        </div>

        {role !== 'super_admin' && (
          <div>
            <label className="block text-sm font-medium text-[#99f6e4] mb-1">Wspólnota</label>
            <select
              className="input"
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
            >
              <option value="">— brak —</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Przypisanie mieszkania */}
      <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-[#0f766e] uppercase tracking-wide">Przypisane mieszkanie</h3>
        <div>
          <label className="block text-sm font-medium text-[#99f6e4] mb-1">Lokal</label>
          <select className="input w-full" value={apartmentId} onChange={e => setApartmentId(e.target.value)}>
            <option value="">— brak —</option>
            {communities.map(comm => {
              const commApts = apartments.filter(a => a.community_id === comm.id)
              if (!commApts.length) return null
              return (
                <optgroup key={comm.id} label={comm.name}>
                  {commApts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.number}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </div>
        <p className="text-xs text-[#115e59]">Jeden użytkownik = jedno mieszkanie. Mieszkanie zapisuje się razem z resztą danych przyciskiem poniżej.</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {isPending ? 'Zapisywanie...' : 'Zapisz zmiany'}
          </button>
          <button
            onClick={() => router.back()}
            className="text-sm text-[#0f766e] hover:text-[#f0fdfa] px-5 py-2.5 rounded-lg border border-[#0f2d2a] hover:bg-[#051210] transition"
          >
            Anuluj
          </button>
        </div>

        {!isSelf && (
          <div className="flex gap-2 flex-wrap justify-end">
            <button
              onClick={handleSendPasswordReset}
              disabled={resetSending}
              className="text-sm text-teal-400 hover:text-teal-300 font-medium px-4 py-2.5 rounded-lg border border-teal-800 hover:bg-teal-950/30 transition disabled:opacity-50"
              title="Wysyła link resetowania hasła na e-mail użytkownika"
            >
              {resetSending ? 'Wysyłanie...' : '🔑 Reset hasła'}
            </button>
            <button
              onClick={handleDeactivate}
              disabled={isPending}
              className="text-sm text-yellow-400 hover:text-yellow-400 font-medium px-4 py-2.5 rounded-lg border border-yellow-900 hover:bg-yellow-950/30 transition disabled:opacity-50"
            >
              Dezaktywuj
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-sm text-red-400 hover:text-red-400 font-medium px-4 py-2.5 rounded-lg border border-red-900 hover:bg-red-950/30 transition disabled:opacity-50"
            >
              Usuń konto
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

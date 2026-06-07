'use client'

import { useState, useTransition } from 'react'
import { updateProfile, changePassword } from './actions'
import { useToast } from '@/components/ToastContext'

export default function ProfileForm({ fullName }: { fullName: string }) {
  const { showToast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(fullName)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const handleSaveName = () => {
    startTransition(async () => {
      try {
        await updateProfile({ full_name: name })
        showToast('Imię i nazwisko zostało zaktualizowane')
      } catch (e: any) {
        showToast(e.message ?? 'Błąd podczas zapisywania', 'error')
      }
    })
  }

  const handleChangePassword = () => {
    startTransition(async () => {
      try {
        await changePassword({ password, confirm })
        setPassword('')
        setConfirm('')
        showToast('Hasło zostało zmienione')
      } catch (e: any) {
        showToast(e.message ?? 'Błąd podczas zmiany hasła', 'error')
      }
    })
  }

  return (
    <>
      {/* Zmiana imienia */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Imię i nazwisko</h3>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jan Kowalski"
        />
        <button
          onClick={handleSaveName}
          disabled={isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50"
        >
          {isPending ? 'Zapisywanie...' : 'Zapisz'}
        </button>
      </div>

      {/* Zmiana hasła */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Zmień hasło</h3>
        <div className="space-y-3">
          <input
            type="password"
            className="input"
            placeholder="Nowe hasło (min. 8 znaków)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            className="input"
            placeholder="Powtórz nowe hasło"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
          />
        </div>
        <button
          onClick={handleChangePassword}
          disabled={isPending || !password}
          className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50"
        >
          {isPending ? 'Zmienianie...' : 'Zmień hasło'}
        </button>
      </div>
    </>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { updateProfile, changePassword, setPin } from './actions'
import { useToast } from '@/components/ToastContext'

export default function ProfileForm({ fullName, hasPin }: { fullName: string; hasPin: boolean }) {
  const { showToast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(fullName)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pin, setPin_] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')

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

  const handleSetPin = () => {
    startTransition(async () => {
      const result = await setPin({ pin, pinConfirm })
      if (result.error) {
        showToast(result.error, 'error')
      } else {
        setPin_('')
        setPinConfirm('')
        showToast('PIN do głosowania został ustawiony ✓')
      }
    })
  }

  return (
    <>
      {/* Zmiana imienia */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
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

      {/* PIN do głosowania */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">PIN do głosowania</h3>
          {hasPin
            ? <span className="text-xs bg-green-900/30 text-green-400 border border-green-800 px-2 py-0.5 rounded-full">✓ Ustawiony</span>
            : <span className="text-xs bg-orange-900/30 text-orange-400 border border-orange-800 px-2 py-0.5 rounded-full">Nie ustawiony</span>
          }
        </div>
        <p className="text-xs text-gray-500">4-cyfrowy PIN używany do potwierdzenia głosu w uchwałach wspólnoty.</p>
        <div className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            className="input w-32 tracking-widest text-center text-lg"
            placeholder="••••"
            value={pin}
            onChange={e => setPin_(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            className="input w-32 tracking-widest text-center text-lg"
            placeholder="••••"
            value={pinConfirm}
            onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={e => e.key === 'Enter' && handleSetPin()}
          />
        </div>
        <button
          onClick={handleSetPin}
          disabled={isPending || pin.length !== 4 || pinConfirm.length !== 4}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50"
        >
          {isPending ? 'Zapisywanie...' : hasPin ? 'Zmień PIN' : 'Ustaw PIN'}
        </button>
      </div>

      {/* Zmiana hasła */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
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

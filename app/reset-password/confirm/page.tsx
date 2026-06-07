'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

export default function ConfirmResetPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase umieszcza tokeny w hashu URL po kliknięciu linku z maila
    // getSupabaseBrowserClient automatycznie je odbiera i tworzy sesję
    const supabase = getSupabaseBrowserClient()
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
  }, [])

  const handleSubmit = async () => {
    setError(null)
    if (password.length < 6) return setError('Hasło musi mieć co najmniej 6 znaków.')
    if (password !== confirm) return setError('Hasła nie są identyczne.')

    setLoading(true)
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError('Błąd: ' + error.message)
    } else {
      await supabase.auth.signOut()
      router.push('/login?reset=success')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white shadow-md rounded-xl p-8 w-full max-w-sm space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Nowe hasło</h1>
          <p className="text-sm text-gray-500 mt-1">Ustaw nowe hasło do swojego konta.</p>
        </div>

        {!ready ? (
          <p className="text-sm text-gray-400">Weryfikowanie linku…</p>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nowe hasło</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Powtórz hasło</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-2.5 text-sm transition disabled:opacity-50"
            >
              {loading ? 'Zapisywanie...' : 'Zapisz nowe hasło'}
        </button>
          </>
        )}
      </div>
    </main>
  )
}

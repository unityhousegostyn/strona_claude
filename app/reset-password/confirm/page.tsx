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
    <main className="min-h-screen flex items-center justify-center bg-[#0d1410]">
      <div className="bg-[#121c15] shadow-2xl shadow-black/40 rounded-xl p-8 w-full max-w-sm space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-[#d1fae5]">Nowe hasło</h1>
          <p className="text-sm text-[#4d7a5f] mt-1">Ustaw nowe hasło do swojego konta.</p>
        </div>

        {!ready ? (
          <p className="text-sm text-[#6b9478]">Weryfikowanie linku…</p>
        ) : (
          <>
            {error && (
              <div className="bg-red-950/30 border border-red-900 text-red-400 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#a7f3d0] mb-1">Nowe hasło</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input w-full"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#a7f3d0] mb-1">Powtórz hasło</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="input w-full"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg py-2.5 text-sm transition disabled:opacity-50"
            >
              {loading ? 'Zapisywanie...' : 'Zapisz nowe hasło'}
        </button>
          </>
        )}
      </div>
    </main>
  )
}

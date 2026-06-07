'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import Link from 'next/link'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const reset = searchParams.get('reset')
    const status = searchParams.get('status')
    const verified = searchParams.get('verified')
    if (reset === 'success') {
      setSuccess('Hasło zostało zmienione. Możesz się teraz zalogować.')
    } else if (verified === 'true') {
      setSuccess('Email potwierdzony! Konto oczekuje teraz na akceptację administratora.')
    } else if (status === 'unconfirmed') {
      setSuccess('Potwierdź adres email klikając link w wiadomości którą wysłaliśmy.')
    } else if (status === 'pending') {
      setSuccess('Konto oczekuje na akceptację administratora.')
    }
  }, [searchParams])

  const handleLogin = async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setError(error.message || 'Nieprawidłowy email lub hasło.')
        setLoading(false)
        return
      }

      await supabase.auth.getSession()
      router.push('/admin/dashboard')
    } catch {
      setError('Wystąpił błąd logowania.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-900 shadow-2xl shadow-black/40 rounded-xl p-8 w-full max-w-sm space-y-5">
      <h1 className="text-2xl font-bold text-gray-200">Logowanie</h1>
      <p className="text-sm text-gray-500">Panel zarządzania wspólnotą</p>

      {success && (
        <div className="bg-green-950/30 border border-green-900 text-green-400 text-sm rounded-lg px-4 py-3">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-950/30 border border-red-900 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="input w-full"
            placeholder="jan@wspolnota.pl"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Hasło</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="input w-full"
            placeholder="••••••••"
          />
        </div>
      </div>

      <button
        onClick={handleLogin}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-2.5 text-sm transition disabled:opacity-50"
      >
        {loading ? 'Logowanie...' : 'Zaloguj się'}
      </button>

      <div className="flex flex-col items-center gap-2 pt-2">
        <Link href="/reset-password" className="text-sm text-gray-500 hover:text-gray-300 hover:underline">
          Zapomniałeś hasła?
        </Link>
        <Link href="/register" className="text-sm text-blue-600 hover:underline">
          Nie masz konta? Zarejestruj się
        </Link>
      </div>

      <div className="border-t border-gray-800 pt-4">
        <p className="text-xs text-gray-400 text-center leading-relaxed">
          Administratorem danych osobowych jest zarządca wspólnoty mieszkaniowej.
          Dane przetwarzane są w celu obsługi panelu mieszkańca na podstawie art. 6 ust. 1 lit. b RODO.
          Przysługuje Ci prawo dostępu, sprostowania, usunięcia danych oraz wniesienia skargi do UODO.
          Szczegóły w{' '}
          <Link href="/privacy" className="underline hover:text-gray-400">
            Polityce Prywatności
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950">
      <Suspense fallback={<div className="bg-gray-900 shadow-2xl shadow-black/40 rounded-xl p-8 w-full max-w-sm" />}>
        <LoginForm />
      </Suspense>
    </main>
  )
}

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
    <div className="bg-white shadow-md rounded-xl p-8 w-full max-w-sm space-y-5">
      <h1 className="text-2xl font-bold text-gray-800">Logowanie</h1>
      <p className="text-sm text-gray-500">Panel zarządzania wspólnotą</p>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="jan@wspolnota.pl"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hasło</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <Link href="/reset-password" className="text-sm text-gray-500 hover:text-gray-700 hover:underline">
          Zapomniałeś hasła?
        </Link>
        <Link href="/register" className="text-sm text-blue-600 hover:underline">
          Nie masz konta? Zarejestruj się
        </Link>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <Suspense fallback={<div className="bg-white shadow-md rounded-xl p-8 w-full max-w-sm" />}>
        <LoginForm />
      </Suspense>
    </main>
  )
}

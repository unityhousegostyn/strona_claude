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
    const errorParam = searchParams.get('error')
    if (reset === 'success') {
      setSuccess('Hasło zostało zmienione. Możesz się teraz zalogować.')
    } else if (verified === 'true') {
      setSuccess('Email potwierdzony! Konto oczekuje teraz na akceptację administratora.')
    } else if (status === 'unconfirmed') {
      setSuccess('Potwierdź adres email klikając link w wiadomości którą wysłaliśmy.')
    } else if (status === 'pending') {
      setSuccess('Konto oczekuje na akceptację administratora.')
    } else if (errorParam === 'invalid-link') {
      setError('Link weryfikacyjny jest nieprawidłowy lub wygasł. Zarejestruj się ponownie.')
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

      // Sprawdź czy użytkownik ma 2FA aktywne
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aalData?.nextLevel === 'aal2' && aalData?.currentLevel !== 'aal2') {
        window.location.href = '/mfa-verify'
      } else {
        window.location.href = '/admin/dashboard'
      }
    } catch {
      setError('Wystąpił błąd logowania.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[#121c15] shadow-2xl shadow-black/40 rounded-xl p-8 w-full max-w-sm space-y-5">
      <h1 className="text-2xl font-bold text-[#d1fae5]">Logowanie</h1>
      <p className="text-sm text-[#4d7a5f]">Panel zarządzania wspólnotą</p>

      {success && (
        <div className="bg-emerald-950/30 border border-emerald-800 text-emerald-400 text-sm rounded-lg px-4 py-3">
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
          <label className="block text-sm font-medium text-[#a7f3d0] mb-1">Email</label>
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
          <label className="block text-sm font-medium text-[#a7f3d0] mb-1">Hasło</label>
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
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg py-2.5 text-sm transition disabled:opacity-50"
      >
        {loading ? 'Logowanie...' : 'Zaloguj się'}
      </button>

      <div className="flex flex-col items-center gap-2 pt-2">
        <Link href="/reset-password" className="text-sm text-[#4d7a5f] hover:text-[#a7f3d0] hover:underline">
          Zapomniałeś hasła?
        </Link>
        <Link href="/register" className="text-sm text-emerald-500 hover:underline">
          Nie masz konta? Zarejestruj się
        </Link>
      </div>

      <div className="border-t border-[#1e3324] pt-4">
        <p className="text-xs text-[#6b9478] text-center leading-relaxed">
          Administratorem danych osobowych jest zarządca wspólnoty mieszkaniowej.
          Dane przetwarzane są w celu obsługi panelu mieszkańca na podstawie art. 6 ust. 1 lit. b RODO.
          Przysługuje Ci prawo dostępu, sprostowania, usunięcia danych oraz wniesienia skargi do UODO.
          Szczegóły w{' '}
          <Link href="/privacy" className="underline hover:text-[#6b9478]">
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
    <main className="min-h-screen flex items-center justify-center bg-[#0d1410]">
      <Suspense fallback={<div className="bg-[#121c15] shadow-2xl shadow-black/40 rounded-xl p-8 w-full max-w-sm" />}>
        <LoginForm />
      </Suspense>
    </main>
  )
}

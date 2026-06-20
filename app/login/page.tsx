'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import { recordLogin } from './actions'
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
    if (!email.trim() || !password) {
      setError('Podaj email i hasło.')
      return
    }

    setLoading(true)
    setError(null)

    // Zabezpieczenie przed "zawieszeniem się" przycisku, gdy zapytanie do
    // Supabase nie odpowiada (np. chwilowy problem sieciowy) — bez tego
    // przycisk pokazywał "Logowanie..." w nieskończoność, bez żadnego błędu.
    const TIMEOUT_MS = 15000
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
    )

    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await Promise.race([
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        timeout,
      ])

      if (error) {
        setError(error.message || 'Nieprawidłowy email lub hasło.')
        setLoading(false)
        return
      }

      // Sprawdź czy użytkownik ma 2FA aktywne
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aalData?.nextLevel === 'aal2' && aalData?.currentLevel !== 'aal2') {
        // Logowanie nie jest jeszcze kompletne — wpis do audit logu dopiero po weryfikacji 2FA
        window.location.href = '/mfa-verify'
      } else {
        // Audit log "best effort" — nigdy nie blokuje i nie przerywa logowania
        recordLogin().catch(() => {})
        window.location.href = '/admin/dashboard'
      }
    } catch (e: any) {
      setError(
        e?.message === 'timeout'
          ? 'Serwer nie odpowiada. Sprawdź połączenie z internetem i spróbuj ponownie.'
          : 'Wystąpił błąd logowania. Spróbuj ponownie.'
      )
      setLoading(false)
    }
  }

  return (
    <div className="bg-[#081918] shadow-2xl shadow-black/40 rounded-xl p-8 w-full max-w-sm space-y-5">
      <h1 className="text-2xl font-bold text-[#ccfbf1]">Logowanie</h1>
      <p className="text-sm text-[#115e59]">Panel zarządzania wspólnotą</p>

      {success && (
        <div className="bg-teal-950/30 border border-teal-800 text-teal-400 text-sm rounded-lg px-4 py-3">
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
          <label className="block text-sm font-medium text-[#99f6e4] mb-1">Email</label>
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
          <label className="block text-sm font-medium text-[#99f6e4] mb-1">Hasło</label>
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
        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg py-2.5 text-sm transition disabled:opacity-50"
      >
        {loading ? 'Logowanie...' : 'Zaloguj się'}
      </button>

      <div className="flex flex-col items-center gap-2 pt-2">
        <Link href="/reset-password" className="text-sm text-[#115e59] hover:text-[#99f6e4] hover:underline">
          Zapomniałeś hasła?
        </Link>
        <Link href="/register" className="text-sm text-teal-500 hover:underline">
          Nie masz konta? Zarejestruj się
        </Link>
      </div>

      <div className="border-t border-[#0f2d2a] pt-4">
        <p className="text-xs text-[#0f766e] text-center leading-relaxed">
          Administratorem danych osobowych jest zarządca wspólnoty mieszkaniowej.
          Dane przetwarzane są w celu obsługi panelu mieszkańca na podstawie art. 6 ust. 1 lit. b RODO.
          Przysługuje Ci prawo dostępu, sprostowania, usunięcia danych oraz wniesienia skargi do UODO.
          Szczegóły w{' '}
          <Link href="/privacy" className="underline hover:text-[#0f766e]">
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
    <main className="min-h-screen flex items-center justify-center bg-[#051210]">
      <Suspense fallback={<div className="bg-[#081918] shadow-2xl shadow-black/40 rounded-xl p-8 w-full max-w-sm" />}>
        <LoginForm />
      </Suspense>
    </main>
  )
}

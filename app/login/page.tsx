'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import Link from 'next/link'

function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    const reset    = searchParams.get('reset')
    const status   = searchParams.get('status')
    const verified = searchParams.get('verified')
    const errParam = searchParams.get('error')
    if (reset === 'success')       setSuccess('Hasło zostało zmienione. Możesz się teraz zalogować.')
    else if (verified === 'true')  setSuccess('Email potwierdzony! Konto oczekuje teraz na akceptację administratora.')
    else if (status === 'unconfirmed') setSuccess('Potwierdź adres email klikając link w wiadomości którą wysłaliśmy.')
    else if (status === 'pending') setSuccess('Konto oczekuje na akceptację administratora.')
    else if (errParam === 'invalid-link') setError('Link weryfikacyjny jest nieprawidłowy lub wygasł. Zarejestruj się ponownie.')
  }, [searchParams])

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError('Podaj email i hasło.'); return }
    setLoading(true)
    setError(null)

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 15000)
    )

    try {
      const supabase = getSupabaseBrowserClient()
      const { data: authData, error } = await Promise.race([
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        timeout,
      ])
      if (error) { setError(error.message || 'Nieprawidłowy email lub hasło.'); setLoading(false); return }

      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aalData?.nextLevel === 'aal2' && aalData?.currentLevel !== 'aal2') {
        window.location.href = '/mfa-verify'
      } else {
        // Fire-and-forget — nie czekamy na audit log przed przekierowaniem
        fetch('/api/log-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: authData?.session?.access_token }),
          keepalive: true,
        }).catch(() => {})
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
    <div className="min-h-screen flex">

      {/* ── LEFT: Branding panel ───────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[46%] bg-gradient-to-br from-teal-600 via-teal-600 to-teal-800 flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-white/10 rounded-full pointer-events-none" />
        <div className="absolute bottom-24 -left-20 w-56 h-56 bg-white/5  rounded-full pointer-events-none" />
        <div className="absolute top-1/2 right-8 w-20 h-20 bg-white/5  rounded-full pointer-events-none" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center border border-white/30">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h2v11H4zm6 0h2v11h-2zm6 0h2v11h-2z" fill="white" fillOpacity="0.2" stroke="none"/>
              <path d="M3 21h18M3 10h18"/>
              <polyline points="3 7 12 2 21 7"/>
              <rect x="4" y="10" width="2" height="11"/><rect x="11" y="10" width="2" height="11"/><rect x="18" y="10" width="2" height="11"/>
            </svg>
          </div>
          <div>
            <p className="font-extrabold text-white text-lg leading-tight">Unity House</p>
            <p className="text-teal-200 text-xs font-medium tracking-wide">Gostyń</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative space-y-6">
          <div>
            <h1 className="text-4xl font-black text-white leading-[1.1] tracking-tight">
              Twoja wspólnota,<br/>
              zawsze pod ręką.
            </h1>
            <p className="text-teal-100 text-base mt-3 leading-relaxed max-w-xs">
              Rozliczenia, finanse, głosowania i liczniki wody — wszystko w jednym nowoczesnym panelu.
            </p>
          </div>

          <div className="space-y-2.5">
            {[
              { icon: '💰', label: 'Finanse i rozliczenia wspólnoty' },
              { icon: '🗳',  label: 'Elektroniczne głosowania (UoWL)' },
              { icon: '🌊', label: 'Liczniki wody i zawiadomienia' },
              { icon: '📊', label: 'Raporty i eksport do PDF / Excel' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-7 h-7 bg-white/15 rounded-lg flex items-center justify-center text-sm flex-shrink-0">
                  {item.icon}
                </div>
                <span className="text-teal-100 text-sm">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="relative bg-white/10 border border-white/20 rounded-2xl p-5">
          <p className="text-white text-sm leading-relaxed italic">
            &ldquo;Wreszcie widzę wszystkie ogłoszenia zarządu i status mojego zgłoszenia bez dzwonienia do biura. Wszystko w telefonie.&rdquo;
          </p>
          <div className="flex items-center gap-2.5 mt-4">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-base">👩</div>
            <div>
              <p className="text-white text-xs font-semibold">Anna K.</p>
              <p className="text-teal-200 text-xs">Mieszkaniec · Gostyń</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Form ───────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M3 10h18M3 7l9-4 9 4"/>
                <rect x="4" y="10" width="2" height="11"/><rect x="11" y="10" width="2" height="11"/><rect x="18" y="10" width="2" height="11"/>
              </svg>
            </div>
            <span className="font-bold text-gray-900">Unity House Gostyń</span>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Zaloguj się</h2>
              <p className="text-gray-500 text-sm mt-1">Panel zarządzania wspólnotą mieszkaniową</p>
            </div>

            {success && (
              <div className="bg-teal-50 border border-teal-200 text-teal-700 text-sm rounded-xl px-4 py-3 mb-5">
                {success}
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-5">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Adres email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full rounded-xl px-4 py-2.5 text-sm border border-gray-200 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition placeholder:text-gray-400"
                  placeholder="jan@wspolnota.pl"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Hasło</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    className="w-full rounded-xl px-4 py-2.5 pr-11 text-sm border border-gray-200 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition placeholder:text-gray-400"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                    tabIndex={-1}
                  >
                    {showPass
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end mt-2">
              <Link href="/reset-password" className="text-xs text-gray-400 hover:text-teal-600 transition">
                Zapomniałeś hasła?
              </Link>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full mt-5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-semibold rounded-xl py-2.5 text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading
                ? <>
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                    Logowanie…
                  </>
                : 'Zaloguj się →'
              }
            </button>

            <div className="mt-5 pt-5 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Nie masz konta?{' '}
                <Link href="/register" className="text-teal-600 font-semibold hover:underline">
                  Zarejestruj się
                </Link>
              </p>
            </div>
          </div>

          {/* RODO */}
          <p className="text-xs text-gray-400 text-center mt-5 leading-relaxed px-2">
            Administratorem danych osobowych jest zarządca wspólnoty mieszkaniowej.
            Dane przetwarzane są na podstawie art. 6 ust. 1 lit. b RODO.{' '}
            <Link href="/privacy" className="underline hover:text-gray-600">Polityka Prywatności</Link>.
          </p>

        </div>
      </div>

    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <LoginForm />
    </Suspense>
  )
}

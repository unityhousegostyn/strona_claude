'use client'

import { useState, useEffect, useRef } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

export default function MFAVerifyPage() {
  const supabase = getSupabaseBrowserClient()
  const [code, setCode]       = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [ready, setReady]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const init = async () => {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aalData?.currentLevel === 'aal2') { window.location.href = '/admin/dashboard'; return }
      if (!aalData || aalData.currentLevel === null) { window.location.href = '/login'; return }
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totp = factors?.totp?.find(f => f.status === 'verified')
      if (!totp) { window.location.href = '/admin/dashboard'; return }
      setFactorId(totp.id)
      setReady(true)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    init()
  }, [])

  const handleVerify = async () => {
    if (!factorId || code.length !== 6) return
    setLoading(true)
    setError(null)

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 15000)
    )

    try {
      const { data: challenge, error: chalErr } = await Promise.race([
        supabase.auth.mfa.challenge({ factorId }),
        timeout,
      ])
      if (chalErr || !challenge) {
        setError('Błąd weryfikacji. Spróbuj ponownie.')
        setLoading(false)
        return
      }

      const { error: verifyErr } = await Promise.race([
        supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code }),
        timeout,
      ])

      if (verifyErr) {
        setError('Nieprawidłowy kod. Sprawdź aplikację i spróbuj ponownie.')
        setCode('')
        setLoading(false)
        return
      }

      // Pobierz aktualną sesję po weryfikacji MFA (aal2) — access_token do audit logu
      const { data: { session: mfaSession } } = await supabase.auth.getSession()
      const logRes = await fetch('/api/log-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mfaSession?.access_token }),
        keepalive: true,
      }).catch((err) => { console.warn('[log-login] fetch error:', err); return null })
      if (logRes && !logRes.ok) {
        const body = await logRes.json().catch(() => null)
        console.warn('[log-login] failed:', logRes.status, body)
      }
      window.location.href = '/admin/dashboard'
    } catch (e: any) {
      setError(e?.message === 'timeout' ? 'Serwer nie odpowiada. Spróbuj ponownie.' : 'Wystąpił błąd. Spróbuj ponownie.')
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin text-teal-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          <p className="text-sm text-gray-400">Ładowanie…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-gradient-to-br from-teal-700 to-teal-500 rounded-xl flex items-center justify-center shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M3 10h18"/><polyline points="3 7 12 2 21 7"/>
              <rect x="4" y="10" width="2" height="11"/><rect x="11" y="10" width="2" height="11"/><rect x="18" y="10" width="2" height="11"/>
            </svg>
          </div>
          <span className="font-bold text-gray-900">Unity House Gostyń</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 bg-teal-50 border border-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="10" rx="2"/>
                <path d="M8 11V7a4 4 0 018 0v4"/>
                <circle cx="12" cy="16" r="1" fill="#0d9488"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Weryfikacja 2FA</h1>
              <p className="text-sm text-gray-500">Wpisz kod z aplikacji authenticator</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Kod weryfikacyjny (6 cyfr)</label>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              className="w-full rounded-xl px-4 py-3 text-sm border border-gray-200 bg-gray-50 text-gray-900 tracking-[.5em] text-center text-2xl font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition placeholder:text-gray-300 placeholder:tracking-normal placeholder:text-base"
              placeholder="000000"
            />
            {/* Progress dots */}
            <div className="flex justify-center gap-2 mt-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all ${i < code.length ? 'bg-teal-500 scale-110' : 'bg-gray-200'}`} />
              ))}
            </div>
          </div>

          <button
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl py-2.5 text-sm transition disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading
              ? <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Weryfikowanie…</>
              : 'Zweryfikuj →'
            }
          </button>

          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3">
              Otwórz Google Authenticator, Authy lub inną aplikację TOTP i wpisz aktualny 6-cyfrowy kod.
            </p>
            <div className="text-center">
              <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-red-500 transition">
                ← Wyloguj i wróć do logowania
              </button>
            </div>
          </div>

        </div>
      </div>
    </main>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

export default function MFAVerifyPage() {
  const supabase = getSupabaseBrowserClient()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      // Już zweryfikowany — idź dalej
      if (aalData?.currentLevel === 'aal2') {
        window.location.href = '/admin/dashboard'
        return
      }
      // Nie zalogowany w ogóle
      if (!aalData || aalData.currentLevel === null) {
        window.location.href = '/login'
        return
      }
      // Pobierz aktywny faktor
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totp = factors?.totp?.find(f => f.status === 'verified')
      if (!totp) {
        // Brak 2FA — normalny redirect
        window.location.href = '/admin/dashboard'
        return
      }
      setFactorId(totp.id)
      setReady(true)
    }
    init()
  }, [])

  const handleVerify = async () => {
    if (!factorId || code.length !== 6) return
    setLoading(true)
    setError(null)

    try {
      const { data: challenge, error: chalErr } = await supabase.auth.mfa.challenge({ factorId })
      if (chalErr || !challenge) {
        setError('Błąd weryfikacji. Spróbuj ponownie.')
        setLoading(false)
        return
      }

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      })

      if (verifyErr) {
        setError('Nieprawidłowy kod. Sprawdź aplikację i spróbuj ponownie.')
        setCode('')
        setLoading(false)
        return
      }

      window.location.href = '/admin/dashboard'
    } catch {
      setError('Wystąpił błąd. Spróbuj ponownie.')
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#051210]">
        <div className="text-[#115e59] text-sm">Ładowanie...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#051210]">
      <div className="bg-[#081918] shadow-2xl shadow-black/40 rounded-xl p-8 w-full max-w-sm space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-[#ccfbf1]">Weryfikacja 2FA</h1>
          <p className="text-sm text-[#115e59]">Wpisz 6-cyfrowy kod z aplikacji authenticator</p>
        </div>

        {error && (
          <div className="bg-red-950/30 border border-red-900 text-red-400 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <label className="block text-sm font-medium text-[#99f6e4]">Kod weryfikacyjny</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
            className="input w-full tracking-widest text-center text-2xl font-mono py-3"
            placeholder="000000"
          />
        </div>

        <button
          onClick={handleVerify}
          disabled={loading || code.length !== 6}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg py-2.5 text-sm transition disabled:opacity-50"
        >
          {loading ? 'Weryfikacja...' : 'Zweryfikuj'}
        </button>

        <div className="text-center">
          <button
            onClick={handleLogout}
            className="text-sm text-[#115e59] hover:text-[#99f6e4]"
          >
            Wróć do logowania
          </button>
        </div>

        <p className="text-xs text-[#115e59] text-center">
          Otwórz Google Authenticator, Authy lub inną aplikację TOTP i wpisz wyświetlony kod.
        </p>
      </div>
    </main>
  )
}

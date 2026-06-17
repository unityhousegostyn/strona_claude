'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { registerUser, getInvitation, getCommunity } from './actions'
import Link from 'next/link'

type InviteData = {
  email: string
  full_name: string | null
  apartment_number: string | null
  community_id: string
  community_name: string
} | null

type CommunityData = {
  community_id: string
  community_name: string
} | null

function RegisterForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const communityIdParam = searchParams.get('community_id') ?? ''

  const [loading, setLoading] = useState(false)
  const [checkingToken, setCheckingToken] = useState(!!token || !!communityIdParam)
  const [invite, setInvite] = useState<InviteData>(null)
  const [communityData, setCommunityData] = useState<CommunityData>(null)
  const [tokenError, setTokenError] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    if (token) {
      getInvitation(token).then(data => {
        setCheckingToken(false)
        if (!data || 'error' in data) setTokenError(true)
        else setInvite(data)
      })
    } else if (communityIdParam) {
      getCommunity(communityIdParam).then(data => {
        setCheckingToken(false)
        if (!data) setTokenError(true)
        else setCommunityData(data)
      })
    }
  }, [token, communityIdParam])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    const formData = new FormData(e.currentTarget)
    if (token) formData.set('invite_token', token)
    if (communityIdParam) formData.set('community_id_param', communityIdParam)
    const res = await registerUser(formData)

    setLoading(false)
    setResult(res)
  }

  // ── Ładowanie tokenu ──────────────────────────────────────────────────────
  if (checkingToken) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#18110a]">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 text-amber-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="text-sm text-[#a16207]">Weryfikuję zaproszenie…</p>
        </div>
      </main>
    )
  }

  // ── Token wygasły / nieprawidłowy ─────────────────────────────────────────
  if (tokenError) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#18110a] p-4">
        <div className="bg-[#1e1409] border border-[#33200d] rounded-2xl p-8 w-full max-w-sm text-center space-y-4">
          <div className="w-14 h-14 bg-red-950/40 border border-red-900/50 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
            </svg>
          </div>
          <h1 className="text-lg font-bold text-[#fef9ee]">Link wygasł</h1>
          <p className="text-sm text-[#b45309] leading-relaxed">
            Ten link zaproszenia wygasł lub został już użyty. Skontaktuj się z zarządem wspólnoty, aby otrzymać nowe zaproszenie.
          </p>
          <Link href="/login" className="inline-block text-sm text-amber-500 hover:underline">
            ← Wróć do logowania
          </Link>
        </div>
      </main>
    )
  }

  // ── Sukces rejestracji ────────────────────────────────────────────────────
  if (result?.success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#18110a] p-4">
        <div className="bg-[#1e1409] border border-[#33200d] rounded-2xl p-8 w-full max-w-sm text-center space-y-5">
          <div className="w-16 h-16 bg-amber-950/40 border border-amber-700/50 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#fef9ee]">Sprawdź skrzynkę!</h1>
          <p className="text-sm text-[#b45309] leading-relaxed">
            Wysłaliśmy link aktywacyjny na Twój adres email. Kliknij go, aby aktywować konto.
          </p>
          <div className="bg-[#18110a] border border-[#271a0c] rounded-xl px-4 py-3 text-xs text-[#a16207] text-left space-y-1.5">
            <p className="font-semibold text-[#b45309] mb-1">Co dalej?</p>
            {invite ? (
              <>
                <p>1. Kliknij link w emailu (ważny 24h)</p>
                <p>2. Konto zostanie od razu aktywowane 🎉</p>
                <p>3. Zaloguj się i zacznij korzystać z panelu</p>
              </>
            ) : (
              <>
                <p>1. Kliknij link w emailu (ważny 24h)</p>
                <p>2. Poczekaj na akceptację administratora</p>
                <p>3. Zaloguj się i korzystaj z panelu</p>
              </>
            )}
          </div>
          <Link href="/login" className="inline-block text-sm text-amber-500 hover:underline">
            Wróć do logowania
          </Link>
        </div>
      </main>
    )
  }

  // ── Formularz ─────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#18110a] p-4">
      <div className="w-full max-w-sm">

        {/* Baner zaproszenia personalnego */}
        {invite && (
          <div className="bg-amber-950/30 border border-amber-700/40 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
            <span className="text-2xl flex-shrink-0">🏠</span>
            <div>
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Zaproszenie od zarządu</p>
              <p className="text-sm text-[#fef9ee] font-medium">{invite.community_name}</p>
              {invite.apartment_number && (
                <p className="text-xs text-[#b45309]">Lokal {invite.apartment_number}</p>
              )}
            </div>
          </div>
        )}

        {/* Baner rejestracji przez link wspólnoty */}
        {communityData && !invite && (
          <div className="bg-amber-950/30 border border-amber-700/40 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
            <span className="text-2xl flex-shrink-0">🏢</span>
            <div>
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Rejestracja do wspólnoty</p>
              <p className="text-sm text-[#fef9ee] font-medium">{communityData.community_name}</p>
              <p className="text-xs text-[#b45309]">Konto zostanie aktywowane po weryfikacji przez administratora</p>
            </div>
          </div>
        )}

        <div className="bg-[#1e1409] border border-[#33200d] rounded-2xl shadow-2xl shadow-black/40 p-8 space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-[#fef9ee]">
              {invite || communityData ? 'Utwórz konto' : 'Rejestracja'}
            </h1>
            <p className="text-sm text-[#a16207] mt-1">
              {invite ? 'Już prawie gotowe — ustaw hasło do konta' : 'Utwórz konto w panelu wspólnoty'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#fde68a] mb-1.5 uppercase tracking-wide">Email</label>
              <input
                name="email"
                type="email"
                defaultValue={invite?.email ?? ''}
                placeholder="jan@wspolnota.pl"
                className="input w-full"
                required
              />
              {invite?.email && (
                <p className="text-xs text-[#3d2008] mt-1">Zaproszenie zostało wysłane na <span className="text-[#b45309]">{invite.email}</span> — możesz wpisać inny adres.</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#fde68a] mb-1.5 uppercase tracking-wide">Hasło</label>
              <input
                name="password"
                type="password"
                placeholder="minimum 8 znaków"
                className="input w-full"
                minLength={8}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#fde68a] mb-1.5 uppercase tracking-wide">Imię i nazwisko</label>
              <input
                name="full_name"
                type="text"
                defaultValue={invite?.full_name ?? ''}
                placeholder="Jan Kowalski"
                className="input w-full"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-600 text-white font-semibold rounded-lg py-2.5 text-sm transition disabled:opacity-50 mt-2"
            >
              {loading ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Rejestruję…</>
              ) : (
                (invite || communityData) ? 'Utwórz konto i dołącz do wspólnoty' : 'Zarejestruj się'
              )}
            </button>
          </form>

          {result && !result.success && (
            <p className="text-center text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
              {result.message}
            </p>
          )}

          <div className="text-center pt-1">
            <Link href="/login" className="text-sm text-amber-500 hover:underline">
              Masz już konto? Zaloguj się
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-[#18110a]">
        <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"/>
      </main>
    }>
      <RegisterForm />
    </Suspense>
  )
}

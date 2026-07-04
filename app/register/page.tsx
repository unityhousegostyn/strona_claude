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

/* ── Shared helpers ───────────────────────────────────────────────── */

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center border border-white/30">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M3 10h18"/><polyline points="3 7 12 2 21 7"/>
          <rect x="4" y="10" width="2" height="11"/><rect x="11" y="10" width="2" height="11"/><rect x="18" y="10" width="2" height="11"/>
        </svg>
      </div>
      <div>
        <p className="font-extrabold text-white text-lg leading-tight">Unity House</p>
        <p className="text-teal-200 text-xs font-medium tracking-wide">Gostyń</p>
      </div>
    </div>
  )
}

function MobileLogo() {
  return (
    <div className="lg:hidden flex items-center gap-2 mb-8">
      <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M3 10h18"/><polyline points="3 7 12 2 21 7"/>
          <rect x="4" y="10" width="2" height="11"/><rect x="11" y="10" width="2" height="11"/><rect x="18" y="10" width="2" height="11"/>
        </svg>
      </div>
      <span className="font-bold text-gray-900">Unity House Gostyń</span>
    </div>
  )
}

/* Single-column centered fallback (error/success states) */
function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-gradient-to-br from-teal-700 to-teal-500 rounded-xl flex items-center justify-center shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M3 10h18"/><polyline points="3 7 12 2 21 7"/>
              <rect x="4" y="10" width="2" height="11"/><rect x="11" y="10" width="2" height="11"/><rect x="18" y="10" width="2" height="11"/>
            </svg>
          </div>
          <span className="font-bold text-gray-900">Unity House Gostyń</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">{children}</div>
      </div>
    </main>
  )
}

/* ── Main form ────────────────────────────────────────────────────── */
function RegisterForm() {
  const searchParams   = useSearchParams()
  const token          = searchParams.get('token') ?? ''
  const communityIdParam = searchParams.get('community_id') ?? ''

  const [loading,      setLoading]      = useState(false)
  const [checkingToken, setCheckingToken] = useState(!!token || !!communityIdParam)
  const [invite,       setInvite]       = useState<InviteData>(null)
  const [communityData, setCommunityData] = useState<CommunityData>(null)
  const [tokenError,   setTokenError]   = useState(false)
  const [result,       setResult]       = useState<{ success: boolean; message: string } | null>(null)
  const [showPass,     setShowPass]     = useState(false)

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

  /* ── Checking token ── */
  if (checkingToken) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin text-teal-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          <p className="text-sm text-gray-400">Weryfikuję zaproszenie…</p>
        </div>
      </main>
    )
  }

  /* ── Token invalid ── */
  if (tokenError) {
    return (
      <CenteredCard>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mx-auto">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Link wygasł</h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              Ten link zaproszenia wygasł lub został już użyty. Skontaktuj się z zarządem wspólnoty, aby otrzymać nowe zaproszenie.
            </p>
          </div>
          <Link href="/login" className="inline-block text-sm font-semibold text-teal-600 hover:underline">
            ← Wróć do logowania
          </Link>
        </div>
      </CenteredCard>
    )
  }

  /* ── Success ── */
  if (result?.success) {
    return (
      <CenteredCard>
        <div className="text-center space-y-5">
          <div className="w-16 h-16 bg-teal-50 border border-teal-200 rounded-full flex items-center justify-center mx-auto">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8"/>
              <path d="M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Sprawdź skrzynkę!</h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              Wysłaliśmy link aktywacyjny na Twój adres email. Kliknij go, aby aktywować konto.
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-600 text-left space-y-1.5">
            <p className="font-semibold text-gray-700 mb-1">Co dalej?</p>
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
          <Link href="/login" className="inline-block text-sm font-semibold text-teal-600 hover:underline">
            Wróć do logowania
          </Link>
        </div>
      </CenteredCard>
    )
  }

  /* ── Main form — split-screen ── */
  return (
    <div className="min-h-screen flex">

      {/* LEFT: Branding */}
      <div className="hidden lg:flex lg:w-[46%] bg-gradient-to-br from-teal-600 via-teal-600 to-teal-800 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-white/10 rounded-full pointer-events-none" />
        <div className="absolute bottom-24 -left-20 w-56 h-56 bg-white/5 rounded-full pointer-events-none" />

        <Logo />

        <div className="relative space-y-6">
          <div>
            <h1 className="text-4xl font-black text-white leading-[1.1] tracking-tight">
              Dołącz do<br/>
              swojej wspólnoty.
            </h1>
            <p className="text-teal-100 text-base mt-3 leading-relaxed max-w-xs">
              Załóż konto i zyskaj dostęp do rozliczeń, ogłoszeń, głosowań i liczników wody.
            </p>
          </div>

          <div className="space-y-2.5">
            {[
              { icon: '📋', label: 'Swoje rozliczenia i saldo' },
              { icon: '📢', label: 'Ogłoszenia zarządu' },
              { icon: '🗳',  label: 'Głosowania nad uchwałami' },
              { icon: '🌊', label: 'Zgłaszanie odczytów liczników' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-7 h-7 bg-white/15 rounded-lg flex items-center justify-center text-sm flex-shrink-0">{item.icon}</div>
                <span className="text-teal-100 text-sm">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative bg-white/10 border border-white/20 rounded-2xl p-5">
          <p className="text-teal-100 text-xs">Rejestracja jest bezpłatna i zajmuje mniej niż minutę. Twoje konto zostanie aktywowane przez administratora wspólnoty.</p>
        </div>
      </div>

      {/* RIGHT: Form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md">
          <MobileLogo />

          {/* Invite banner */}
          {invite && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
              <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0">🏠</div>
              <div>
                <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Zaproszenie od zarządu</p>
                <p className="text-sm font-semibold text-teal-900">{invite.community_name}</p>
                {invite.apartment_number && (
                  <p className="text-xs text-teal-600">Lokal {invite.apartment_number}</p>
                )}
              </div>
            </div>
          )}

          {communityData && !invite && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
              <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0">🏢</div>
              <div>
                <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Rejestracja do wspólnoty</p>
                <p className="text-sm font-semibold text-teal-900">{communityData.community_name}</p>
                <p className="text-xs text-teal-600">Konto aktywuje administrator</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {invite || communityData ? 'Utwórz konto' : 'Rejestracja'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {invite ? 'Już prawie gotowe — ustaw hasło do konta' : 'Utwórz konto w panelu wspólnoty'}
              </p>
            </div>

            {result && !result.success && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-5">
                {result.message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Adres email</label>
                <input
                  name="email"
                  type="email"
                  defaultValue={invite?.email ?? ''}
                  placeholder="jan@wspolnota.pl"
                  className="w-full rounded-xl px-4 py-2.5 text-sm border border-gray-200 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition placeholder:text-gray-400"
                  autoComplete="email"
                  required
                />
                {invite?.email && (
                  <p className="text-xs text-gray-400 mt-1">
                    Zaproszenie wysłano na <span className="text-gray-600 font-medium">{invite.email}</span> — możesz wpisać inny adres.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Hasło</label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="minimum 8 znaków"
                    className="w-full rounded-xl px-4 py-2.5 pr-10 text-sm border border-gray-200 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition placeholder:text-gray-400"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Imię i nazwisko</label>
                <input
                  name="full_name"
                  type="text"
                  defaultValue={invite?.full_name ?? ''}
                  placeholder="Jan Kowalski"
                  className="w-full rounded-xl px-4 py-2.5 text-sm border border-gray-200 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition placeholder:text-gray-400"
                  autoComplete="name"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl py-2.5 text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading
                  ? <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Rejestruję…</>
                  : (invite || communityData) ? 'Utwórz konto i dołącz →' : 'Zarejestruj się →'
                }
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Masz już konto?{' '}
                <Link href="/login" className="text-teal-600 font-semibold hover:underline">Zaloguj się</Link>
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center mt-5 leading-relaxed px-2">
            Administratorem danych jest zarządca wspólnoty. Dane przetwarzane na podstawie art. 6 ust. 1 lit. b RODO.{' '}
            <Link href="/privacy" className="underline hover:text-gray-600">Polityka Prywatności</Link>.
          </p>
        </div>
      </div>

    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <svg className="animate-spin text-teal-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
      </main>
    }>
      <RegisterForm />
    </Suspense>
  )
}

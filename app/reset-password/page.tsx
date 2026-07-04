'use client'

import { useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]     = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!email.trim()) { setError('Podaj adres email.'); return }
    setLoading(true)
    setError(null)

    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password/confirm`,
    })

    setLoading(false)
    if (error) setError('Błąd: ' + error.message)
    else setSent(true)
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

          {sent ? (
            <div className="text-center space-y-5">
              <div className="w-14 h-14 bg-teal-50 border border-teal-200 rounded-full flex items-center justify-center mx-auto">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 10.5 19.79 19.79 0 01.88 1.87 2 2 0 012.86 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0121 14.92z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 mb-1">Sprawdź skrzynkę</h1>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Wysłaliśmy link resetujący na <span className="font-semibold text-gray-700">{email}</span>. Kliknij go, aby ustawić nowe hasło.
                </p>
              </div>
              <p className="text-xs text-gray-400">Nie widzisz emaila? Sprawdź folder Spam.</p>
              <Link href="/login" className="inline-block text-sm font-semibold text-teal-600 hover:underline">
                ← Wróć do logowania
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Reset hasła</h1>
                <p className="text-sm text-gray-500 mt-1">Wyślemy Ci link do ustawienia nowego hasła.</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-5">
                  {error}
                </div>
              )}

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Adres email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  className="w-full rounded-xl px-4 py-2.5 text-sm border border-gray-200 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition placeholder:text-gray-400"
                  placeholder="jan@wspolnota.pl"
                  autoComplete="email"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl py-2.5 text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading
                  ? <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Wysyłanie…</>
                  : 'Wyślij link resetujący →'
                }
              </button>

              <div className="mt-5 pt-5 border-t border-gray-100 text-center">
                <Link href="/login" className="text-sm text-gray-400 hover:text-teal-600 transition">
                  ← Wróć do logowania
                </Link>
              </div>
            </>
          )}

        </div>
      </div>
    </main>
  )
}

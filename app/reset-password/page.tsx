'use client'

import { useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!email.trim()) return setError('Podaj adres email.')
    setLoading(true)
    setError(null)

    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password/confirm`,
    })

    setLoading(false)
    if (error) {
      setError('Błąd: ' + error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 shadow-2xl shadow-black/40 rounded-xl p-8 w-full max-w-sm space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-200">Reset hasła</h1>
          <p className="text-sm text-gray-500 mt-1">Wyślemy Ci link do ustawienia nowego hasła.</p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="bg-green-950/30 border border-green-900 text-green-400 text-sm rounded-lg px-4 py-3">
              Link resetujący został wysłany na <strong>{email}</strong>. Sprawdź swoją skrzynkę.
            </div>
            <Link href="/login" className="block text-center text-sm text-blue-600 hover:underline">
              Wróć do logowania
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-950/30 border border-red-900 text-red-400 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="input w-full"
                placeholder="jan@wspolnota.pl"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-2.5 text-sm transition disabled:opacity-50"
            >
              {loading ? 'Wysyłanie...' : 'Wyślij link resetujący'}
            </button>
            <div className="text-center">
              <Link href="/login" className="text-sm text-gray-500 hover:underline">
                Wróć do logowania
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

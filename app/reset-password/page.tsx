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
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white shadow-md rounded-xl p-8 w-full max-w-sm space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reset hasła</h1>
          <p className="text-sm text-gray-500 mt-1">Wyślemy Ci link do ustawienia nowego hasła.</p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
              Link resetujący został wysłany na <strong>{email}</strong>. Sprawdź swoją skrzynkę.
            </div>
            <Link href="/login" className="block text-center text-sm text-blue-600 hover:underline">
              Wróć do logowania
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

'use client'

import { useState } from 'react'
import { registerUser } from './actions'
import Link from 'next/link'

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    const formData = new FormData(e.currentTarget)
    const res = await registerUser(formData)

    setLoading(false)
    setResult(res)
  }

  if (result?.success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white shadow-md rounded-xl p-8 w-full max-w-sm space-y-5 text-center">
          <div className="text-5xl">📧</div>
          <h1 className="text-xl font-bold text-gray-800">Sprawdź swoją skrzynkę</h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            Wysłaliśmy email z linkiem potwierdzającym. Kliknij go, żeby aktywować konto.
          </p>
          <p className="text-xs text-gray-400">
            Po potwierdzeniu adresu Twoje konto trafi do kolejki — administrator wspólnoty zatwierdzi je wkrótce.
          </p>
          <Link
            href="/login"
            className="inline-block mt-2 text-sm text-blue-600 hover:underline"
          >
            Wróć do logowania
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white shadow-md rounded-xl p-8 w-full max-w-sm space-y-5">
        <h1 className="text-2xl font-bold text-gray-800">Rejestracja</h1>
        <p className="text-sm text-gray-500">Utwórz konto w panelu wspólnoty</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              name="email"
              type="email"
              placeholder="jan@wspolnota.pl"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasło</label>
            <input
              name="password"
              type="password"
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Imię i nazwisko</label>
            <input
              name="full_name"
              type="text"
              placeholder="Jan Kowalski"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-2.5 text-sm transition disabled:opacity-50"
          >
            {loading ? 'Rejestruję...' : 'Zarejestruj się'}
          </button>
        </form>

        {result && !result.success && (
          <p className="text-center text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {result.message}
          </p>
        )}

        <div className="text-center pt-2">
          <Link href="/login" className="text-sm text-blue-600 hover:underline">
            Masz już konto? Zaloguj się
          </Link>
        </div>
      </div>
    </main>
  )
}

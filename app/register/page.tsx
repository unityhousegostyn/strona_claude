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
      <main className="min-h-screen flex items-center justify-center bg-[#18140e]">
        <div className="bg-[#241e14] shadow-2xl shadow-black/40 rounded-xl p-8 w-full max-w-sm space-y-5 text-center">
          <div className="text-5xl">📧</div>
          <h1 className="text-xl font-bold text-[#ddd5c5]">Sprawdź skrzynkę!</h1>
          <p className="text-sm text-[#7a6a58] leading-relaxed">
            Wysłaliśmy link aktywacyjny na Twój adres email. Kliknij go, aby potwierdzić rejestrację.
          </p>
          <div className="bg-[#2a2218] rounded-lg px-4 py-3 text-xs text-[#7a6a58] text-left space-y-1.5">
            <p className="font-medium text-[#b8a898] mb-1">Co dalej?</p>
            <p>1. Kliknij link w emailu (ważny 24h)</p>
            <p>2. Poczekaj na akceptację administratora</p>
            <p>3. Zaloguj się i korzystaj z panelu</p>
          </div>
          <Link
            href="/login"
            className="inline-block mt-2 text-sm text-amber-500 hover:underline"
          >
            Wróć do logowania
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#18140e]">
      <div className="bg-[#241e14] shadow-2xl shadow-black/40 rounded-xl p-8 w-full max-w-sm space-y-5">
        <h1 className="text-2xl font-bold text-[#ddd5c5]">Rejestracja</h1>
        <p className="text-sm text-[#6a5a48]">Utwórz konto w panelu wspólnoty</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-[#b8a898] mb-1">Email</label>
            <input
              name="email"
              type="email"
              placeholder="jan@wspolnota.pl"
              className="input w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#b8a898] mb-1">Hasło</label>
            <input
              name="password"
              type="password"
              placeholder="••••••••"
              className="input w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#b8a898] mb-1">Imię i nazwisko</label>
            <input
              name="full_name"
              type="text"
              placeholder="Jan Kowalski"
              className="input w-full"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg py-2.5 text-sm transition disabled:opacity-50"
          >
            {loading ? 'Rejestruję...' : 'Zarejestruj się'}
          </button>
        </form>

        {result && !result.success && (
          <p className="text-center text-sm text-red-400 bg-red-950/30 rounded-lg px-3 py-2">
            {result.message}
          </p>
        )}

        <div className="text-center pt-2">
          <Link href="/login" className="text-sm text-amber-500 hover:underline">
            Masz już konto? Zaloguj się
          </Link>
        </div>
      </div>
    </main>
  )
}

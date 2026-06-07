'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCommunity } from '../actions'

export default function AddCommunityPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!name || !address) {
      setError('Wypełnij wszystkie pola.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      await createCommunity({ name, address })
      router.push('/admin/communities')
    } catch (e: any) {
      setError(e.message ?? 'Błąd podczas dodawania wspólnoty.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-2xl font-bold text-gray-100">Dodaj wspólnotę</h2>

      {error && (
        <div className="bg-red-950/30 border border-red-900 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Nazwa wspólnoty</label>
          <input
            className="input"
            placeholder="np. Wspólnota Różana 12"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Adres</label>
          <input
            className="input"
            placeholder="np. ul. Różana 12, Warszawa"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50"
        >
          {loading ? 'Zapisywanie...' : 'Zapisz wspólnotę'}
        </button>
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-400 hover:text-gray-100 px-5 py-2.5 rounded-lg border border-gray-800 hover:bg-gray-950 transition"
        >
          Anuluj
        </button>
      </div>
    </div>
  )
}

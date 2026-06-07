'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

export default function EditCommunityPage() {
  const router = useRouter()
  const { id } = useParams()
  const supabase = getSupabaseBrowserClient()

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('communities')
        .select('*')
        .eq('id', id)
        .single()
      if (data) {
        setName(data.name)
        setAddress(data.address)
      }
    }
    load()
  }, [id])

  const handleUpdate = async () => {
    if (!name || !address) {
      setError('Wypełnij wszystkie pola.')
      return
    }
    setLoading(true)
    setError(null)

    const { error } = await supabase
      .from('communities')
      .update({ name, address })
      .eq('id', id)

    if (error) {
      setError('Błąd podczas zapisywania.')
      setLoading(false)
      return
    }

    router.push('/admin/communities')
  }

  const handleDelete = async () => {
    if (!confirm('Czy na pewno chcesz usunąć tę wspólnotę? Tej operacji nie można cofnąć.')) return
    setDeleting(true)

    const { error } = await supabase
      .from('communities')
      .delete()
      .eq('id', id)

    if (error) {
      setError('Błąd podczas usuwania. Upewnij się że wspólnota nie ma przypisanych użytkowników.')
      setDeleting(false)
      return
    }

    router.push('/admin/communities')
  }

  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Edytuj wspólnotę</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa wspólnoty</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Adres</label>
          <input
            className="input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={handleUpdate}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Zapisywanie...' : 'Zapisz zmiany'}
          </button>
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-600 hover:text-gray-900 px-5 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
          >
            Anuluj
          </button>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-sm text-red-600 hover:text-red-700 font-medium px-5 py-2.5 rounded-lg border border-red-200 hover:bg-red-50 transition disabled:opacity-50"
        >
          {deleting ? 'Usuwanie...' : 'Usuń wspólnotę'}
        </button>
      </div>
    </div>
  )
}
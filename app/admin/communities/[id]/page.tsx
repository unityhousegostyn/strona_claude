'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import { updateCommunity, deleteCommunity } from '../actions'

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

    try {
      await updateCommunity(id as string, { name, address })
      router.push('/admin/communities')
    } catch (e: any) {
      setError(e.message ?? 'Błąd podczas zapisywania.')
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Czy na pewno chcesz usunąć tę wspólnotę? Tej operacji nie można cofnąć.')) return
    setDeleting(true)

    try {
      await deleteCommunity(id as string)
      router.push('/admin/communities')
    } catch (e: any) {
      setError(e.message ?? 'Błąd podczas usuwania.')
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-2xl font-bold text-stone-900">Edytuj wspólnotę</h2>

      {error && (
        <div className="bg-red-950/30 border border-red-900 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-stone-100 border border-stone-200 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Nazwa wspólnoty</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Adres</label>
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
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Zapisywanie...' : 'Zapisz zmiany'}
          </button>
          <button
            onClick={() => router.back()}
            className="text-sm text-stone-500 hover:text-stone-900 px-5 py-2.5 rounded-lg border border-stone-200 hover:bg-stone-50 transition"
          >
            Anuluj
          </button>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-sm text-red-400 hover:text-red-400 font-medium px-5 py-2.5 rounded-lg border border-red-900 hover:bg-red-950/30 transition disabled:opacity-50"
        >
          {deleting ? 'Usuwanie...' : 'Usuń wspólnotę'}
        </button>
      </div>
    </div>
  )
}

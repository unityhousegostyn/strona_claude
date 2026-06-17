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
  const [waterMeterEnabled, setWaterMeterEnabled] = useState(false)
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
        setWaterMeterEnabled(data.water_meter_enabled ?? false)
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
      await updateCommunity(id as string, { name, address, water_meter_enabled: waterMeterEnabled })
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
      <h2 className="text-2xl font-bold text-[#f0fdfa]">Edytuj wspólnotę</h2>

      {error && (
        <div className="bg-red-950/30 border border-red-900 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#99f6e4] mb-1">Nazwa wspólnoty</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#99f6e4] mb-1">Adres</label>
          <input
            className="input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-[#99f6e4]">Moduł liczników wody</p>
            <p className="text-xs text-[#115e59] mt-0.5">Mieszkańcy tej wspólnoty mogą zgłaszać odczyty wodomierzy</p>
          </div>
          <button
            type="button"
            onClick={() => setWaterMeterEnabled(v => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${waterMeterEnabled ? 'bg-blue-600' : 'bg-[#0f2d2a]'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${waterMeterEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={handleUpdate}
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Zapisywanie...' : 'Zapisz zmiany'}
          </button>
          <button
            onClick={() => router.back()}
            className="text-sm text-[#0f766e] hover:text-[#f0fdfa] px-5 py-2.5 rounded-lg border border-[#0f2d2a] hover:bg-[#051210] transition"
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

'use client'
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

export default function AddAnnouncementPage() {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()

  const [profile, setProfile] = useState<any>(null)
  const [communities, setCommunities] = useState<any[]>([])
  const [communityId, setCommunityId] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      if (p?.role === 'super_admin') {
        const { data: c } = await supabase.from('communities').select('*')
        setCommunities(c ?? [])
      } else {
        setCommunityId(p?.community_id)
      }
    }
    load()
  }, [])

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('announcements').insert({
      title,
      content,
      start_date: startDate,
      end_date: endDate,
      community_id: communityId,
      created_by: user?.id,
    })
    if (error) {
      setError('Błąd podczas dodawania ogłoszenia.')
      setLoading(false)
      return
    }
    router.push('/admin/announcements')
  }

  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dodaj ogłoszenie</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        {profile?.role === 'super_admin' && (
          <Field label="Wspólnota">
            <select
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
              className="input"
            >
              <option value="">Wybierz wspólnotę</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Tytuł">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Treść">
          <textarea className="input min-h-[100px]" value={content} onChange={(e) => setContent(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Data rozpoczęcia">
            <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Data zakończenia">
            <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50"
        >
          {loading ? 'Zapisywanie...' : 'Zapisz ogłoszenie'}
        </button>
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-600 hover:text-gray-900 px-5 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
        >
          Anuluj
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
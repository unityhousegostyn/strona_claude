'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import { createAnnouncement } from '../actions'

type Target = 'all' | 'one' | 'selected'

export default function AddAnnouncementPage() {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()

  const [profile, setProfile] = useState<any>(null)
  const [communities, setCommunities] = useState<any[]>([])
  const [target, setTarget] = useState<Target>('one')
  const [communityId, setCommunityId] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      if (p?.role === 'super_admin') {
        const { data: c } = await supabase.from('communities').select('*').order('name')
        setCommunities(c ?? [])
      } else {
        // admin widzi tylko swoją wspólnotę
        setCommunityId(p?.community_id)
        setTarget('one')
      }
    }
    load()
  }, [])

  const toggleCommunity = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSubmit = () => {
    setError(null)
    if (!title.trim()) return setError('Podaj tytuł ogłoszenia.')
    if (target === 'one' && !communityId) return setError('Wybierz wspólnotę.')
    if (target === 'selected' && selectedIds.length === 0) return setError('Wybierz co najmniej jedną wspólnotę.')

    startTransition(async () => {
      try {
        await createAnnouncement({
          title,
          content,
          start_date: startDate,
          end_date: endDate,
          target,
          community_id: target === 'one' ? communityId : null,
          community_ids: target === 'selected' ? selectedIds : [],
        })
        router.push('/admin/announcements')
      } catch (e: any) {
        setError(e.message ?? 'Błąd podczas zapisywania.')
      }
    })
  }

  const isSuperAdmin = profile?.role === 'super_admin'

  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dodaj ogłoszenie</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">

        {/* Wybór zasięgu — tylko super_admin */}
        {isSuperAdmin && (
          <Field label="Zasięg ogłoszenia">
            <div className="flex gap-2 flex-wrap">
              {([
                { value: 'all', label: '🌐 Wszystkie wspólnoty' },
                { value: 'selected', label: '☑️ Wybrane wspólnoty' },
                { value: 'one', label: '🏢 Jedna wspólnota' },
              ] as { value: Target; label: string }[]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTarget(opt.value)}
                  className={`text-sm px-3 py-1.5 rounded-lg border font-medium transition ${
                    target === opt.value
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
        )}

        {/* Jedna wspólnota — dropdown */}
        {isSuperAdmin && target === 'one' && (
          <Field label="Wspólnota">
            <select
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Wybierz wspólnotę…</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        )}

        {/* Wybrane wspólnoty — checkboxy */}
        {isSuperAdmin && target === 'selected' && (
          <Field label="Wybierz wspólnoty">
            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {communities.map((c) => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:text-gray-900">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleCommunity(c.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </Field>
        )}

        <Field label="Tytuł">
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tytuł ogłoszenia"
          />
        </Field>

        <Field label="Treść">
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Treść ogłoszenia…"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Data rozpoczęcia">
            <input
              type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="Data zakończenia">
            <input
              type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50"
        >
          {isPending ? 'Zapisywanie…' : 'Zapisz ogłoszenie'}
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

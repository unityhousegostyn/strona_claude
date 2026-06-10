'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createAnnouncement } from '../actions'

type Target = 'all' | 'one' | 'selected'

interface Community { id: string; name: string }

interface Props {
  isSuperAdmin: boolean
  adminCommunityId: string | null
  communities: Community[]
}

export default function AnnouncementForm({ isSuperAdmin, adminCommunityId, communities }: Props) {
  const router = useRouter()
  const [target, setTarget] = useState<Target>('one')
  const [communityId, setCommunityId] = useState(adminCommunityId ?? '')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const toggleCommunity = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const handleSubmit = () => {
    setError(null)
    if (!title.trim()) return setError('Podaj tytuł ogłoszenia.')
    if (target === 'one' && !communityId) return setError('Wybierz wspólnotę.')
    if (target === 'selected' && selectedIds.length === 0) return setError('Wybierz co najmniej jedną wspólnotę.')

    startTransition(async () => {
      const result = await createAnnouncement({
        title,
        content,
        start_date: startDate,
        end_date: endDate,
        target,
        community_id: target === 'one' ? communityId : null,
        community_ids: target === 'selected' ? selectedIds : [],
      })
      if (result?.error) {
        setError(result.error)
      } else {
        router.push('/admin/announcements')
      }
    })
  }

  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-2xl font-bold text-stone-900">Dodaj ogłoszenie</h2>

      {error && (
        <div className="bg-red-950/30 border border-red-900 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <div className="bg-stone-100 border border-stone-200 rounded-xl p-6 space-y-4">

        {/* Zasięg — tylko super_admin */}
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
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'border-stone-200 text-stone-500 hover:bg-stone-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
        )}

        {/* Jedna wspólnota — dropdown (super_admin) */}
        {isSuperAdmin && target === 'one' && (
          <Field label="Wspólnota">
            <select
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
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
            <div className="space-y-2 max-h-48 overflow-y-auto border border-stone-200 rounded-lg p-3">
              {communities.map((c) => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleCommunity(c.id)}
                    className="rounded border-stone-200 text-green-600"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </Field>
        )}

        <Field label="Tytuł">
          <input
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tytuł ogłoszenia"
          />
        </Field>

        <Field label="Treść">
          <textarea
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 min-h-[100px]"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Treść ogłoszenia…"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Data rozpoczęcia">
            <input type="date" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Data zakończenia">
            <input type="date" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50"
        >
          {isPending ? 'Zapisywanie…' : 'Zapisz ogłoszenie'}
        </button>
        <button
          onClick={() => router.back()}
          className="text-sm text-stone-500 hover:text-stone-900 px-5 py-2.5 rounded-lg border border-stone-200 hover:bg-stone-50 transition"
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
      <label className="block text-sm font-medium text-stone-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

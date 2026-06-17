'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateAnnouncement } from '../../actions'

type Target = 'all' | 'one' | 'selected'

interface Community { id: string; name: string }

interface Announcement {
  id: string
  title: string
  content: string
  target: Target
  community_id: string | null
  start_date: string | null
  end_date: string | null
  pinned: boolean
}

interface Props {
  announcement: Announcement
  selectedCommunityIds: string[]
  isSuperAdmin: boolean
  adminCommunityId: string | null
  communities: Community[]
}

export default function EditAnnouncementForm({
  announcement,
  selectedCommunityIds,
  isSuperAdmin,
  adminCommunityId,
  communities,
}: Props) {
  const router = useRouter()
  const [target, setTarget] = useState<Target>(announcement.target)
  const [communityId, setCommunityId] = useState(announcement.community_id ?? adminCommunityId ?? '')
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedCommunityIds)
  const [title, setTitle] = useState(announcement.title)
  const [content, setContent] = useState(announcement.content)
  const [startDate, setStartDate] = useState(announcement.start_date?.split('T')[0] ?? '')
  const [endDate, setEndDate] = useState(announcement.end_date?.split('T')[0] ?? '')
  const [pinned, setPinned] = useState(announcement.pinned)
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
      const result = await updateAnnouncement(announcement.id, {
        title,
        content,
        start_date: startDate,
        end_date: endDate,
        target,
        community_id: target === 'one' ? communityId : null,
        community_ids: target === 'selected' ? selectedIds : [],
        pinned,
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
      <h2 className="text-2xl font-bold text-[#fef9ee]">Edytuj ogłoszenie</h2>

      {error && (
        <div className="bg-red-950/30 border border-red-900 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <div className="bg-[#1e1409] border border-[#33200d] rounded-xl p-6 space-y-4">

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
                      ? 'bg-amber-600 border-green-600 text-white'
                      : 'border-[#33200d] text-[#b45309] hover:bg-[#18110a]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
        )}

        {isSuperAdmin && target === 'one' && (
          <Field label="Wspólnota">
            <select
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
              className="w-full border border-[#33200d] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">Wybierz wspólnotę…</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        )}

        {isSuperAdmin && target === 'selected' && (
          <Field label="Wybierz wspólnoty">
            <div className="space-y-2 max-h-48 overflow-y-auto border border-[#33200d] rounded-lg p-3">
              {communities.map((c) => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm text-[#fde68a]">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleCommunity(c.id)}
                    className="rounded border-[#33200d] text-amber-500"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </Field>
        )}

        <Field label="Tytuł">
          <input
            className="w-full border border-[#33200d] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tytuł ogłoszenia"
          />
        </Field>

        <Field label="Treść">
          <textarea
            className="w-full border border-[#33200d] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[120px]"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Treść ogłoszenia…"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Data rozpoczęcia">
            <input type="date" className="w-full border border-[#33200d] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Data zakończenia">
            <input type="date" className="w-full border border-[#33200d] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
      </div>

      <Field label="">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <div
            onClick={() => setPinned(v => !v)}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
              pinned ? 'bg-amber-600 border-amber-600' : 'border-[#33200d] hover:border-amber-700'
            }`}
          >
            {pinned && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
              </svg>
            )}
          </div>
          <div>
            <span className="text-sm font-medium text-[#fde68a]">Przypnij ogłoszenie na górze</span>
            <p className="text-xs text-[#3d2008]">Przypięte ogłoszenia wyświetlają się zawsze jako pierwsze</p>
          </div>
        </label>
      </Field>

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50"
        >
          {isPending ? 'Zapisywanie…' : 'Zapisz zmiany'}
        </button>
        <button
          onClick={() => router.back()}
          className="text-sm text-[#b45309] hover:text-[#fef9ee] px-5 py-2.5 rounded-lg border border-[#33200d] hover:bg-[#18110a] transition"
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
      <label className="block text-sm font-medium text-[#fde68a] mb-1">{label}</label>
      {children}
    </div>
  )
}

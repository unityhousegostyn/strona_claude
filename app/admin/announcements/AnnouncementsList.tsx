'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Announcement {
  id: string
  title: string
  content: string
  target: string
  community_id: string | null
  start_date: string | null
  end_date: string | null
  created_at: string
}

interface Props {
  announcements: Announcement[]
  communityMap: Record<string, string>
  junctionMap: Record<string, string[]>
  canEdit: boolean
}

const PAGE_SIZE = 20

export default function AnnouncementsList({ announcements, communityMap, junctionMap, canEdit }: Props) {
  const [tab, setTab] = useState<'active' | 'archive'>('active')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const now = new Date()

  const isActive = (a: Announcement) => {
    if (a.end_date && new Date(a.end_date) < now) return false
    if (a.start_date && new Date(a.start_date) > now) return false
    return true
  }

  const filtered = announcements
    .filter((a) => (tab === 'active' ? isActive(a) : !isActive(a)))
    .filter((a) => a.title.toLowerCase().includes(search.toLowerCase()) ||
                   a.content.toLowerCase().includes(search.toLowerCase()))

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleTabChange = (t: 'active' | 'archive') => {
    setTab(t)
    setPage(1)
  }

  const handleSearch = (v: string) => {
    setSearch(v)
    setPage(1)
  }

  const targetLabel = (a: Announcement) => {
    if (a.target === 'all') return { text: 'Wszystkie wspólnoty', cls: 'bg-blue-50 text-blue-700' }
    if (a.target === 'one') return { text: communityMap[a.community_id!] ?? '—', cls: 'bg-gray-100 text-gray-600' }
    const names = (junctionMap[a.id] ?? []).map((cid) => communityMap[cid] ?? cid)
    return { text: names.join(', ') || '—', cls: 'bg-purple-50 text-purple-700' }
  }

  const activeCount = announcements.filter(isActive).length
  const archiveCount = announcements.length - activeCount

  return (
    <div className="space-y-4">
      {/* Zakładki */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => handleTabChange('active')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
            tab === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Aktywne <span className="ml-1 text-xs text-blue-600 font-semibold">{activeCount}</span>
        </button>
        <button
          onClick={() => handleTabChange('archive')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
            tab === 'archive' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Archiwum <span className="ml-1 text-xs text-gray-400 font-semibold">{archiveCount}</span>
        </button>
      </div>

      {/* Wyszukiwarka */}
      <input
        className="input max-w-sm"
        placeholder="Szukaj ogłoszenia..."
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
      />

      {/* Lista */}
      {paged.length === 0 ? (
        <p className="text-sm text-gray-400">
          {search ? 'Brak wyników dla podanej frazy.' : 'Brak ogłoszeń.'}
        </p>
      ) : (
        <div className="space-y-3">
          {paged.map((a) => {
            const { text, cls } = targetLabel(a)
            return (
              <div key={a.id} className={`bg-white border rounded-xl p-4 ${tab === 'archive' ? 'opacity-70' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{a.title}</p>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{a.content}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{text}</span>
                      {tab === 'archive' && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Archiwalne</span>
                      )}
                      <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('pl-PL')}</span>
                      {a.end_date && (
                        <span className="text-xs text-gray-400">
                          do {new Date(a.end_date).toLocaleDateString('pl-PL')}
                        </span>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <Link href={`/admin/announcements/${a.id}`} className="text-sm text-blue-600 hover:underline whitespace-nowrap">
                      Edytuj
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Paginacja */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
          >
            ← Poprzednia
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
          >
            Następna →
          </button>
        </div>
      )}
    </div>
  )
}

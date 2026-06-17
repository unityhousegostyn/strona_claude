'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { togglePin } from './actions'

interface Announcement {
  id: string
  title: string
  content: string
  target: string
  community_id: string | null
  start_date: string | null
  end_date: string | null
  created_at: string
  pinned: boolean
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
  const [, startTransition] = useTransition()
  const [optimisticPins, setOptimisticPins] = useState<Record<string, boolean>>({})

  const now = new Date()

  const isPinned = (a: Announcement) =>
    a.id in optimisticPins ? optimisticPins[a.id] : a.pinned

  const isActive = (a: Announcement) => {
    if (a.end_date && new Date(a.end_date) < now) return false
    if (a.start_date && new Date(a.start_date) > now) return false
    return true
  }

  const filtered = announcements
    .filter((a) => (tab === 'active' ? isActive(a) : !isActive(a)))
    .filter((a) => a.title.toLowerCase().includes(search.toLowerCase()) ||
                   a.content.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const ap = isPinned(a) ? 1 : 0
      const bp = isPinned(b) ? 1 : 0
      if (bp !== ap) return bp - ap
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleTabChange = (t: 'active' | 'archive') => { setTab(t); setPage(1) }
  const handleSearch = (v: string) => { setSearch(v); setPage(1) }

  const handleTogglePin = (a: Announcement) => {
    const newVal = !isPinned(a)
    setOptimisticPins(prev => ({ ...prev, [a.id]: newVal }))
    startTransition(async () => {
      await togglePin(a.id, newVal)
    })
  }

  const targetLabel = (a: Announcement) => {
    if (a.target === 'all') return { text: 'Wszystkie wspólnoty', cls: 'bg-amber-950/40 text-amber-400' }
    if (a.target === 'one') return { text: communityMap[a.community_id!] ?? '—', cls: 'bg-[#1e1409] text-[#b45309]' }
    const names = (junctionMap[a.id] ?? []).map((cid) => communityMap[cid] ?? cid)
    return { text: names.join(', ') || '—', cls: 'bg-purple-950/30 text-purple-400' }
  }

  const activeCount = announcements.filter(isActive).length
  const archiveCount = announcements.length - activeCount

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-[#1e1409] rounded-lg p-1 w-fit">
        {(['active', 'archive'] as const).map(t => (
          <button key={t} onClick={() => handleTabChange(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              tab === t ? 'bg-[#18110a] text-[#fef9ee] shadow-lg shadow-black/30' : 'text-[#a16207] hover:text-[#fde68a]'
            }`}>
            {t === 'active' ? 'Aktywne' : 'Archiwum'}
            <span className={`ml-1 text-xs font-semibold ${t === 'active' ? 'text-amber-500' : 'text-[#b45309]'}`}>
              {t === 'active' ? activeCount : archiveCount}
            </span>
          </button>
        ))}
      </div>

      <input className="input max-w-sm" placeholder="Szukaj ogłoszenia..."
        value={search} onChange={(e) => handleSearch(e.target.value)} />

      {paged.length === 0 ? (
        <p className="text-sm text-[#b45309]">{search ? 'Brak wyników.' : 'Brak ogłoszeń.'}</p>
      ) : (
        <div className="space-y-3">
          {paged.map((a) => {
            const { text, cls } = targetLabel(a)
            const pinned = isPinned(a)
            return (
              <div key={a.id} className={`bg-[#1e1409] border rounded-xl p-4 transition ${
                tab === 'archive' ? 'opacity-70 border-[#271a0c]' :
                pinned ? 'border-amber-700/60 shadow-sm shadow-amber-900/20' : 'border-[#33200d]'
              }`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      {pinned && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                          </svg>
                          Przypięte
                        </span>
                      )}
                      <p className="font-semibold text-[#fef9ee]">{a.title}</p>
                    </div>
                    <p className="text-sm text-[#a16207] mt-1 line-clamp-2">{a.content}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{text}</span>
                      {tab === 'archive' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#1a1208] text-[#a16207]">Archiwalne</span>
                      )}
                      <span className="text-xs text-[#b45309]">{new Date(a.created_at).toLocaleDateString('pl-PL')}</span>
                      {a.end_date && (
                        <span className="text-xs text-[#b45309]">do {new Date(a.end_date).toLocaleDateString('pl-PL')}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canEdit && (
                      <button onClick={() => handleTogglePin(a)}
                        title={pinned ? 'Odepnij' : 'Przypnij na górze'}
                        className={`p-1.5 rounded-lg border transition ${
                          pinned
                            ? 'border-amber-700/60 text-amber-500 bg-amber-950/30 hover:bg-amber-950/50'
                            : 'border-[#271a0c] text-[#3d2008] hover:border-amber-700/40 hover:text-amber-600'
                        }`}>
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                        </svg>
                      </button>
                    )}
                    {canEdit && (
                      <Link href={`/admin/announcements/${a.id}`} className="text-sm text-amber-500 hover:underline">
                        Edytuj
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-2 pt-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-[#33200d] rounded-lg hover:bg-[#18110a] disabled:opacity-40 transition">
            ← Poprzednia
          </button>
          <span className="text-sm text-[#a16207]">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-[#33200d] rounded-lg hover:bg-[#18110a] disabled:opacity-40 transition">
            Następna →
          </button>
        </div>
      )}
    </div>
  )
}

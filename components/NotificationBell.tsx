'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import Link from 'next/link'
import { fetchNotifications, markNotificationRead, markAllNotificationsRead, type Notification } from '@/app/notifications/actions'

const TYPE_ICON: Record<string, string> = {
  new_ticket:       '🎫',
  ticket_status:    '🔄',
  ticket_comment:   '💬',
  new_announcement: '📢',
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return 'przed chwilą'
  if (diff < 3600)  return `${Math.floor(diff / 60)} min temu`
  if (diff < 86400) return `${Math.floor(diff / 3600)} godz. temu`
  return `${Math.floor(diff / 86400)} dni temu`
}

export default function NotificationBell({ initialUnread = 0 }: { initialUnread?: number }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(initialUnread)
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  // Zamknij dropdown po kliknięciu poza
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Odśwież liczbę co 60s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications().then(({ unread: u }) => setUnread(u))
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  const openDropdown = async () => {
    setOpen(o => !o)
    if (!loaded) {
      const { data, unread: u } = await fetchNotifications()
      setNotifications(data)
      setUnread(u)
      setLoaded(true)
    }
  }

  const handleClick = async (n: Notification) => {
    if (!n.read) {
      await markNotificationRead(n.id)
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
      setUnread(u => Math.max(0, u - 1))
    }
    setOpen(false)
  }

  const handleMarkAll = () => {
    startTransition(async () => {
      await markAllNotificationsRead()
      setNotifications(prev => prev.map(x => ({ ...x, read: true })))
      setUnread(0)
    })
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={openDropdown}
        className="relative p-2 rounded-lg text-[#7a6a58] hover:bg-[#18140e] hover:text-[#f0ebe0] transition"
        aria-label="Powiadomienia"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#241e14] border border-[#3a2e1e] rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#3a2e1e]">
            <span className="text-sm font-semibold text-[#f0ebe0]">Powiadomienia</span>
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={isPending}
                className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50 transition"
              >
                Oznacz wszystkie
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-[400px] overflow-y-auto">
            {!loaded && (
              <div className="px-4 py-8 text-center text-sm text-[#6a5a48]">Ładowanie…</div>
            )}
            {loaded && notifications.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-2xl mb-2">🔔</p>
                <p className="text-sm text-[#7a6a58]">Brak powiadomień</p>
              </div>
            )}
            {notifications.map(n => {
              const inner = (
                <div
                  className={`flex gap-3 px-4 py-3 border-b border-[#3a2e1e]/50 hover:bg-[#2a2218] transition cursor-pointer ${
                    !n.read ? 'bg-amber-950/20' : ''
                  }`}
                  onClick={() => handleClick(n)}
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">{TYPE_ICON[n.type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!n.read ? 'text-[#f0ebe0] font-medium' : 'text-[#b8a898]'}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-[#6a5a48] mt-0.5 truncate">{n.body}</p>
                    )}
                    <p className="text-xs text-[#4a3c28] mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 mt-2" />
                  )}
                </div>
              )

              return n.link ? (
                <Link key={n.id} href={n.link}>{inner}</Link>
              ) : (
                <div key={n.id}>{inner}</div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import { Profile } from '@/types'
import { useI18n } from '@/lib/i18n'

type NavItem = { href: string; label: string; icon: string }
type NavGroup = { group: string; icon: string; subItems: NavItem[] }
type NavEntry = NavItem | NavGroup

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'group' in entry
}

function useNavEntries(role: string): NavEntry[] {
  const { t } = useI18n()

  const entries: NavEntry[] = [
    { href: '/admin/dashboard', label: t('nav.home'), icon: '🏠' },
    { href: '/admin/announcements', label: t('nav.announcements'), icon: '📢' },
    { href: '/admin/tickets', label: t('nav.tickets'), icon: '🎫' },
    { href: '/admin/board', label: t('nav.board'), icon: '💬' },
    { href: '/admin/contacts', label: t('nav.contacts'), icon: '📞' },
    { href: '/admin/documents', label: t('nav.documents'), icon: '📁' },
    { href: '/admin/votes', label: t('nav.votes'), icon: '🗳️' },
    { href: '/admin/settlements', label: t('nav.settlements'), icon: '🧾' },
  ]

  if (role === 'super_admin' || role === 'admin') {
    entries.push({
      group: t('nav.finanse'),
      icon: '💳',
      subItems: [
        { href: '/admin/finanse/przychody', label: t('nav.przychody'), icon: '💰' },
        { href: '/admin/finanse/koszty', label: t('nav.koszty'), icon: '💸' },
        { href: '/admin/finanse/raporty', label: t('nav.raporty'), icon: '📊' },
      ],
    })
  }

  if (role === 'super_admin') {
    entries.push({ href: '/admin/communities', label: t('nav.communities'), icon: '🏢' })
  }
  if (role === 'super_admin' || role === 'admin') {
    entries.push({ href: '/admin/users', label: t('nav.users'), icon: '👥' })
  }
  if (role === 'super_admin') {
    entries.push({ href: '/admin/audit', label: t('nav.audit'), icon: '🔍' })
  }
  return entries
}

interface Props {
  profile: Profile
  userEmail: string
  unreadAnnouncements?: number
  pendingUsers?: number
}

export default function SidebarNav({ profile, userEmail, unreadAnnouncements = 0, pendingUsers = 0 }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [financeOpen, setFinanceOpen] = useState(pathname.startsWith('/admin/finanse'))
  const navItems = useNavEntries(profile.role)

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Administrator',
    user: 'Mieszkaniec',
  }

  const renderEntry = (entry: NavEntry, closeMobile: () => void) => {
    if (isGroup(entry)) {
      const anyActive = entry.subItems.some(s => pathname.startsWith(s.href))
      return (
        <div key={entry.group}>
          <button
            onClick={() => setFinanceOpen(o => !o)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              anyActive ? 'text-blue-400' : 'text-gray-400 hover:bg-gray-950 hover:text-gray-100'
            }`}
          >
            <span>{entry.icon}</span>
            <span className="flex-1 text-left">{entry.group}</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform ${financeOpen ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {financeOpen && (
            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-800 pl-3">
              {entry.subItems.map(sub => {
                const active = pathname.startsWith(sub.href)
                return (
                  <Link
                    key={sub.href}
                    href={sub.href}
                    onClick={closeMobile}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      active ? 'bg-blue-950/40 text-blue-400' : 'text-gray-400 hover:bg-gray-950 hover:text-gray-100'
                    }`}
                  >
                    <span className="text-base">{sub.icon}</span>
                    <span>{sub.label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    const active = pathname.startsWith(entry.href)
    return (
      <Link
        key={entry.href}
        href={entry.href}
        onClick={closeMobile}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
          active ? 'bg-blue-950/40 text-blue-400' : 'text-gray-400 hover:bg-gray-950 hover:text-gray-100'
        }`}
      >
        <span>{entry.icon}</span>
        <span className="flex-1">{entry.label}</span>
        {entry.href === '/admin/announcements' && unreadAnnouncements > 0 && (
          <span className="bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
            {unreadAnnouncements > 99 ? '99+' : unreadAnnouncements}
          </span>
        )}
        {entry.href === '/admin/users' && pendingUsers > 0 && (
          <span className="bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
            {pendingUsers > 99 ? '99+' : pendingUsers}
          </span>
        )}
      </Link>
    )
  }

  const NavContent = () => (
    <>
      <div className="p-5 border-b border-gray-800">
        <h1 className="text-lg font-bold text-gray-100">🏢 Wspólnoty</h1>
        <p className="text-xs text-gray-400 mt-0.5">Panel zarządzania</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(entry => renderEntry(entry, () => setMobileOpen(false)))}
      </nav>

      <div className="p-4 border-t border-gray-800 space-y-1">
        <Link
          href="/admin/profile"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-950 transition"
        >
          <div className="w-7 h-7 rounded-full bg-blue-900/40 text-blue-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
            {(profile.full_name ?? userEmail).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-100 truncate">{profile.full_name ?? userEmail}</p>
            <p className="text-xs text-gray-400">{roleLabel[profile.role]}</p>
          </div>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full text-left text-sm text-red-400 hover:text-red-400 font-medium px-3 py-2 rounded-lg hover:bg-red-950/30 transition"
        >
          Wyloguj się
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 h-14">
        <h1 className="text-base font-bold text-gray-100">🏢 Wspólnoty</h1>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-gray-400 hover:bg-gray-900 transition"
          aria-label="Otwórz menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside className={`
        lg:hidden fixed top-0 left-0 z-50 h-full w-72 bg-gray-900 shadow-2xl shadow-black/60 flex flex-col transition-transform duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h1 className="text-lg font-bold text-gray-100">🏢 Wspólnoty</h1>
          <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-900 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(entry => renderEntry(entry, () => setMobileOpen(false)))}
        </nav>
        <div className="p-4 border-t border-gray-800 space-y-1">
          <Link href="/admin/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-950 transition">
            <div className="w-7 h-7 rounded-full bg-blue-900/40 text-blue-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
              {(profile.full_name ?? userEmail).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-100 truncate">{profile.full_name ?? userEmail}</p>
              <p className="text-xs text-gray-400">{roleLabel[profile.role]}</p>
            </div>
          </Link>
          <button onClick={handleLogout} className="w-full text-left text-sm text-red-400 font-medium px-3 py-2 rounded-lg hover:bg-red-950/30 transition">
            Wyloguj się
          </button>
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-gray-900 border-r border-gray-800 flex-col shrink-0">
        <NavContent />
      </aside>
    </>
  )
}

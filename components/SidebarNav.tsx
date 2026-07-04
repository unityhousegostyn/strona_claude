'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import { Profile } from '@/types'
import { useI18n } from '@/lib/i18n'
import ThemeToggle from './ThemeToggle'

type NavItem = { href: string; label: string; icon: string }
type NavGroup = { key: string; group: string; icon: string; subItems: NavItem[] }
type NavSection = { section: string }
type NavEntry = NavItem | NavGroup | NavSection

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'group' in entry
}
function isSection(entry: NavEntry): entry is NavSection {
  return 'section' in entry
}

function useNavEntries(role: string): NavEntry[] {
  const { t } = useI18n()

  const isNajemca = role === 'najemca'
  const isAdminPlus = role === 'super_admin' || role === 'admin'

  const entries: NavEntry[] = [
    { href: '/admin/dashboard', label: t('nav.home'), icon: '🏠' },

    { section: 'Komunikacja' },
    { href: '/admin/announcements', label: t('nav.announcements'), icon: '📢' },
    { href: '/admin/board', label: t('nav.board'), icon: '💬' },
    { href: '/admin/tickets', label: t('nav.tickets'), icon: '🎫' },
    ...(!isNajemca ? [{ href: '/admin/wnioski', label: t('nav.wnioski'), icon: '📝' }] : []),

    { section: 'Zasoby' },
    { href: '/admin/contacts', label: t('nav.contacts'), icon: '📞' },
    ...(!isNajemca ? [{ href: '/admin/documents', label: t('nav.documents'), icon: '📁' }] : []),

    ...(isNajemca ? [
      { section: 'Moje konto' },
      { href: '/admin/settlements/moje-konto', label: 'Rozliczenie', icon: '💳' },
    ] : []),

    ...(!isNajemca ? [
      { section: 'Wspólnota' },
      { href: '/admin/votes', label: t('nav.votes'), icon: '🗳️' },
      {
        key: 'rozliczenia',
        group: t('nav.settlements'),
        icon: '🧾',
        subItems: [
          ...(role === 'user' ? [{ href: '/admin/settlements/moje-konto', label: 'Moje konto', icon: '💳' }] : []),
          { href: '/admin/settlements', label: 'Zestawienie', icon: '📋' },
          { href: '/admin/water-meters', label: 'Liczniki wody', icon: '💧' },
          { href: '/admin/settlements/nota-wody-zbiorczy', label: 'Noty wody', icon: '📄' },
          ...(isAdminPlus ? [
            { href: '/admin/settlements/wezwania', label: 'Wezwania do zapłaty', icon: '⚠️' },
            { href: '/admin/settlements/zawiadomienia', label: t('nav.zawiadomienia'), icon: '📨' },
          ] : []),
        ],
      },
    ] : []),
  ]

  if (!isNajemca && isAdminPlus) {
    entries.push({
      key: 'finanse',
      group: t('nav.finanse'),
      icon: '💳',
      subItems: [
        { href: '/admin/finanse/przychody', label: t('nav.przychody'), icon: '💰' },
        { href: '/admin/finanse/koszty', label: t('nav.koszty'), icon: '💸' },
        { href: '/admin/finanse/budzet', label: t('nav.budzet'), icon: '📋' },
        { href: '/admin/finanse/lokaty', label: t('nav.lokaty'), icon: '🏦' },
        { href: '/admin/finanse/raporty', label: t('nav.raporty'), icon: '📊' },
        ...(role === 'super_admin' ? [
          { href: '/admin/finanse/zamkniecie-roku', label: 'Zamknięcie roku', icon: '🔒' },
          { href: '/admin/ksef', label: 'KSeF', icon: '🗂️' },
        ] : []),
      ],
    })
  }

  if (isAdminPlus) {
    entries.push({ section: 'Administracja' })
    if (role === 'super_admin') {
      entries.push({ href: '/admin/communities', label: t('nav.communities'), icon: '🏢' })
    }
    entries.push({ href: '/admin/users', label: t('nav.users'), icon: '👥' })
    entries.push({ href: '/admin/messages', label: t('nav.messages'), icon: '✉️' })
    if (role === 'super_admin') {
      entries.push({ href: '/admin/audit', label: t('nav.audit'), icon: '🔍' })
    }
  }

  return entries
}

interface Props {
  profile: Profile
  userEmail: string
  unreadAnnouncements?: number
  pendingUsers?: number
  newRequests?: number
}

export default function SidebarNav({ profile, userEmail, unreadAnnouncements = 0, pendingUsers = 0, newRequests = 0 }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    finanse: pathname.startsWith('/admin/finanse'),
    rozliczenia: pathname.startsWith('/admin/settlements'),
  })
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
    najemca: 'Najemca',
  }

  const getBadge = (href: string) => {
    if (href === '/admin/announcements' && unreadAnnouncements > 0) return { count: unreadAnnouncements, color: 'bg-teal-600' }
    if (href === '/admin/users' && pendingUsers > 0) return { count: pendingUsers, color: 'bg-red-600' }
    if (href === '/admin/wnioski' && newRequests > 0) return { count: newRequests, color: 'bg-blue-600' }
    return null
  }

  const renderEntry = (entry: NavEntry, closeMobile: () => void) => {
    if (isSection(entry)) {
      return (
        <div key={entry.section} className="pt-3 pb-1 px-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#1f5c55]">{entry.section}</p>
        </div>
      )
    }

    if (isGroup(entry)) {
      const anyActive = entry.subItems.some(s => pathname.startsWith(s.href))
      const isOpen = openGroups[entry.key] ?? anyActive
      // Wybierz najdłużej dopasowany href, żeby przy zagnieżdżonych ścieżkach
      // (np. /admin/settlements i /admin/settlements/zawiadomienia) podświetlić tylko jedną pozycję
      const bestMatch = entry.subItems.reduce<NavItem | null>((best, s) => {
        if (!pathname.startsWith(s.href)) return best
        if (!best || s.href.length > best.href.length) return s
        return best
      }, null)
      return (
        <div key={entry.key}>
          <button
            onClick={() => setOpenGroups(o => ({ ...o, [entry.key]: !isOpen }))}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              anyActive ? 'text-teal-400' : 'text-[#4d9e94] hover:bg-[#081918] hover:text-[#f0fdfa]'
            }`}
          >
            <span>{entry.icon}</span>
            <span className="flex-1 text-left">{entry.group}</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {isOpen && (
            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[#0f2d2a] pl-3">
              {entry.subItems.map(sub => {
                const active = sub.href === bestMatch?.href
                return (
                  <Link
                    key={sub.href}
                    href={sub.href}
                    onClick={closeMobile}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      active ? 'bg-teal-950/40 text-teal-400' : 'text-[#4d9e94] hover:bg-[#081918] hover:text-[#f0fdfa]'
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
    const badge = getBadge(entry.href)
    const tourIdMap: Record<string, string> = {
      '/admin/dashboard': 'nav-dashboard',
      '/admin/announcements': 'nav-announcements',
      '/admin/tickets': 'nav-tickets',
      '/admin/board': 'nav-board',
      '/admin/contacts': 'nav-contacts',
      '/admin/documents': 'nav-documents',
      '/admin/votes': 'nav-votes',
      '/admin/settlements': 'nav-settlements',
      '/admin/wnioski': 'nav-wnioski',
      '/admin/users': 'nav-users',
      '/admin/messages': 'nav-messages',
    }
    return (
      <Link
        key={entry.href}
        href={entry.href}
        onClick={closeMobile}
        data-tour={tourIdMap[entry.href]}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
          active ? 'bg-teal-950/40 text-teal-400' : 'text-[#4d9e94] hover:bg-[#081918] hover:text-[#f0fdfa]'
        }`}
      >
        <span>{entry.icon}</span>
        <span className="flex-1">{entry.label}</span>
        {badge && (
          <span className={`${badge.color} text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center`}>
            {badge.count > 99 ? '99+' : badge.count}
          </span>
        )}
      </Link>
    )
  }

  // Bottom nav items (5 tabs: 4 key pages + Więcej)
  const bottomNavItems: NavItem[] = [
    { href: '/admin/dashboard', label: 'Start', icon: '🏠' },
    { href: '/admin/settlements', label: 'Rozliczenia', icon: '🧾' },
    { href: '/admin/wnioski', label: 'Wnioski', icon: '📝' },
    { href: '/admin/announcements', label: 'Ogłoszenia', icon: '📢' },
  ]

  const NavContent = () => (
    <>
      <div className="p-5 border-b border-[#0f2d2a]">
        <h1 className="text-lg font-bold text-[#f0fdfa]">🏢 Wspólnoty</h1>
        <p className="text-xs text-[#4d9e94] mt-0.5">Panel zarządzania</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(entry => renderEntry(entry, () => {}))}
      </nav>

      <div className="p-4 border-t border-[#0f2d2a] space-y-1">
        <Link
          href="/admin/profile"
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#081918] transition"
        >
          <div className="w-7 h-7 rounded-full bg-teal-900/40 text-teal-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
            {(profile.full_name ?? userEmail).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#f0fdfa] truncate">{profile.full_name ?? userEmail}</p>
            <p className="text-xs text-[#4d9e94]">{roleLabel[profile.role]}</p>
          </div>
        </Link>
        <ThemeToggle />
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
      {/* ── MOBILE ── */}

      {/* Top bar — uproszczony, bez hamburgera */}
      <div className="print:hidden lg:hidden fixed top-0 left-0 right-0 z-30 bg-[#051210] border-b border-[#0f2d2a] flex items-center justify-between px-4 h-14">
        <h1 className="text-base font-bold text-[#f0fdfa]">🏢 Wspólnoty</h1>
        <Link href="/admin/profile" className="w-8 h-8 rounded-full bg-teal-900/40 text-teal-400 text-sm font-bold flex items-center justify-center">
          {(profile.full_name ?? userEmail).charAt(0).toUpperCase()}
        </Link>
      </div>

      {/* Bottom navigation bar */}
      <nav className="print:hidden lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#051210] border-t border-[#0f2d2a] flex items-stretch h-16 safe-area-bottom">
        {bottomNavItems.map(item => {
          const active = pathname.startsWith(item.href)
          const badge = getBadge(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition relative ${
                active ? 'text-teal-400' : 'text-[#4d9e94]'
              }`}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-teal-500 rounded-full" />
              )}
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="text-[10px] leading-none">{item.label}</span>
              {badge && (
                <span className={`absolute top-2 right-1/4 ${badge.color} text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center`}>
                  {badge.count > 9 ? '9+' : badge.count}
                </span>
              )}
            </Link>
          )
        })}

        {/* Więcej — otwiera drawer */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium text-[#4d9e94] transition"
        >
          <span className="text-xl leading-none">☰</span>
          <span className="text-[10px] leading-none">Więcej</span>
          {(pendingUsers > 0 || newRequests > 0) && (
            <span className="absolute top-2 right-1 bg-red-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              !
            </span>
          )}
        </button>
      </nav>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div
          className="print:hidden lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer — pełne menu z dołu */}
      <div className={`
        print:hidden lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#051210] rounded-t-2xl shadow-2xl
        transition-transform duration-300 max-h-[85vh] flex flex-col
        ${drawerOpen ? 'translate-y-0' : 'translate-y-full'}
      `}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-[#0f2d2a] rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#0f2d2a]">
          <span className="text-sm font-semibold text-[#f0fdfa]">Menu</span>
          <button onClick={() => setDrawerOpen(false)} className="text-[#4d9e94] hover:text-[#f0fdfa] text-xl leading-none">×</button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto pb-safe">
          {navItems.map(entry => renderEntry(entry, () => setDrawerOpen(false)))}
        </nav>
        <div className="p-4 border-t border-[#0f2d2a] space-y-1">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-teal-900/40 text-teal-400 text-xs font-bold flex items-center justify-center">
              {(profile.full_name ?? userEmail).charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-medium text-[#f0fdfa] truncate max-w-[180px]">{profile.full_name ?? userEmail}</p>
              <p className="text-xs text-[#0f766e]">{roleLabel[profile.role]}</p>
            </div>
          </div>
          <ThemeToggle />
          <button onClick={handleLogout} className="w-full text-left text-sm text-red-400 font-medium px-3 py-2 rounded-lg hover:bg-red-950/30 transition">
            Wyloguj się
          </button>
        </div>
      </div>

      {/* ── DESKTOP sidebar ── */}
      <aside className="print:hidden hidden lg:flex w-64 bg-[#051210] border-r border-[#0f2d2a] flex-col shrink-0">
        <NavContent />
      </aside>
    </>
  )
}

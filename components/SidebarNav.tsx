'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import { Profile } from '@/types'
import { useI18n } from '@/lib/i18n'
import { useTheme } from './ThemeProvider'
import {
  PhHouse, PhMegaphone, PhChatBubble, PhTicket, PhClipboard,
  PhPhone, PhFolder, PhScales, PhReceipt, PhCreditCard,
  PhMoney, PhTrendDown, PhChartBar, PhLock, PhArchive,
  PhBuildings, PhUsers, PhEnvelope, PhSearch, PhDrop,
  PhFileText, PhWarning, PhBank, PhCalendar,
  PhCaretRight, PhUserCircle, PhSignOut, PhSun, PhMoon, PhGrid,
} from './PhIcon'

// ── Icon style map ────────────────────────────────────────────────────────────
type IconDef = { bg: string; color: string; Icon: React.FC<{ size?: number; color?: string }> }

const ICON_MAP: Record<string, IconDef> = {
  '🏠': { bg: 'bg-teal-50',    color: '#0d9488', Icon: PhHouse },
  '📢': { bg: 'bg-amber-50',   color: '#d97706', Icon: PhMegaphone },
  '💬': { bg: 'bg-violet-50',  color: '#7c3aed', Icon: PhChatBubble },
  '🎫': { bg: 'bg-purple-50',  color: '#9333ea', Icon: PhTicket },
  '📝': { bg: 'bg-blue-50',    color: '#2563eb', Icon: PhClipboard },
  '📞': { bg: 'bg-green-50',   color: '#16a34a', Icon: PhPhone },
  '📁': { bg: 'bg-indigo-50',  color: '#4f46e5', Icon: PhFolder },
  '🗳️': { bg: 'bg-rose-50',    color: '#e11d48', Icon: PhScales },
  '🧾': { bg: 'bg-teal-50',    color: '#0d9488', Icon: PhReceipt },
  '💳': { bg: 'bg-sky-50',     color: '#0284c7', Icon: PhCreditCard },
  '💰': { bg: 'bg-emerald-50', color: '#059669', Icon: PhMoney },
  '💸': { bg: 'bg-red-50',     color: '#dc2626', Icon: PhTrendDown },
  '📊': { bg: 'bg-orange-50',  color: '#ea580c', Icon: PhChartBar },
  '🔒': { bg: 'bg-gray-100',   color: '#4b5563', Icon: PhLock },
  '🗂️': { bg: 'bg-yellow-50',  color: '#ca8a04', Icon: PhArchive },
  '🏢': { bg: 'bg-teal-50',    color: '#0d9488', Icon: PhBuildings },
  '👥': { bg: 'bg-orange-50',  color: '#ea580c', Icon: PhUsers },
  '✉️': { bg: 'bg-sky-50',     color: '#0284c7', Icon: PhEnvelope },
  '🔍': { bg: 'bg-gray-100',   color: '#6b7280', Icon: PhSearch },
  '💧': { bg: 'bg-cyan-50',    color: '#0891b2', Icon: PhDrop },
  '📄': { bg: 'bg-slate-50',   color: '#475569', Icon: PhFileText },
  '⚠️': { bg: 'bg-amber-50',   color: '#d97706', Icon: PhWarning },
  '📋': { bg: 'bg-slate-100',  color: '#64748b', Icon: PhFileText },
  '🏦': { bg: 'bg-cyan-50',    color: '#0891b2', Icon: PhBank },
  '📨': { bg: 'bg-indigo-50',  color: '#4f46e5', Icon: PhCalendar },
}

function NavIcon({ emoji, active }: { emoji: string; active: boolean }) {
  const def = ICON_MAP[emoji]
  if (!def) return <span className="text-base">{emoji}</span>
  const { bg, color, Icon } = def
  if (active) {
    return (
      <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
        <Icon size={16} color="white" />
      </span>
    )
  }
  return (
    <span className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
      <Icon size={16} color={color} />
    </span>
  )
}

// ── Nav types ─────────────────────────────────────────────────────────────────
type NavItem    = { href: string; label: string; icon: string }
type NavGroup   = { key: string; group: string; icon: string; subItems: NavItem[] }
type NavSection = { section: string }
type NavEntry   = NavItem | NavGroup | NavSection

function isGroup(e: NavEntry): e is NavGroup   { return 'group'   in e }
function isSection(e: NavEntry): e is NavSection { return 'section' in e }

function useNavEntries(role: string): NavEntry[] {
  const { t } = useI18n()
  const isNajemca  = role === 'najemca'
  const isAdminPlus = role === 'super_admin' || role === 'admin'

  const entries: NavEntry[] = [
    { href: '/admin/dashboard', label: t('nav.home'), icon: '🏠' },

    { section: 'Komunikacja' },
    { href: '/admin/announcements', label: t('nav.announcements'), icon: '📢' },
    { href: '/admin/board',         label: t('nav.board'),         icon: '💬' },
    { href: '/admin/tickets',       label: t('nav.tickets'),       icon: '🎫' },
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
          ...(isAdminPlus ? [
            { href: '/admin/water-meters',                   label: 'Liczniki wody',  icon: '💧' },
            { href: '/admin/settlements/nota-wody-zbiorczy', label: 'Noty wody',       icon: '📄' },
          ] : []),
          ...(isAdminPlus ? [
            { href: '/admin/settlements/wezwania',      label: 'Wezwania do zapłaty', icon: '⚠️' },
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
        { href: '/admin/finanse/przychody',         label: t('nav.przychody'),  icon: '💰' },
        { href: '/admin/finanse/koszty',            label: t('nav.koszty'),     icon: '💸' },
        { href: '/admin/finanse/budzet',            label: t('nav.budzet'),     icon: '📋' },
        { href: '/admin/finanse/lokaty',            label: t('nav.lokaty'),     icon: '🏦' },
        { href: '/admin/finanse/raporty',           label: t('nav.raporty'),    icon: '📊' },
        ...(role === 'super_admin' ? [
          { href: '/admin/finanse/zamkniecie-roku', label: 'Zamknięcie roku',   icon: '🔒' },
          { href: '/admin/ksef',                    label: 'KSeF',              icon: '🗂️' },
          { href: '/admin/finanse/mt940',           label: 'Import MT940',      icon: '🏦' },
        ] : []),
      ],
    })
  }

  if (isAdminPlus) {
    entries.push({ section: 'Administracja' })
    if (role === 'super_admin') {
      entries.push({ href: '/admin/communities', label: t('nav.communities'), icon: '🏢' })
    }
    entries.push({ href: '/admin/users',     label: t('nav.users'),    icon: '👥' })
    entries.push({ href: '/admin/messages',  label: t('nav.messages'), icon: '✉️' })
    entries.push({ href: '/admin/analytics', label: 'Analytics',       icon: '📈' })
    if (role === 'super_admin') {
      entries.push({ href: '/admin/audit', label: t('nav.audit'), icon: '🔍' })
    }
  }

  return entries
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  profile: Profile
  userEmail: string
  unreadAnnouncements?: number
  pendingUsers?: number
  newRequests?: number
}

export default function SidebarNav({
  profile, userEmail,
  unreadAnnouncements = 0, pendingUsers = 0, newRequests = 0,
}: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const { theme, toggle } = useTheme()
  const [drawerOpen,  setDrawerOpen]  = useState(false)
  const [openGroups,  setOpenGroups]  = useState<Record<string, boolean>>({
    finanse:      pathname.startsWith('/admin/finanse'),
    rozliczenia:  pathname.startsWith('/admin/settlements'),
  })
  const navItems = useNavEntries(profile.role)

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin',
    admin:       'Administrator',
    user:        'Mieszkaniec',
    najemca:     'Najemca',
  }

  const getBadge = (href: string) => {
    if (href === '/admin/announcements' && unreadAnnouncements > 0) return { count: unreadAnnouncements, color: 'bg-teal-500' }
    if (href === '/admin/users'         && pendingUsers          > 0) return { count: pendingUsers,          color: 'bg-red-500'  }
    if (href === '/admin/wnioski'       && newRequests           > 0) return { count: newRequests,           color: 'bg-blue-500' }
    return null
  }

  const initials = (profile.full_name ?? userEmail).charAt(0).toUpperCase()

  // ── Render helpers ──────────────────────────────────────────────────────────
  const renderEntry = (entry: NavEntry, closeMobile: () => void) => {
    if (isSection(entry)) {
      return (
        <div key={entry.section} className="px-3 pt-4 pb-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-400">{entry.section}</p>
        </div>
      )
    }

    if (isGroup(entry)) {
      const anyActive = entry.subItems.some(s => pathname.startsWith(s.href))
      const isOpen    = openGroups[entry.key] ?? anyActive
      const bestMatch = entry.subItems.reduce<NavItem | null>((best, s) => {
        if (!pathname.startsWith(s.href)) return best
        if (!best || s.href.length > best.href.length) return s
        return best
      }, null)

      return (
        <div key={entry.key}>
          <button
            onClick={() => setOpenGroups(o => ({ ...o, [entry.key]: !isOpen }))}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              anyActive
                ? 'bg-teal-600 text-white shadow-sm shadow-teal-200'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <NavIcon emoji={entry.icon} active={anyActive} />
            <span className="flex-1 text-left text-[13px]">{entry.group}</span>
            <PhCaretRight
              size={14}
              color={anyActive ? 'white' : '#9ca3af'}
            />
          </button>
          {isOpen && (
            <div className="ml-5 mt-0.5 border-l-2 border-gray-100 pl-3 space-y-0.5">
              {entry.subItems.map(sub => {
                const active = sub.href === bestMatch?.href
                return (
                  <Link
                    key={sub.href}
                    href={sub.href}
                    onClick={closeMobile}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                      active
                        ? 'bg-teal-600 text-white shadow-sm shadow-teal-200'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <NavIcon emoji={sub.icon} active={active} />
                    <span className="flex-1">{sub.label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    // Plain nav item
    const active = pathname.startsWith(entry.href)
    const badge  = getBadge(entry.href)
    const tourIdMap: Record<string, string> = {
      '/admin/dashboard':    'nav-dashboard',
      '/admin/announcements':'nav-announcements',
      '/admin/tickets':      'nav-tickets',
      '/admin/board':        'nav-board',
      '/admin/contacts':     'nav-contacts',
      '/admin/documents':    'nav-documents',
      '/admin/votes':        'nav-votes',
      '/admin/settlements':  'nav-settlements',
      '/admin/wnioski':      'nav-wnioski',
      '/admin/users':        'nav-users',
      '/admin/messages':     'nav-messages',
    }

    return (
      <Link
        key={entry.href}
        href={entry.href}
        onClick={closeMobile}
        data-tour={tourIdMap[entry.href]}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
          active
            ? 'bg-teal-600 text-white shadow-sm shadow-teal-200'
            : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        <NavIcon emoji={entry.icon} active={active} />
        <span className="flex-1">{entry.label}</span>
        {badge && (
          <span className={`${badge.color} text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center`}>
            {badge.count > 99 ? '99+' : badge.count}
          </span>
        )}
      </Link>
    )
  }

  // ── Desktop sidebar content ──────────────────────────────────────────────────
  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center shadow-sm shadow-teal-200 flex-shrink-0">
          <PhBuildings size={18} color="white" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">Wspólnoty</p>
          <p className="text-[10px] text-gray-400">Panel zarządzania</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(entry => renderEntry(entry, () => {}))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-gray-100 space-y-1">
        <Link
          href="/admin/profile"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-all group"
        >
          <div className="w-8 h-8 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-gray-900 truncate">{profile.full_name ?? userEmail}</p>
            <p className="text-[10px] text-gray-400">{roleLabel[profile.role]}</p>
          </div>
          <PhCaretRight size={14} color="#d1d5db" />
        </Link>

        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-gray-500 hover:bg-gray-50 transition-all"
        >
          {theme === 'dark' ? <PhSun size={16} color="#d97706" /> : <PhMoon size={16} color="#6b7280" />}
          <span>{theme === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}</span>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-red-500 hover:bg-red-50 transition-all"
        >
          <PhSignOut size={16} color="#ef4444" />
          <span>Wyloguj się</span>
        </button>
      </div>
    </>
  )

  // ── Mobile bottom nav ─────────────────────────────────────────────────────
  const bottomNavItems: NavItem[] = [
    { href: '/admin/dashboard',    label: 'Start',       icon: '🏠' },
    { href: '/admin/settlements',  label: 'Rozliczenia', icon: '🧾' },
    { href: '/admin/wnioski',      label: 'Wnioski',     icon: '📝' },
    { href: '/admin/announcements',label: 'Ogłoszenia',  icon: '📢' },
  ]

  return (
    <>
      {/* ── MOBILE top bar ─────────────────────────────────────────────── */}
      <div className="print:hidden lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-100 flex items-center justify-between px-4 h-14 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
            <PhBuildings size={15} color="white" />
          </div>
          <span className="text-sm font-bold text-gray-900">Wspólnoty</span>
        </div>
        <Link
          href="/admin/profile"
          className="w-8 h-8 rounded-full bg-teal-600 text-white text-sm font-bold flex items-center justify-center"
        >
          {initials}
        </Link>
      </div>

      {/* ── MOBILE bottom nav ──────────────────────────────────────────── */}
      <nav className="print:hidden lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 flex items-stretch h-16 shadow-[0_-1px_8px_rgba(0,0,0,.06)]">
        {bottomNavItems.map(item => {
          const active = pathname.startsWith(item.href)
          const badge  = getBadge(item.href)
          const def    = ICON_MAP[item.icon]
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition relative ${
                active ? 'text-teal-600' : 'text-gray-400'
              }`}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-teal-500 rounded-full" />
              )}
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${active ? 'bg-teal-50' : ''}`}>
                {def ? <def.Icon size={18} color={active ? '#0d9488' : '#9ca3af'} /> : item.icon}
              </span>
              <span className={`text-[10px] leading-none ${active ? 'text-teal-600' : 'text-gray-400'}`}>{item.label}</span>
              {badge && (
                <span className={`absolute top-2 right-1/4 ${badge.color} text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center`}>
                  {badge.count > 9 ? '9+' : badge.count}
                </span>
              )}
            </Link>
          )
        })}

        {/* Więcej */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium text-gray-400 relative"
        >
          <span className="w-8 h-8 rounded-xl flex items-center justify-center">
            <PhGrid size={18} color="#9ca3af" />
          </span>
          <span className="text-[10px] leading-none">Więcej</span>
          {(pendingUsers > 0 || newRequests > 0) && (
            <span className="absolute top-2 right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">!</span>
          )}
        </button>
      </nav>

      {/* ── MOBILE drawer overlay ──────────────────────────────────────── */}
      {drawerOpen && (
        <div className="print:hidden lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
      )}
      <div className={`
        print:hidden lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl
        transition-transform duration-300 max-h-[85vh] flex flex-col
        ${drawerOpen ? 'translate-y-0' : 'translate-y-full'}
      `}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">Menu</span>
          <button onClick={() => setDrawerOpen(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto pb-safe">
          {navItems.map(entry => renderEntry(entry, () => setDrawerOpen(false)))}
        </nav>
        <div className="px-3 py-3 border-t border-gray-100 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="w-8 h-8 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
              {initials}
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-900 truncate max-w-[200px]">{profile.full_name ?? userEmail}</p>
              <p className="text-[10px] text-gray-400">{roleLabel[profile.role]}</p>
            </div>
          </div>
          <button
            onClick={toggle}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-gray-500 hover:bg-gray-50 transition-all"
          >
            {theme === 'dark' ? <PhSun size={16} color="#d97706" /> : <PhMoon size={16} color="#6b7280" />}
            <span>{theme === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-red-500 hover:bg-red-50 transition-all"
          >
            <PhSignOut size={16} color="#ef4444" />
            <span>Wyloguj się</span>
          </button>
        </div>
      </div>

      {/* ── DESKTOP sidebar ─────────────────────────────────────────────── */}
      <aside className="print:hidden hidden lg:flex w-64 bg-white border-r border-gray-100 flex-col shrink-0 shadow-[1px_0_8px_rgba(0,0,0,.04)]">
        <NavContent />
      </aside>
    </>
  )
}

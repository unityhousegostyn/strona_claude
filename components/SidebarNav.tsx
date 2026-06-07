'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import { Profile } from '@/types'

const navItems = (role: string) => {
  const base = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: '🏠' },
    { href: '/admin/announcements', label: 'Ogłoszenia', icon: '📢' },
    { href: '/admin/tickets', label: 'Zgłoszenia', icon: '🎫' },
    { href: '/admin/documents', label: 'Dokumenty', icon: '📁' },
  ]
  if (role === 'super_admin') {
    base.push({ href: '/admin/communities', label: 'Wspólnoty', icon: '🏢' })
  }
  if (role === 'super_admin' || role === 'admin') {
    base.push({ href: '/admin/users', label: 'Użytkownicy', icon: '👥' })
  }
  if (role === 'super_admin') {
    base.push({ href: '/admin/audit', label: 'Audit Log', icon: '🔍' })
  }
  return base
}

interface Props {
  profile: Profile
  userEmail: string
  unreadAnnouncements?: number
}

export default function SidebarNav({ profile, userEmail, unreadAnnouncements = 0 }: Props) {
  const pathname = usePathname()
  const router = useRouter()

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

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-5 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">🏢 Wspólnoty</h1>
        <p className="text-xs text-gray-400 mt-0.5">Panel zarządzania</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems(profile.role).map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.href === '/admin/announcements' && unreadAnnouncements > 0 && (
                <span className="bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {unreadAnnouncements > 99 ? '99+' : unreadAnnouncements}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-100 space-y-1">
        <Link
          href="/admin/profile"
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition"
        >
          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
            {(profile.full_name ?? userEmail).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{profile.full_name ?? userEmail}</p>
            <p className="text-xs text-gray-400">{roleLabel[profile.role]}</p>
          </div>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full text-left text-sm text-red-600 hover:text-red-700 font-medium px-3 py-2 rounded-lg hover:bg-red-50 transition"
        >
          Wyloguj się
        </button>
      </div>
    </aside>
  )
}
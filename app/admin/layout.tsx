import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import SidebarNav from '@/components/SidebarNav'
import NotificationBell from '@/components/NotificationBell'
import { ToastProvider } from '@/components/ToastContext'
import AutoRefresh from '@/components/AutoRefresh'
import ChatWidget from '@/components/ChatWidget'
import InactivityLogout from '@/components/InactivityLogout'
import { I18nProvider } from '@/lib/i18n'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const admin = getSupabaseAdminClient()

  // Pobierz wspólnotę osobno
  let community = null
  if (profile.community_id) {
    const { data } = await admin
      .from('communities')
      .select('*')
      .eq('id', profile.community_id)
      .single()
    community = data
  }

  const profileWithCommunity = { ...profile, community }

  // Liczba wszystkich aktywnych ogłoszeń (widocznych dla użytkownika)
  let unreadCount = 0
  let pendingUsersCount = 0
  try {
    const now = new Date()

    let annQuery = admin.from('announcements').select('id, start_date, end_date')
    if (profile.role !== 'super_admin' && profile.community_id) {
      annQuery = annQuery.or(`community_id.eq.${profile.community_id},target.eq.all`) as any
    }
    const { data: allAnns } = await annQuery

    const activeAnns = (allAnns ?? []).filter((a: any) => {
      if (a.end_date && new Date(a.end_date) < now) return false
      if (a.start_date && new Date(a.start_date) > now) return false
      return true
    })
    unreadCount = activeAnns.length
  } catch {
    unreadCount = 0
  }

  // Oczekujący użytkownicy — widoczne tylko dla admin/super_admin
  if (profile.role === 'super_admin' || profile.role === 'admin') {
    try {
      const { count } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
      pendingUsersCount = count ?? 0
    } catch {
      pendingUsersCount = 0
    }
  }

  // Nowe wnioski do administracji
  let newRequestsCount = 0
  try {
    let reqQuery = admin
      .from('community_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new')
    if (profile.role === 'admin' && profile.community_id) {
      reqQuery = reqQuery.eq('community_id', profile.community_id) as any
    }
    if (profile.role !== 'user') {
      const { count } = await reqQuery
      newRequestsCount = count ?? 0
    }
  } catch {
    newRequestsCount = 0
  }

  // Nieprzeczytane powiadomienia
  let unreadNotifications = 0
  try {
    const { count } = await admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
    unreadNotifications = count ?? 0
  } catch {
    unreadNotifications = 0
  }

  return (
    <I18nProvider>
    <ToastProvider>
      <div className="flex min-h-screen bg-[#051210]">
        <SidebarNav
          profile={profileWithCommunity}
          userEmail={user.email ?? ''}
          unreadAnnouncements={unreadCount}
          pendingUsers={pendingUsersCount}
          newRequests={newRequestsCount}
        />
        {(profile.role === 'super_admin' || profile.role === 'admin') && (
          <><AutoRefresh intervalMs={60000} /><InactivityLogout /></>
        )}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar z dzwonkiem */}
          <div className="lg:hidden fixed top-0 left-0 right-0 z-20 pointer-events-none" />
          <div className="hidden lg:flex items-center justify-end px-6 pt-4 pb-0">
            <NotificationBell initialUnread={unreadNotifications} />
          </div>
          <main className="flex-1 p-4 lg:p-6 overflow-auto pt-[72px] pb-20 lg:pt-3 lg:pb-6">
            {children}
          </main>
        </div>
        {/* <ChatWidget /> */}{/* AI chatbot — aktywuj po dodaniu ANTHROPIC_API_KEY */}
      </div>
    </ToastProvider>
    </I18nProvider>
  )
}

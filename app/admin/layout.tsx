import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import SidebarNav from '@/components/SidebarNav'
import NotificationBell from '@/components/NotificationBell'
import { ToastProvider } from '@/components/ToastContext'
import AutoRefresh from '@/components/AutoRefresh'
import ChatWidget from '@/components/ChatWidget'
import InactivityLogout from '@/components/InactivityLogout'
import SuperAdminRefreshTimer from '@/components/SuperAdminRefreshTimer'
import OnboardingTour from '@/components/OnboardingTour'
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
      <div className="print:block flex min-h-screen bg-[#f0f2f5] print:bg-white print:min-h-0">
        <SidebarNav
          profile={profileWithCommunity}
          userEmail={user.email ?? ''}
          unreadAnnouncements={unreadCount}
          pendingUsers={pendingUsersCount}
          newRequests={newRequestsCount}
        />
        {profile.role === 'admin' && (
          <><AutoRefresh intervalMs={60000} /><InactivityLogout /></>
        )}
        {profile.role === 'super_admin' && (
          <AutoRefresh intervalMs={60000} />
        )}
        <div className="print:block flex-1 flex flex-col min-w-0">
          {/* Desktop topbar */}
          <div className="print:hidden hidden lg:flex items-center gap-4 px-6 py-3 bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
            <div className="flex-1 max-w-sm">
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-400 border border-gray-100">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <span>Szukaj modułu, lokalu…</span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {profile.role === 'super_admin' && <SuperAdminRefreshTimer />}
              <NotificationBell initialUnread={unreadNotifications} />
              <div className="text-xs text-gray-400 hidden xl:block">
                {new Date().toLocaleDateString('pl-PL', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>
          <main className="print:p-0 print:overflow-visible flex-1 p-4 lg:p-6 overflow-auto pt-[72px] pb-20 lg:pt-6 lg:pb-6">
            {children}
          </main>
        </div>
        {/* <ChatWidget /> */}{/* AI chatbot — aktywuj po dodaniu ANTHROPIC_API_KEY */}
        {!profile.onboarded && <OnboardingTour role={profile.role} />}
      </div>
    </ToastProvider>
    </I18nProvider>
  )
}

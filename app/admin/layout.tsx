import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import SidebarNav from '@/components/SidebarNav'
import { ToastProvider } from '@/components/ToastContext'
import AutoRefresh from '@/components/AutoRefresh'
import ChatWidget from '@/components/ChatWidget'
import InactivityLogout from '@/components/InactivityLogout'

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

  // Liczba nieprzeczytanych aktywnych ogłoszeń
  let unreadCount = 0
  let pendingUsersCount = 0
  try {
    const now = new Date()

    // Pobierz tylko aktywne ogłoszenia (nie archiwalne) — filtruj po wspólnocie
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
    const activeIds = activeAnns.map((a: any) => a.id)

    const { data: readRows } = await admin
      .from('read_announcements')
      .select('announcement_id')
      .eq('user_id', user.id)
      .in('announcement_id', activeIds.length ? activeIds : ['00000000-0000-0000-0000-000000000000'])

    const readCount = (readRows ?? []).length
    unreadCount = Math.max(0, activeIds.length - readCount)
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

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-gray-950">
        <SidebarNav
          profile={profileWithCommunity}
          userEmail={user.email ?? ''}
          unreadAnnouncements={unreadCount}
          pendingUsers={pendingUsersCount}
        />
        {(profile.role === 'super_admin' || profile.role === 'admin') && (
          <><AutoRefresh intervalMs={60000} /><InactivityLogout /></>
        )}
        <main className="flex-1 p-4 lg:p-6 overflow-auto pt-[72px] lg:pt-6">
          {children}
        </main>
        {/* <ChatWidget /> */}{/* AI chatbot — aktywuj po dodaniu ANTHROPIC_API_KEY */}
      </div>
    </ToastProvider>
  )
}

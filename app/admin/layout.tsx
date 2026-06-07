import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import SidebarNav from '@/components/SidebarNav'
import { ToastProvider } from '@/components/ToastContext'
import AutoRefresh from '@/components/AutoRefresh'
import ChatWidget from '@/components/ChatWidget'

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

  // Liczba nieprzeczytanych ogłoszeń — bezpieczne pobieranie
  let unreadCount = 0
  try {
    const { count: total } = await admin
      .from('announcements')
      .select('id', { count: 'exact', head: true })

    const { data: readRows } = await admin
      .from('read_announcements')
      .select('announcement_id')
      .eq('user_id', user.id)

    const readCount = (readRows ?? []).length
    unreadCount = Math.max(0, (total ?? 0) - readCount)
  } catch {
    unreadCount = 0
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-gray-950">
        <SidebarNav
          profile={profileWithCommunity}
          userEmail={user.email ?? ''}
          unreadAnnouncements={unreadCount}
        />
        {(profile.role === 'super_admin' || profile.role === 'admin') && (
          <AutoRefresh intervalMs={60000} />
        )}
        <main className="flex-1 p-4 lg:p-6 overflow-auto pt-[72px] lg:pt-6">
          {children}
        </main>
        {/* <ChatWidget /> */}{/* AI chatbot — aktywuj po dodaniu ANTHROPIC_API_KEY */}
      </div>
    </ToastProvider>
  )
}

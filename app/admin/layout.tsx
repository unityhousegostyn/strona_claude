import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import SidebarNav from '@/components/SidebarNav'
import { ToastProvider } from '@/components/ToastContext'

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
  const { data: community } = profile.community_id
    ? await admin.from('communities').select('*').eq('id', profile.community_id).single()
    : { data: null }

  const profileWithCommunity = { ...profile, community }

  // Liczba nieprzeczytanych ogłoszeń
  const { data: readIds } = await admin
    .from('read_announcements')
    .select('announcement_id')
    .eq('user_id', user.id)

  const readAnnouncementIds = (readIds ?? []).map((r: any) => r.announcement_id)

  let unreadCount = 0
  if (readAnnouncementIds.length > 0) {
    const { count } = await admin
      .from('announcements')
      .select('id', { count: 'exact', head: true })
      .not('id', 'in', `(${readAnnouncementIds.map((id: string) => `'${id}'`).join(',')})`)
    unreadCount = count ?? 0
  } else {
    const { count } = await admin
      .from('announcements')
      .select('id', { count: 'exact', head: true })
    unreadCount = count ?? 0
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-gray-100">
        <SidebarNav profile={profileWithCommunity} userEmail={user.email ?? ''} unreadAnnouncements={unreadCount} />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </ToastProvider>
  )
}

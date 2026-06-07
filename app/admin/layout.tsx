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
    .select('*, community:communities(*)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Liczba nieprzeczytanych ogłoszeń
  const admin = getSupabaseAdminClient()
  const { count: unreadCount } = await admin
    .from('announcements')
    .select('id', { count: 'exact', head: true })
    .not('id', 'in', `(SELECT announcement_id FROM read_announcements WHERE user_id = '${user.id}')`)

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-gray-100">
        <SidebarNav profile={profile} userEmail={user.email ?? ''} unreadAnnouncements={unreadCount ?? 0} />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </ToastProvider>
  )
}

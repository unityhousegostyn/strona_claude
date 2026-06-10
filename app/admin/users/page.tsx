import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { redirect } from 'next/navigation'
import PendingUsers from './PendingUsers'
import AddUserForm from './AddUserForm'
import UsersClient from './UsersClient'

export default async function UsersPage() {
  // Auth check — anon client (RLS)
  const { user, profile } = await getAuthProfile()
  if (profile.role === 'user') redirect('/admin/dashboard')

  const isSuperAdmin = profile.role === 'super_admin'

  // Zapytania o innych użytkowników — admin client (omija RLS)
  const admin = getSupabaseAdminClient()

  const pendingQuery = admin
    .from('profiles')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (!isSuperAdmin) pendingQuery.eq('community_id', profile.community_id)

  const activeQuery = admin
    .from('profiles')
    .select('*, community:communities(name)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (!isSuperAdmin) activeQuery.eq('community_id', profile.community_id)

  const [{ data: pendingUsers }, { data: activeUsers }, { data: communities }] = await Promise.all([
    pendingQuery,
    activeQuery,
    isSuperAdmin
      ? admin.from('communities').select('*').order('name')
      : Promise.resolve({ data: [] }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-100">Użytkownicy</h2>
        <AddUserForm
          communities={communities ?? []}
          isSuperAdmin={isSuperAdmin}
          adminCommunityId={profile.community_id}
        />
      </div>

      <PendingUsers
        users={pendingUsers ?? []}
        communities={communities ?? []}
        isSuperAdmin={isSuperAdmin}
        adminCommunityId={profile.community_id}
      />

      <UsersClient users={activeUsers ?? []} isSuperAdmin={isSuperAdmin} />
    </div>
  )
}

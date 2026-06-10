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

  // Lokale do przypisania przy zatwierdzaniu
  const apartmentsQuery = admin
    .from('settlement_apartments')
    .select('id, number, community_id')
    .eq('active', true)
    .order('number')
  if (!isSuperAdmin && profile.community_id) apartmentsQuery.eq('community_id', profile.community_id)

  const [{ data: pendingUsers }, { data: activeUsers }, { data: communities }, { data: apartments }] = await Promise.all([
    pendingQuery,
    activeQuery,
    isSuperAdmin
      ? admin.from('communities').select('*').order('name')
      : admin.from('communities').select('id, name').eq('id', profile.community_id ?? ''),
    apartmentsQuery,
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
        apartments={apartments ?? []}
        isSuperAdmin={isSuperAdmin}
        adminCommunityId={profile.community_id}
      />

      <UsersClient users={activeUsers ?? []} isSuperAdmin={isSuperAdmin} />
    </div>
  )
}

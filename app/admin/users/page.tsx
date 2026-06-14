import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { redirect } from 'next/navigation'
import PendingUsers from './PendingUsers'
import AddUserForm from './AddUserForm'
import UsersClient from './UsersClient'
import InviteModal from './InviteModal'
import CopyRegisterLink from './CopyRegisterLink'

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

  const invitedQuery = admin
    .from('profiles')
    .select('*, community:communities(name)')
    .in('status', ['invited'])
    .order('created_at', { ascending: false })
  if (!isSuperAdmin) invitedQuery.eq('community_id', profile.community_id)

  // Lokale do przypisania przy zatwierdzaniu
  const apartmentsQuery = admin
    .from('settlement_apartments')
    .select('id, number, community_id')
    .eq('active', true)
    .order('number')
  if (!isSuperAdmin && profile.community_id) apartmentsQuery.eq('community_id', profile.community_id)

  const [{ data: pendingUsers }, { data: activeUsers }, { data: invitedUsers }, { data: communities }, { data: apartments }] = await Promise.all([
    pendingQuery,
    activeQuery,
    invitedQuery,
    isSuperAdmin
      ? admin.from('communities').select('*').order('name')
      : admin.from('communities').select('id, name').eq('id', profile.community_id ?? ''),
    apartmentsQuery,
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-[#ecfdf5]">Użytkownicy</h2>
        <div className="flex items-center gap-2">
          {profile.community_id && (
            <CopyRegisterLink communityId={profile.community_id} />
          )}
          <InviteModal
            communities={communities ?? []}
            isSuperAdmin={isSuperAdmin}
            adminCommunityId={profile.community_id}
          />
          <AddUserForm
            communities={communities ?? []}
            isSuperAdmin={isSuperAdmin}
            adminCommunityId={profile.community_id}
          />
        </div>
      </div>

      <PendingUsers
        users={pendingUsers ?? []}
        invitedUsers={invitedUsers ?? []}
        communities={communities ?? []}
        apartments={apartments ?? []}
        isSuperAdmin={isSuperAdmin}
        adminCommunityId={profile.community_id}
      />

      <UsersClient users={activeUsers ?? []} isSuperAdmin={isSuperAdmin} />
    </div>
  )
}

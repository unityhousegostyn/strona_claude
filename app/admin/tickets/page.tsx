import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import TicketsClient from './TicketsClient'

export default async function TicketsPage() {
  const { user, profile } = await getAuthProfile()
  const admin = getSupabaseAdminClient()

  let query = admin
    .from('tickets')
    .select('*, community:communities(name)')
    .order('created_at', { ascending: false })

  if (profile.role === 'user' || profile.role === 'admin' || profile.role === 'najemca') {
    query = query.eq('community_id', profile.community_id) as any
  }

  const { data: tickets, error } = await query

  let communities: { id: string; name: string }[] = []
  if (profile.role === 'super_admin') {
    const { data } = await admin.from('communities').select('id, name').order('name')
    communities = data ?? []
  } else if (profile.community_id) {
    const { data } = await admin.from('communities').select('id, name').eq('id', profile.community_id).single()
    if (data) communities = [data]
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm bg-red-950/30 border border-red-900 rounded-xl p-4">
        Błąd ładowania zgłoszeń: {error.message}
      </div>
    )
  }

  return (
    <TicketsClient
      tickets={tickets ?? []}
      communities={communities}
      userId={user.id}
      communityId={profile.community_id}
      isAdmin={profile.role === 'admin' || profile.role === 'super_admin'}
      isSuperAdmin={profile.role === 'super_admin'}
    />
  )
}

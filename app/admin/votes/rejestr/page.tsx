import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import RejestrClient from './RejestrClient'

export default async function RejestrPage() {
  const { user, profile } = await getAuthProfile()
  const admin = getSupabaseAdminClient()

  const communityId = profile.community_id
  const isSuperAdmin = profile.role === 'super_admin'

  let communities: { id: string; name: string }[] = []
  if (isSuperAdmin) {
    const { data } = await admin.from('communities').select('id, name').order('name')
    communities = data ?? []
  } else if (communityId) {
    const { data } = await admin.from('communities').select('id, name').eq('id', communityId).single()
    if (data) communities = [data]
  }

  const communityIds = communities.map(c => c.id)

  const { data: votes } = await admin
    .from('votes')
    .select(`
      id, title, status, voting_method, created_at, closed_at, deadline,
      resolution_number, community_id,
      community:communities(name),
      choices:vote_choices(choice, share_value, apartment_id, user_id)
    `)
    .in('community_id', communityIds.length ? communityIds : ['00000000-0000-0000-0000-000000000000'])
    .order('community_id', { ascending: true })
    .order('resolution_number', { ascending: true })

  // Pobierz liczbę aktywnych lokali per wspólnota
  const { data: apartments } = await admin
    .from('settlement_apartments')
    .select('id, community_id')
    .in('community_id', communityIds.length ? communityIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('active', true)

  const aptCountByCommunity: Record<string, number> = {}
  for (const a of apartments ?? []) {
    aptCountByCommunity[a.community_id] = (aptCountByCommunity[a.community_id] ?? 0) + 1
  }

  // Supabase zwraca relację community jako tablicę — normalizuj do obiektu
  const normalizedVotes = (votes ?? []).map(v => ({
    ...v,
    community: Array.isArray(v.community) ? (v.community[0] ?? null) : v.community,
  }))

  return (
    <RejestrClient
      votes={normalizedVotes as any}
      communities={communities}
      isSuperAdmin={isSuperAdmin}
      aptCountByCommunity={aptCountByCommunity}
    />
  )
}

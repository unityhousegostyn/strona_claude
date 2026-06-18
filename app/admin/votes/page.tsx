import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import VotesClient from './VotesClient'

export default async function VotesPage() {
  const { user, profile } = await getAuthProfile()
  if (profile.role === 'najemca') redirect('/admin/dashboard')
  const admin = getSupabaseAdminClient()

  const communityId = profile.community_id

  // super_admin widzi wszystkie wspólnoty
  let communities: { id: string; name: string }[] = []
  if (profile.role === 'super_admin') {
    const { data } = await admin.from('communities').select('id, name').order('name')
    communities = data ?? []
  } else if (communityId) {
    const { data } = await admin.from('communities').select('id, name').eq('id', communityId).single()
    if (data) communities = [data]
  }

  const communityIds = communities.map(c => c.id)

  const { data: votes } = await admin
    .from('votes')
    .select('*, community:communities(name), choices:vote_choices(choice, share_value, user_id, apartment_id)')
    .in('community_id', communityIds.length ? communityIds : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at', { ascending: false })

  const isSuperAdmin = profile.role === 'super_admin'
  const isAdmin = profile.role === 'admin' || isSuperAdmin

  // Oblicz następny numer uchwały dla domyślnej wspólnoty (do formularza tworzenia)
  const defaultCommunityId = communityId ?? communities[0]?.id ?? null
  let nextResolutionNumber = 1
  if (defaultCommunityId) {
    const currentYear = new Date().getFullYear()
    const { data: lastNum } = await admin
      .from('votes')
      .select('resolution_number')
      .eq('community_id', defaultCommunityId)
      .gte('created_at', `${currentYear}-01-01`)
      .order('resolution_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    nextResolutionNumber = ((lastNum as any)?.resolution_number ?? 0) + 1
  }

  const [pinRes, profileAptRes] = await Promise.all([
    admin.from('profiles').select('voting_pin_hash').eq('id', user.id).single(),
    admin.from('profiles').select('apartment_id').eq('id', user.id).single(),
  ])

  const hasPin = !!pinRes.data?.voting_pin_hash
  const userApartmentId: string | null = (profileAptRes.data as any)?.apartment_id ?? null

  return (
    <VotesClient
      votes={votes ?? []}
      communities={communities}
      userId={user.id}
      userApartmentId={userApartmentId}
      communityId={communityId ?? null}
      isAdmin={isAdmin}
      isSuperAdmin={isSuperAdmin}
      hasPin={hasPin}
      nextResolutionNumber={nextResolutionNumber}
    />
  )
}

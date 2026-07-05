'use server'

import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'

export interface ApartmentResult {
  id: string
  number: string
  owner_name: string
  community_id: string
  communityName: string
}

export async function searchApartments(query: string): Promise<ApartmentResult[]> {
  if (!query || query.trim().length < 2) return []
  if (query.trim().length > 100) return []

  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles').select('role, community_id').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) return []

  const admin = getSupabaseAdminClient()
  const q = query.trim().toLowerCase()

  let aptQuery = admin
    .from('settlement_apartments')
    .select('id, number, owner_name, community_id')
    .eq('active', true)

  if (profile.role === 'admin' && profile.community_id) {
    aptQuery = aptQuery.eq('community_id', profile.community_id)
  }

  // Szukaj po numerze lub nazwisku — Supabase ilike
  const { data: byNumber } = await aptQuery
    .ilike('number', `%${q}%`)
    .limit(5)

  const { data: byName } = await aptQuery
    .ilike('owner_name', `%${q}%`)
    .limit(5)

  const all = [...(byNumber ?? []), ...(byName ?? [])]
  const unique = all.filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i).slice(0, 8)

  // Pobierz nazwy wspólnot
  const communityIds = [...new Set(unique.map(a => a.community_id))]
  const { data: communities } = await admin
    .from('communities').select('id, name').in('id', communityIds)
  const communityMap: Record<string, string> = {}
  for (const c of communities ?? []) communityMap[c.id] = c.name

  return unique.map(a => ({
    id: a.id,
    number: a.number,
    owner_name: a.owner_name,
    community_id: a.community_id,
    communityName: communityMap[a.community_id] ?? '',
  }))
}

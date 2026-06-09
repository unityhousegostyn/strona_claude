import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import PrzychodyClient from './PrzychodyClient'
import { INCOME_CATEGORIES } from './income-categories'

export default async function PrzychodyPage() {
  const { profile } = await getAuthProfile()
  if (profile.role === 'user') redirect('/admin/dashboard')

  const admin = getSupabaseAdminClient()
  const isSuperAdmin = profile.role === 'super_admin'

  let communities: { id: string; name: string }[] = []
  if (isSuperAdmin) {
    const { data } = await admin.from('communities').select('id, name').order('name')
    communities = data ?? []
  } else if (profile.community_id) {
    const { data } = await admin.from('communities').select('id, name').eq('id', profile.community_id).single()
    if (data) communities = [data]
  }

  const communityIds = communities.map(c => c.id)
  const currentYear = new Date().getFullYear()

  const { data: incomeEntries } = await admin
    .from('community_income')
    .select('*')
    .in('community_id', communityIds.length ? communityIds : ['00000000-0000-0000-0000-000000000000'])
    .order('income_date', { ascending: false })

  const { data: entries } = await admin
    .from('settlement_entries')
    .select('paid, year, month, apartment:settlement_apartments!inner(community_id)')
    .gte('year', currentYear - 1)

  const settlementsMap: Record<string, Record<string, number>> = {}
  for (const e of entries ?? []) {
    const commId = (e.apartment as any)?.community_id
    if (!commId) continue
    settlementsMap[commId] = settlementsMap[commId] ?? {}
    settlementsMap[commId][`${e.year}:${e.month}`] = (settlementsMap[commId][`${e.year}:${e.month}`] ?? 0) + (e.paid ?? 0)
  }

  const commMap: Record<string, string> = {}
  for (const c of communities) commMap[c.id] = c.name

  return (
    <PrzychodyClient
      incomeEntries={incomeEntries ?? []}
      settlementsMap={settlementsMap}
      communities={communities}
      commMap={commMap}
      isSuperAdmin={isSuperAdmin}
      defaultCommunityId={profile.community_id ?? communities[0]?.id ?? ''}
      categories={INCOME_CATEGORIES}
      currentYear={currentYear}
    />
  )
}

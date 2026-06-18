import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import RaportyClient from './RaportyClient'

export default async function RaportyPage() {
  const { profile } = await getAuthProfile()
  if (profile.role === 'user' || profile.role === 'najemca') redirect('/admin/dashboard')

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
  const safeIds = communityIds.length ? communityIds : ['00000000-0000-0000-0000-000000000000']
  const currentYear = new Date().getFullYear()

  const [
    { data: apartments },
    { data: rates },
    { data: entries },
    { data: expenses },
    { data: communityIncome },
    { data: deposits },
  ] = await Promise.all([
    admin.from('settlement_apartments')
      .select('id, number, owner_name, area_m2, persons_count, has_meter, community_id, active')
      .in('community_id', safeIds)
      .eq('active', true)
      .order('number'),
    admin.from('settlement_rates')
      .select('*')
      .in('community_id', safeIds)
      .order('effective_from', { ascending: false }),
    admin.from('settlement_entries')
      .select('apartment_id, community_id, year, month, paid, water_m3, water_correction, notes')
      .in('community_id', safeIds),
    admin.from('community_expenses')
      .select('community_id, category, description, amount, expense_date, year, month, invoice_number')
      .in('community_id', safeIds),
    admin.from('community_income')
      .select('community_id, category, description, amount, income_date, year, month')
      .in('community_id', safeIds),
    admin.from('community_deposits')
      .select('community_id, type, bank_name, description, amount, interest_rate, start_date, end_date, status')
      .in('community_id', safeIds)
      .order('start_date', { ascending: false }),
  ])

  return (
    <RaportyClient
      communities={communities}
      apartments={apartments ?? []}
      rates={rates ?? []}
      entries={entries ?? []}
      expenses={expenses ?? []}
      communityIncome={communityIncome ?? []}
      deposits={deposits ?? []}
      isSuperAdmin={isSuperAdmin}
      defaultCommunityId={profile.community_id ?? communities[0]?.id ?? ''}
      currentYear={currentYear}
    />
  )
}

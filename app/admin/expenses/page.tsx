import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import ExpensesClient from './ExpensesClient'
import { EXPENSE_CATEGORIES } from './categories'

export default async function ExpensesPage() {
  const { profile } = await getAuthProfile()
  if (profile.role !== 'super_admin') redirect('/admin/dashboard')

  const admin = getSupabaseAdminClient()
  const isSuperAdmin = profile.role === 'super_admin'

  // Wspólnoty do wyboru
  let communities: { id: string; name: string }[] = []
  if (isSuperAdmin) {
    const { data } = await admin.from('communities').select('id, name').order('name')
    communities = data ?? []
  } else if (profile.community_id) {
    const { data } = await admin.from('communities').select('id, name').eq('id', profile.community_id).single()
    if (data) communities = [data]
  }

  const communityIds = communities.map(c => c.id)

  // Koszty — ostatnie 2 lata
  const currentYear = new Date().getFullYear()
  const { data: expenses } = await admin
    .from('community_expenses')
    .select('*')
    .in('community_id', communityIds.length ? communityIds : ['00000000-0000-0000-0000-000000000000'])
    .gte('year', currentYear - 1)
    .order('expense_date', { ascending: false })

  // Wpłaty mieszkańców dla porównania
  const { data: entries } = await admin
    .from('settlement_entries')
    .select('paid, year, month, apartment:settlement_apartments!inner(community_id)')
    .gte('year', currentYear - 1)

  // Sumuj wpłaty per community per year/month
  const incomeMap: Record<string, Record<string, number>> = {}
  for (const e of entries ?? []) {
    const commId = (e.apartment as any)?.community_id
    if (!commId) continue
    const key = `${commId}:${e.year}:${e.month}`
    incomeMap[commId] = incomeMap[commId] ?? {}
    incomeMap[commId][`${e.year}:${e.month}`] = (incomeMap[commId][`${e.year}:${e.month}`] ?? 0) + (e.paid ?? 0)
  }

  const commMap: Record<string, string> = {}
  for (const c of communities) commMap[c.id] = c.name

  return (
    <ExpensesClient
      expenses={expenses ?? []}
      communities={communities}
      commMap={commMap}
      incomeMap={incomeMap}
      isSuperAdmin={isSuperAdmin}
      defaultCommunityId={profile.community_id ?? communities[0]?.id ?? ''}
      categories={EXPENSE_CATEGORIES}
      currentYear={currentYear}
    />
  )
}

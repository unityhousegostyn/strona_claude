import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { getBudget, getAvailableYears } from './actions'
import BudzetClient from './BudzetClient'

export default async function BudzetPage() {
  const { profile } = await getAuthProfile()
  if (!['super_admin', 'admin'].includes(profile.role)) redirect('/admin/dashboard')

  const admin = getSupabaseAdminClient()
  const { data: communities } = await admin
    .from('communities')
    .select('id, name')
    .order('name')

  const firstId = communities?.[0]?.id ?? ''
  const currentYear = new Date().getFullYear()

  const [budgetResult, years] = await Promise.all([
    getBudget(firstId, currentYear),
    getAvailableYears(firstId),
  ])

  return (
    <BudzetClient
      communities={communities ?? []}
      initialBudget={budgetResult.data}
      initialYears={years}
      isSuperAdmin={profile.role === 'super_admin'}
    />
  )
}

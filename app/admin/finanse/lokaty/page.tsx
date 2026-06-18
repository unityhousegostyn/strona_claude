import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import LokatyClient from './LokatyClient'

export default async function LokatyPage() {
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
  const { data: deposits } = await admin
    .from('community_deposits')
    .select('*')
    .in('community_id', communityIds.length ? communityIds : ['00000000-0000-0000-0000-000000000000'])
    .order('start_date', { ascending: false })

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-[#f0fdfa]">Lokaty i konta oszczędnościowe</h2>
        <p className="text-sm text-[#115e59] mt-1">Zarządzaj środkami ulokowanymi w bankach — lokaty terminowe i konta oszczędnościowe</p>
      </div>
      <LokatyClient
        communities={communities}
        initialDeposits={(deposits ?? []) as any}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  )
}

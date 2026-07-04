import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { getYearClosures } from './actions'
import ZamkniecieClient from './ZamkniecieClient'

export default async function ZamkniecieRokuPage({
  searchParams,
}: {
  searchParams: Promise<{ communityId?: string }>
}) {
  const { profile } = await getAuthProfile()
  if (!['super_admin', 'admin'].includes(profile.role)) redirect('/admin/dashboard')

  const sp = await searchParams
  const admin = getSupabaseAdminClient()

  const { data: communities } = await admin.from('communities').select('id, name').order('name')
  const available = profile.role === 'admin'
    ? (communities ?? []).filter(c => c.id === profile.community_id)
    : (communities ?? [])

  const communityId = sp.communityId ?? available[0]?.id ?? ''
  if (!communityId) redirect('/admin/finanse')

  if (profile.role === 'admin' && profile.community_id !== communityId) redirect('/admin/finanse')

  const communityName = available.find(c => c.id === communityId)?.name ?? ''
  const closures = await getYearClosures(communityId)
  const currentYear = new Date().getFullYear()

  return (
    <ZamkniecieClient
      communityId={communityId}
      communityName={communityName}
      closures={closures}
      currentYear={currentYear}
      isSuperAdmin={profile.role === 'super_admin'}
    />
  )
}

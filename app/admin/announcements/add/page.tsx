import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AnnouncementForm from './AnnouncementForm'

export default async function AddAnnouncementPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role === 'user') redirect('/admin/dashboard')

  const isSuperAdmin = profile.role === 'super_admin'

  const admin = getSupabaseAdminClient()
  const { data: communities } = isSuperAdmin
    ? await admin.from('communities').select('id, name').order('name')
    : { data: [] }

  return (
    <AnnouncementForm
      isSuperAdmin={isSuperAdmin}
      adminCommunityId={profile.community_id}
      communities={communities ?? []}
    />
  )
}

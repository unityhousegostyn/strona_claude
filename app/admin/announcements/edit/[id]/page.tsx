import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EditAnnouncementForm from './EditAnnouncementForm'

export default async function EditAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role === 'user') redirect('/admin/dashboard')

  const admin = getSupabaseAdminClient()

  const { data: announcement } = await admin
    .from('announcements')
    .select('*')
    .eq('id', id)
    .single()

  if (!announcement) redirect('/admin/announcements')

  // Pobierz listę wspólnot dla target=selected
  const { data: junctionRows } = await admin
    .from('announcement_communities')
    .select('community_id')
    .eq('announcement_id', id)

  const selectedCommunityIds = (junctionRows ?? []).map((r: any) => r.community_id)

  const isSuperAdmin = profile.role === 'super_admin'
  const { data: communities } = isSuperAdmin
    ? await admin.from('communities').select('id, name').order('name')
    : { data: [] }

  return (
    <EditAnnouncementForm
      announcement={announcement}
      selectedCommunityIds={selectedCommunityIds}
      isSuperAdmin={isSuperAdmin}
      adminCommunityId={profile.community_id}
      communities={communities ?? []}
    />
  )
}

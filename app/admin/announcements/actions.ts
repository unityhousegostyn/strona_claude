'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient, getSupabaseServerClient } from '@/lib/supabase/server'

export async function createAnnouncement(formData: {
  title: string
  content: string
  start_date: string
  end_date: string
  target: 'all' | 'one' | 'selected'
  community_id: string | null
  community_ids: string[]
}) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Brak autoryzacji')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, community_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role === 'user') throw new Error('Brak uprawnień')

  // Admin może dodawać ogłoszenia tylko do swojej wspólnoty
  if (profile.role === 'admin') {
    if (formData.target !== 'one' || formData.community_id !== profile.community_id) {
      throw new Error('Admin może dodawać ogłoszenia tylko do swojej wspólnoty')
    }
  }

  const admin = getSupabaseAdminClient()

  const { data: announcement, error } = await admin
    .from('announcements')
    .insert({
      title: formData.title,
      content: formData.content,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      target: formData.target,
      community_id: formData.target === 'one' ? formData.community_id : null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  if (formData.target === 'selected' && formData.community_ids.length > 0) {
    const rows = formData.community_ids.map((cid) => ({
      announcement_id: announcement.id,
      community_id: cid,
    }))
    const { error: junctionError } = await admin
      .from('announcement_communities')
      .insert(rows)
    if (junctionError) throw new Error(junctionError.message)
  }

  revalidatePath('/admin/announcements')
}

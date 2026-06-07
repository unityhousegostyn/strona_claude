'use server'

import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'

export async function markAsRead(announcementId: string) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = getSupabaseAdminClient()
  await admin
    .from('read_announcements')
    .upsert({ user_id: user.id, announcement_id: announcementId }, { onConflict: 'user_id,announcement_id' })
}

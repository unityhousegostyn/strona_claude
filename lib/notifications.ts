/**
 * Helper do tworzenia powiadomień in-app.
 * Używa adminClient — bezpieczne po stronie serwera (Server Actions).
 */
import { getSupabaseAdminClient } from '@/lib/supabase/server'

export interface CreateNotificationInput {
  user_id: string
  community_id?: string | null
  type: 'new_ticket' | 'ticket_status' | 'ticket_comment' | 'new_announcement'
  title: string
  body?: string
  link?: string
}

/** Wyślij jedno powiadomienie */
export async function createNotification(input: CreateNotificationInput) {
  const admin = getSupabaseAdminClient()
  await admin.from('notifications').insert({
    user_id:      input.user_id,
    community_id: input.community_id ?? null,
    type:         input.type,
    title:        input.title,
    body:         input.body ?? null,
    link:         input.link ?? null,
  })
}

/** Wyślij powiadomienie do wielu użytkowników naraz */
export async function createNotificationForMany(
  userIds: string[],
  input: Omit<CreateNotificationInput, 'user_id'>
) {
  if (!userIds.length) return
  const admin = getSupabaseAdminClient()
  await admin.from('notifications').insert(
    userIds.map(uid => ({
      user_id:      uid,
      community_id: input.community_id ?? null,
      type:         input.type,
      title:        input.title,
      body:         input.body ?? null,
      link:         input.link ?? null,
    }))
  )
}

/**
 * Pobierz IDs adminów/super_adminów danej wspólnoty
 * (do powiadamiania przy nowym zgłoszeniu od mieszkańca)
 */
export async function getAdminUserIds(communityId: string): Promise<string[]> {
  const admin = getSupabaseAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('status', 'active')
    .or(`role.eq.super_admin,and(role.eq.admin,community_id.eq.${communityId})`)
  return (data ?? []).map((p: { id: string }) => p.id)
}

/**
 * Pobierz IDs wszystkich aktywnych mieszkańców wspólnoty
 * (do powiadamiania o nowym ogłoszeniu)
 */
export async function getCommunityUserIds(communityId: string): Promise<string[]> {
  const admin = getSupabaseAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('community_id', communityId)
    .eq('status', 'active')
  return (data ?? []).map((p: { id: string }) => p.id)
}

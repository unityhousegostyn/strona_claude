'use server'
import { revalidatePath } from 'next/cache'
import { getAuthProfileAction } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'

export interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read: boolean
  created_at: string
}

/** Pobierz ostatnie 30 powiadomień bieżącego usera */
export async function fetchNotifications(): Promise<{ data: Notification[]; unread: number }> {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) return { data: [], unread: 0 }

  const admin = getSupabaseAdminClient()
  const { data } = await admin
    .from('notifications')
    .select('id,type,title,body,link,read,created_at')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  const notifications = (data ?? []) as Notification[]
  const unread = notifications.filter(n => !n.read).length
  return { data: notifications, unread }
}

/** Oznacz jedno powiadomienie jako przeczytane */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) return

  const admin = getSupabaseAdminClient()
  await admin
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', auth.user.id)
}

/** Oznacz wszystkie jako przeczytane */
export async function markAllNotificationsRead(): Promise<void> {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) return

  const admin = getSupabaseAdminClient()
  await admin
    .from('notifications')
    .update({ read: true })
    .eq('user_id', auth.user.id)
    .eq('read', false)

  revalidatePath('/admin', 'layout')
}

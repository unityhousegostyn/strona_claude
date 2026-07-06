'use server'

import { getSupabaseServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/audit'
import { headers } from 'next/headers'

/**
 * Zapisuje wpis w audit logu po pomyślnym zalogowaniu.
 * WAŻNE: Musi być wywoływane z await — fire-and-forget powoduje anulowanie
 * requestu przez przeglądarkę przed zapisem do bazy.
 */
export async function recordLogin() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? hdrs.get('x-real-ip')
    ?? 'unknown'
  const ua = hdrs.get('user-agent') ?? 'unknown'

  await logActivity({
    userId: user.id,
    action: 'login',
    meta: { ip, ua: ua.slice(0, 200) },
  })
}

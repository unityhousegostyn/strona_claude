'use server'

import { getSupabaseAdminClient, getSupabaseServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/audit'
import { headers } from 'next/headers'

/**
 * Zapisuje wpis w audit logu po pomyślnym zalogowaniu.
 *
 * Przyjmuje opcjonalny accessToken — jeśli podany, weryfikuje go przez admin
 * client (niezależne od cookie session). Fallback: cookie session.
 *
 * WAŻNE: Musi być wywoływane z await — fire-and-forget powoduje anulowanie
 * requestu przez przeglądarkę przed zapisem do bazy.
 */
export async function recordLogin(accessToken?: string) {
  let userId: string | undefined

  // Preferowana ścieżka: weryfikacja tokenu przez admin client (nie zależy od cookie)
  if (accessToken && typeof accessToken === 'string' && accessToken.length > 0) {
    const admin = getSupabaseAdminClient()
    const { data: { user } } = await admin.auth.getUser(accessToken)
    userId = user?.id
  }

  // Fallback: cookie session (działa gdy accessToken niedostępny)
  if (!userId) {
    const supabase = await getSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id
  }

  if (!userId) return

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? hdrs.get('x-real-ip')
    ?? 'unknown'
  const ua = hdrs.get('user-agent') ?? 'unknown'

  await logActivity({
    userId,
    action: 'login',
    meta: { ip, ua: ua.slice(0, 200) },
  })
}

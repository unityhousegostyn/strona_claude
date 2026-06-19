'use server'

import { getSupabaseServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/audit'

/**
 * Zapisuje wpis w audit logu po pomyślnym zalogowaniu.
 * Wywoływane z klienta (app/login/page.tsx, app/mfa-verify/page.tsx) zaraz po
 * tym, jak Supabase Auth potwierdzi sesję — dzięki @supabase/ssr cookie sesji
 * jest już ustawione, więc ten server action widzi zalogowanego użytkownika.
 */
export async function recordLogin() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await logActivity({ userId: user.id, action: 'login' })
}

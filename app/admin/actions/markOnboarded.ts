'use server'

import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function markOnboarded() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('profiles').update({ onboarded: true }).eq('id', user.id)
}

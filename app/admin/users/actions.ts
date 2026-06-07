'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient } from '@/lib/supabase/server'

export async function approveUser(userId: string, communityId: string) {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'active', community_id: communityId })
    .eq('id', userId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

export async function rejectUser(userId: string) {
  const supabase = getSupabaseAdminClient()
  // Usuń profil i konto auth
  await supabase.from('profiles').delete().eq('id', userId)
  await supabase.auth.admin.deleteUser(userId)
  revalidatePath('/admin/users')
}

'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient, getSupabaseServerClient } from '@/lib/supabase/server'

async function requireAdminOrSuperAdmin() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Brak autoryzacji')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, community_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role === 'user') throw new Error('Brak uprawnień')
  return { user, profile }
}

export async function approveUser(userId: string, communityId: string) {
  const { profile } = await requireAdminOrSuperAdmin()

  // Admin może zatwierdzać tylko do swojej wspólnoty
  if (profile.role === 'admin' && communityId !== profile.community_id) {
    throw new Error('Brak uprawnień do tej wspólnoty')
  }

  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ status: 'active', community_id: communityId })
    .eq('id', userId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

export async function rejectUser(userId: string) {
  const { profile } = await requireAdminOrSuperAdmin()

  const admin = getSupabaseAdminClient()

  // Admin może odrzucać tylko użytkowników ze swojej wspólnoty (lub pending bez wspólnoty)
  if (profile.role === 'admin') {
    const { data: target } = await admin.from('profiles').select('community_id').eq('id', userId).single()
    if (target?.community_id && target.community_id !== profile.community_id) {
      throw new Error('Brak uprawnień do tego użytkownika')
    }
  }

  await admin.from('profiles').delete().eq('id', userId)
  await admin.auth.admin.deleteUser(userId)
  revalidatePath('/admin/users')
}

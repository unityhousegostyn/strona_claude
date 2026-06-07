'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient, getSupabaseServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/audit'
import { sendAccountApprovedEmail } from '@/lib/email'

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
  const { user, profile } = await requireAdminOrSuperAdmin()

  if (profile.role === 'admin' && communityId !== profile.community_id) {
    throw new Error('Brak uprawnień do tej wspólnoty')
  }

  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ status: 'active', community_id: communityId })
    .eq('id', userId)

  if (error) throw new Error(error.message)
  await logActivity({ userId: user.id, action: 'approve_user', targetType: 'user', targetId: userId, meta: { communityId } })

  // Wyślij email do zaakceptowanego użytkownika
  const { data: approvedUser } = await admin.from('profiles').select('email').eq('id', userId).single()
  const { data: community } = await admin.from('communities').select('name').eq('id', communityId).single()
  if (approvedUser?.email) {
    await sendAccountApprovedEmail({ to: approvedUser.email, communityName: community?.name ?? '' }).catch(() => {})
  }

  revalidatePath('/admin/users')
}

export async function rejectUser(userId: string) {
  const { user, profile } = await requireAdminOrSuperAdmin()

  const admin = getSupabaseAdminClient()

  if (profile.role === 'admin') {
    const { data: target } = await admin.from('profiles').select('community_id').eq('id', userId).single()
    if (target?.community_id && target.community_id !== profile.community_id) {
      throw new Error('Brak uprawnień do tego użytkownika')
    }
  }

  await logActivity({ userId: user.id, action: 'reject_user', targetType: 'user', targetId: userId })
  await admin.from('profiles').delete().eq('id', userId)
  await admin.auth.admin.deleteUser(userId)
  revalidatePath('/admin/users')
}

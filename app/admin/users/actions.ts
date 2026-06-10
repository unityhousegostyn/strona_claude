'use server'
import { getAuthProfileAction } from '@/lib/getAuthProfile'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/audit'
import { sendAccountApprovedEmail } from '@/lib/email'

async function requireAdminOrSuperAdmin() {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) throw new Error(auth.error)
  if (auth.profile.role === 'user') throw new Error('Brak uprawnień')
  return { user: auth.user, profile: auth.profile }
}

export async function approveUser(userId: string, communityId: string, apartmentId?: string | null): Promise<{ error?: string }> {
  try {
    const { user, profile } = await requireAdminOrSuperAdmin()

    if (profile.role === 'admin' && communityId !== profile.community_id) {
      return { error: 'Brak uprawnień do tej wspólnoty' }
    }

    const admin = getSupabaseAdminClient()
    const { error } = await admin
      .from('profiles')
      .update({ status: 'active', community_id: communityId })
      .eq('id', userId)

    if (error) return { error: error.message }

    // Przypisz lokal jeśli podano
    if (apartmentId) {
      await admin.from('settlement_apartments').update({ owner_id: null }).eq('owner_id', userId)
      const { error: aptError } = await admin
        .from('settlement_apartments')
        .update({ owner_id: userId })
        .eq('id', apartmentId)
      if (aptError) return { error: 'Błąd przypisywania mieszkania: ' + aptError.message }
    }

    await logActivity({ userId: user.id, action: 'approve_user', targetType: 'user', targetId: userId, meta: { communityId, apartmentId } })

    // Wyślij email do zaakceptowanego użytkownika
    const { data: approvedUser } = await admin.from('profiles').select('email').eq('id', userId).single()
    const { data: community } = await admin.from('communities').select('name').eq('id', communityId).single()
    if (approvedUser?.email) {
      await sendAccountApprovedEmail({ to: approvedUser.email, communityName: community?.name ?? '' }).catch(() => {})
    }

    revalidatePath('/admin/users')
    revalidatePath('/admin/settlements')
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

export async function addUser(data: {
  email: string
  full_name: string
  password: string
  role: 'user' | 'admin'
  community_id: string
}): Promise<{ error?: string }> {
  try {
    const { user: actor, profile: actorProfile } = await requireAdminOrSuperAdmin()

    if (actorProfile.role === 'admin') {
      if (data.community_id !== actorProfile.community_id) return { error: 'Brak uprawnień do tej wspólnoty' }
      if (data.role !== 'user') return { error: 'Administrator może dodawać tylko mieszkańców' }
    }

    const admin = getSupabaseAdminClient()

    const { data: created, error: authError } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    })
    if (authError) return { error: authError.message }

    const { error: profileError } = await admin.from('profiles').upsert({
      id: created.user.id,
      full_name: data.full_name,
      role: data.role,
      community_id: data.community_id,
      status: 'active',
    })
    if (profileError) return { error: profileError.message }

    await logActivity({ userId: actor.id, action: 'create_user', targetType: 'user', targetId: created.user.id })
    revalidatePath('/admin/users')
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
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

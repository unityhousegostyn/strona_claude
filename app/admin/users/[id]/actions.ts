'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient, getSupabaseServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/audit'
import { sendPasswordResetEmail } from '@/lib/email'

async function requireSuperAdmin() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Brak autoryzacji')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') throw new Error('Tylko super_admin może edytować użytkowników')
  return { user, profile }
}

export async function updateUser(userId: string, data: {
  full_name: string
  role: string
  community_id: string | null
}) {
  const { user } = await requireSuperAdmin()

  const full_name = data.full_name.trim()
  if (full_name && (full_name.length < 2 || full_name.length > 100)) {
    throw new Error('Imię i nazwisko musi mieć 2–100 znaków')
  }
  if (!['user', 'najemca', 'admin', 'super_admin'].includes(data.role)) {
    throw new Error('Nieprawidłowa rola')
  }
  // super_admin nie może mieć community_id
  const community_id = data.role === 'super_admin' ? null : data.community_id

  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ full_name: full_name || null, role: data.role, community_id })
    .eq('id', userId)

  if (error) throw new Error('Błąd podczas zapisywania')
  await logActivity({ userId: user.id, action: 'update_user', targetType: 'user', targetId: userId, meta: { role: data.role } })
  revalidatePath('/admin/users')
}

export async function deactivateUser(userId: string) {
  const { user } = await requireSuperAdmin()

  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ status: 'pending' })
    .eq('id', userId)

  if (error) throw new Error('Błąd podczas dezaktywacji')
  await logActivity({ userId: user.id, action: 'deactivate_user', targetType: 'user', targetId: userId })
  revalidatePath('/admin/users')
}

export async function assignApartment(userId: string, apartmentId: string | null) {
  await requireSuperAdmin()
  const admin = getSupabaseAdminClient()
  // Zapisz apartment_id bezpośrednio w profiles (wiele użytkowników może być w tym samym lokalu)
  const { error } = await admin
    .from('profiles')
    .update({ apartment_id: apartmentId })
    .eq('id', userId)
  if (error) throw new Error('Błąd podczas przypisywania mieszkania')
  revalidatePath('/admin/users')
  revalidatePath('/admin/settlements')
}

export async function sendPasswordResetLink(userId: string): Promise<{ error?: string; sent?: boolean }> {
  const supabase = await getSupabaseServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { error: 'Brak autoryzacji' }

  const { data: callerProfile } = await supabase.from('profiles').select('role, community_id').eq('id', caller.id).single()
  if (!callerProfile || !['admin', 'super_admin'].includes(callerProfile.role)) return { error: 'Brak uprawnień' }

  const admin = getSupabaseAdminClient()

  // Admin może resetować tylko w swojej wspólnocie
  if (callerProfile.role === 'admin') {
    const { data: targetProfile } = await admin.from('profiles').select('community_id').eq('id', userId).single()
    if (!targetProfile || targetProfile.community_id !== callerProfile.community_id) return { error: 'Brak uprawnień do tego użytkownika' }
  }

  const { data: userData } = await admin.auth.admin.getUserById(userId)
  if (!userData.user?.email) return { error: 'Brak adresu email użytkownika' }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: userData.user.email,
  })

  if (linkError || !linkData?.properties?.action_link) {
    return { error: 'Błąd generowania linku resetowania: ' + (linkError?.message ?? 'nieznany błąd') }
  }

  await sendPasswordResetEmail({ to: userData.user.email, resetUrl: linkData.properties.action_link })
  await logActivity({ userId: caller.id, action: 'reset_user_password', targetType: 'user', targetId: userId })
  return { sent: true }
}

export async function deleteUserPermanently(userId: string) {
  const { user } = await requireSuperAdmin()

  // Nie możesz usunąć samego siebie
  if (userId === user.id) throw new Error('Nie możesz usunąć własnego konta')

  const admin = getSupabaseAdminClient()
  await logActivity({ userId: user.id, action: 'delete_user', targetType: 'user', targetId: userId })
  await admin.from('profiles').delete().eq('id', userId)
  await admin.auth.admin.deleteUser(userId)
  revalidatePath('/admin/users')
}

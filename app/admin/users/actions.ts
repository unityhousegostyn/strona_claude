'use server'
import { getAuthProfileAction } from '@/lib/getAuthProfile'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/audit'
import { sendAccountApprovedEmail, sendInvitationEmail } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

async function requireAdminOrSuperAdmin() {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) throw new Error(auth.error)
  if (auth.profile.role === 'user' || auth.profile.role === 'najemca') throw new Error('Brak uprawnień')
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

    // Przypisz lokal jeśli podano — lokal MUSI należeć do wspólnoty, do której
    // przypisujemy użytkownika, inaczej admin mógłby (podając cudzy apartmentId)
    // przejąć własność mieszkania nalężącego do innej wspólnoty.
    if (apartmentId) {
      const { data: targetApt } = await admin.from('settlement_apartments').select('community_id').eq('id', apartmentId).single()
      if (!targetApt) return { error: 'Mieszkanie nie istnieje' }
      if (targetApt.community_id !== communityId) return { error: 'Mieszkanie nie należy do tej wspólnoty' }

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
  role: 'user' | 'najemca' | 'admin' | 'super_admin'
  community_id: string
  apartment_id?: string | null
}): Promise<{ error?: string }> {
  try {
    const { user: actor, profile: actorProfile } = await requireAdminOrSuperAdmin()

    // Runtime allowlist — TypeScript nie chroni Server Actions przed arbitralną wartością z sieci
    const VALID_ROLES = ['user', 'najemca', 'admin', 'super_admin'] as const
    if (!VALID_ROLES.includes(data.role as any)) return { error: 'Nieprawidłowa rola' }

    if (actorProfile.role === 'admin') {
      if (data.community_id !== actorProfile.community_id) return { error: 'Brak uprawnień do tej wspólnoty' }
      if (data.role !== 'user') return { error: 'Administrator może dodawać tylko mieszkańców' }
    }
    // Tylko super_admin może tworzyć konta super_admin
    if (data.role === 'super_admin' && actorProfile.role !== 'super_admin') {
      return { error: 'Tylko Super Admin może tworzyć konta Super Admin' }
    }
    // Walidacja emaila — Supabase może zaakceptować nieprawidłowy email; sprawdzamy tu
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      return { error: 'Nieprawidłowy adres email' }
    }
    if (data.email.trim().length > 200) {
      return { error: 'Email może mieć maksymalnie 200 znaków' }
    }
    // Walidacja hasła — bcrypt ma limit 72 bajtów; bardzo długie hasła mogą powodować DoS
    if (!data.password || data.password.length < 8 || data.password.length > 128) {
      return { error: 'Hasło musi mieć 8–128 znaków' }
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
      community_id: data.role === 'super_admin' ? null : data.community_id,
      apartment_id: data.apartment_id || null,
      status: 'active',
    })
    if (profileError) return { error: profileError.message }

    await logActivity({ userId: actor.id, action: 'create_user', targetType: 'user', targetId: created.user.id, meta: { apartment_id: data.apartment_id } })
    revalidatePath('/admin/users')
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

export async function sendInvitation(data: {
  email: string
  full_name?: string
  apartment_number?: string
  community_id: string
}): Promise<{ error?: string }> {
  try {
    const { user: actor, profile: actorProfile } = await requireAdminOrSuperAdmin()

    if (actorProfile.role === 'admin') {
      if (data.community_id !== actorProfile.community_id) return { error: 'Brak uprawnień do tej wspólnoty' }
    }

    const emailTrimmed = data.email.trim().toLowerCase()
    if (!emailTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      return { error: 'Nieprawidłowy adres email' }
    }

    const admin = getSupabaseAdminClient()

    // Sprawdź czy użytkownik już istnieje
    const { data: existing } = await admin.from('profiles').select('id, status').eq('email', emailTrimmed).maybeSingle()
    if (existing) return { error: 'Użytkownik z tym adresem email już istnieje w systemie' }

    // Usuń stare, nieużyte zaproszenia na ten email w tej wspólnocie
    await admin.from('invitations')
      .delete()
      .eq('email', emailTrimmed)
      .eq('community_id', data.community_id)
      .is('used_at', null)

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dni

    const { data: inv, error: invError } = await admin.from('invitations').insert({
      email: emailTrimmed,
      full_name: data.full_name?.trim() || null,
      apartment_number: data.apartment_number?.trim() || null,
      community_id: data.community_id,
      invited_by: actor.id,
      expires_at: expiresAt.toISOString(),
    }).select('token').single()

    if (invError || !inv) return { error: invError?.message ?? 'Błąd tworzenia zaproszenia' }

    const { data: community } = await admin.from('communities').select('name').eq('id', data.community_id).single()

    const inviteUrl = `${APP_URL}/register?token=${inv.token}`

    await sendInvitationEmail({
      to: emailTrimmed,
      communityName: community?.name ?? 'Wspólnota',
      inviteUrl,
      fullName: data.full_name?.trim() || undefined,
      expiresAt,
    })

    await logActivity({ userId: actor.id, action: 'send_invitation', targetType: 'user', meta: { email: emailTrimmed, community_id: data.community_id } })
    revalidatePath('/admin/users')
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

export async function sendBulkInvitations(data: {
  contacts: { email: string; full_name?: string }[]
  community_id: string
}): Promise<{ sent: number; skipped: { email: string; reason: string }[] }> {
  const { user: actor, profile: actorProfile } = await requireAdminOrSuperAdmin()

  if (actorProfile.role === 'admin') {
    if (data.community_id !== actorProfile.community_id) throw new Error('Brak uprawnień do tej wspólnoty')
  }

  // Limit anty-spam — bez tego można zakolejkować wysyłkę tysięcy emaili
  if (!data.contacts.length) throw new Error('Brak kontaktów')
  if (data.contacts.length > 500) throw new Error('Za dużo kontaktów (max 500)')

  const admin = getSupabaseAdminClient()

  const { data: community } = await admin.from('communities').select('name').eq('id', data.community_id).single()
  const communityName = community?.name ?? 'Wspólnota'
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  // Pobierz istniejące emaile (profile + aktywne zaproszenia)
  const emails = data.contacts.map(c => c.email.trim().toLowerCase()).filter(Boolean)
  const { data: existingProfiles } = await admin.from('profiles').select('email').in('email', emails)
  const { data: existingInvites } = await admin.from('invitations')
    .select('email').in('email', emails).is('used_at', null).gt('expires_at', new Date().toISOString())

  const existingSet = new Set([
    ...(existingProfiles ?? []).map((p: any) => p.email),
    ...(existingInvites ?? []).map((i: any) => i.email),
  ])

  const skipped: { email: string; reason: string }[] = []
  const toInvite: typeof data.contacts = []

  for (const c of data.contacts) {
    const email = c.email.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skipped.push({ email: c.email, reason: 'Nieprawidłowy adres' })
      continue
    }
    if (existingSet.has(email)) {
      skipped.push({ email, reason: 'Już istnieje' })
      continue
    }
    toInvite.push({ ...c, email })
  }

  if (toInvite.length === 0) return { sent: 0, skipped }

  // Batch insert zaproszeń
  const rows = toInvite.map(c => ({
    email: c.email,
    full_name: c.full_name?.trim() || null,
    community_id: data.community_id,
    invited_by: actor.id,
    expires_at: expiresAt.toISOString(),
  }))

  const { data: inserted, error } = await admin.from('invitations').insert(rows).select('token, email, full_name')
  if (error) throw new Error('Błąd zapisu zaproszeń: ' + error.message)

  // Wysyłaj emaile (fire-and-forget per email, żeby nie blokować na wolnym SMTP)
  let sent = 0
  for (const inv of inserted ?? []) {
    try {
      await sendInvitationEmail({
        to: inv.email,
        communityName,
        inviteUrl: `${APP_URL}/register?token=${inv.token}`,
        fullName: inv.full_name ?? undefined,
        expiresAt,
      })
      sent++
    } catch {
      skipped.push({ email: inv.email, reason: 'Błąd wysyłki' })
    }
  }

  await logActivity({ userId: actor.id, action: 'send_bulk_invitations', targetType: 'user', meta: { count: sent, community_id: data.community_id } })
  revalidatePath('/admin/users')
  return { sent, skipped }
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

export async function activateInvitedUser(userId: string): Promise<{ error?: string }> {
  try {
    const { user: actor, profile: actorProfile } = await requireAdminOrSuperAdmin()
    const admin = getSupabaseAdminClient()

    const { data: target } = await admin.from('profiles').select('community_id, status').eq('id', userId).single()
    if (!target) return { error: 'Użytkownik nie istnieje' }
    if (target.status !== 'invited') return { error: 'Użytkownik nie ma statusu invited' }

    if (actorProfile.role === 'admin' && target.community_id !== actorProfile.community_id) {
      return { error: 'Brak uprawnień do tej wspólnoty' }
    }

    await admin.from('profiles').update({ status: 'active' }).eq('id', userId)
    await logActivity({ userId: actor.id, action: 'activate_invited_user', targetType: 'user', targetId: userId })
    revalidatePath('/admin/users')
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

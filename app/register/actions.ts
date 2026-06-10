'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { RegisterSchema } from './schema'
import { sendEmailVerification } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function getInvitation(token: string) {
  if (!token) return null
  const admin = getSupabaseAdminClient()
  const { data } = await admin
    .from('invitations')
    .select('email, full_name, apartment_number, community_id, expires_at, used_at, communities(name)')
    .eq('token', token)
    .maybeSingle()
  if (!data) return null
  if (data.used_at) return { error: 'expired' as const }
  if (new Date(data.expires_at) < new Date()) return { error: 'expired' as const }
  return {
    email: data.email,
    full_name: data.full_name as string | null,
    apartment_number: data.apartment_number as string | null,
    community_id: data.community_id as string,
    community_name: (data.communities as any)?.name ?? '',
  }
}

export async function registerUser(formData: FormData) {
  const token = formData.get('invite_token') as string | null

  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
    full_name: formData.get('full_name'),
  }

  const parsed = RegisterSchema.safeParse(rawData)
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message }
  }

  const { email, password, full_name } = parsed.data
  const admin = getSupabaseAdminClient()

  // Weryfikacja tokenu zaproszenia (jeśli podany)
  let invitation: { community_id: string; token: string } | null = null
  if (token) {
    const { data: inv } = await admin
      .from('invitations')
      .select('email, community_id, token, expires_at, used_at')
      .eq('token', token)
      .maybeSingle()

    if (!inv || inv.used_at || new Date(inv.expires_at) < new Date()) {
      return { success: false, message: 'Link zaproszenia wygasł lub jest nieprawidłowy.' }
    }
    invitation = { community_id: inv.community_id, token: inv.token }
  }

  // Sprawdź czy email już istnieje
  const { data: existing } = await admin.from('profiles').select('id, status').eq('email', email).maybeSingle()
  if (existing) {
    const msg =
      existing.status === 'unconfirmed'
        ? 'Konto z tym emailem oczekuje na potwierdzenie. Sprawdź skrzynkę mailową.'
        : 'Konto z tym adresem email już istnieje.'
    return { success: false, message: msg }
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: { redirectTo: `${APP_URL}/auth/callback` },
  })

  if (linkError || !linkData) {
    return { success: false, message: 'Błąd rejestracji: ' + (linkError?.message ?? 'Nieznany błąd') }
  }

  const userId = linkData.user?.id
  if (!userId) return { success: false, message: 'Błąd: nie udało się pobrać ID użytkownika.' }

  // Profil — zaproszeni dostają community_id od razu; status 'invited' (aktywowany po weryfikacji email)
  const { error: insertError } = await admin.from('profiles').insert({
    id: userId,
    email,
    full_name,
    role: 'user',
    status: invitation ? 'invited' : 'unconfirmed',
    community_id: invitation?.community_id ?? null,
  })

  if (insertError) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    return { success: false, message: 'Błąd zapisu profilu: ' + insertError.message }
  }

  // Oznacz zaproszenie jako użyte — token już skonsumowany, niezależnie od emaila
  if (invitation) {
    try {
      await admin.from('invitations')
        .update({ used_at: new Date().toISOString() })
        .eq('token', invitation.token)
    } catch {}
  }

  const tokenHash = linkData.properties.hashed_token
  const verifyUrl = `${APP_URL}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=signup`

  try {
    await sendEmailVerification({ to: email, confirmUrl: verifyUrl, fullName: full_name })
  } catch {}

  return { success: true, message: '' }
}

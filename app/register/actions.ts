'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { RegisterSchema } from './schema'
import { sendEmailVerification } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function registerUser(formData: FormData) {
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

  // Sprawdź czy email już istnieje
  const { data: existing } = await admin.from('profiles').select('id, status').eq('email', email).maybeSingle()
  if (existing) {
    const msg =
      existing.status === 'unconfirmed'
        ? 'Konto z tym emailem oczekuje na potwierdzenie. Sprawdź skrzynkę mailową.'
        : 'Konto z tym adresem email już istnieje.'
    return { success: false, message: msg }
  }

  // generateLink tworzy użytkownika z niepotwierdzonymi emailem i zwraca link weryfikacyjny
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: {
      redirectTo: `${APP_URL}/auth/callback`,
    },
  })

  if (linkError || !linkData) {
    return { success: false, message: 'Błąd rejestracji: ' + (linkError?.message ?? 'Nieznany błąd') }
  }

  const userId = linkData.user?.id
  if (!userId) {
    return { success: false, message: 'Błąd: nie udało się pobrać ID użytkownika.' }
  }

  // Wstaw profil ze statusem 'unconfirmed' — dostęp po potwierdzeniu maila I akceptacji admina
  const { error: insertError } = await admin.from('profiles').insert({
    id: userId,
    email,
    full_name,
    role: 'user',
    status: 'unconfirmed',
    community_id: null,
  })

  if (insertError) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    return { success: false, message: 'Błąd zapisu profilu: ' + insertError.message }
  }

  // Wyślij email weryfikacyjny przez Gmail/Nodemailer
  try {
    await sendEmailVerification({
      to: email,
      confirmUrl: linkData.properties.action_link,
      fullName: full_name,
    })
  } catch (err) {
    console.error('Błąd wysyłki emaila weryfikacyjnego:', err)
    // Rejestracja się udała, ale email nie doszedł — nie blokujemy
  }

  return { success: true, message: '' }
}

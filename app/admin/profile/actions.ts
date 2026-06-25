'use server'

import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { hashPin, verifyPin } from '@/lib/pin'
import { logActivity } from '@/lib/audit'
import { checkPinRateLimit, clearPinRateLimit, remainingPinAttempts } from '@/lib/pin-rate-limit'

export async function updateProfile(data: { full_name: string }) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Brak autoryzacji')

  const full_name = data.full_name.trim()
  if (!full_name || full_name.length < 3 || full_name.length > 100) {
    throw new Error('Imię i nazwisko musi mieć 3–100 znaków')
  }

  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ full_name })
    .eq('id', user.id)

  if (error) throw new Error('Błąd podczas zapisywania')
  revalidatePath('/admin/profile')
}

export async function changePassword(data: { password: string; confirm: string }) {
  if (data.password !== data.confirm) throw new Error('Hasła nie są identyczne')
  if (data.password.length < 8) throw new Error('Hasło musi mieć minimum 8 znaków')

  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Brak autoryzacji')

  const { error } = await supabase.auth.updateUser({ password: data.password })
  if (error) throw new Error('Błąd podczas zmiany hasła')
}

export async function setPin(data: { pin: string; pinConfirm: string }): Promise<{ error?: string }> {
  if (!/^\d{4}$/.test(data.pin)) return { error: 'PIN musi składać się z 4 cyfr' }
  if (data.pin !== data.pinConfirm) return { error: 'PINy nie są identyczne' }

  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Brak autoryzacji' }

  const pinHash = await hashPin(data.pin)
  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ voting_pin_hash: pinHash })
    .eq('id', user.id)

  if (error) return { error: 'Błąd podczas zapisywania PINu' }
  revalidatePath('/admin/profile')
  return {}
}

// ── RODO: usunięcie własnego konta ────────────────────────────────────────────
export async function deleteOwnAccount(): Promise<{ error?: string }> {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Brak autoryzacji' }

  const admin = getSupabaseAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role === 'super_admin') {
    return { error: 'Konto Super Administratora nie może zostać usunięte przez panel. Skontaktuj się z dostawcą systemu.' }
  }

  await logActivity({ userId: user.id, action: 'delete_own_account', targetType: 'user', targetId: user.id })
  await admin.from('profiles').delete().eq('id', user.id)
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return { error: 'Błąd podczas usuwania konta: ' + error.message }
  return {}
}

export async function verifyPinAction(pin: string): Promise<{ valid: boolean; error?: string }> {
  if (!/^\d{4}$/.test(pin)) return { valid: false }

  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { valid: false }

  // Rate limiting — 5 błędnych prób w 15 minut
  if (!checkPinRateLimit(user.id)) {
    return { valid: false, error: 'Zbyt wiele błędnych prób PIN. Poczekaj 15 minut.' }
  }

  const admin = getSupabaseAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('voting_pin_hash')
    .eq('id', user.id)
    .single()

  if (!profile?.voting_pin_hash) return { valid: false }
  const valid = await verifyPin(pin, profile.voting_pin_hash)

  if (valid) clearPinRateLimit(user.id)
  else if (remainingPinAttempts(user.id) === 0) {
    return { valid: false, error: 'Zbyt wiele błędnych prób PIN. Poczekaj 15 minut.' }
  }

  return { valid }
}

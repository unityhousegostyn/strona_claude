'use server'

import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

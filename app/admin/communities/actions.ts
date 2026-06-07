'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient, getSupabaseServerClient } from '@/lib/supabase/server'

async function requireSuperAdmin() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Brak autoryzacji')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') throw new Error('Tylko super_admin może zarządzać wspólnotami')
  return { user, profile }
}

export async function createCommunity(formData: { name: string; address: string }) {
  await requireSuperAdmin()

  const name = formData.name.trim()
  const address = formData.address.trim()

  if (!name || name.length < 3 || name.length > 100) throw new Error('Nazwa musi mieć 3–100 znaków')
  if (!address || address.length < 5 || address.length > 200) throw new Error('Adres musi mieć 5–200 znaków')

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('communities').insert({ name, address })
  if (error) throw new Error('Błąd podczas dodawania wspólnoty')

  revalidatePath('/admin/communities')
}

export async function updateCommunity(id: string, formData: { name: string; address: string }) {
  await requireSuperAdmin()

  const name = formData.name.trim()
  const address = formData.address.trim()

  if (!name || name.length < 3 || name.length > 100) throw new Error('Nazwa musi mieć 3–100 znaków')
  if (!address || address.length < 5 || address.length > 200) throw new Error('Adres musi mieć 5–200 znaków')
  if (!id) throw new Error('Brak ID wspólnoty')

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('communities').update({ name, address }).eq('id', id)
  if (error) throw new Error('Błąd podczas zapisywania')

  revalidatePath('/admin/communities')
}

export async function deleteCommunity(id: string) {
  await requireSuperAdmin()

  if (!id) throw new Error('Brak ID wspólnoty')

  const admin = getSupabaseAdminClient()

  // Sprawdź czy wspólnota ma przypisanych użytkowników
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', id)

  if (count && count > 0) throw new Error('Nie można usunąć wspólnoty z przypisanymi użytkownikami')

  const { error } = await admin.from('communities').delete().eq('id', id)
  if (error) throw new Error('Błąd podczas usuwania')

  revalidatePath('/admin/communities')
}

'use server'
import { getAuthProfileAction } from '@/lib/getAuthProfile'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/audit'

async function requireSuperAdmin() {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) throw new Error(auth.error)
  if (auth.profile.role !== 'super_admin') throw new Error('Tylko super_admin może zarządzać wspólnotami')
  return { user: auth.user, profile: auth.profile }
}

export async function createCommunity(formData: { name: string; address: string }) {
  await requireSuperAdmin()

  const name = formData.name.trim()
  const address = formData.address.trim()

  if (!name || name.length < 3 || name.length > 100) throw new Error('Nazwa musi mieć 3–100 znaków')
  if (!address || address.length < 5 || address.length > 200) throw new Error('Adres musi mieć 5–200 znaków')

  const admin = getSupabaseAdminClient()
  const { data: newComm, error } = await admin.from('communities').insert({ name, address }).select('id').single()
  if (error) throw new Error('Błąd podczas dodawania wspólnoty')
  const { user } = await requireSuperAdmin()
  await logActivity({ userId: user!.id, action: 'create_community', targetType: 'community', targetId: newComm?.id, meta: { name, address } })
  revalidatePath('/admin/communities')
}

/** Lookup NIP w Białej Liście MF (darmowe, bez klucza API) */
export async function lookupNIP(nip: string): Promise<{ name?: string; address?: string; error?: string }> {
  await requireSuperAdmin()
  const cleaned = nip.replace(/[\s-]/g, '')
  if (!/^\d{10}$/.test(cleaned)) return { error: 'NIP musi mieć 10 cyfr' }
  const date = new Date().toISOString().slice(0, 10)
  try {
    const res = await fetch(
      `https://wl-api.mf.gov.pl/api/search/nip/${cleaned}?date=${date}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return { error: res.status === 404 ? 'Nie znaleziono podmiotu o tym NIP' : `Błąd API MF (${res.status})` }
    const json = await res.json()
    const subject = json?.result?.subject
    if (!subject) return { error: 'Brak danych w odpowiedzi API' }
    return { name: subject.name ?? undefined, address: (subject.workingAddress ?? subject.residenceAddress) ?? undefined }
  } catch (e: any) {
    return { error: `Błąd połączenia z API MF: ${e?.message ?? 'timeout'}` }
  }
}

export async function updateCommunity(id: string, formData: { name: string; address: string; nip?: string; water_meter_enabled?: boolean; bank_account?: string; legal_basis?: string; opening_balance_eksploatacyjny?: number; opening_balance_remont?: number; opening_balance_date?: string }) {
  await requireSuperAdmin()

  const name = formData.name.trim()
  const address = formData.address.trim()

  if (!name || name.length < 3 || name.length > 100) throw new Error('Nazwa musi mieć 3–100 znaków')
  if (!address || address.length < 5 || address.length > 200) throw new Error('Adres musi mieć 5–200 znaków')
  if (!id) throw new Error('Brak ID wspólnoty')
  if (formData.bank_account && formData.bank_account.trim().length > 50) throw new Error('Numer konta może mieć maksymalnie 50 znaków')
  if (formData.legal_basis && formData.legal_basis.trim().length > 500) throw new Error('Podstawa prawna może mieć maksymalnie 500 znaków')
  if (formData.opening_balance_date && formData.opening_balance_date.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(formData.opening_balance_date.trim())) throw new Error('Nieprawidłowy format daty salda (oczekiwano YYYY-MM-DD)')
  if (formData.opening_balance_eksploatacyjny !== undefined && isNaN(formData.opening_balance_eksploatacyjny)) throw new Error('Saldo początkowe funduszu eksploatacyjnego musi być liczbą')
  if (formData.opening_balance_remont !== undefined && isNaN(formData.opening_balance_remont)) throw new Error('Saldo początkowe funduszu remontowego musi być liczbą')

  const admin = getSupabaseAdminClient()
  const updateData: Record<string, unknown> = { name, address }
  if (formData.nip !== undefined) updateData.nip = formData.nip.replace(/[\s-]/g, '').slice(0, 10) || null
  if (formData.water_meter_enabled !== undefined) updateData.water_meter_enabled = formData.water_meter_enabled
  if (formData.bank_account !== undefined) updateData.bank_account = formData.bank_account.trim() || null
  if (formData.legal_basis !== undefined) updateData.legal_basis = formData.legal_basis.trim() || null
  if (formData.opening_balance_eksploatacyjny !== undefined) updateData.opening_balance_eksploatacyjny = formData.opening_balance_eksploatacyjny
  if (formData.opening_balance_remont !== undefined) updateData.opening_balance_remont = formData.opening_balance_remont
  if (formData.opening_balance_date !== undefined) updateData.opening_balance_date = formData.opening_balance_date.trim() || null
  const { error } = await admin.from('communities').update(updateData).eq('id', id)
  if (error) throw new Error('Błąd podczas zapisywania')
  const { user } = await requireSuperAdmin()
  await logActivity({ userId: user!.id, action: 'update_community', targetType: 'community', targetId: id, meta: { name } })
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
  const { user } = await requireSuperAdmin()
  await logActivity({ userId: user!.id, action: 'delete_community', targetType: 'community', targetId: id })
  revalidatePath('/admin/communities')
}

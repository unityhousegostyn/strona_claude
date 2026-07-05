'use server'

import { getAuthProfileAction } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/audit'

function requireAdminPlus(role: string) {
  return role !== 'super_admin' && role !== 'admin'
    ? 'Brak uprawnień'
    : null
}

/** Pobierz lokale wspólnoty potrzebne do dopasowania */
export async function getApartmentsForMT940(communityId: string) {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) return { error: auth.error, apartments: [] }
  const deny = requireAdminPlus(auth.profile.role)
  if (deny) return { error: deny, apartments: [] }
  if (auth.profile.role === 'admin' && auth.profile.community_id !== communityId)
    return { error: 'Brak uprawnień do tej wspólnoty', apartments: [] }

  const admin = getSupabaseAdminClient()
  const { data } = await admin
    .from('settlement_apartments')
    .select('id, number, owner_name, community_id')
    .eq('community_id', communityId)
    .eq('active', true)
    .order('number')

  return { error: null, apartments: data ?? [] }
}

export interface BulkImportItem {
  apartment_id: string
  community_id: string
  year: number
  month: number
  /** Kwota do dodania do istniejącej wpłaty (nie zastępuje) */
  amount: number
}

export interface BulkImportResult {
  imported: number
  skipped: number
  errors: string[]
}

/** Importuj dopasowane transakcje jako wpłaty do settlement_entries */
export async function bulkImportMT940(
  items: BulkImportItem[],
): Promise<BulkImportResult> {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) return { imported: 0, skipped: 0, errors: [auth.error] }
  const deny = requireAdminPlus(auth.profile.role)
  if (deny) return { imported: 0, skipped: 0, errors: [deny] }

  if (!items.length) return { imported: 0, skipped: 0, errors: [] }
  if (items.length > 500) return { imported: 0, skipped: 0, errors: ['Za dużo rekordów (max 500)'] }

  // Walidacja każdego rekordu przed importem
  for (const item of items) {
    if (!item.apartment_id || !item.community_id) return { imported: 0, skipped: 0, errors: ['Brak apartment_id lub community_id'] }
    if (typeof item.amount !== 'number' || !isFinite(item.amount) || item.amount <= 0) {
      return { imported: 0, skipped: 0, errors: [`Nieprawidłowa kwota: ${item.amount} — musi być dodatnią liczbą`] }
    }
    if (item.amount > 1_000_000) return { imported: 0, skipped: 0, errors: [`Kwota przekracza limit 1 000 000 zł`] }
    if (!Number.isInteger(item.year) || item.year < 2000 || item.year > 2100) {
      return { imported: 0, skipped: 0, errors: [`Nieprawidłowy rok: ${item.year}`] }
    }
    if (!Number.isInteger(item.month) || item.month < 1 || item.month > 12) {
      return { imported: 0, skipped: 0, errors: [`Nieprawidłowy miesiąc: ${item.month}`] }
    }
  }

  const admin = getSupabaseAdminClient()
  let imported = 0, skipped = 0
  const errors: string[] = []

  // Sprawdź zamknięte lata i zweryfikuj przynależność lokali
  const communityIds = [...new Set(items.map(i => i.community_id))]
  if (auth.profile.role === 'admin') {
    if (communityIds.some(cid => cid !== auth.profile.community_id)) {
      return { imported: 0, skipped: 0, errors: ['Brak uprawnień do jednej z wspólnot'] }
    }
  }

  for (const item of items) {
    try {
      // IDOR: weryfikacja apartment → community
      const { data: aptCheck } = await admin
        .from('settlement_apartments')
        .select('community_id')
        .eq('id', item.apartment_id)
        .single()
      if (!aptCheck || aptCheck.community_id !== item.community_id) {
        errors.push(`Lokal ${item.apartment_id}: niezgodność wspólnoty`)
        skipped++
        continue
      }

      // Blokada zamkniętego roku
      const { data: yearClosed } = await admin
        .from('year_closures')
        .select('id')
        .eq('community_id', item.community_id)
        .eq('year', item.year)
        .maybeSingle()
      if (yearClosed) {
        errors.push(`Rok ${item.year} jest zamknięty`)
        skipped++
        continue
      }

      // Pobierz istniejący wpis żeby dodać do wpłaty (nie zastąpić)
      const { data: existing } = await admin
        .from('settlement_entries')
        .select('paid, water_correction, water_m3, notes, persons_count')
        .eq('apartment_id', item.apartment_id)
        .eq('year', item.year)
        .eq('month', item.month)
        .maybeSingle()

      const newPaid = (existing?.paid ?? 0) + item.amount

      const { error } = await admin.from('settlement_entries').upsert({
        apartment_id:    item.apartment_id,
        community_id:    item.community_id,
        year:            item.year,
        month:           item.month,
        paid:            Math.round(newPaid * 100) / 100,
        water_correction: existing?.water_correction ?? 0,
        water_m3:        existing?.water_m3 ?? 0,
        notes:           existing?.notes ?? null,
        persons_count:   existing?.persons_count ?? null,
        updated_at:      new Date().toISOString(),
      }, { onConflict: 'apartment_id,year,month' })

      if (error) {
        errors.push(`Lokal ${item.apartment_id} ${item.year}/${item.month}: ${error.message}`)
        skipped++
      } else {
        imported++
        await logActivity({
          userId: auth.user!.id,
          action: 'mt940_import',
          targetType: 'settlement_entry',
          meta: { apartment_id: item.apartment_id, year: item.year, month: item.month, amount: item.amount },
        })
      }
    } catch (e: any) {
      errors.push(`Błąd: ${e?.message}`)
      skipped++
    }
  }

  // Revalidate
  revalidatePath('/admin/settlements')
  revalidatePath('/admin/finanse/mt940')

  return { imported, skipped, errors }
}

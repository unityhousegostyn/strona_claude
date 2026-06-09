'use server'
import { getAuthProfileAction } from '@/lib/getAuthProfile'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/audit'

type AuthResult =
  | { error: string; user: null; role: null; communityId: null }
  | { error: null; user: { id: string }; role: 'super_admin' | 'admin'; communityId: string | null }

async function requireAdminOrAbove(): Promise<AuthResult> {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) return { error: auth.error, user: null, role: null, communityId: null }
  const profile = auth.profile!
  const user = auth.user!
  if (profile.role !== 'super_admin' && profile.role !== 'admin')
    return { error: 'Brak uprawnień', user: null, role: null, communityId: null }
  return { error: null, user: { id: user.id }, role: profile.role as 'super_admin' | 'admin', communityId: profile.community_id ?? null }
}

function guardCommunity(
  auth: { role: string | null; communityId: string | null },
  communityId: string
): string | null {
  if (auth.role === 'super_admin') return null
  if (!auth.communityId || auth.communityId !== communityId) return 'Brak dostępu do tej wspólnoty'
  return null
}

// ── LOKALE ──────────────────────────────────────────────────────────────────

export async function createApartment(data: {
  community_id: string
  number: string
  owner_name: string
  area_m2: number
  share_numerator?: number | null
  share_denominator?: number | null
  persons_count: number
  has_meter: boolean
  floor?: number | null
  notes?: string | null
}): Promise<{ error?: string }> {
  const auth = await requireAdminOrAbove()
  if (auth.error !== null) return { error: auth.error }
  const guardErr = guardCommunity(auth, data.community_id)
  if (guardErr) return { error: guardErr }

  if (!data.number?.trim()) return { error: 'Nr lokalu jest wymagany' }
  if (!data.owner_name?.trim()) return { error: 'Właściciel jest wymagany' }
  if (!data.area_m2 || data.area_m2 <= 0) return { error: 'Powierzchnia musi być większa od 0' }
  if (!data.persons_count || data.persons_count < 1) return { error: 'Liczba osób musi być >= 1' }

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('settlement_apartments').insert({
    community_id: data.community_id,
    number: data.number.trim(),
    owner_name: data.owner_name.trim(),
    area_m2: data.area_m2,
    share_numerator: data.share_numerator ?? null,
    share_denominator: data.share_denominator ?? null,
    persons_count: data.persons_count,
    has_meter: data.has_meter,
    floor: data.floor ?? null,
    notes: data.notes?.trim() ?? null,
  })

  if (error) return { error: error.message }
  await logActivity({ userId: auth.user!.id, action: 'create_apartment', targetType: 'settlement_apartment', meta: { community_id: data.community_id, number: data.number } })
  revalidatePath('/admin/settlements')
  return {}
}

export async function updateApartment(id: string, data: {
  number?: string
  owner_name?: string
  area_m2?: number
  share_numerator?: number | null
  share_denominator?: number | null
  persons_count?: number
  has_meter?: boolean
  floor?: number | null
  notes?: string | null
  active?: boolean
}): Promise<{ error?: string }> {
  const auth = await requireAdminOrAbove()
  if (auth.error !== null) return { error: auth.error }

  const admin = getSupabaseAdminClient()
  const { data: apt } = await admin.from('settlement_apartments').select('community_id').eq('id', id).single()
  if (!apt) return { error: 'Lokal nie istnieje' }
  const guardErr = guardCommunity(auth, apt.community_id)
  if (guardErr) return { error: guardErr }

  const { error } = await admin.from('settlement_apartments').update(data).eq('id', id)
  if (error) return { error: error.message }
  await logActivity({ userId: auth.user!.id, action: 'update_apartment', targetType: 'settlement_apartment', targetId: id })
  revalidatePath('/admin/settlements')
  return {}
}

export async function deleteApartment(id: string): Promise<{ error?: string }> {
  const auth = await requireAdminOrAbove()
  if (auth.error !== null) return { error: auth.error }

  const admin = getSupabaseAdminClient()
  const { data: apt } = await admin.from('settlement_apartments').select('community_id').eq('id', id).single()
  if (!apt) return { error: 'Lokal nie istnieje' }
  const guardErr = guardCommunity(auth, apt.community_id)
  if (guardErr) return { error: guardErr }

  const { error } = await admin.from('settlement_apartments').update({ active: false }).eq('id', id)
  if (error) return { error: error.message }
  await logActivity({ userId: auth.user!.id, action: 'deactivate_apartment', targetType: 'settlement_apartment', targetId: id })
  revalidatePath('/admin/settlements')
  return {}
}

// ── STAWKI ───────────────────────────────────────────────────────────────────

export async function createRates(data: {
  community_id: string
  effective_from: string
  water_price_m3: number
  water_ryczalt_m3: number
  garbage_per_person: number
  renovation_rate_m2: number
  operating_rate_m2: number
  manager_fee_type: 'per_m2' | 'fixed'
  manager_fee_value: number
  water_billing_type: 'ryczalt' | 'meter'
}): Promise<{ error?: string }> {
  const auth = await requireAdminOrAbove()
  if (auth.error !== null) return { error: auth.error }
  const guardErr = guardCommunity(auth, data.community_id)
  if (guardErr) return { error: guardErr }

  if (!data.effective_from) return { error: 'Data obowiązywania jest wymagana' }

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('settlement_rates').insert(data)
  if (error) return { error: error.message }
  await logActivity({ userId: auth.user!.id, action: 'create_rates', targetType: 'settlement_rates', meta: { community_id: data.community_id, effective_from: data.effective_from } })
  revalidatePath('/admin/settlements')
  return {}
}

export async function updateRates(id: string, data: {
  effective_from: string
  water_price_m3: number
  water_ryczalt_m3: number
  garbage_per_person: number
  renovation_rate_m2: number
  operating_rate_m2: number
  manager_fee_type: 'per_m2' | 'fixed'
  manager_fee_value: number
  water_billing_type: 'ryczalt' | 'meter'
}): Promise<{ error?: string }> {
  const auth = await requireAdminOrAbove()
  if (auth.error !== null) return { error: auth.error }

  const admin = getSupabaseAdminClient()
  const { data: rate } = await admin.from('settlement_rates').select('community_id').eq('id', id).single()
  if (!rate) return { error: 'Stawki nie istnieją' }
  const guardErr = guardCommunity(auth, rate.community_id)
  if (guardErr) return { error: guardErr }

  if (!data.effective_from) return { error: 'Data obowiązywania jest wymagana' }

  const { error } = await admin.from('settlement_rates').update(data).eq('id', id)
  if (error) return { error: error.message }
  await logActivity({ userId: auth.user!.id, action: 'update_rates', targetType: 'settlement_rates', targetId: id, meta: { effective_from: data.effective_from } })
  revalidatePath('/admin/settlements', 'layout')
  return {}
}

export async function deleteRates(id: string): Promise<{ error?: string }> {
  const auth = await requireAdminOrAbove()
  if (auth.error !== null) return { error: auth.error }

  const admin = getSupabaseAdminClient()
  const { data: rate } = await admin.from('settlement_rates').select('community_id').eq('id', id).single()
  if (!rate) return { error: 'Stawki nie istnieją' }
  const guardErr = guardCommunity(auth, rate.community_id)
  if (guardErr) return { error: guardErr }

  const { error } = await admin.from('settlement_rates').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/settlements')
  return {}
}

// ── WPISY MIESIĘCZNE ─────────────────────────────────────────────────────────

export async function upsertEntry(data: {
  apartment_id: string
  community_id: string
  year: number
  month: number
  paid: number
  water_correction: number
  water_m3?: number
  notes?: string | null
}): Promise<{ error?: string }> {
  const auth = await requireAdminOrAbove()
  if (auth.error !== null) return { error: auth.error }
  const guardErr = guardCommunity(auth, data.community_id)
  if (guardErr) return { error: guardErr }

  if (data.paid < 0) return { error: 'Wplata nie moze byc ujemna' }
  if (data.month < 1 || data.month > 12) return { error: 'Nieprawidlowy miesiac' }

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('settlement_entries').upsert({
    apartment_id: data.apartment_id,
    community_id: data.community_id,
    year: data.year,
    month: data.month,
    paid: data.paid,
    water_correction: data.water_correction,
    water_m3: data.water_m3 ?? 0,
    notes: data.notes ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'apartment_id,year,month' })

  if (error) return { error: error.message }
  await logActivity({ userId: auth.user!.id, action: 'upsert_entry', targetType: 'settlement_entry', meta: { apartment_id: data.apartment_id, year: data.year, month: data.month, paid: data.paid } })
  revalidatePath(`/admin/settlements/${data.apartment_id}`)
  return {}
}

// ── ROZLICZENIE KWARTALNE ────────────────────────────────────────────────────

export async function upsertWaterReconciliation(data: {
  apartment_id: string
  year: number
  quarter: number
  meter_reading_start: number
  meter_reading_end: number
  ryczalt_m3: number
  water_price_m3: number
  notes?: string | null
}): Promise<{ error?: string }> {
  const auth = await requireAdminOrAbove()
  if (auth.error !== null) return { error: auth.error }

  const admin = getSupabaseAdminClient()
  const { data: apt } = await admin.from('settlement_apartments').select('community_id').eq('id', data.apartment_id).single()
  if (!apt) return { error: 'Lokal nie istnieje' }
  const guardErr = guardCommunity(auth, apt.community_id)
  if (guardErr) return { error: guardErr }

  const actual_m3 = Math.round((data.meter_reading_end - data.meter_reading_start) * 1000) / 1000
  const correction_m3 = Math.round((actual_m3 - data.ryczalt_m3) * 1000) / 1000
  const correction_amount = Math.round(correction_m3 * data.water_price_m3 * 100) / 100

  const { error } = await admin.from('settlement_water_reconciliation').upsert({
    apartment_id: data.apartment_id,
    year: data.year,
    quarter: data.quarter,
    meter_reading_start: data.meter_reading_start,
    meter_reading_end: data.meter_reading_end,
    actual_m3,
    ryczalt_m3: data.ryczalt_m3,
    correction_m3,
    correction_amount,
    notes: data.notes ?? null,
  }, { onConflict: 'apartment_id,year,quarter' })

  if (error) return { error: error.message }
  revalidatePath(`/admin/settlements/${data.apartment_id}`)
  return {}
}

// ── IMPORT WPŁAT Z CSV ───────────────────────────────────────────────────────
// Format: lokal;rok;miesiac;wplata;woda_m3;korekta_wody;uwagi
// Przykład: 14;2026;1;350.00;3.5;0;
export async function importEntriesCSV(
  community_id: string,
  csvText: string,
): Promise<{ imported: number; errors: string[]; skipped: number }> {
  const auth = await requireAdminOrAbove()
  if (auth.error !== null) return { imported: 0, skipped: 0, errors: [auth.error] }
  const guardErr = guardCommunity(auth, community_id)
  if (guardErr) return { imported: 0, skipped: 0, errors: [guardErr] }

  const admin = getSupabaseAdminClient()

  // Pobierz lokale tej wspólnoty (numer → id)
  const { data: apts } = await admin
    .from('settlement_apartments')
    .select('id, number')
    .eq('community_id', community_id)
  const aptMap: Record<string, string> = {}
  for (const a of apts ?? []) aptMap[a.number.trim()] = a.id

  // DEBUG — usuń po diagnozie
  if ((apts ?? []).length === 0) {
    return { imported: 0, skipped: 0, errors: [`DEBUG: community_id="${community_id}", apts=0 — brak lokali w bazie dla tej wspólnoty`] }
  }

  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean)
  const startIdx = lines[0]?.toLowerCase().startsWith('lokal') ? 1 : 0

  const rows: any[] = []
  const errors: string[] = []
  let skipped = 0

  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(/[;,]/).map(p => p.trim().replace(/^"|"$/g, ''))
    const [lokal, rokStr, miesStr, wplataStr, woda_m3Str, korekta_wodyStr, notes] = parts

    if (!lokal) { skipped++; continue }

    const apt_id = aptMap[lokal]
    if (!apt_id) { errors.push(`Wiersz ${i + 1}: nieznany lokal "${lokal}"`); continue }

    const year = parseInt(rokStr)
    const month = parseInt(miesStr)
    const paid = parseFloat((wplataStr ?? '0').replace(',', '.'))
    const water_m3 = parseFloat((woda_m3Str ?? '0').replace(',', '.')) || 0
    const water_correction = parseFloat((korekta_wodyStr ?? '0').replace(',', '.')) || 0

    if (isNaN(year) || year < 2020 || year > 2100)
      { errors.push(`Wiersz ${i + 1}: nieprawidłowy rok "${rokStr}"`); continue }
    if (isNaN(month) || month < 1 || month > 12)
      { errors.push(`Wiersz ${i + 1}: nieprawidłowy miesiąc "${miesStr}"`); continue }
    if (isNaN(paid) || paid < 0)
      { errors.push(`Wiersz ${i + 1}: nieprawidłowa wpłata "${wplataStr}"`); continue }

    rows.push({
      apartment_id: apt_id,
      community_id,
      year,
      month,
      paid,
      water_m3,
      water_correction,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
  }

  if (rows.length > 0) {
    const { error } = await admin
      .from('settlement_entries')
      .upsert(rows, { onConflict: 'apartment_id,year,month' })
    if (error) return { imported: 0, skipped, errors: [error.message, ...errors] }
    await logActivity({
      userId: auth.user!.id,
      action: 'import_entries_csv',
      targetType: 'settlement_entry',
      meta: { community_id, count: rows.length },
    })
  }

  revalidatePath('/admin/settlements')
  return { imported: rows.length, skipped, errors }
}

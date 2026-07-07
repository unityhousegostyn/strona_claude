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
  water_billing_type: 'ryczalt' | 'meter' | 'zaliczka'
  water_reconciliation_months: number
}): Promise<{ error?: string }> {
  const auth = await requireAdminOrAbove()
  if (auth.error !== null) return { error: auth.error }
  const guardErr = guardCommunity(auth, data.community_id)
  if (guardErr) return { error: guardErr }

  if (!data.effective_from) return { error: 'Data obowiązywania jest wymagana' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.effective_from)) return { error: 'Nieprawidłowy format daty stawki (oczekiwano YYYY-MM-DD)' }

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
  water_billing_type: 'ryczalt' | 'meter' | 'zaliczka'
  water_reconciliation_months: number
}): Promise<{ error?: string }> {
  const auth = await requireAdminOrAbove()
  if (auth.error !== null) return { error: auth.error }

  const admin = getSupabaseAdminClient()
  const { data: rate } = await admin.from('settlement_rates').select('community_id').eq('id', id).single()
  if (!rate) return { error: 'Stawki nie istnieją' }
  const guardErr = guardCommunity(auth, rate.community_id)
  if (guardErr) return { error: guardErr }

  if (!data.effective_from) return { error: 'Data obowiązywania jest wymagana' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.effective_from)) return { error: 'Nieprawidłowy format daty stawki (oczekiwano YYYY-MM-DD)' }

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
  persons_count?: number | null
}): Promise<{ error?: string }> {
  const auth = await requireAdminOrAbove()
  if (auth.error !== null) return { error: auth.error }
  const guardErr = guardCommunity(auth, data.community_id)
  if (guardErr) return { error: guardErr }

  if (data.paid < 0) return { error: 'Wplata nie moze byc ujemna' }
  if (data.month < 1 || data.month > 12) return { error: 'Nieprawidlowy miesiac' }
  if (!Number.isInteger(data.year) || data.year < 2000 || data.year > 2100) return { error: 'Nieprawidłowy rok' }

  const admin = getSupabaseAdminClient()

  // IDOR fix: verify apartment belongs to the stated community
  const { data: aptCheck } = await admin
    .from('settlement_apartments')
    .select('community_id')
    .eq('id', data.apartment_id)
    .single()
  if (!aptCheck || aptCheck.community_id !== data.community_id)
    return { error: 'Lokal nie należy do tej wspólnoty' }

  // Year-closed check: block editing if fiscal year is locked
  const { data: yearClosed } = await admin
    .from('year_closures')
    .select('id')
    .eq('community_id', data.community_id)
    .eq('year', data.year)
    .maybeSingle()
  if (yearClosed) return { error: `Rok ${data.year} jest zamknięty — edycja zablokowana` }

  const { error } = await admin.from('settlement_entries').upsert({
    apartment_id: data.apartment_id,
    community_id: data.community_id,
    year: data.year,
    month: data.month,
    paid: data.paid,
    water_correction: data.water_correction,
    water_m3: data.water_m3 ?? 0,
    notes: data.notes ?? null,
    persons_count: data.persons_count ?? null,
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

  if (!csvText || csvText.length > 500_000) return { imported: 0, skipped: 0, errors: ['Plik CSV jest za duży (max 500 KB)'] }

  const admin = getSupabaseAdminClient()

  // Pobierz lokale tej wspólnoty (numer → id)
  const { data: apts } = await admin
    .from('settlement_apartments')
    .select('id, number')
    .eq('community_id', community_id)
  const aptMap: Record<string, string> = {}
  for (const a of apts ?? []) aptMap[a.number.trim()] = a.id

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
    if (error) return { imported: 0, skipped, errors: [(error as any).message ?? String(error), ...errors] }
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

// ── SALDO OTWARCIA ──────────────────────────────────────────────────────────

export async function upsertOpeningBalance(
  apartmentId: string,
  year: number,
  balance: number
): Promise<{ error?: string }> {
  const auth = await requireAdminOrAbove()
  if (auth.error !== null) return { error: auth.error }

  const admin = getSupabaseAdminClient()

  // Sprawdź, że admin ma dostęp do tego lokalu
  const { data: apt } = await admin
    .from('settlement_apartments')
    .select('community_id')
    .eq('id', apartmentId)
    .single()
  if (!apt) return { error: 'Nie znaleziono lokalu' }
  const guardErr = guardCommunity(auth, apt.community_id)
  if (guardErr) return { error: guardErr }

  const { error } = await admin
    .from('settlement_opening_balances')
    .upsert(
      { apartment_id: apartmentId, year, balance, updated_at: new Date().toISOString() },
      { onConflict: 'apartment_id,year' }
    )
  if (error) return { error: error.message }

  revalidatePath(`/admin/settlements/${apartmentId}`)
  return {}
}

// ── ODCZYT LICZNIKA — delta bieżący − poprzedni miesiąc ──────────────────────

export async function getWaterConsumption(
  apartmentId: string,
  year: number,
  month: number,
): Promise<{ m3: number | null; current: number | null; previous: number | null; error?: string }> {
  const auth = await requireAdminOrAbove()
  if (auth.error !== null) return { m3: null, current: null, previous: null, error: auth.error }

  const admin = getSupabaseAdminClient()

  const { data: apt } = await admin
    .from('settlement_apartments')
    .select('community_id')
    .eq('id', apartmentId)
    .single()
  if (!apt) return { m3: null, current: null, previous: null, error: 'Lokal nie istnieje' }
  const guardErr = guardCommunity(auth, apt.community_id)
  if (guardErr) return { m3: null, current: null, previous: null, error: guardErr }

  const curYM = `${year}-${String(month).padStart(2, '0')}`
  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYM = `${prevYear}-${String(prevMonth).padStart(2, '0')}`

  const [{ data: curRow }, { data: prevRow }] = await Promise.all([
    admin.from('water_meter_readings')
      .select('reading_value')
      .eq('apartment_id', apartmentId)
      .like('reading_date', `${curYM}%`)
      .eq('status', 'confirmed')
      .order('reading_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from('water_meter_readings')
      .select('reading_value')
      .eq('apartment_id', apartmentId)
      .like('reading_date', `${prevYM}%`)
      .eq('status', 'confirmed')
      .order('reading_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const current = curRow?.reading_value ?? null
  const previous = prevRow?.reading_value ?? null
  if (current === null || previous === null) return { m3: null, current, previous }

  const m3 = Math.max(0, Math.round((current - previous) * 1000) / 1000)
  return { m3, current, previous }
}

// ── ABSOLUTNY ODCZYT LICZNIKA za dany miesiąc (do qStart/qEnd) ───────────────

export async function getWaterReading(
  apartmentId: string,
  year: number,
  month: number,
): Promise<{ value: number | null; error?: string }> {
  const auth = await requireAdminOrAbove()
  if (auth.error !== null) return { value: null, error: auth.error }

  const admin = getSupabaseAdminClient()

  // Community isolation fix: verify apartment belongs to caller's community
  const { data: apt } = await admin
    .from('settlement_apartments')
    .select('community_id')
    .eq('id', apartmentId)
    .single()
  if (!apt) return { value: null, error: 'Lokal nie istnieje' }
  const guardErrW = guardCommunity(auth, apt.community_id)
  if (guardErrW) return { value: null, error: guardErrW }

  // Poprawna obsługa przełomu roku (miesiąc 0 = grudzień roku poprzedniego)
  const actualYear = month < 1 ? year - 1 : month > 12 ? year + 1 : year
  const actualMonth = month < 1 ? 12 : month > 12 ? month - 12 : month
  const ym = `${actualYear}-${String(actualMonth).padStart(2, '0')}`
  const { data } = await admin
    .from('water_meter_readings')
    .select('reading_value')
    .eq('apartment_id', apartmentId)
    .like('reading_date', `${ym}%`)
    .eq('status', 'confirmed')
    .order('reading_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  return { value: data?.reading_value ?? null }
}

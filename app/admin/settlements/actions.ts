'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'

async function requireSuperAdmin() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Brak autoryzacji' as const, user: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'super_admin') return { error: 'Brak uprawnień' as const, user: null }
  return { error: null, user }
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
  const { error: authErr } = await requireSuperAdmin()
  if (authErr) return { error: authErr }

  if (!data.number?.trim()) return { error: 'Nr lokalu jest wymagany' }
  if (!data.owner_name?.trim()) return { error: 'Właściciel jest wymagany' }
  if (!data.area_m2 || data.area_m2 <= 0) return { error: 'Powierzchnia musi być większa od 0' }
  if (!data.persons_count || data.persons_count < 1) return { error: 'Liczba osób musi być ≥ 1' }

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
  const { error: authErr } = await requireSuperAdmin()
  if (authErr) return { error: authErr }

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('settlement_apartments').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/settlements')
  return {}
}

export async function deleteApartment(id: string): Promise<{ error?: string }> {
  const { error: authErr } = await requireSuperAdmin()
  if (authErr) return { error: authErr }

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('settlement_apartments').update({ active: false }).eq('id', id)
  if (error) return { error: error.message }
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
}): Promise<{ error?: string }> {
  const { error: authErr } = await requireSuperAdmin()
  if (authErr) return { error: authErr }

  if (!data.effective_from) return { error: 'Data obowiązywania jest wymagana' }

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('settlement_rates').insert(data)
  if (error) return { error: error.message }
  revalidatePath('/admin/settlements')
  return {}
}

export async function deleteRates(id: string): Promise<{ error?: string }> {
  const { error: authErr } = await requireSuperAdmin()
  if (authErr) return { error: authErr }

  const admin = getSupabaseAdminClient()
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
  notes?: string | null
}): Promise<{ error?: string }> {
  const { error: authErr } = await requireSuperAdmin()
  if (authErr) return { error: authErr }

  if (data.paid < 0) return { error: 'Wpłata nie może być ujemna' }
  if (data.month < 1 || data.month > 12) return { error: 'Nieprawidłowy miesiąc' }

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('settlement_entries').upsert({
    apartment_id: data.apartment_id,
    community_id: data.community_id,
    year: data.year,
    month: data.month,
    paid: data.paid,
    water_correction: data.water_correction,
    notes: data.notes ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'apartment_id,year,month' })

  if (error) return { error: error.message }
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
  const { error: authErr } = await requireSuperAdmin()
  if (authErr) return { error: authErr }

  const actual_m3 = Math.round((data.meter_reading_end - data.meter_reading_start) * 1000) / 1000
  const correction_m3 = Math.round((actual_m3 - data.ryczalt_m3) * 1000) / 1000
  const correction_amount = Math.round(correction_m3 * data.water_price_m3 * 100) / 100

  const admin = getSupabaseAdminClient()
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

'use server'

import { getAuthProfileAction } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/audit'

// ── DIAGNOSTYKA — lista numerów lokali (do debugowania importu) ───────────────

export async function getApartmentNumbers(
  communityId: string
): Promise<{ numbers: string[]; error?: string }> {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) return { numbers: [], error: auth.error }
  if (auth.profile.role !== 'super_admin') return { numbers: [], error: 'Brak uprawnień' }

  const admin = getSupabaseAdminClient()
  const { data, error } = await admin
    .from('settlement_apartments')
    .select('number')
    .eq('community_id', communityId)
    .order('number')

  if (error) return { numbers: [], error: error.message }
  return { numbers: (data ?? []).map(r => r.number) }
}

// ── IMPORT ZBIORCZY Z XLSX (tylko super_admin) ────────────────────────────────

export interface ImportWaterRow {
  community_id: string
  apt_number: string        // pełny ID: "7/1", "7a/1", "7/4a"
  reading_value: number
  reading_date: string      // YYYY-MM-DD
  note: string | null
  meter_serial: string | null
}

export async function importWaterReadingsAdmin(
  rows: ImportWaterRow[]
): Promise<{ imported: number; skipped: Array<{ apt: string; reason: string }> }> {
  const empty = (reason: string) => ({ imported: 0, skipped: [{ apt: '—', reason }] })

  const auth = await getAuthProfileAction()
  if (auth.error !== null) return empty(auth.error)
  if (auth.profile.role !== 'super_admin') return empty('Tylko super_admin może importować zbiorczo')
  if (!rows.length) return { imported: 0, skipped: [] }
  if (rows.length > 200) return empty('Za dużo wierszy (max 200)')

  const dateRx = /^\d{4}-\d{2}-\d{2}$/
  for (const r of rows) {
    if (!dateRx.test(r.reading_date)) return empty(`Nieprawidłowa data: ${r.reading_date}`)
    if (r.reading_value <= 0 || r.reading_value > 999999) return empty(`Nieprawidłowa wartość m³ dla lokalu ${r.apt_number}`)
  }

  const admin = getSupabaseAdminClient()
  const skipped: Array<{ apt: string; reason: string }> = []

  const communityIds = [...new Set(rows.map(r => r.community_id))]
  const months = [...new Set(rows.map(r => r.reading_date.slice(0, 7)))] // wszystkie YYYY-MM w batchu

  // Pobierz wszystkie aktywne lokale dla tych wspólnot
  const { data: allApts } = await admin
    .from('settlement_apartments')
    .select('id, number, community_id')
    .in('community_id', communityIds)
    .eq('active', true)

  const aptMap = new Map<string, string>() // `${community_id}:${number}` → apartment_id
  for (const apt of allApts ?? []) {
    aptMap.set(`${apt.community_id}:${String(apt.number).trim()}`, apt.id)
  }

  // Sprawdź istniejące odczyty dla wszystkich miesięcy w batchu (z fallbackiem dla sub-liczników)
  const aptIdsToCheck = rows
    .map(r => {
      const n = r.apt_number.trim()
      return aptMap.get(`${r.community_id}:${n}`) ??
        (/[a-z]$/i.test(n) ? aptMap.get(`${r.community_id}:${n.replace(/[a-z]$/i, '')}`) : undefined)
    })
    .filter(Boolean) as string[]

  // Pobierz istniejące odczyty dla każdego miesiąca osobno (Supabase nie ma OR na like)
  const existingSet = new Set<string>()
  if (aptIdsToCheck.length) {
    for (const m of months) {
      const { data: ex } = await admin
        .from('water_meter_readings')
        .select('apartment_id')
        .in('apartment_id', aptIdsToCheck)
        .like('reading_date', `${m}%`)
        .in('status', ['pending', 'confirmed'])
      for (const r of ex ?? []) existingSet.add(`${m}:${r.apartment_id}`)
    }
  }

  const insertRows: object[] = []
  const now = new Date().toISOString()

  for (const row of rows) {
    const aptNum = row.apt_number.trim()
    let aptId = aptMap.get(`${row.community_id}:${aptNum}`)
    // Fallback: jeśli lokal "7/4a" nie istnieje, spróbuj "7/4" (sub-licznik → lokal)
    if (!aptId && /[a-z]$/i.test(aptNum)) {
      const stripped = aptNum.replace(/[a-z]$/i, '')
      aptId = aptMap.get(`${row.community_id}:${stripped}`)
    }
    if (!aptId) {
      skipped.push({ apt: aptNum, reason: 'Nie znaleziono lokalu w systemie' })
      continue
    }
    const monthKey = `${row.reading_date.slice(0, 7)}:${aptId}`
    if (existingSet.has(monthKey)) {
      skipped.push({ apt: aptNum, reason: 'Odczyt za ten miesiąc już istnieje' })
      continue
    }

    const noteParts = [row.note, row.meter_serial ? `[wodomierz: ${row.meter_serial}]` : null].filter(Boolean)
    insertRows.push({
      user_id: auth.user.id,
      apartment_id: aptId,
      community_id: row.community_id,
      reading_value: row.reading_value,
      reading_date: row.reading_date,
      note: noteParts.length ? noteParts.join(' · ') : null,
      status: 'confirmed',
      confirmed_at: now,
      confirmed_by: auth.user.id,
    })
  }

  if (!insertRows.length) return { imported: 0, skipped }

  const { error } = await admin.from('water_meter_readings').insert(insertRows)
  if (error) return empty(error.message)

  await logActivity({ userId: auth.user.id, action: 'import_water_readings', targetType: 'water_meter', targetId: 'bulk' })
  revalidatePath('/admin/water-meters')

  return { imported: insertRows.length, skipped }
}

export async function submitWaterReading(data: {
  apartment_id: string
  reading_value: number
  reading_date: string
  note?: string
}): Promise<{ error?: string }> {
  try {
    const auth = await getAuthProfileAction()
    if (auth.error !== null) return { error: auth.error }
    if (auth.profile.role !== 'user') return { error: 'Tylko mieszkańcy mogą zgłaszać odczyty' }

    const admin = getSupabaseAdminClient()

    // Sprawdź czy lokal należy do tego usera.
    // Priorytet: profiles.apartment_id (nowy system), fallback: owner_id (legacy).
    const profileApartmentId = auth.profile.apartment_id
    if (profileApartmentId !== data.apartment_id) {
      const { data: legacyCheck } = await admin
        .from('settlement_apartments')
        .select('id')
        .eq('id', data.apartment_id)
        .eq('owner_id', auth.user.id)
        .maybeSingle()
      if (!legacyCheck) return { error: 'Brak uprawnień do tego lokalu' }
    }

    const { data: apt } = await admin
      .from('settlement_apartments')
      .select('id, community_id, number')
      .eq('id', data.apartment_id)
      .maybeSingle()
    if (!apt) return { error: 'Lokal nie istnieje' }

    // Sprawdź czy wspólnota ma włączone liczniki
    const { data: community } = await admin
      .from('communities')
      .select('water_meter_enabled')
      .eq('id', apt.community_id)
      .single()
    if (!community?.water_meter_enabled) return { error: 'Zgłaszanie odczytów jest wyłączone dla tej wspólnoty' }

    // Sprawdź czy nie ma już odczytu w tym miesiącu
    const month = data.reading_date.slice(0, 7) // YYYY-MM
    const { data: existing } = await admin
      .from('water_meter_readings')
      .select('id')
      .eq('apartment_id', data.apartment_id)
      .like('reading_date', `${month}%`)
      .in('status', ['pending', 'confirmed'])
      .maybeSingle()
    if (existing) return { error: 'Odczyt na ten miesiąc już został zgłoszony' }

    const { error } = await admin.from('water_meter_readings').insert({
      user_id: auth.user.id,
      apartment_id: data.apartment_id,
      community_id: apt.community_id,
      reading_value: data.reading_value,
      reading_date: data.reading_date,
      note: data.note?.trim() || null,
      status: 'pending',
    })

    if (error) return { error: error.message }

    revalidatePath('/admin/settlements')
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

export async function confirmReading(id: string): Promise<{ error?: string }> {
  try {
    const auth = await getAuthProfileAction()
    if (auth.error !== null) return { error: auth.error }
    if (auth.profile.role === 'user' || auth.profile.role === 'najemca') return { error: 'Brak uprawnień' }

    const admin = getSupabaseAdminClient()
    const { data: reading } = await admin
      .from('water_meter_readings')
      .select('community_id, apartment_id, reading_value, reading_date')
      .eq('id', id).single()

    if (!reading) return { error: 'Nie znaleziono odczytu' }
    if (auth.profile.role === 'admin' && reading.community_id !== auth.profile.community_id)
      return { error: 'Brak uprawnień do tej wspólnoty' }

    await admin.from('water_meter_readings')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), confirmed_by: auth.user.id })
      .eq('id', id)

    await logActivity({ userId: auth.user.id, action: 'confirm_water_reading', targetType: 'water_meter', targetId: id })
    revalidatePath('/admin/water-meters')
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

export async function rejectReading(id: string, reason: string): Promise<{ error?: string }> {
  try {
    const auth = await getAuthProfileAction()
    if (auth.error !== null) return { error: auth.error }
    if (auth.profile.role === 'user' || auth.profile.role === 'najemca') return { error: 'Brak uprawnień' }

    const admin = getSupabaseAdminClient()
    const { data: reading } = await admin
      .from('water_meter_readings')
      .select('community_id')
      .eq('id', id).single()

    if (!reading) return { error: 'Nie znaleziono odczytu' }
    if (auth.profile.role === 'admin' && reading.community_id !== auth.profile.community_id)
      return { error: 'Brak uprawnień do tej wspólnoty' }

    await admin.from('water_meter_readings')
      .update({ status: 'rejected', rejection_reason: reason || null })
      .eq('id', id)

    await logActivity({ userId: auth.user.id, action: 'reject_water_reading', targetType: 'water_meter', targetId: id })
    revalidatePath('/admin/water-meters')
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

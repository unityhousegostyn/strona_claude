'use server'

import { getAuthProfileAction } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/audit'
import { buildYearlyTable, type SettlementApartment, type SettlementEntry, type SettlementRate } from '@/lib/settlementCalc'

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

// ── SYNC ODCZYTÓW → ROZLICZENIA ───────────────────────────────────────────────
// Dla danej wspólnoty i roku: pobiera stawki, ustala model rozliczenia wody,
// i automatycznie wypełnia settlement_entries.water_m3 (model miesięczny)
// lub settlement_water_reconciliation (model wielomiesięczny).

export async function syncWaterToSettlements(
  communityId: string,
  year: number,
  overwrite = false,
): Promise<{
  model: string
  synced: number
  skipped: number
  errors: string[]
  debug?: string
}> {
  const fail = (msg: string, debug?: string) => ({ model: '?', synced: 0, skipped: 0, errors: [msg], debug })

  const auth = await getAuthProfileAction()
  if (auth.error !== null) return fail(auth.error)
  if (auth.profile.role !== 'super_admin') return fail('Tylko super_admin')
  if (year < 2000 || year > 2100) return fail('Nieprawidłowy rok')

  const admin = getSupabaseAdminClient()

  // 1. Pobierz stawki (najnowsze dla tej wspólnoty)
  const { data: ratesRows } = await admin
    .from('settlement_rates')
    .select('water_billing_type, water_reconciliation_months, water_price_m3, water_ryczalt_m3, effective_from')
    .eq('community_id', communityId)
    .order('effective_from', { ascending: false })
    .limit(1)

  const rates = ratesRows?.[0]
  if (!rates) return fail('Brak stawek dla tej wspólnoty')

  const billingType: string = rates.water_billing_type ?? 'ryczalt'
  const reconMonths: number = rates.water_reconciliation_months ?? 3

  // 2. Pobierz wszystkie lokale ze wspólnoty (active=true lub NULL — nie wykluczaj NULL)
  const { data: apts } = await admin
    .from('settlement_apartments')
    .select('id, number, community_id, area_m2, persons_count, has_meter, share_numerator, share_denominator, owner_id, owner_name, floor, notes, active')
    .eq('community_id', communityId)
    .neq('active', false)

  if (!apts?.length) return fail(`Brak lokali w tej wspólnoty (communityId=${communityId})`)

  // 3. Pobierz wszystkie potwierdzone odczyty dla tych lokali z zakresu roku
  //    (+1 miesiąc przed i po, żeby mieć granice okresu)
  const aptIds = apts.map(a => a.id)
  const { data: allReadings } = await admin
    .from('water_meter_readings')
    .select('apartment_id, reading_value, reading_date')
    .in('apartment_id', aptIds)
    .eq('status', 'confirmed')
    .gte('reading_date', `${year - 1}-12-01`)
    .lte('reading_date', `${year}-12-31`)
    .order('reading_date', { ascending: true })

  // Mapa: aptId → sorted readings array
  const readingsByApt = new Map<string, { value: number; ym: string }[]>()
  for (const r of allReadings ?? []) {
    const ym = (r.reading_date as string).slice(0, 7)
    if (!readingsByApt.has(r.apartment_id)) readingsByApt.set(r.apartment_id, [])
    readingsByApt.get(r.apartment_id)!.push({ value: r.reading_value, ym })
  }

  const now = new Date().toISOString()
  let synced = 0
  let skipped = 0
  const errors: string[] = []
  const debugInfo = `lokale=${apts.length} odczyty=${allReadings?.length ?? 0} model=${billingType}/${reconMonths}mies`

  // ── MODEL MIESIĘCZNY (reconMonths === 1) ─────────────────────────────────
  if (billingType === 'meter' && reconMonths === 1) {
    for (const apt of apts) {
      const readings = readingsByApt.get(apt.id) ?? []
      const byYM = new Map(readings.map(r => [r.ym, r.value]))

      for (let m = 1; m <= 12; m++) {
        const curYM = `${year}-${String(m).padStart(2, '0')}`
        const prevYear = m === 1 ? year - 1 : year
        const prevM = m === 1 ? 12 : m - 1
        const prevYM = `${prevYear}-${String(prevM).padStart(2, '0')}`

        const cur = byYM.get(curYM)
        const prev = byYM.get(prevYM)
        if (cur == null || prev == null) { skipped++; continue }

        const delta = Math.max(0, Math.round((cur - prev) * 1000) / 1000)

        // Sprawdź istniejący wpis
        const { data: existing } = await admin
          .from('settlement_entries')
          .select('id, water_m3, paid, water_correction')
          .eq('apartment_id', apt.id)
          .eq('year', year)
          .eq('month', m)
          .maybeSingle()

        if (existing && (existing.water_m3 ?? 0) !== 0 && !overwrite) { skipped++; continue }

        const { error } = await admin.from('settlement_entries').upsert({
          apartment_id: apt.id,
          community_id: communityId,
          year,
          month: m,
          paid: existing?.paid ?? 0,
          water_correction: existing?.water_correction ?? 0,
          water_m3: delta,
          updated_at: now,
        }, { onConflict: 'apartment_id,year,month' })

        if (error) { errors.push(`${apt.number}/${m}: ${error.message}`); continue }
        synced++
      }
    }
    return { model: 'miesięczny', synced, skipped, errors, debug: debugInfo }
  }

  // ── MODEL WIELOMIESIĘCZNY (kwartalny, półroczny, roczny) ──────────────────
  if (billingType === 'meter' || billingType === 'ryczalt' || billingType === 'zaliczka') {
    const numPeriods = Math.floor(12 / reconMonths)

    // Model zaliczka: potrzebujemy settlement_entries żeby policzyć ile mieszkaniec
    // faktycznie zapłacił za wodę w każdym okresie (budYearlyTable liczy to narastająco)
    let allFullRates: SettlementRate[] = []
    const entriesByApt = new Map<string, SettlementEntry[]>()

    if (billingType === 'zaliczka') {
      const { data: ratesAll } = await admin
        .from('settlement_rates')
        .select('*')
        .eq('community_id', communityId)
        .order('effective_from', { ascending: false })
      allFullRates = (ratesAll ?? []) as SettlementRate[]

      const { data: entriesAll } = await admin
        .from('settlement_entries')
        .select('id, apartment_id, year, month, paid, water_correction, water_m3, notes, persons_count')
        .in('apartment_id', aptIds)
        .eq('year', year)
      for (const e of entriesAll ?? []) {
        if (!entriesByApt.has(e.apartment_id)) entriesByApt.set(e.apartment_id, [])
        entriesByApt.get(e.apartment_id)!.push(e as unknown as SettlementEntry)
      }
    }

    for (const apt of apts) {
      const readings = readingsByApt.get(apt.id) ?? []
      const byYM = new Map(readings.map(r => [r.ym, r.value]))

      // Dla modelu zaliczka: wylicz rows raz per lokal
      let aptRows: ReturnType<typeof buildYearlyTable> | null = null
      if (billingType === 'zaliczka') {
        const aptEntries = entriesByApt.get(apt.id) ?? []
        aptRows = buildYearlyTable(apt as unknown as SettlementApartment, allFullRates, aptEntries, year)
      }

      for (let p = 1; p <= numPeriods; p++) {
        const startM = (p - 1) * reconMonths + 1  // pierwszy miesiąc okresu
        const endM = p * reconMonths               // ostatni miesiąc okresu

        // Stan na początku okresu = odczyt z miesiąca PRZED okresem
        const prevM = startM - 1
        const prevYear = prevM < 1 ? year - 1 : year
        const prevMonthReal = prevM < 1 ? 12 : prevM
        const startYM = `${prevYear}-${String(prevMonthReal).padStart(2, '0')}`
        const endYM = `${year}-${String(endM).padStart(2, '0')}`

        const startVal = byYM.get(startYM)
        const endVal = byYM.get(endYM)
        if (startVal == null || endVal == null) { skipped++; continue }

        // Sprawdź istniejące rozliczenie okresu
        const { data: existing } = await admin
          .from('settlement_water_reconciliation')
          .select('id')
          .eq('apartment_id', apt.id)
          .eq('year', year)
          .eq('quarter', p)
          .maybeSingle()

        if (existing && !overwrite) { skipped++; continue }

        const actual_m3 = Math.max(0, Math.round((endVal - startVal) * 1000) / 1000)

        // ryczalt_m3 dla zaliczki = suma row.water z miesięcy okresu (+1 offset:
        // wpłata za miesiąc X wpada w rozliczeniu w miesiącu X+1)
        let ryczalt_m3: number
        if (billingType === 'zaliczka' && aptRows) {
          const paidMonthsStart = (p - 1) * reconMonths + 2
          const sumWaterZl = Array.from({ length: reconMonths }, (_, i) => paidMonthsStart + i)
            .filter(m => m <= 12)
            .reduce((s, m) => s + (aptRows!.find(r => r.month === m)?.water ?? 0), 0)
          ryczalt_m3 = (rates.water_price_m3 ?? 0) > 0
            ? Math.round(sumWaterZl / rates.water_price_m3 * 1000) / 1000
            : 0
        } else {
          ryczalt_m3 = Math.round((rates.water_ryczalt_m3 ?? 0) * reconMonths * 1000) / 1000
        }

        const correction_m3 = Math.round((actual_m3 - ryczalt_m3) * 1000) / 1000
        const correction_amount = Math.round(correction_m3 * (rates.water_price_m3 ?? 0) * 100) / 100

        const { error } = await admin.from('settlement_water_reconciliation').upsert({
          apartment_id: apt.id,
          year,
          quarter: p,
          meter_reading_start: startVal,
          meter_reading_end: endVal,
          actual_m3,
          ryczalt_m3,
          correction_m3,
          correction_amount,
        }, { onConflict: 'apartment_id,year,quarter' })

        if (error) { errors.push(`${apt.number}/Q${p}: ${error.message}`); continue }
        synced++
      }
    }
    return { model: `${reconMonths}-miesięczny`, synced, skipped, errors, debug: debugInfo }
  }

  return fail(`Nieobsługiwany model: ${billingType}`)
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

'use server'

import { getAuthProfileAction } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/audit'

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

    // Sprawdź czy lokal należy do tego usera
    const { data: apt } = await admin
      .from('settlement_apartments')
      .select('id, community_id, number')
      .eq('id', data.apartment_id)
      .eq('owner_id', auth.user.id)
      .maybeSingle()
    if (!apt) return { error: 'Brak przypisanego lokalu' }

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
    if (auth.profile.role === 'user') return { error: 'Brak uprawnień' }

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
    if (auth.profile.role === 'user') return { error: 'Brak uprawnień' }

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

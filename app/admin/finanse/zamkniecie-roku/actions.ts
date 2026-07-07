'use server'

import { revalidatePath } from 'next/cache'
import { getAuthProfileAction } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { buildYearlyTable, type SettlementApartment, type SettlementEntry, type SettlementRate } from '@/lib/settlementCalc'
import { logActivity } from '@/lib/audit'

async function requireSuperAdmin() {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) return { error: auth.error, user: null, profile: null }
  if (auth.profile.role !== 'super_admin') return { error: 'Tylko super_admin może zamykać rok finansowy', user: null, profile: null }
  return { error: null, user: auth.user, profile: auth.profile }
}

async function requireAdminPlus(communityId: string) {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) return { error: auth.error, user: null, profile: null }
  if (!['super_admin', 'admin'].includes(auth.profile.role)) return { error: 'Brak uprawnień', user: null, profile: null }
  if (auth.profile.role === 'admin' && auth.profile.community_id !== communityId)
    return { error: 'Brak dostępu do tej wspólnoty', user: null, profile: null }
  return { error: null, user: auth.user, profile: auth.profile }
}

export interface YearClosureSummary {
  id: string
  year: number
  closed_at: string
  total_apartments: number
  total_paid: number
  total_due: number
  total_balance: number
  notes: string | null
}

export interface ApartmentClosingSummary {
  id: string
  number: string
  owner_name: string
  total_paid: number
  total_due: number
  balance: number   // paid - due
}

/** Pobierz listę zamkniętych lat dla wspólnoty */
export async function getYearClosures(communityId: string): Promise<YearClosureSummary[]> {
  const auth = await requireAdminPlus(communityId)
  if (auth.error) return []
  const admin = getSupabaseAdminClient()
  const { data } = await admin
    .from('year_closures')
    .select('*')
    .eq('community_id', communityId)
    .order('year', { ascending: false })
  return data ?? []
}

/** Sprawdź czy rok jest zamknięty */
export async function isYearClosed(communityId: string, year: number): Promise<boolean> {
  const admin = getSupabaseAdminClient()
  const { data } = await admin
    .from('year_closures')
    .select('id')
    .eq('community_id', communityId)
    .eq('year', year)
    .maybeSingle()
  return !!data
}

/** Wylicz podsumowanie rozliczeń roku przed zamknięciem (podgląd) */
export async function previewYearClose(communityId: string, year: number): Promise<{
  apartments: ApartmentClosingSummary[]
  totalPaid: number
  totalDue: number
  totalBalance: number
  error?: string
}> {
  const auth = await requireAdminPlus(communityId)
  if (auth.error) return { apartments: [], totalPaid: 0, totalDue: 0, totalBalance: 0, error: auth.error }

  const admin = getSupabaseAdminClient()

  const [aptsRes, ratesRes, entriesRes] = await Promise.all([
    admin.from('settlement_apartments').select('*').eq('community_id', communityId).eq('active', true).order('number'),
    admin.from('settlement_rates').select('*').eq('community_id', communityId).order('effective_from', { ascending: false }),
    admin.from('settlement_entries').select('*').eq('year', year)
      .in('apartment_id', []),  // filled below
  ])

  const apts: SettlementApartment[] = (aptsRes.data ?? []) as SettlementApartment[]
  const rates: SettlementRate[] = (ratesRes.data ?? []) as SettlementRate[]

  let entries: SettlementEntry[] = []
  if (apts.length > 0) {
    const aptIds = apts.map(a => a.id)
    const { data: entData } = await admin
      .from('settlement_entries').select('*')
      .eq('year', year).in('apartment_id', aptIds)
    entries = (entData ?? []) as SettlementEntry[]
  }

  const apartments: ApartmentClosingSummary[] = []
  for (const apt of apts) {
    const aptEntries = entries.filter(e => e.apartment_id === apt.id)
    const rows = buildYearlyTable(apt, rates, aptEntries, year)
    const totalPaid = rows.reduce((s, r) => s + r.paid, 0)
    const totalDue  = rows.reduce((s, r) => s + r.total_due, 0)
    apartments.push({
      id: apt.id,
      number: apt.number,
      owner_name: apt.owner_name,
      total_paid: Math.round(totalPaid * 100) / 100,
      total_due:  Math.round(totalDue  * 100) / 100,
      balance:    Math.round((totalPaid - totalDue) * 100) / 100,
    })
  }

  const totalPaid    = apartments.reduce((s, a) => s + a.total_paid, 0)
  const totalDue     = apartments.reduce((s, a) => s + a.total_due,  0)
  const totalBalance = apartments.reduce((s, a) => s + a.balance,    0)

  return {
    apartments,
    totalPaid:    Math.round(totalPaid    * 100) / 100,
    totalDue:     Math.round(totalDue     * 100) / 100,
    totalBalance: Math.round(totalBalance * 100) / 100,
  }
}

/**
 * Zamknij rok finansowy:
 * 1. Wylicz saldo końcowe każdego lokalu
 * 2. Ustaw saldo otwarcia na rok+1 = saldo końcowe zamykanego roku
 * 3. Zapisz rekord w year_closures
 *
 * Tylko super_admin może zamykać lata (nieodwracalna operacja).
 */
export async function closeYear(
  communityId: string,
  year: number,
  notes?: string
): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireSuperAdmin()
  if (auth.error) return { error: auth.error }

  if (notes && notes.trim().length > 1000) return { error: 'Notatka może mieć maksymalnie 1000 znaków' }

  const admin = getSupabaseAdminClient()

  // Sprawdź czy już zamknięty
  const { data: existing } = await admin
    .from('year_closures').select('id').eq('community_id', communityId).eq('year', year).maybeSingle()
  if (existing) return { error: `Rok ${year} jest już zamknięty.` }

  // Wylicz podsumowanie
  const preview = await previewYearClose(communityId, year)
  if (preview.error) return { error: preview.error }

  // Ustaw saldo otwarcia na rok+1 dla każdego lokalu
  const nextYear = year + 1
  const balanceRows = preview.apartments.map(apt => ({
    apartment_id: apt.id,
    year: nextYear,
    balance: apt.balance,
    updated_at: new Date().toISOString(),
  }))

  if (balanceRows.length > 0) {
    const { error: balErr } = await admin
      .from('settlement_opening_balances')
      .upsert(balanceRows, { onConflict: 'apartment_id,year' })
    if (balErr) return { error: `Błąd przenoszenia sald: ${balErr.message}` }
  }

  // Zapisz zamknięcie
  const { error: closeErr } = await admin.from('year_closures').insert({
    community_id: communityId,
    year,
    closed_by: auth.user!.id,
    total_apartments: preview.apartments.length,
    total_paid: preview.totalPaid,
    total_due: preview.totalDue,
    total_balance: preview.totalBalance,
    notes: notes?.trim() || null,
  })

  if (closeErr) return { error: closeErr.message }

  await logActivity({
    userId: auth.user!.id,
    action: 'close_year',
    targetType: 'community',
    targetId: communityId,
    meta: { year, total_apartments: preview.apartments.length, total_balance: preview.totalBalance },
  })

  revalidatePath('/admin/finanse/zamkniecie-roku')
  revalidatePath('/admin/settlements')
  return { success: true }
}

/** Ponowne otwarcie roku (tylko super_admin, np. po pomyłce) */
export async function reopenYear(communityId: string, year: number): Promise<{ error?: string }> {
  const auth = await requireSuperAdmin()
  if (auth.error) return { error: auth.error }

  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from('year_closures')
    .delete()
    .eq('community_id', communityId)
    .eq('year', year)

  if (error) return { error: error.message }

  await logActivity({
    userId: auth.user!.id,
    action: 'reopen_year',
    targetType: 'community',
    targetId: communityId,
    meta: { year },
  })

  revalidatePath('/admin/finanse/zamkniecie-roku')
  return {}
}

'use server'

import { revalidatePath } from 'next/cache'
import { getAuthProfileAction } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { ksefAuth, ksefQueryInvoices, guessCategory, type KsefEnvironment } from '@/lib/ksef'

// ── Auth helper ───────────────────────────────────────────────────────────────

async function requireSuperAdmin() {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) return { error: auth.error as string, user: null }
  if (auth.profile.role !== 'super_admin') return { error: 'Tylko super_admin', user: null }
  return { error: null, user: auth.user }
}

// ── Ustawienia KSeF ───────────────────────────────────────────────────────────

export interface KsefSettings {
  id: string
  nip: string
  ksef_token: string
  environment: KsefEnvironment
  sync_from_date: string | null
  last_sync_at: string | null
  last_sync_status: string | null
  last_sync_count: number
  enabled: boolean
}

export async function getKsefSettings(): Promise<{ settings: KsefSettings | null; error?: string }> {
  const auth = await requireSuperAdmin()
  if (auth.error) return { settings: null, error: auth.error }
  const admin = getSupabaseAdminClient()
  const { data } = await admin.from('ksef_settings').select('*').maybeSingle()
  return { settings: data as KsefSettings | null }
}

export async function saveKsefSettings(data: {
  nip: string
  ksef_token: string
  environment: KsefEnvironment
  sync_from_date: string
  enabled: boolean
}): Promise<{ error?: string }> {
  const auth = await requireSuperAdmin()
  if (auth.error) return { error: auth.error }

  if (data.nip && !/^\d{10}$/.test(data.nip)) return { error: 'NIP musi mieć dokładnie 10 cyfr' }

  const admin = getSupabaseAdminClient()
  const { data: existing } = await admin.from('ksef_settings').select('id').maybeSingle()

  const payload = {
    nip: data.nip.trim(),
    ksef_token: data.ksef_token.trim(),
    environment: data.environment,
    sync_from_date: data.sync_from_date || null,
    enabled: data.enabled,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { error } = await admin.from('ksef_settings').update(payload).eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await admin.from('ksef_settings').insert(payload)
    if (error) return { error: error.message }
  }

  revalidatePath('/admin/ksef')
  return {}
}

// ── Historia syncronizacji ────────────────────────────────────────────────────

export interface SyncLogEntry {
  id: string
  started_at: string
  finished_at: string | null
  status: string
  invoices_fetched: number
  invoices_imported: number
  invoices_skipped: number
  error_message: string | null
}

export async function getSyncLog(): Promise<SyncLogEntry[]> {
  const admin = getSupabaseAdminClient()
  const { data } = await admin
    .from('ksef_sync_log')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(20)
  return (data ?? []) as SyncLogEntry[]
}

// ── Kolejka faktur ────────────────────────────────────────────────────────────

export interface QueueItem {
  id: string
  ksef_number: string | null
  invoice_date: string | null
  issue_date: string | null
  seller_name: string | null
  seller_nip: string | null
  buyer_nip: string | null
  net_amount: number | null
  vat_amount: number | null
  gross_amount: number | null
  description: string | null
  suggested_category: string | null
  status: string
  community_id: string | null
  expense_id: string | null
  created_at: string
}

export async function getKsefQueue(
  status: 'pending' | 'imported' | 'skipped' | 'all' = 'pending',
): Promise<{ items: QueueItem[]; error?: string }> {
  const admin = getSupabaseAdminClient()
  let q = admin
    .from('ksef_invoice_queue')
    .select('*')
    .order('invoice_date', { ascending: false })
    .limit(200)

  if (status !== 'all') q = q.eq('status', status)

  const { data, error } = await q
  if (error) return { items: [], error: error.message }
  return { items: (data ?? []) as QueueItem[] }
}

/**
 * Importuje fakturę z kolejki jako community_expense.
 * Tworzy wpis w community_expenses i oznacza queue item jako 'imported'.
 */
export async function importQueueItem(
  queueId: string,
  communityId: string,
  category: string,
  description: string,
  expenseDate: string,
): Promise<{ error?: string }> {
  const auth = await requireSuperAdmin()
  if (auth.error) return { error: auth.error }

  const admin = getSupabaseAdminClient()
  const { data: item } = await admin
    .from('ksef_invoice_queue')
    .select('*')
    .eq('id', queueId)
    .single()

  if (!item) return { error: 'Faktura nie istnieje w kolejce' }
  if (item.status === 'imported') return { error: 'Faktura została już zaimportowana' }

  // Utwórz community_expense
  const { data: expense, error: expErr } = await admin.from('community_expenses').insert({
    community_id: communityId,
    category,
    description: description.trim(),
    amount: item.gross_amount ?? 0,
    expense_date: expenseDate,
    invoice_number: item.ksef_number ?? undefined,
    is_renovation_fund: category === 'fundusz_remontowy',
    created_by: auth.user!.id,
  }).select('id').single()

  if (expErr) return { error: expErr.message }

  // Zaktualizuj status w kolejce
  await admin.from('ksef_invoice_queue').update({
    status: 'imported',
    community_id: communityId,
    expense_id: expense?.id,
    updated_at: new Date().toISOString(),
  }).eq('id', queueId)

  revalidatePath('/admin/ksef')
  revalidatePath('/admin/finanse/koszty')
  return {}
}

export async function skipQueueItem(queueId: string): Promise<{ error?: string }> {
  const auth = await requireSuperAdmin()
  if (auth.error) return { error: auth.error }

  const admin = getSupabaseAdminClient()
  await admin.from('ksef_invoice_queue').update({
    status: 'skipped',
    updated_at: new Date().toISOString(),
  }).eq('id', queueId)

  revalidatePath('/admin/ksef')
  return {}
}

// ── Ręczna synchronizacja ─────────────────────────────────────────────────────

export async function runKsefSync(): Promise<{
  error?: string
  imported?: number
  fetched?: number
}> {
  const auth = await requireSuperAdmin()
  if (auth.error) return { error: auth.error }

  const admin = getSupabaseAdminClient()

  // Pobierz ustawienia
  const { data: settings } = await admin.from('ksef_settings').select('*').maybeSingle()
  if (!settings) return { error: 'Brak konfiguracji KSeF. Skonfiguruj token w zakładce Ustawienia.' }
  if (!settings.enabled) return { error: 'Integracja KSeF jest wyłączona w ustawieniach.' }
  if (!settings.ksef_token || !settings.nip) return { error: 'Uzupełnij NIP i token KSeF.' }

  // Utwórz log entry
  const { data: logEntry } = await admin.from('ksef_sync_log').insert({
    status: 'running',
  }).select('id').single()
  const logId = logEntry?.id

  let fetched = 0
  let imported = 0
  let skipped = 0

  try {
    // Uwierzytelnienie
    const auth2 = await ksefAuth(settings.nip, settings.ksef_token, settings.environment)

    // Zakres dat: od last_sync_at lub sync_from_date, do teraz
    const dateTo = new Date()
    let dateFrom: Date
    if (settings.last_sync_at) {
      dateFrom = new Date(settings.last_sync_at)
      // Cofnij o 1 godzinę żeby nie pominąć faktur przy chwilowym opóźnieniu
      dateFrom.setHours(dateFrom.getHours() - 1)
    } else if (settings.sync_from_date) {
      dateFrom = new Date(settings.sync_from_date)
    } else {
      // Domyślnie: ostatnie 30 dni
      dateFrom = new Date()
      dateFrom.setDate(dateFrom.getDate() - 30)
    }

    // Pobierz listę faktur
    const invoices = await ksefQueryInvoices(auth2.accessToken, settings.environment, dateFrom, dateTo)
    fetched = invoices.length

    // Pobierz listę NIP-ów wspólnot dla automatycznego dopasowania
    const { data: communities } = await admin.from('communities').select('id, nip')
    const nipMap = new Map<string, string>() // nip → community_id
    for (const c of communities ?? []) {
      if (c.nip) nipMap.set(c.nip, c.id)
    }

    // Przetwórz faktury — dodaj do kolejki (pomiń duplikaty)
    for (const inv of invoices) {
      // Sprawdź duplikat
      const { data: dup } = await admin
        .from('ksef_invoice_queue')
        .select('id')
        .eq('ksef_number', inv.kseNumber)
        .maybeSingle()

      if (dup) { skipped++; continue }

      const communityId = nipMap.get(inv.buyerNip) ?? null
      const suggestedCategory = guessCategory(inv.sellerName)

      await admin.from('ksef_invoice_queue').insert({
        ksef_number: inv.kseNumber,
        invoice_date: inv.invoiceDate || null,
        issue_date: inv.issueDate || null,
        seller_name: inv.sellerName,
        seller_nip: inv.sellerNip,
        buyer_nip: inv.buyerNip,
        net_amount: inv.netAmount,
        vat_amount: inv.vatAmount,
        gross_amount: inv.grossAmount,
        suggested_category: suggestedCategory,
        // Jeśli NIP pasuje do wspólnoty, ustaw ją od razu
        community_id: communityId,
        status: 'pending',
        sync_log_id: logId,
      })
      imported++
    }

    // Zaktualizuj log i last_sync_at
    await admin.from('ksef_sync_log').update({
      finished_at: new Date().toISOString(),
      status: 'success',
      invoices_fetched: fetched,
      invoices_imported: imported,
      invoices_skipped: skipped,
    }).eq('id', logId)

    await admin.from('ksef_settings').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'success',
      last_sync_count: imported,
    }).eq('id', settings.id)

  } catch (e: any) {
    const msg = e?.message ?? 'Nieznany błąd'
    await admin.from('ksef_sync_log').update({
      finished_at: new Date().toISOString(),
      status: 'error',
      invoices_fetched: fetched,
      invoices_imported: imported,
      invoices_skipped: skipped,
      error_message: msg,
    }).eq('id', logId)

    await admin.from('ksef_settings').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'error',
    }).eq('id', settings.id)

    revalidatePath('/admin/ksef')
    return { error: msg }
  }

  revalidatePath('/admin/ksef')
  revalidatePath('/admin/finanse/koszty')
  return { fetched, imported }
}

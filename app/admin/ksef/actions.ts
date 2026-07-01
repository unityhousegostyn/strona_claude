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

// ── Diagnostyka API KSeF ─────────────────────────────────────────────────────

export async function diagnoseKsefApi(env: 'prod' | 'test' = 'prod'): Promise<{
  results: { url: string; method: string; status: number; contentType: string; preview: string }[]
  error?: string
}> {
  // L1-FIX: brak auth w poprzedniej wersji — każdy mógł wywołać ten Server Action
  const auth = await requireSuperAdmin()
  if (auth.error) return { results: [], error: auth.error }

  const base = env === 'prod'
    ? 'https://api.ksef.mf.gov.pl/v2'
    : 'https://api-test.ksef.mf.gov.pl/v2'

  type Target = { url: string; method: string; body?: string; headers?: Record<string, string> }

  const dummyNip = '0000000000'
  const dummyChallenge = 'test-challenge'
  const dummyToken = 'test-token'
  const dummyRef = 'test-ref-12345'
  const qRef = encodeURIComponent(dummyRef)

  const targets: Target[] = [
    { url: `${base}/`, method: 'GET' },
    { url: `${base}/auth/challenge`, method: 'POST' },
    { url: `${base}/security/public-key-certificates`, method: 'GET' },
    { url: `${base}/auth/ksef-token`, method: 'POST', body: JSON.stringify({ challenge: dummyChallenge, contextIdentifier: { type: 'Nip', value: dummyNip }, encryptedToken: 'dummyEncrypted==', publicKeyId: 'dummyKeyId' }) },
    { url: `${base}/auth/${qRef}`, method: 'GET', headers: { Authorization: `Bearer ${dummyToken}` } },
    { url: `${base}/auth/token/redeem`, method: 'POST', headers: { Authorization: `Bearer ${dummyToken}` } },
  ]

  const results = await Promise.all(targets.map(async t => {
    try {
      const isGet = t.method === 'GET' || t.method === 'OPTIONS'
      const res = await fetch(t.url, {
        method: t.method,
        headers: {
          ...(isGet ? {} : { 'Content-Type': 'application/json' }),
          'Accept': 'application/json, text/html',
          ...(t.headers ?? {}),
        },
        body: t.body,
        signal: AbortSignal.timeout(8000),
      })
      const text = await res.text()
      const contentType = res.headers.get('content-type') ?? ''
      const allow = res.headers.get('allow') ?? ''
      const preview = (allow ? `[Allow: ${allow}] ` : '') + text.slice(0, 250)
      return { url: t.url, method: t.method, status: res.status, contentType, preview }
    } catch (e: any) {
      return { url: t.url, method: t.method, status: 0, contentType: 'error', preview: e?.message ?? String(e) }
    }
  }))

  return { results }
}

// ── Diagnostyka zapytań o faktury ─────────────────────────────────────────────

export async function diagnoseKsefQuery(communityId: string): Promise<{
  error?: string
  nip?: string
  rows: { subjectType: string; dateType: string; count: number; samples: string[]; error?: string }[]
  rawFirstInvoice?: string
}> {
  const auth = await requireSuperAdmin()
  if (auth.error) return { error: auth.error, rows: [] }

  const admin = getSupabaseAdminClient()
  const { data: settings } = await admin.from('ksef_settings').select('*').eq('community_id', communityId).maybeSingle()
  if (!settings?.ksef_token || !settings?.nip) return { error: 'Brak konfiguracji KSeF dla tej wspólnoty', rows: [] }

  let accessToken: string
  try {
    const a = await (await import('@/lib/ksef')).ksefAuth(settings.nip, settings.ksef_token, settings.environment)
    accessToken = a.accessToken
  } catch (e: any) {
    return { error: `Auth failed: ${e?.message}`, rows: [] }
  }

  const base = settings.environment === 'prod'
    ? 'https://api.ksef.mf.gov.pl/v2'
    : 'https://api-test.ksef.mf.gov.pl/v2'

  const dateTo = new Date()
  const dateFrom89 = new Date(dateTo)
  dateFrom89.setDate(dateFrom89.getDate() - 89)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const combos = [
    { subjectType: 'Subject1',          dateType: 'Issue' },
    { subjectType: 'Subject2',          dateType: 'Issue' },
    { subjectType: 'SubjectAuthorized', dateType: 'Issue' },
  ]

  let rawFirstInvoice: string | null = null

  const rows = await Promise.all(combos.map(async ({ subjectType, dateType }) => {
    try {
      const res = await fetch(
        `${base}/invoices/query/metadata?pageOffset=0&pageSize=10`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
          body: JSON.stringify({ subjectType, dateRange: { from: fmt(dateFrom89), to: fmt(dateTo), dateType } }),
        },
      )
      const text = await res.text()
      if (!res.ok) return { subjectType, dateType, count: 0, samples: [], error: `HTTP ${res.status}: ${text.slice(0, 400)}` }
      const json = JSON.parse(text)
      const invoices: any[] = json?.invoices ?? json?.data?.invoices ?? []
      const total: number = json?.totalCount ?? json?.total ?? invoices.length
      if (!rawFirstInvoice && invoices.length > 0) {
        rawFirstInvoice = JSON.stringify(invoices[0], null, 2).slice(0, 1500)
      }
      const samples = invoices.slice(0, 3).map((inv: any) => {
        const nr = inv.kseNumber ?? inv.ksefNumber ?? inv.referenceNumber ?? '?'
        const date = inv.invoiceDate ?? inv.issueDate ?? inv.issueDateTime?.slice(0,10) ?? '?'
        const seller = inv.sellerName ?? inv.seller?.name ?? '?'
        return `${nr} | ${date} | ${seller}`
      })
      return { subjectType, dateType, count: total, samples }
    } catch (e: any) {
      return { subjectType, dateType, count: 0, samples: [], error: e?.message ?? 'błąd' }
    }
  }))

  return { nip: settings.nip, rows, rawFirstInvoice: rawFirstInvoice ?? undefined }
}

// ── Ustawienia KSeF ───────────────────────────────────────────────────────────

export interface KsefSettings {
  id: string
  community_id: string | null
  nip: string
  ksef_token: string
  environment: KsefEnvironment
  sync_from_date: string | null
  last_sync_at: string | null
  last_sync_status: string | null
  last_sync_count: number
  enabled: boolean
  auto_import: boolean
}

/** Wszystkie konfiguracje KSeF (per wspólnota) */
export async function getAllKsefSettings(): Promise<{ settings: KsefSettings[]; error?: string }> {
  const auth = await requireSuperAdmin()
  if (auth.error) return { settings: [], error: auth.error }
  const admin = getSupabaseAdminClient()
  const { data } = await admin.from('ksef_settings').select('*').not('community_id', 'is', null)
  return { settings: (data ?? []) as KsefSettings[] }
}

/** Konfiguracja KSeF dla konkretnej wspólnoty */
export async function getKsefSettings(communityId: string): Promise<{ settings: KsefSettings | null; error?: string }> {
  const auth = await requireSuperAdmin()
  if (auth.error) return { settings: null, error: auth.error }
  const admin = getSupabaseAdminClient()
  const { data } = await admin.from('ksef_settings').select('*').eq('community_id', communityId).maybeSingle()
  return { settings: data as KsefSettings | null }
}

export async function saveKsefSettings(data: {
  community_id: string
  nip: string
  ksef_token: string
  environment: KsefEnvironment
  sync_from_date: string
  enabled: boolean
  auto_import: boolean
}): Promise<{ error?: string }> {
  const auth = await requireSuperAdmin()
  if (auth.error) return { error: auth.error }

  if (data.nip && !/^\d{10}$/.test(data.nip)) return { error: 'NIP musi mieć dokładnie 10 cyfr' }

  const admin = getSupabaseAdminClient()
  const { data: existing } = await admin.from('ksef_settings').select('id').eq('community_id', data.community_id).maybeSingle()

  const payload = {
    community_id: data.community_id,
    nip: data.nip.trim(),
    ksef_token: data.ksef_token.trim(),
    environment: data.environment,
    sync_from_date: data.sync_from_date || null,
    enabled: data.enabled,
    auto_import: data.auto_import,
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

// ── Uzupełnij invoice_number dla istniejących wierszy ────────────────────────

export async function refreshInvoiceNumbers(communityId: string): Promise<{
  error?: string
  updated?: number
  skipped?: number
}> {
  const auth = await requireSuperAdmin()
  if (auth.error) return { error: auth.error }

  const admin = getSupabaseAdminClient()
  const { data: settings } = await admin.from('ksef_settings').select('*').eq('community_id', communityId).maybeSingle()
  if (!settings?.ksef_token || !settings?.nip) return { error: 'Brak konfiguracji KSeF dla tej wspólnoty' }

  const { data: rows } = await admin
    .from('ksef_invoice_queue')
    .select('id, ksef_number')
    .is('invoice_number', null)
    .not('ksef_number', 'is', null)

  if (!rows?.length) return { updated: 0, skipped: 0 }

  let accessToken: string
  try {
    const a = await ksefAuth(settings.nip, settings.ksef_token, settings.environment)
    accessToken = a.accessToken
  } catch (e: any) {
    return { error: `Auth failed: ${e?.message}` }
  }

  const dateTo = new Date()
  const windowStart = settings.sync_from_date ? new Date(settings.sync_from_date) : (() => {
    const d = new Date(); d.setDate(d.getDate() - 89); return d
  })()

  const allInvoices = await ksefQueryInvoices(accessToken, settings.environment, windowStart, dateTo)

  const numMap = new Map<string, string>()
  for (const inv of allInvoices) {
    if (inv.kseNumber && inv.invoiceNumber) numMap.set(inv.kseNumber, inv.invoiceNumber)
  }

  let updated = 0, skipped = 0
  for (const row of rows) {
    const invoiceNumber = row.ksef_number ? numMap.get(row.ksef_number) : undefined
    if (invoiceNumber) {
      await admin.from('ksef_invoice_queue').update({ invoice_number: invoiceNumber }).eq('id', row.id)
      updated++
    } else {
      skipped++
    }
  }

  revalidatePath('/admin/ksef')
  return { updated, skipped }
}

// ── Skan konkretnego zakresu dat ──────────────────────────────────────────────

export async function scanKsefDateRange(daysBack: number = 7, communityId: string): Promise<{
  error?: string
  nip?: string
  dateFrom?: string
  dateTo?: string
  invoices: {
    kseNumber: string
    invoiceDate: string
    issueDate: string
    sellerName: string
    sellerNip: string
    buyerNip: string
    inDatabase: boolean
    dbStatus?: string
  }[]
}> {
  const auth = await requireSuperAdmin()
  if (auth.error) return { error: auth.error, invoices: [] }

  const admin = getSupabaseAdminClient()
  const { data: settings } = await admin.from('ksef_settings').select('*').eq('community_id', communityId).maybeSingle()
  if (!settings?.ksef_token || !settings?.nip) return { error: 'Brak konfiguracji KSeF dla tej wspólnoty', invoices: [] }

  let accessToken: string
  try {
    const a = await ksefAuth(settings.nip, settings.ksef_token, settings.environment)
    accessToken = a.accessToken
  } catch (e: any) {
    return { error: `Auth failed: ${e?.message}`, invoices: [] }
  }

  const base = settings.environment === 'prod'
    ? 'https://api.ksef.mf.gov.pl/v2'
    : 'https://api-test.ksef.mf.gov.pl/v2'

  const dateTo = new Date()
  const dateFrom = new Date(dateTo)
  const safeDaysBack = Math.min(Math.max(1, Math.floor(daysBack)), 89)
  dateFrom.setDate(dateFrom.getDate() - safeDaysBack)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const subjectTypes = ['Subject1', 'Subject2', 'SubjectAuthorized'] as const
  const allRaw: any[] = []

  for (const st of subjectTypes) {
    try {
      const res = await fetch(
        `${base}/invoices/query/metadata?pageOffset=0&pageSize=100`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
          body: JSON.stringify({ subjectType: st, dateRange: { from: fmt(dateFrom), to: fmt(dateTo), dateType: 'Issue' } }),
        },
      )
      if (!res.ok) continue
      const json = await res.json()
      const invoices: any[] = json?.invoices ?? json?.data?.invoices ?? json?.items ?? []
      for (const inv of invoices) allRaw.push({ ...inv, _subjectType: st })
    } catch { /* ignore */ }
  }

  const seen = new Set<string>()
  const unique = allRaw.filter(inv => {
    const key = inv.kseNumber ?? inv.ksefNumber ?? inv.referenceNumber ?? Math.random().toString()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const kseNumbers = unique.map(i => i.kseNumber ?? i.ksefNumber ?? i.referenceNumber ?? '').filter(Boolean)
  const { data: dbRows } = await admin
    .from('ksef_invoice_queue')
    .select('ksef_number, status')
    .in('ksef_number', kseNumbers.length > 0 ? kseNumbers : ['__none__'])

  const dbMap = new Map<string, string>()
  for (const row of dbRows ?? []) {
    if (row.ksef_number) dbMap.set(row.ksef_number, row.status)
  }

  const invoices = unique.map(inv => {
    const kseNumber = String(inv.kseNumber ?? inv.ksefNumber ?? inv.referenceNumber ?? '')
    const status = dbMap.get(kseNumber)
    return {
      kseNumber,
      invoiceDate: String(inv.invoiceDate ?? inv.issuedAt ?? ''),
      issueDate:   String(inv.issueDate ?? inv.issueDateTime?.slice(0,10) ?? ''),
      sellerName:  String(inv.sellerName ?? inv.seller?.name ?? ''),
      sellerNip:   String(inv.sellerNip ?? inv.seller?.identifier ?? ''),
      buyerNip:    String(inv.buyerNip  ?? inv.buyer?.identifier ?? ''),
      inDatabase:  dbMap.has(kseNumber),
      dbStatus:    status,
    }
  }).sort((a, b) => (b.invoiceDate || b.issueDate).localeCompare(a.invoiceDate || a.issueDate))

  return { nip: settings.nip, dateFrom: fmt(dateFrom), dateTo: fmt(dateTo), invoices }
}

// ── Pamięć kategorii sprzedawców ─────────────────────────────────────────────

export interface SellerMapping {
  id: string
  community_id: string
  seller_nip: string
  seller_name: string | null
  category: string
  updated_at: string
}

export async function getSellerMappings(communityId: string): Promise<SellerMapping[]> {
  const admin = getSupabaseAdminClient()
  const { data } = await admin
    .from('ksef_seller_mapping')
    .select('*')
    .eq('community_id', communityId)
    .order('seller_name', { ascending: true })
  return (data ?? []) as SellerMapping[]
}

export async function getAllSellerMappings(): Promise<SellerMapping[]> {
  const admin = getSupabaseAdminClient()
  const { data } = await admin
    .from('ksef_seller_mapping')
    .select('*')
    .order('seller_name', { ascending: true })
  return (data ?? []) as SellerMapping[]
}

export async function updateSellerMapping(id: string, category: string): Promise<{ error?: string }> {
  const auth = await requireSuperAdmin()
  if (auth.error) return { error: auth.error }
  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from('ksef_seller_mapping')
    .update({ category, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/ksef')
  return {}
}

export async function deleteSellerMapping(id: string): Promise<{ error?: string }> {
  const auth = await requireSuperAdmin()
  if (auth.error) return { error: auth.error }
  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('ksef_seller_mapping').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/ksef')
  return {}
}

// ── Historia synchronizacji ───────────────────────────────────────────────────

export interface SyncLogEntry {
  id: string
  community_id: string | null
  started_at: string
  finished_at: string | null
  status: string
  invoices_fetched: number
  invoices_imported: number
  invoices_skipped: number
  error_message: string | null
}

export async function getSyncLog(communityId?: string): Promise<SyncLogEntry[]> {
  const admin = getSupabaseAdminClient()
  let q = admin
    .from('ksef_sync_log')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(20)
  if (communityId) q = q.eq('community_id', communityId)
  const { data } = await q
  return (data ?? []) as SyncLogEntry[]
}

// ── Kolejka faktur ────────────────────────────────────────────────────────────

export interface QueueItem {
  id: string
  ksef_number: string | null
  invoice_number: string | null
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

  await admin.from('ksef_invoice_queue').update({
    status: 'imported',
    community_id: communityId,
    expense_id: expense?.id,
    updated_at: new Date().toISOString(),
  }).eq('id', queueId)

  // Zapamiętaj kategorię dla tego sprzedawcy (pamięć kontrahentów)
  if (item.seller_nip) {
    await admin.from('ksef_seller_mapping').upsert({
      community_id: communityId,
      seller_nip: item.seller_nip,
      seller_name: item.seller_name ?? undefined,
      category,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'community_id,seller_nip' })
  }

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

export async function restoreQueueItem(queueId: string): Promise<{ error?: string }> {
  const auth = await requireSuperAdmin()
  if (auth.error) return { error: auth.error }

  const admin = getSupabaseAdminClient()
  await admin.from('ksef_invoice_queue').update({
    status: 'pending',
    updated_at: new Date().toISOString(),
  }).eq('id', queueId)

  revalidatePath('/admin/ksef')
  return {}
}

// ── Ręczna synchronizacja ─────────────────────────────────────────────────────

export async function runKsefSync(communityId: string): Promise<{
  error?: string
  imported?: number
  fetched?: number
  skipped?: number
  dateFrom?: string
  dateTo?: string
  insertErrors?: string[]
}> {
  const auth = await requireSuperAdmin()
  if (auth.error) return { error: auth.error }

  const admin = getSupabaseAdminClient()

  const { data: settings } = await admin.from('ksef_settings').select('*').eq('community_id', communityId).maybeSingle()
  if (!settings) return { error: 'Brak konfiguracji KSeF. Skonfiguruj token w zakładce Ustawienia.' }
  if (!settings.enabled) return { error: 'Integracja KSeF jest wyłączona w ustawieniach.' }
  if (!settings.ksef_token || !settings.nip) return { error: 'Uzupełnij NIP i token KSeF.' }

  const { data: logEntry } = await admin.from('ksef_sync_log').insert({
    status: 'running',
    community_id: communityId,
  }).select('id').single()
  const logId = logEntry?.id

  let fetched = 0, imported = 0, autoImported = 0, skipped = 0
  let windowStartISO = '', dateToISO = ''
  let insertErrorsOut: string[] = []

  try {
    const auth2 = await ksefAuth(settings.nip, settings.ksef_token, settings.environment)

    const dateTo = new Date()
    const syncFromDate = settings.sync_from_date ? new Date(settings.sync_from_date) : null
    let windowStart: Date
    if (syncFromDate) {
      windowStart = syncFromDate
    } else if (settings.last_sync_at) {
      const fromLastSync = new Date(settings.last_sync_at)
      fromLastSync.setHours(fromLastSync.getHours() - 1)
      windowStart = fromLastSync
    } else {
      windowStart = new Date()
      windowStart.setDate(windowStart.getDate() - 30)
    }
    windowStartISO = windowStart.toISOString().slice(0, 10)
    dateToISO = dateTo.toISOString().slice(0, 10)

    const MAX_WINDOW_DAYS = 89
    const allInvoices: Awaited<ReturnType<typeof ksefQueryInvoices>> = []
    let cursor = new Date(windowStart)
    while (cursor < dateTo) {
      const windowEnd = new Date(cursor)
      windowEnd.setDate(windowEnd.getDate() + MAX_WINDOW_DAYS)
      if (windowEnd > dateTo) windowEnd.setTime(dateTo.getTime())
      const chunk = await ksefQueryInvoices(auth2.accessToken, settings.environment, cursor, windowEnd)
      allInvoices.push(...chunk)
      cursor.setDate(cursor.getDate() + MAX_WINDOW_DAYS)
    }

    fetched = allInvoices.length

    const { data: communities } = await admin.from('communities').select('id, nip')
    const nipMap = new Map<string, string>()
    for (const c of communities ?? []) {
      if (c.nip) nipMap.set(c.nip, c.id)
    }

    // Załaduj pamięć kategorii kontrahentów dla tej wspólnoty
    const { data: sellerMappings } = await admin
      .from('ksef_seller_mapping')
      .select('seller_nip, category')
      .eq('community_id', communityId)
    const sellerCategoryMap = new Map<string, string>()
    for (const m of sellerMappings ?? []) {
      sellerCategoryMap.set(m.seller_nip, m.category)
    }

    const insertErrors: string[] = []
    for (const inv of allInvoices) {
      const ksef_number = inv.kseNumber || null

      if (ksef_number) {
        const { data: dup } = await admin
          .from('ksef_invoice_queue')
          .select('id')
          .eq('ksef_number', ksef_number)
          .maybeSingle()
        if (dup) { skipped++; continue }
      }

      const invCommunityId = nipMap.get(inv.buyerNip) ?? null
      const sellerNipClean = String(inv.sellerNip ?? '').slice(0, 10)
      const category = sellerCategoryMap.get(sellerNipClean) ?? guessCategory(inv.sellerName)

      // Auto-import: gdy włączony i buyer NIP pasuje do NIP wspólnoty
      if (settings.auto_import && inv.buyerNip && inv.buyerNip === settings.nip) {
        const expenseDate = inv.invoiceDate ?? inv.issueDate ?? new Date().toISOString().slice(0, 10)
        const { error: expErr } = await admin.from('community_expenses').insert({
          community_id: communityId,
          category,
          description: inv.sellerName ?? 'Faktura KSeF',
          amount: inv.grossAmount ?? 0,
          expense_date: expenseDate,
          invoice_number: ksef_number ?? undefined,
          is_renovation_fund: category === 'fundusz_remontowy',
          created_by: null,
        })

        if (!expErr) {
          // Zapisz w kolejce jako 'imported' (dla audytu)
          await admin.from('ksef_invoice_queue').insert({
            ksef_number,
            invoice_number: inv.invoiceNumber || null,
            invoice_date: inv.invoiceDate || null,
            issue_date: inv.issueDate || null,
            seller_name: inv.sellerName || null,
            seller_nip: String(inv.sellerNip ?? '').slice(0, 10) || null,
            buyer_nip:  String(inv.buyerNip  ?? '').slice(0, 10) || null,
            net_amount: inv.netAmount,
            vat_amount: inv.vatAmount,
            gross_amount: inv.grossAmount,
            suggested_category: category,
            community_id: communityId,
            status: 'imported',
            sync_log_id: logId,
          })
          autoImported++
          continue
        }
        // fallback: jeśli insert expense się nie udał — dodaj do kolejki pending
      }

      const { error: insertErr } = await admin.from('ksef_invoice_queue').insert({
        ksef_number,
        invoice_number: inv.invoiceNumber || null,
        invoice_date: inv.invoiceDate || null,
        issue_date: inv.issueDate || null,
        seller_name: inv.sellerName || null,
        seller_nip: sellerNipClean || null,
        buyer_nip:  String(inv.buyerNip  ?? '').slice(0, 10) || null,
        net_amount: inv.netAmount,
        vat_amount: inv.vatAmount,
        gross_amount: inv.grossAmount,
        suggested_category: category,
        community_id: invCommunityId,
        status: 'pending',
        sync_log_id: logId,
      })

      if (insertErr) {
        insertErrors.push(`${ksef_number ?? '(brak nr)'}: ${insertErr.message}`)
      } else {
        imported++
      }
    }

    insertErrorsOut = insertErrors
    if (insertErrors.length > 0) {
      console.error('[KSeF] Błędy insertów:', insertErrors.join('; '))
      await admin.from('ksef_sync_log').update({
        error_message: `Błędy insertów: ${insertErrors.slice(0, 3).join('; ')}${insertErrors.length > 3 ? ` (+${insertErrors.length - 3} więcej)` : ''}`,
      }).eq('id', logId)
    }

    await admin.from('ksef_sync_log').update({
      finished_at: new Date().toISOString(),
      status: 'success',
      invoices_fetched: fetched,
      invoices_imported: imported + autoImported,
      invoices_skipped: skipped,
    }).eq('id', logId)

    await admin.from('ksef_settings').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'success',
      last_sync_count: imported + autoImported,
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
  return { fetched, imported: imported + autoImported, skipped, dateFrom: windowStartISO, dateTo: dateToISO, insertErrors: insertErrorsOut }
}

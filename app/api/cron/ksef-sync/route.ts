import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { ksefAuth, ksefQueryInvoices, guessCategory } from '@/lib/ksef'

export const runtime = 'nodejs'

// Vercel Cron: codziennie o 02:00 — pobiera faktury z KSeF do kolejki.
// Zabezpieczenie fail-closed: bez CRON_SECRET endpoint zwraca 401.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdminClient()

  // Pobierz ustawienia
  const { data: settings } = await admin.from('ksef_settings').select('*').maybeSingle()
  if (!settings?.enabled) {
    return NextResponse.json({ skipped: true, reason: 'KSeF not enabled' })
  }
  if (!settings.ksef_token || !settings.nip) {
    return NextResponse.json({ skipped: true, reason: 'Missing NIP or token' })
  }

  // Utwórz log entry
  const { data: logEntry } = await admin.from('ksef_sync_log').insert({
    status: 'running',
  }).select('id').single()
  const logId = logEntry?.id

  let fetched = 0
  let imported = 0
  let skipped = 0

  try {
    const auth = await ksefAuth(settings.nip, settings.ksef_token, settings.environment)

    const dateTo = new Date()
    let dateFrom: Date
    if (settings.last_sync_at) {
      dateFrom = new Date(settings.last_sync_at)
      dateFrom.setHours(dateFrom.getHours() - 1)
    } else if (settings.sync_from_date) {
      dateFrom = new Date(settings.sync_from_date)
    } else {
      dateFrom = new Date()
      dateFrom.setDate(dateFrom.getDate() - 30)
    }

    const invoices = await ksefQueryInvoices(auth.accessToken, settings.environment, dateFrom, dateTo)
    fetched = invoices.length

    // Pobierz NIP-y wspólnot do automatycznego dopasowania
    const { data: communities } = await admin.from('communities').select('id, nip')
    const nipMap = new Map<string, string>()
    for (const c of communities ?? []) {
      if (c.nip) nipMap.set(c.nip, c.id)
    }

    for (const inv of invoices) {
      // Pomiń duplikaty
      const { data: dup } = await admin
        .from('ksef_invoice_queue')
        .select('id')
        .eq('ksef_number', inv.kseNumber)
        .maybeSingle()

      if (dup) { skipped++; continue }

      const communityId = nipMap.get(inv.buyerNip) ?? null

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
        suggested_category: guessCategory(inv.sellerName),
        community_id: communityId,
        status: 'pending',
        sync_log_id: logId,
      })
      imported++
    }

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

    console.log(`[ksef-sync] fetched=${fetched} imported=${imported} skipped=${skipped}`)
    return NextResponse.json({ fetched, imported, skipped })

  } catch (err: any) {
    const msg = err?.message ?? 'Unknown error'
    console.error('[ksef-sync] error:', msg)

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

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

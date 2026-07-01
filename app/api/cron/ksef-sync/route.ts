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

  // Pobierz wszystkie aktywne konfiguracje KSeF — jedna per wspólnota
  const { data: allSettings } = await admin
    .from('ksef_settings')
    .select('*')
    .eq('enabled', true)
    .not('community_id', 'is', null)

  if (!allSettings?.length) {
    return NextResponse.json({ skipped: true, reason: 'No enabled KSeF settings' })
  }

  // Pobierz NIP-y wspólnot raz dla wszystkich iteracji
  const { data: communities } = await admin.from('communities').select('id, nip')
  const nipMap = new Map<string, string>()
  for (const c of communities ?? []) {
    if (c.nip) nipMap.set(c.nip, c.id)
  }

  const results: Array<{
    communityId: string
    fetched: number
    imported: number
    skipped: number
    error?: string
  }> = []

  for (const settings of allSettings) {
    if (!settings.ksef_token || !settings.nip) {
      results.push({ communityId: settings.community_id, fetched: 0, imported: 0, skipped: 0, error: 'Missing NIP or token' })
      continue
    }

    // Utwórz log entry dla tej wspólnoty
    const { data: logEntry } = await admin.from('ksef_sync_log').insert({
      status: 'running',
      community_id: settings.community_id,
    }).select('id').single()
    const logId = logEntry?.id

    let fetched = 0, imported = 0, skipped = 0

    try {
      const auth = await ksefAuth(settings.nip, settings.ksef_token, settings.environment)

      const dateTo = new Date()
      let windowStart: Date
      if (settings.sync_from_date) {
        windowStart = new Date(settings.sync_from_date)
      } else if (settings.last_sync_at) {
        windowStart = new Date(settings.last_sync_at)
        windowStart.setHours(windowStart.getHours() - 1)
      } else {
        windowStart = new Date()
        windowStart.setDate(windowStart.getDate() - 30)
      }

      // Okna 89-dniowe — KSeF odrzuca zakres > 3 miesięcy
      const MAX_WINDOW_DAYS = 89
      const allInvoices: Awaited<ReturnType<typeof ksefQueryInvoices>> = []
      let cursor = new Date(windowStart)
      while (cursor < dateTo) {
        const windowEnd = new Date(cursor)
        windowEnd.setDate(windowEnd.getDate() + MAX_WINDOW_DAYS)
        if (windowEnd > dateTo) windowEnd.setTime(dateTo.getTime())
        const chunk = await ksefQueryInvoices(auth.accessToken, settings.environment, cursor, windowEnd)
        allInvoices.push(...chunk)
        cursor.setDate(cursor.getDate() + MAX_WINDOW_DAYS)
      }

      // Deduplikacja po kseNumber (overlap okien)
      const seen = new Set<string>()
      const invoices = allInvoices.filter(inv => {
        if (!inv.kseNumber) return true
        if (seen.has(inv.kseNumber)) return false
        seen.add(inv.kseNumber)
        return true
      })
      fetched = invoices.length

      for (const inv of invoices) {
        if (inv.kseNumber) {
          const { data: dup } = await admin
            .from('ksef_invoice_queue')
            .select('id')
            .eq('ksef_number', inv.kseNumber)
            .maybeSingle()
          if (dup) { skipped++; continue }
        }

        const communityId = nipMap.get(inv.buyerNip) ?? null

        await admin.from('ksef_invoice_queue').insert({
          ksef_number: inv.kseNumber || null,
          invoice_number: inv.invoiceNumber || null,
          invoice_date: inv.invoiceDate || null,
          issue_date: inv.issueDate || null,
          seller_name: inv.sellerName,
          seller_nip: String(inv.sellerNip ?? '').slice(0, 10) || null,
          buyer_nip: String(inv.buyerNip ?? '').slice(0, 10) || null,
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

      results.push({ communityId: settings.community_id, fetched, imported, skipped })
      console.log(`[ksef-sync] community=${settings.community_id} fetched=${fetched} imported=${imported} skipped=${skipped}`)

    } catch (err: any) {
      const msg = err?.message ?? 'Unknown error'
      console.error(`[ksef-sync] community=${settings.community_id} error:`, msg)

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

      results.push({ communityId: settings.community_id, fetched, imported, skipped, error: msg })
    }
  }

  return NextResponse.json({ results })
}

import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { ksefAuth, ksefQueryInvoices, guessCategory } from '@/lib/ksef'
import { sendKsefSyncEmail } from '@/lib/email'

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

  // Pobierz NIP-y i nazwy wspólnot raz dla wszystkich iteracji
  const { data: communities } = await admin.from('communities').select('id, nip, name')
  const nipMap = new Map<string, string>()       // nip → community_id
  const nameMap = new Map<string, string>()      // community_id → name
  for (const c of communities ?? []) {
    if (c.nip) nipMap.set(c.nip, c.id)
    nameMap.set(c.id, c.name)
  }

  // Pobierz emaile super_adminów do powiadomień
  const { data: adminProfiles } = await admin.from('profiles').select('id').eq('role', 'super_admin')
  const adminIds = new Set((adminProfiles ?? []).map((p: any) => p.id))
  const { data: { users: allUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const adminEmails = allUsers
    .filter(u => adminIds.has(u.id) && u.email)
    .map(u => u.email as string)

  const results: Array<{
    communityId: string
    communityName: string
    fetched: number
    imported: number
    autoImported: number
    skipped: number
    dateFrom: string
    dateTo: string
    error?: string
  }> = []

  for (const settings of allSettings) {
    const communityName = nameMap.get(settings.community_id) ?? settings.community_id

    if (!settings.ksef_token || !settings.nip) {
      results.push({ communityId: settings.community_id, communityName, fetched: 0, imported: 0, autoImported: 0, skipped: 0, dateFrom: '', dateTo: '', error: 'Missing NIP or token' })
      continue
    }

    const { data: logEntry } = await admin.from('ksef_sync_log').insert({
      status: 'running',
      community_id: settings.community_id,
    }).select('id').single()
    const logId = logEntry?.id

    let fetched = 0, imported = 0, autoImported = 0, skipped = 0
    let windowStartISO = '', dateToISO = ''

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
      windowStartISO = windowStart.toISOString().slice(0, 10)
      dateToISO = dateTo.toISOString().slice(0, 10)

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

      // Deduplikacja po kseNumber
      const seen = new Set<string>()
      const invoices = allInvoices.filter(inv => {
        if (!inv.kseNumber) return true
        if (seen.has(inv.kseNumber)) return false
        seen.add(inv.kseNumber)
        return true
      })
      fetched = invoices.length

      for (const inv of invoices) {
        // Pomiń duplikaty
        if (inv.kseNumber) {
          const { data: dup } = await admin
            .from('ksef_invoice_queue')
            .select('id')
            .eq('ksef_number', inv.kseNumber)
            .maybeSingle()
          if (dup) { skipped++; continue }
        }

        const invCommunityId = nipMap.get(inv.buyerNip) ?? null
        const category = guessCategory(inv.sellerName)

        // Auto-import: gdy włączony i faktura jest dla tej wspólnoty
        if (settings.auto_import && inv.buyerNip && inv.buyerNip === settings.nip) {
          const expenseDate = inv.invoiceDate ?? inv.issueDate ?? new Date().toISOString().slice(0, 10)
          const { error: expErr } = await admin.from('community_expenses').insert({
            community_id: settings.community_id,
            category,
            description: inv.sellerName ?? 'Faktura KSeF',
            amount: inv.grossAmount ?? 0,
            expense_date: expenseDate,
            invoice_number: inv.kseNumber ?? undefined,
            is_renovation_fund: category === 'fundusz_remontowy',
            created_by: null,
          })

          if (!expErr) {
            // Oznacz w kolejce jako 'imported' (dla audytu)
            await admin.from('ksef_invoice_queue').insert({
              ksef_number: inv.kseNumber || null,
              invoice_number: inv.invoiceNumber || null,
              invoice_date: inv.invoiceDate || null,
              issue_date: inv.issueDate || null,
              seller_name: inv.sellerName || null,
              seller_nip: String(inv.sellerNip ?? '').slice(0, 10) || null,
              buyer_nip: String(inv.buyerNip ?? '').slice(0, 10) || null,
              net_amount: inv.netAmount,
              vat_amount: inv.vatAmount,
              gross_amount: inv.grossAmount,
              suggested_category: category,
              community_id: settings.community_id,
              status: 'imported',
              sync_log_id: logId,
            })
            autoImported++
            continue
          }
          // fallback do kolejki jeśli insert expense się nie udał
        }

        // Standardowy insert do kolejki pending
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
          suggested_category: category,
          community_id: invCommunityId,
          status: 'pending',
          sync_log_id: logId,
        })
        imported++
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

      results.push({ communityId: settings.community_id, communityName, fetched, imported, autoImported, skipped, dateFrom: windowStartISO, dateTo: dateToISO })
      console.log(`[ksef-sync] community=${communityName} fetched=${fetched} imported=${imported} auto=${autoImported} skipped=${skipped}`)

    } catch (err: any) {
      const msg = err?.message ?? 'Unknown error'
      console.error(`[ksef-sync] community=${communityName} error:`, msg)

      await admin.from('ksef_sync_log').update({
        finished_at: new Date().toISOString(),
        status: 'error',
        invoices_fetched: fetched,
        invoices_imported: imported + autoImported,
        invoices_skipped: skipped,
        error_message: msg,
      }).eq('id', logId)

      await admin.from('ksef_settings').update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'error',
      }).eq('id', settings.id)

      results.push({ communityId: settings.community_id, communityName, fetched, imported, autoImported, skipped, dateFrom: windowStartISO, dateTo: dateToISO, error: msg })
    }
  }

  // Wyślij email powiadomienie jeśli są nowe faktury
  const totalImported = results.reduce((s, r) => s + r.imported + r.autoImported, 0)
  if (totalImported > 0 && adminEmails.length > 0) {
    await sendKsefSyncEmail({
      to: adminEmails,
      results: results.map(r => ({
        communityName: r.communityName,
        imported: r.imported + r.autoImported,
        fetched: r.fetched,
        dateFrom: r.dateFrom,
        dateTo: r.dateTo,
      })),
    }).catch(e => console.error('[ksef-sync] email error:', e?.message))
  }

  return NextResponse.json({ results })
}

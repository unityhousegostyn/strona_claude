import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/server'

const BELKA = 0.19

function calcNetInterest(amount: number, rate: number, startDate: string, endDate: string): number {
  const ms = new Date(endDate).getTime() - new Date(startDate).getTime()
  if (ms <= 0) return 0
  const years = ms / (1000 * 60 * 60 * 24 * 365)
  const gross = amount * (rate / 100) * years
  return Math.round(gross * (1 - BELKA) * 100) / 100
}

export async function GET(req: NextRequest) {
  // Zabezpieczenie: tylko Vercel Cron lub żądanie z poprawnym tokenem.
  // CRON_SECRET musi być ustawiony — jeśli go brak, endpoint jest zablokowany
  // (fail-closed), a nie otwarty publicznie (fail-open).
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  // Pobierz aktywne lokaty z upłyniętym terminem
  const { data: expired, error: fetchErr } = await admin
    .from('community_deposits')
    .select('*')
    .eq('status', 'active')
    .not('end_date', 'is', null)
    .lte('end_date', today)

  if (fetchErr) {
    console.error('[cron/mature-deposits] fetch error:', fetchErr.message)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!expired || expired.length === 0) {
    return NextResponse.json({ message: 'Brak przeterminowanych lokat', processed: 0 })
  }

  const results: { id: string; status: 'ok' | 'error'; netInterest: number; error?: string }[] = []

  for (const deposit of expired) {
    try {
      // Zamknij lokatę
      const { error: closeErr } = await admin
        .from('community_deposits')
        .update({ status: 'closed' })
        .eq('id', deposit.id)

      if (closeErr) {
        results.push({ id: deposit.id, status: 'error', netInterest: 0, error: closeErr.message })
        continue
      }

      // Oblicz odsetki netto
      let netInterest = 0
      if (deposit.interest_rate && deposit.interest_rate > 0 && deposit.end_date) {
        netInterest = calcNetInterest(deposit.amount, deposit.interest_rate, deposit.start_date, deposit.end_date)
      }

      // Zaksięguj odsetki do community_income
      if (netInterest > 0) {
        const bankLabel = deposit.bank_name ? ` — ${deposit.bank_name}` : ''
        const { error: incomeErr } = await admin
          .from('community_income')
          .insert({
            community_id: deposit.community_id,
            category: 'odsetki',
            description: `Odsetki z lokaty${bankLabel} (po podatku Belki 19%) — zamknięcie automatyczne`,
            amount: netInterest,
            income_date: deposit.end_date,
          })

        if (incomeErr) {
          results.push({ id: deposit.id, status: 'error', netInterest, error: `Zamknięta, błąd ksieg.: ${incomeErr.message}` })
          continue
        }
      }

      results.push({ id: deposit.id, status: 'ok', netInterest })
      console.log(`[cron/mature-deposits] Zamknięto lokatę ${deposit.id}, odsetki netto: ${netInterest} zł`)
    } catch (e: any) {
      results.push({ id: deposit.id, status: 'error', netInterest: 0, error: e.message })
    }
  }

  const ok = results.filter(r => r.status === 'ok').length
  const errors = results.filter(r => r.status === 'error').length
  const totalInterest = results.filter(r => r.status === 'ok').reduce((s, r) => s + r.netInterest, 0)

  return NextResponse.json({
    message: `Przetworzono ${expired.length} lokat: ${ok} OK, ${errors} błędów`,
    processed: ok,
    totalNetInterest: totalInterest,
    results,
  })
}

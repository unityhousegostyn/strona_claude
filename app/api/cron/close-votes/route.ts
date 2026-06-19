import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { closeVoteAndNotify } from '@/app/admin/votes/actions'

export const runtime = 'nodejs'

// Vercel Cron — automatyczne zamykanie głosowań po upływie terminu (deadline).
// Wcześniej "status" wymagał ręcznego kliknięcia "Zamknij" w panelu — deadline
// był tylko informacyjny i sam z siebie niczego nie zamykał.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdminClient()
  const now = new Date().toISOString()

  const { data: overdue, error } = await admin
    .from('votes')
    .select('id, title')
    .eq('status', 'open')
    .not('deadline', 'is', null)
    .lt('deadline', now)

  if (error) {
    console.error('[close-votes] fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!overdue || overdue.length === 0) {
    return NextResponse.json({ closed: 0 })
  }

  const results: { id: string; title: string; ok: boolean; error?: string }[] = []

  for (const vote of overdue) {
    try {
      const res = await closeVoteAndNotify(vote.id)
      results.push({ id: vote.id, title: vote.title, ok: !res.error, error: res.error })
    } catch (e: any) {
      results.push({ id: vote.id, title: vote.title, ok: false, error: e.message })
    }
  }

  return NextResponse.json({
    closed: results.filter(r => r.ok).length,
    checked: overdue.length,
    results,
  })
}

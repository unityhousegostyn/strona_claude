import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { sendVoteReminderEmail } from '@/lib/email'

export const runtime = 'nodejs'

// Vercel Cron calls this endpoint with a secret header.
// Schedule defined in vercel.json: every hour.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdminClient()
  const now = new Date()

  // Find open votes where:
  //  - created_at + 24h <= now  (at least 24h old)
  //  - reminder_sent_at IS NULL  (reminder not yet sent)
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const { data: votes, error } = await admin
    .from('votes')
    .select('id, title, description, deadline, resolution_number, community_id, created_at')
    .eq('status', 'open')
    .lte('created_at', cutoff)
    .is('reminder_sent_at', null)

  if (error) {
    console.error('[vote-reminders] fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!votes || votes.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  let sent = 0

  for (const vote of votes) {
    try {
      // Get community name
      const { data: community } = await admin
        .from('communities')
        .select('name')
        .eq('id', vote.community_id)
        .single()

      const communityName = community?.name ?? 'Wspólnota'

      // Get apartment IDs that already voted
      const { data: choices } = await admin
        .from('vote_choices')
        .select('apartment_id')
        .eq('vote_id', vote.id)

      const votedApartmentIds = new Set((choices ?? []).map((c: { apartment_id: string }) => c.apartment_id))

      // Get all active users in this community who have an apartment and haven't voted
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, apartment_id')
        .eq('community_id', vote.community_id)
        .eq('status', 'active')
        .not('apartment_id', 'is', null)

      const pendingProfiles = (profiles ?? []).filter(
        (p: { id: string; apartment_id: string }) => !votedApartmentIds.has(p.apartment_id)
      )

      if (pendingProfiles.length === 0) {
        // Everyone voted — mark reminder sent anyway so we don't re-check
        await admin.from('votes').update({ reminder_sent_at: now.toISOString() }).eq('id', vote.id)
        continue
      }

      // Fetch emails from auth.users for those profile ids
      const profileIds = pendingProfiles.map((p: { id: string }) => p.id)
      const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 })
      const emailMap = new Map(
        (authUsers?.users ?? []).map((u: { id: string; email?: string }) => [u.id, u.email])
      )

      const emails = profileIds
        .map((id: string) => emailMap.get(id))
        .filter((e: string | undefined): e is string => !!e)

      if (emails.length > 0) {
        await sendVoteReminderEmail({
          to: emails,
          voteTitle: vote.title,
          communityName,
          voteId: vote.id,
          deadline: vote.deadline,
          resolutionNumber: vote.resolution_number
            ? `${vote.resolution_number}/${new Date(vote.created_at ?? now).getFullYear()}`
            : null,
        })
        sent++
      }

      // Mark reminder as sent
      await admin.from('votes').update({ reminder_sent_at: now.toISOString() }).eq('id', vote.id)
    } catch (err) {
      console.error(`[vote-reminders] error for vote ${vote.id}:`, err)
    }
  }

  return NextResponse.json({ sent, checked: votes.length })
}

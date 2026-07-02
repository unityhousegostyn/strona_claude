/**
 * Logika zamknięcia głosowania + email z wynikami.
 *
 * UWAGA: Ten plik NIE jest server action ('use server').
 * closeVoteAndNotify jest zwykłą funkcją serwerową — wywołuj ją tylko
 * z autoryzowanych kontekstów (server action closeVote lub cron /api/cron/close-votes).
 *
 * Gdyby ten plik był w 'use server', eksport byłby dostępny jako publiczny
 * endpoint Next.js — każdy zalogowany użytkownik mógłby zamknąć dowolne
 * głosowanie z pominięciem kontroli uprawnień.
 */
import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { sendVoteClosedEmail } from '@/lib/email'

export async function closeVoteAndNotify(voteId: string): Promise<{ error?: string }> {
  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('votes')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', voteId)

  if (error) return { error: error.message }
  revalidatePath('/admin/votes')
  revalidatePath(`/admin/votes/${voteId}`)

  // Wyślij email z wynikami do adminów i super_adminów wspólnoty
  try {
    const { data: vote } = await admin
      .from('votes')
      .select('title, community_id, voting_method, resolution_number, created_at, choices:vote_choices(choice, share_value, apartment_id)')
      .eq('id', voteId)
      .single()

    if (vote) {
      const choices = (vote.choices ?? []) as any[]
      const byShare = vote.voting_method === 'by_share'
      const yes     = choices.filter(c => c.choice === 'yes').reduce((s: number, c: any) => s + (byShare ? c.share_value : 1), 0)
      const no      = choices.filter(c => c.choice === 'no').reduce((s: number, c: any) => s + (byShare ? c.share_value : 1), 0)
      const abstain = choices.filter(c => c.choice === 'abstain').reduce((s: number, c: any) => s + (byShare ? c.share_value : 1), 0)
      const total   = yes + no + abstain

      const votedApts = new Set(choices.map((c: any) => c.apartment_id).filter(Boolean)).size

      const { count: aptCountNum } = await admin
        .from('settlement_apartments')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', vote.community_id)
      const totalApts = aptCountNum ?? 0

      const frekwencjaFrac = byShare ? total : (totalApts > 0 ? votedApts / totalApts : 0)
      const quorumMet = frekwencjaFrac >= 0.5
      const passed = (!quorumMet || total === 0) ? null : yes > total / 2

      const { data: community } = await admin.from('communities').select('name').eq('id', vote.community_id).single()

      const { data: adminProfiles } = await admin
        .from('profiles')
        .select('id, email')
        .eq('community_id', vote.community_id)
        .in('role', ['admin', 'super_admin'])
        .in('status', ['active'])

      const missingIds = (adminProfiles ?? []).filter(u => !u.email).map(u => u.id)
      let authEmailMap: Record<string, string> = {}
      if (missingIds.length > 0) {
        const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 })
        for (const u of authList?.users ?? []) {
          if (missingIds.includes(u.id) && u.email) authEmailMap[u.id] = u.email
        }
      }
      const emails = (adminProfiles ?? [])
        .map(u => u.email || authEmailMap[u.id] || null)
        .filter(Boolean) as string[]

      const year = new Date(vote.created_at).getFullYear()
      const resolutionNumber = vote.resolution_number ? `${vote.resolution_number}/${year}` : '—'

      if (emails.length > 0) {
        await sendVoteClosedEmail({
          to: emails,
          voteTitle: vote.title,
          communityName: community?.name ?? '',
          voteId,
          resolutionNumber,
          yes, no, abstain,
          totalApts,
          votedApts,
          passed,
          byShare,
        })
      }
    }
  } catch {}

  return {}
}

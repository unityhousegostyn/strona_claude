'use server'

import { getAuthProfileAction } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { sendCustomEmail } from '@/lib/email'

export async function sendMessageToResidents(data: {
  subject: string
  body: string
  recipient_ids: string[] | 'all'
  community_id?: string
}): Promise<{ error?: string; sent?: number }> {
  try {
    const auth = await getAuthProfileAction()
    if (auth.error !== null) return { error: auth.error }
    if (auth.profile.role === 'user' || auth.profile.role === 'najemca') return { error: 'Brak uprawnień' }

    const subject = data.subject.trim()
    const body = data.body.trim()
    if (!subject) return { error: 'Temat jest wymagany' }
    if (!body) return { error: 'Treść wiadomości jest wymagana' }
    if (subject.length > 200) return { error: 'Temat jest za długi (max 200 znaków)' }

    const admin = getSupabaseAdminClient()

    // Ustal community_id
    const communityId = auth.profile.role === 'admin'
      ? auth.profile.community_id
      : data.community_id ?? null

    if (!communityId) return { error: 'Brak wspólnoty' }

    // Pobierz emaile odbiorców
    let query = admin
      .from('profiles')
      .select('id, email, full_name')
      .eq('community_id', communityId)
      .eq('role', 'user')
      .eq('status', 'active')
      .not('email', 'is', null)

    if (data.recipient_ids !== 'all') {
      query = query.in('id', data.recipient_ids)
    }

    const { data: users } = await query
    const recipients = (users ?? []).filter(u => u.email) as { id: string; email: string; full_name: string | null }[]

    if (recipients.length === 0) return { error: 'Brak odbiorców do wysłania' }

    const emails = recipients.map(u => u.email)

    await sendCustomEmail({
      to: emails,
      subject,
      body,
      senderName: auth.profile.full_name ?? 'Zarząd',
    })

    return { sent: recipients.length }
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

export async function getResidentsForMessage(communityId: string) {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) return []
  if (auth.profile.role === 'user' || auth.profile.role === 'najemca') return []

  // Admin może wylistować mieszkańców tylko swojej własnej wspólnoty — bez
  // tego mógłby podać communityId innej wspólnoty i wyciągnąć imiona/emaile
  // jej mieszkańców (PII innej wspólnoty).
  const effectiveCommunityId = auth.profile.role === 'admin' ? auth.profile.community_id : communityId
  if (!effectiveCommunityId) return []

  const admin = getSupabaseAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .eq('community_id', effectiveCommunityId)
    .eq('role', 'user')
    .eq('status', 'active')
    .not('email', 'is', null)
    .order('full_name')

  return (data ?? []) as { id: string; full_name: string | null; email: string }[]
}

'use server'

import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/audit'
import { sendNewCommentEmail } from '@/lib/email'
import { createNotificationForMany } from '@/lib/notifications'

export async function addComment(ticketId: string, content: string) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Brak autoryzacji')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, community_id, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile) throw new Error('Brak autoryzacji')

  const trimmed = content.trim()
  if (!trimmed || trimmed.length < 1 || trimmed.length > 2000) throw new Error('Komentarz musi mieć 1–2000 znaków')

  const admin = getSupabaseAdminClient()

  const { data: ticket } = await admin
    .from('tickets')
    .select('community_id, title, created_by')
    .eq('id', ticketId)
    .single()

  if (!ticket) throw new Error('Zgłoszenie nie istnieje')
  if (profile.role !== 'super_admin' && ticket.community_id !== profile.community_id) {
    throw new Error('Brak dostępu do tego zgłoszenia')
  }

  const { data: comment, error } = await admin
    .from('ticket_comments')
    .insert({ ticket_id: ticketId, author_id: user.id, content: trimmed })
    .select('*, author:profiles!author_id(full_name, email)')
    .single()

  if (error) throw new Error('Błąd podczas dodawania komentarza')
  await logActivity({ userId: user.id, action: 'add_comment', targetType: 'ticket', targetId: ticketId })

  // Email do autora zgłoszenia — tylko jeśli komentarz dodaje ktoś inny
  if (ticket.created_by && ticket.created_by !== user.id) {
    const { data: ticketAuthor } = await admin
      .from('profiles')
      .select('email')
      .eq('id', ticket.created_by)
      .single()

    if (ticketAuthor?.email) {
      sendNewCommentEmail({
        to: ticketAuthor.email,
        ticketTitle: ticket.title,
        authorName: profile.full_name ?? profile.email ?? 'Administrator',
        comment: trimmed,
        ticketId,
      }).catch(() => {}) // nie blokuj odpowiedzi jeśli email się nie wyśle
    }
  }

  // In-app notification do autora zgłoszenia
  if (ticket.created_by && ticket.created_by !== user.id) {
    createNotificationForMany([ticket.created_by], {
      community_id: ticket.community_id,
      type: 'ticket_comment',
      title: `Nowy komentarz do: ${ticket.title}`,
      body: profile.full_name ?? 'Administrator',
      link: `/admin/tickets/${ticketId}`,
    }).catch(() => {})
  }

  return comment
}

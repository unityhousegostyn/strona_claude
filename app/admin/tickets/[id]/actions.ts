'use server'

import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/audit'

export async function addComment(ticketId: string, content: string) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Brak autoryzacji')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, community_id')
    .eq('id', user.id)
    .single()

  if (!profile) throw new Error('Brak autoryzacji')

  const trimmed = content.trim()
  if (!trimmed || trimmed.length < 1 || trimmed.length > 2000) throw new Error('Komentarz musi mieć 1–2000 znaków')

  const admin = getSupabaseAdminClient()

  // Sprawdź dostęp do ticketu
  const { data: ticket } = await admin.from('tickets').select('community_id').eq('id', ticketId).single()
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
  return comment
}

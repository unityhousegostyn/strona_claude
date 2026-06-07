'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient, getSupabaseServerClient } from '@/lib/supabase/server'

export async function toggleTicketStatus(ticketId: string, currentStatus: string) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Brak autoryzacji')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, community_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role === 'user') throw new Error('Brak uprawnień')

  const admin = getSupabaseAdminClient()

  // Admin może zmieniać status tylko zgłoszeń swojej wspólnoty
  if (profile.role === 'admin') {
    const { data: ticket } = await admin
      .from('tickets')
      .select('community_id')
      .eq('id', ticketId)
      .single()

    if (!ticket || ticket.community_id !== profile.community_id) {
      throw new Error('Brak uprawnień do tego zgłoszenia')
    }
  }

  const newStatus = currentStatus === 'open' ? 'closed' : 'open'
  const { error } = await admin
    .from('tickets')
    .update({ status: newStatus })
    .eq('id', ticketId)

  if (error) throw new Error('Błąd podczas zmiany statusu')

  revalidatePath('/admin/tickets')
  return newStatus
}

export async function createTicket(data: { title: string; description: string; communityId: string }) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Brak autoryzacji')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, community_id')
    .eq('id', user.id)
    .single()

  if (!profile) throw new Error('Brak autoryzacji')

  // Weryfikacja: user może tworzyć tylko dla swojej wspólnoty
  if (profile.community_id !== data.communityId) throw new Error('Brak uprawnień')

  const title = data.title.trim()
  const description = data.description.trim()

  if (!title || title.length < 3 || title.length > 150) throw new Error('Tytuł musi mieć 3–150 znaków')
  if (!description || description.length < 10 || description.length > 2000) throw new Error('Opis musi mieć 10–2000 znaków')

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('tickets').insert({
    title,
    description,
    status: 'open',
    community_id: data.communityId,
    created_by: user.id,
  })

  if (error) throw new Error('Błąd podczas tworzenia zgłoszenia')
  revalidatePath('/admin/tickets')
}

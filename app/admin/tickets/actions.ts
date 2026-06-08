'use server'
import { getAuthProfileAction } from '@/lib/getAuthProfile'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/audit'

export async function toggleTicketStatus(ticketId: string, currentStatus: string) {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) throw new Error(auth.error)
  if (auth.profile.role === 'user') throw new Error('Brak uprawnień')
  const { user, profile } = auth

  const admin = getSupabaseAdminClient()

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
  const { error } = await admin.from('tickets').update({ status: newStatus }).eq('id', ticketId)
  if (error) throw new Error('Błąd podczas zmiany statusu')
  await logActivity({ userId: user.id, action: 'toggle_ticket_status', targetType: 'ticket', targetId: ticketId, meta: { from: currentStatus, to: newStatus } })
  revalidatePath('/admin/tickets')
  return newStatus
}

export async function createTicket(formData: FormData): Promise<{ error?: string }> {
  try {
    const auth = await getAuthProfileAction()
    if (auth.error !== null) return { error: auth.error }
    const { user, profile } = auth

    if (!profile) return { error: 'Brak autoryzacji' }

    const title = (formData.get('title') as string)?.trim()
    const description = (formData.get('description') as string)?.trim()
    const communityId = formData.get('communityId') as string
    const file = formData.get('attachment') as File | null

    if (profile.community_id !== communityId) return { error: 'Brak uprawnień' }
    if (!title || title.length < 3 || title.length > 150) return { error: 'Tytuł musi mieć 3–150 znaków' }
    if (!description || description.length < 10 || description.length > 2000) return { error: 'Opis musi mieć 10–2000 znaków' }

    const admin = getSupabaseAdminClient()

    // Upload załącznika przez admin client
    let attachmentPath: string | null = null
    if (file && file.size > 0) {
      if (file.size > 10 * 1024 * 1024) return { error: 'Załącznik może mieć maksymalnie 10 MB' }
      const ext = file.name.split('.').pop()
      const storagePath = `${crypto.randomUUID()}.${ext}`
      const arrayBuffer = await file.arrayBuffer()
      const { error: uploadError } = await admin.storage
        .from('ticket-attachments')
        .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false })
      if (uploadError) return { error: 'Błąd uploadu załącznika: ' + uploadError.message }
      attachmentPath = storagePath
    }

    const { error } = await admin.from('tickets').insert({
      title,
      description,
      status: 'open',
      community_id: communityId,
      created_by: user.id,
      attachment_path: attachmentPath,
    })

    if (error) return { error: 'Błąd podczas tworzenia zgłoszenia: ' + error.message }
    await logActivity({ userId: user.id, action: 'create_ticket', targetType: 'ticket', meta: { title, communityId } })
    revalidatePath('/admin/tickets')
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

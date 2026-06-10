'use server'
import { getAuthProfileAction } from '@/lib/getAuthProfile'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { createNotificationForMany, getAdminUserIds } from '@/lib/notifications'
import { logActivity } from '@/lib/audit'
import { sendNewTicketEmail } from '@/lib/email'

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
  const { data: ticketData, error } = await admin
    .from('tickets')
    .update({ status: newStatus })
    .eq('id', ticketId)
    .select('title, created_by, community_id')
    .single()
  if (error) throw new Error('Błąd podczas zmiany statusu')
  await logActivity({ userId: user.id, action: 'toggle_ticket_status', targetType: 'ticket', targetId: ticketId, meta: { from: currentStatus, to: newStatus } })

  // Powiadom autora zgłoszenia (jeśli to nie on zmienia status)
  if (ticketData?.created_by && ticketData.created_by !== user.id) {
    createNotificationForMany([ticketData.created_by], {
      community_id: ticketData.community_id,
      type: 'ticket_status',
      title: `Zgłoszenie ${newStatus === 'closed' ? 'zamknięte' : 'ponownie otwarte'}`,
      body: ticketData.title,
      link: `/admin/tickets/${ticketId}`,
    }).catch(() => {})
  }

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

    if (profile.role === 'super_admin') {
      if (!communityId) return { error: 'Wybierz wspólnotę' }
    } else {
      if (profile.community_id !== communityId) return { error: 'Brak uprawnień' }
    }
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

    const { data: inserted, error } = await admin.from('tickets').insert({
      title,
      description,
      status: 'open',
      community_id: communityId,
      created_by: user.id,
      attachment_path: attachmentPath,
    }).select('id').single()

    if (error) return { error: 'Błąd podczas tworzenia zgłoszenia: ' + error.message }
    await logActivity({ userId: user.id, action: 'create_ticket', targetType: 'ticket', meta: { title, communityId } })

    // Powiadom super_adminów i admina wspólnoty o nowym zgłoszeniu
    if (inserted?.id) {
      const [{ data: superAdminProfiles }, { data: communityAdminProfiles }, { data: community }] = await Promise.all([
        admin.from('profiles').select('id').eq('role', 'super_admin').eq('status', 'active'),
        admin.from('profiles').select('id').eq('role', 'admin').eq('community_id', communityId).eq('status', 'active'),
        admin.from('communities').select('name').eq('id', communityId).single(),
      ])

      // Pobierz emaile z auth — profiles.email może być null dla kont zakładanych przez admina
      const allProfileIds = [
        ...(superAdminProfiles ?? []).map(p => p.id),
        ...(communityAdminProfiles ?? []).map(p => p.id),
      ].filter(id => id !== user.id)
      const uniqueIds = [...new Set(allProfileIds)]

      const emailResults = await Promise.all(
        uniqueIds.map(id => admin.auth.admin.getUserById(id))
      )
      const recipients = emailResults
        .map(r => r.data?.user?.email)
        .filter((e): e is string => !!e)

      if (recipients.length > 0) {
        await sendNewTicketEmail({
          to: recipients,
          ticketTitle: title,
          ticketDescription: description,
          authorName: profile.full_name ?? user.email ?? 'Mieszkaniec',
          communityName: community?.name ?? communityId,
          ticketId: inserted.id,
        }).catch(() => {})
      }
    }

    // In-app notification dla adminów o nowym zgłoszeniu
    if (inserted?.id) {
      getAdminUserIds(communityId).then(adminIds => {
        const targets = adminIds.filter(id => id !== user.id)
        if (targets.length > 0) {
          createNotificationForMany(targets, {
            community_id: communityId,
            type: 'new_ticket',
            title: `Nowe zgłoszenie: ${title}`,
            body: profile.full_name ?? user.email ?? 'Mieszkaniec',
            link: `/admin/tickets/${inserted.id}`,
          }).catch(() => {})
        }
      }).catch(() => {})
    }

    revalidatePath('/admin/tickets')
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

export async function updateTicket(ticketId: string, data: { title: string; description: string }): Promise<{ error?: string }> {
  try {
    const auth = await getAuthProfileAction()
    if (auth.error !== null) return { error: auth.error }
    const { user, profile } = auth
    if (profile.role === 'user') return { error: 'Brak uprawnień' }

    const title = data.title.trim()
    const description = data.description.trim()
    if (!title || title.length < 3 || title.length > 150) return { error: 'Tytuł musi mieć 3–150 znaków' }
    if (!description || description.length < 10 || description.length > 2000) return { error: 'Opis musi mieć 10–2000 znaków' }

    const admin = getSupabaseAdminClient()

    if (profile.role === 'admin') {
      const { data: ticket } = await admin.from('tickets').select('community_id').eq('id', ticketId).single()
      if (!ticket || ticket.community_id !== profile.community_id) return { error: 'Brak uprawnień' }
    }

    const { error } = await admin.from('tickets').update({ title, description, updated_at: new Date().toISOString() }).eq('id', ticketId)
    if (error) return { error: 'Błąd zapisu: ' + error.message }

    await logActivity({ userId: user.id, action: 'edit_ticket', targetType: 'ticket', targetId: ticketId, meta: { title } })
    revalidatePath(`/admin/tickets/${ticketId}`)
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

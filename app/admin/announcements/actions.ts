'use server'
import { getAuthProfileAction } from '@/lib/getAuthProfile'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/audit'
import { sendAnnouncementEmail } from '@/lib/email'
import { createNotificationForMany, getCommunityUserIds } from '@/lib/notifications'

export async function createAnnouncement(formData: {
  title: string
  content: string
  start_date: string
  end_date: string
  target: 'all' | 'one' | 'selected'
  community_id: string | null
  community_ids: string[]
  pinned?: boolean
}): Promise<{ error?: string }> {
  try {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) return { error: auth.error }
  if (auth.profile.role === 'user' || auth.profile.role === 'najemca') return { error: 'Brak uprawnień' }
  const { user, profile } = auth

  // Walidacja wejścia
  const title = formData.title?.trim()
  const content = formData.content?.trim()
  if (!title || title.length < 3 || title.length > 150) return { error: 'Tytuł musi mieć 3–150 znaków' }
  if (!content || content.length < 10 || content.length > 5000) return { error: 'Treść musi mieć 10–5000 znaków' }
  if (!['all', 'one', 'selected'].includes(formData.target)) return { error: 'Nieprawidłowy cel ogłoszenia' }

  // Admin może dodawać ogłoszenia tylko do swojej wspólnoty
  if (profile.role === 'admin') {
    if (formData.target !== 'one' || formData.community_id !== profile.community_id) {
      return { error: 'Admin może dodawać ogłoszenia tylko do swojej wspólnoty' }
    }
  }

  const admin = getSupabaseAdminClient()

  const { data: announcement, error } = await admin
    .from('announcements')
    .insert({
      title: formData.title,
      content: formData.content,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      target: formData.target,
      community_id: formData.target === 'one' ? formData.community_id : null,
      created_by: user.id,
      pinned: formData.pinned ?? false,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  await logActivity({ userId: user.id, action: 'create_announcement', targetType: 'announcement', targetId: announcement.id, meta: { title: formData.title, target: formData.target } })

  if (formData.target === 'selected' && formData.community_ids.length > 0) {
    const rows = formData.community_ids.map((cid) => ({
      announcement_id: announcement.id,
      community_id: cid,
    }))
    const { error: junctionError } = await admin
      .from('announcement_communities')
      .insert(rows)
    if (junctionError) return { error: junctionError.message }
  }

  // Wyślij email do użytkowników docelowych wspólnot
  try {
    let targetCommunityIds: string[] = []
    if (formData.target === 'all') {
      const { data: allCommunities } = await admin.from('communities').select('id')
      targetCommunityIds = (allCommunities ?? []).map((c: any) => c.id)
    } else if (formData.target === 'one' && formData.community_id) {
      targetCommunityIds = [formData.community_id]
    } else if (formData.target === 'selected') {
      targetCommunityIds = formData.community_ids
    }
    if (targetCommunityIds.length > 0) {
      const { data: recipients } = await admin
        .from('profiles')
        .select('email')
        .in('community_id', targetCommunityIds)
        .eq('status', 'active')
      const emails = (recipients ?? []).map((r: any) => r.email).filter(Boolean)
      await sendAnnouncementEmail({ to: emails, title: formData.title, content: formData.content })
    }
  } catch {}

  // In-app notifications o nowym ogłoszeniu
  try {
    let notifCommunityIds: string[] = []
    if (formData.target === 'all') {
      const { data: allC } = await admin.from('communities').select('id')
      notifCommunityIds = (allC ?? []).map((c: any) => c.id)
    } else if (formData.target === 'one' && formData.community_id) {
      notifCommunityIds = [formData.community_id]
    } else if (formData.target === 'selected') {
      notifCommunityIds = formData.community_ids
    }
    if (notifCommunityIds.length > 0) {
      const userIdArrays = await Promise.all(notifCommunityIds.map(getCommunityUserIds))
      const allUserIds = [...new Set(userIdArrays.flat())]
      if (allUserIds.length > 0) {
        await createNotificationForMany(allUserIds, {
          type: 'new_announcement',
          title: `Nowe ogłoszenie: ${formData.title}`,
          link: '/admin/announcements',
        })
      }
    }
  } catch {}

  revalidatePath('/admin/announcements')
  return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

export async function updateAnnouncement(
  id: string,
  formData: {
    title: string
    content: string
    start_date: string
    end_date: string
    target: 'all' | 'one' | 'selected'
    community_id: string | null
    community_ids: string[]
    pinned?: boolean
  }
): Promise<{ error?: string }> {
  try {
    const auth = await getAuthProfileAction()
    if (auth.error !== null) return { error: auth.error }
    if (auth.profile.role === 'user' || auth.profile.role === 'najemca') return { error: 'Brak uprawnień' }
    const { user, profile } = auth

    const title = formData.title?.trim()
    const content = formData.content?.trim()
    if (!title || title.length < 3 || title.length > 150) return { error: 'Tytuł musi mieć 3–150 znaków' }
    if (!content || content.length < 10 || content.length > 5000) return { error: 'Treść musi mieć 10–5000 znaków' }
    if (!['all', 'one', 'selected'].includes(formData.target)) return { error: 'Nieprawidłowy cel ogłoszenia' }

    if (profile.role === 'admin') {
      if (formData.target !== 'one' || formData.community_id !== profile.community_id) {
        return { error: 'Admin może edytować ogłoszenia tylko swojej wspólnoty' }
      }
    }

    const admin = getSupabaseAdminClient()

    // Sprawdź też ISTNIEJĄCY rekord — admin nie może edytować cudzego ogłoszenia
    // (target/community_id w formData to dane PRZYCHODZĄCE, nie to co już jest w bazie)
    if (profile.role === 'admin') {
      const { data: existing } = await admin.from('announcements').select('target, community_id').eq('id', id).single()
      if (!existing) return { error: 'Ogłoszenie nie istnieje' }
      if (existing.target !== 'one' || existing.community_id !== profile.community_id) {
        return { error: 'Admin może edytować ogłoszenia tylko swojej wspólnoty' }
      }
    }

    const { error } = await admin
      .from('announcements')
      .update({
        title,
        content,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        target: formData.target,
        community_id: formData.target === 'one' ? formData.community_id : null,
        pinned: formData.pinned ?? false,
      })
      .eq('id', id)

    if (error) return { error: error.message }

    // Aktualizacja junction table dla target=selected
    await admin.from('announcement_communities').delete().eq('announcement_id', id)
    if (formData.target === 'selected' && formData.community_ids.length > 0) {
      const rows = formData.community_ids.map((cid) => ({ announcement_id: id, community_id: cid }))
      const { error: jErr } = await admin.from('announcement_communities').insert(rows)
      if (jErr) return { error: jErr.message }
    }

    await logActivity({ userId: user.id, action: 'update_announcement', targetType: 'announcement', targetId: id, meta: { title } })
    revalidatePath('/admin/announcements')
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

export async function togglePin(announcementId: string, pinned: boolean): Promise<{ error?: string }> {
  try {
    const auth = await getAuthProfileAction()
    if (auth.error !== null) return { error: auth.error }
    if (auth.profile.role === 'user' || auth.profile.role === 'najemca') return { error: 'Brak uprawnień' }
    const { profile } = auth

    const admin = getSupabaseAdminClient()

    if (profile.role === 'admin') {
      const { data: existing } = await admin.from('announcements').select('target, community_id').eq('id', announcementId).single()
      if (!existing) return { error: 'Ogłoszenie nie istnieje' }
      if (existing.target !== 'one' || existing.community_id !== profile.community_id) {
        return { error: 'Brak uprawnień do tej wspólnoty' }
      }
    }

    const { error } = await admin
      .from('announcements')
      .update({ pinned })
      .eq('id', announcementId)

    if (error) return { error: error.message }
    revalidatePath('/admin/announcements')
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

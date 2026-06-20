'use server'

import { getAuthProfileAction } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type RequestType =
  | 'zaswiadczenie_zamieszkania'
  | 'zaswiadczenie_niezalegania'
  | 'zmiana_danych'
  | 'naprawa'
  | 'dokumenty'
  | 'inne'

export type RequestStatus = 'new' | 'in_progress' | 'done' | 'rejected'

async function getActor() {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) throw new Error(auth.error)
  return { user: auth.user!, profile: auth.profile! }
}

/** Mieszkaniec składa nowy wniosek */
export async function submitRequest(formData: {
  type: RequestType
  title: string
  description?: string
}): Promise<{ error?: string; success?: boolean }> {
  try {
    const { user, profile } = await getActor()
    if (!profile.community_id) return { error: 'Brak przypisanej wspólnoty' }
    if (!formData.title.trim()) return { error: 'Podaj tytuł wniosku' }

    const admin = getSupabaseAdminClient()
    const { error } = await admin.from('community_requests').insert({
      community_id: profile.community_id,
      user_id: user.id,
      type: formData.type,
      title: formData.title.trim(),
      description: formData.description?.trim() || null,
      status: 'new',
    })

    if (error) return { error: error.message }
    revalidatePath('/admin/wnioski')
    return { success: true }
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

/** Admin/super_admin zmienia status wniosku + opcjonalna notatka */
export async function updateRequestStatus(
  id: string,
  status: RequestStatus,
  adminNote?: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    const { profile } = await getActor()
    if (profile.role === 'user') return { error: 'Brak uprawnień' }

    const admin = getSupabaseAdminClient()

    // Weryfikacja dostępu admina do wspólnoty
    if (profile.role === 'admin') {
      const { data } = await admin
        .from('community_requests')
        .select('community_id')
        .eq('id', id)
        .single()
      if (data?.community_id !== profile.community_id) return { error: 'Brak uprawnień' }
    }

    const update: Record<string, unknown> = { status }
    if (adminNote !== undefined) update.admin_note = adminNote.trim() || null

    const { error } = await admin.from('community_requests').update(update).eq('id', id)
    if (error) return { error: error.message }

    revalidatePath('/admin/wnioski')
    return { success: true }
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

/** Admin usuwa wniosek (np. spam / duplikat) */
export async function deleteRequest(id: string): Promise<{ error?: string; success?: boolean }> {
  try {
    const { profile } = await getActor()
    if (profile.role === 'user') return { error: 'Brak uprawnień' }

    const admin = getSupabaseAdminClient()

    if (profile.role === 'admin') {
      const { data } = await admin.from('community_requests').select('community_id').eq('id', id).single()
      if (!data) return { error: 'Wniosek nie istnieje' }
      if (data.community_id !== profile.community_id) return { error: 'Brak uprawnień' }
    }

    const { error } = await admin.from('community_requests').delete().eq('id', id)
    if (error) return { error: error.message }

    revalidatePath('/admin/wnioski')
    return { success: true }
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

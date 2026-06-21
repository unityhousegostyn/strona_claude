'use server'
import { getAuthProfileAction } from '@/lib/getAuthProfile'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/audit'

export async function createContact(data: {
  name: string
  role: string
  category: string
  phone?: string
  email?: string
  description?: string
  communityId: string | null
}): Promise<{ error?: string }> {
  try {
    const auth = await getAuthProfileAction()
    if (auth.error !== null) return { error: auth.error }
    if (auth.profile.role === 'user' || auth.profile.role === 'najemca') return { error: 'Brak uprawnień' }
    const { user, profile } = auth

    const name = data.name?.trim()
    const role = data.role?.trim()
    if (!name || name.length < 2) return { error: 'Nazwa musi mieć min. 2 znaki' }
    if (!role || role.length < 2) return { error: 'Stanowisko musi mieć min. 2 znaki' }
    if (!data.phone && !data.email) return { error: 'Podaj numer telefonu lub email' }

    const admin = getSupabaseAdminClient()
    const communityId = profile.role === 'super_admin' ? data.communityId : profile.community_id

    const { error } = await admin.from('contacts').insert({
      name,
      role,
      category: data.category || 'other',
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      description: data.description?.trim() || null,
      community_id: communityId,
    })

    if (error) return { error: error.message }
    await logActivity({ userId: user.id, action: 'create_contact', targetType: 'contact', meta: { name, communityId } })
    revalidatePath('/admin/contacts')
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

export async function deleteContact(contactId: string): Promise<{ error?: string }> {
  try {
    const auth = await getAuthProfileAction()
    if (auth.error !== null) return { error: auth.error }
    if (auth.profile.role === 'user' || auth.profile.role === 'najemca') return { error: 'Brak uprawnień' }
    const { user, profile } = auth

    const admin = getSupabaseAdminClient()

    if (profile.role === 'admin') {
      const { data: contact } = await admin.from('contacts').select('community_id').eq('id', contactId).single()
      if (!contact || contact.community_id !== profile.community_id) return { error: 'Brak uprawnień' }
    }

    const { error: delError } = await admin.from('contacts').delete().eq('id', contactId)
    if (delError) return { error: delError.message }
    await logActivity({ userId: user.id, action: 'delete_contact', targetType: 'contact', targetId: contactId })
    revalidatePath('/admin/contacts')
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

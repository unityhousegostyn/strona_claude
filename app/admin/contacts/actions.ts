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
    if (name.length > 100) return { error: 'Nazwa może mieć max 100 znaków' }
    if (!role || role.length < 2) return { error: 'Stanowisko musi mieć min. 2 znaki' }
    if (role.length > 100) return { error: 'Stanowisko może mieć max 100 znaków' }
    if (!data.phone && !data.email) return { error: 'Podaj numer telefonu lub email' }
    const phone = data.phone?.trim() || null
    const email = data.email?.trim() || null
    const description = data.description?.trim() || null
    if (phone && phone.length > 30) return { error: 'Numer telefonu może mieć max 30 znaków' }
    if (email && (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: 'Nieprawidłowy adres email' }
    if (description && description.length > 500) return { error: 'Opis może mieć max 500 znaków' }
    if (!['other', 'management', 'maintenance', 'emergency', 'utility'].includes(data.category ?? '')) {
      data.category = 'other'
    }

    const admin = getSupabaseAdminClient()
    const communityId = profile.role === 'super_admin' ? data.communityId : profile.community_id

    const { error } = await admin.from('contacts').insert({
      name,
      role,
      category: data.category || 'other',
      phone,
      email,
      description,
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

export async function updateContact(contactId: string, data: {
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
    if (!name || name.length < 2 || name.length > 100) return { error: 'Nazwa musi mieć 2–100 znaków' }
    if (!role || role.length < 2 || role.length > 100) return { error: 'Stanowisko musi mieć 2–100 znaków' }
    if (!data.phone && !data.email) return { error: 'Podaj numer telefonu lub email' }
    const phone = data.phone?.trim() || null
    const email = data.email?.trim() || null
    const description = data.description?.trim() || null
    if (phone && phone.length > 30) return { error: 'Numer telefonu max 30 znaków' }
    if (email && (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: 'Nieprawidłowy email' }
    if (description && description.length > 500) return { error: 'Opis max 500 znaków' }

    const admin = getSupabaseAdminClient()

    // IDOR — admin może edytować tylko kontakty swojej wspólnoty
    if (profile.role === 'admin') {
      const { data: existing } = await admin.from('contacts').select('community_id').eq('id', contactId).single()
      if (!existing || existing.community_id !== profile.community_id) return { error: 'Brak uprawnień' }
    }

    const communityId = profile.role === 'super_admin' ? data.communityId : profile.community_id

    const { error } = await admin.from('contacts').update({
      name, role,
      category: ['manager', 'emergency', 'service', 'security', 'other'].includes(data.category) ? data.category : 'other',
      phone, email, description,
      community_id: communityId,
    }).eq('id', contactId)

    if (error) return { error: error.message }
    await logActivity({ userId: user.id, action: 'update_contact', targetType: 'contact', targetId: contactId, meta: { name } })
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

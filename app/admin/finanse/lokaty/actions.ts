'use server'

import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addDeposit(formData: {
  community_id: string
  type: 'lokata' | 'konto_oszczednosciowe'
  bank_name?: string
  description?: string
  amount: number
  interest_rate?: number
  start_date: string
  end_date?: string
}) {
  const { profile } = await getAuthProfile()
  if (profile.role === 'user') return { error: 'Brak uprawnień' }

  // admin może tylko swoją wspólnotę
  if (profile.role === 'admin' && profile.community_id !== formData.community_id) {
    return { error: 'Brak uprawnień do tej wspólnoty' }
  }

  if (!formData.amount || formData.amount <= 0) return { error: 'Kwota musi być większa od 0' }
  if (!formData.start_date) return { error: 'Podaj datę założenia' }

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('community_deposits').insert({
    community_id: formData.community_id,
    type: formData.type,
    bank_name: formData.bank_name || null,
    description: formData.description || null,
    amount: formData.amount,
    interest_rate: formData.interest_rate ?? null,
    start_date: formData.start_date,
    end_date: formData.end_date || null,
    status: 'active',
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/finanse/lokaty')
  revalidatePath('/admin/dashboard')
  return { success: true }
}

export async function closeDeposit(id: string) {
  const { profile } = await getAuthProfile()
  if (profile.role === 'user') return { error: 'Brak uprawnień' }

  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from('community_deposits')
    .update({ status: 'closed' })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/finanse/lokaty')
  revalidatePath('/admin/dashboard')
  return { success: true }
}

export async function deleteDeposit(id: string) {
  const { profile } = await getAuthProfile()
  if (profile.role !== 'super_admin') return { error: 'Tylko super_admin może usuwać lokaty' }

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('community_deposits').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/finanse/lokaty')
  revalidatePath('/admin/dashboard')
  return { success: true }
}

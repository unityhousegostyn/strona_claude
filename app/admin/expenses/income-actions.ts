'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthProfileAction } from '@/lib/getAuthProfile'
import { INCOME_CATEGORIES } from './income-categories'
import type { IncomeCategory } from './income-categories'

async function getActor() {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) throw new Error(auth.error)
  return { user: auth.user!, profile: auth.profile! }
}

export async function addIncome(data: {
  community_id: string
  category: IncomeCategory
  description: string
  amount: number
  income_date: string
}): Promise<{ error?: string; id?: string }> {
  try {
    const { user, profile } = await getActor()
    if (profile.role === 'user') return { error: 'Brak uprawnień' }
    if (profile.role === 'admin' && profile.community_id !== data.community_id)
      return { error: 'Brak uprawnień do tej wspólnoty' }
    if (!data.description.trim()) return { error: 'Opis jest wymagany' }
    if (!data.amount || data.amount <= 0) return { error: 'Kwota musi być większa niż 0' }
    if (!data.income_date) return { error: 'Data jest wymagana' }

    const admin = getSupabaseAdminClient()
    const { data: row, error } = await admin.from('community_income').insert({
      community_id: data.community_id,
      category: data.category,
      description: data.description.trim(),
      amount: data.amount,
      income_date: data.income_date,
      created_by: user.id,
    }).select('id').single()

    if (error) return { error: error.message }
    revalidatePath('/admin/expenses')
    revalidatePath('/admin/dashboard')
    return { id: row.id }
  } catch (e: any) {
    return { error: e?.message ?? String(e) }
  }
}

export async function deleteIncome(id: string): Promise<{ error?: string }> {
  try {
    const { profile } = await getActor()
    if (profile.role === 'user') return { error: 'Brak uprawnień' }
    const admin = getSupabaseAdminClient()
    const { error } = await admin.from('community_income').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/admin/expenses')
    revalidatePath('/admin/dashboard')
    return {}
  } catch (e: any) {
    return { error: e?.message ?? String(e) }
  }
}

export async function getIncomeList(community_id: string): Promise<any[]> {
  try {
    const admin = getSupabaseAdminClient()
    const { data } = await admin
      .from('community_income')
      .select('*')
      .eq('community_id', community_id)
      .order('income_date', { ascending: false })
    return data ?? []
  } catch {
    return []
  }
}

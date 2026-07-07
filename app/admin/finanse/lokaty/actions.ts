'use server'

import { getAuthProfileAction } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const BELKA = 0.19

function calcNetInterest(amount: number, rate: number, startDate: string, endDate: string): number {
  const ms = new Date(endDate).getTime() - new Date(startDate).getTime()
  if (ms <= 0) return 0
  const years = ms / (1000 * 60 * 60 * 24 * 365)
  const gross = amount * (rate / 100) * years
  return Math.round(gross * (1 - BELKA) * 100) / 100
}

async function getActor() {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) throw new Error(auth.error)
  return { user: auth.user!, profile: auth.profile! }
}

export async function addDeposit(formData: {
  community_id: string
  type: 'lokata' | 'konto_oszczednosciowe'
  bank_name?: string
  description?: string
  amount: number
  interest_rate?: number
  start_date: string
  end_date?: string
}): Promise<{ error?: string; success?: boolean }> {
  try {
    const { profile } = await getActor()
    if (profile.role === 'user' || profile.role === 'najemca') return { error: 'Brak uprawnień' }
    if (profile.role === 'admin' && profile.community_id !== formData.community_id)
      return { error: 'Brak uprawnień do tej wspólnoty' }
    // Typ lokaty — walidacja runtime, TypeScript nie chroni wartości z sieci
    if (!['lokata', 'konto_oszczednosciowe'].includes(formData.type)) return { error: 'Nieprawidłowy typ (lokata lub konto_oszczednosciowe)' }
    if (!formData.amount || formData.amount <= 0) return { error: 'Kwota musi być większa od 0' }
    if (formData.amount > 10_000_000) return { error: 'Kwota przekracza dozwolony limit (10 000 000 zł)' }
    if (formData.interest_rate !== undefined && formData.interest_rate !== null && (formData.interest_rate < 0 || formData.interest_rate > 100)) return { error: 'Oprocentowanie musi być w zakresie 0–100%' }
    if (formData.bank_name && formData.bank_name.trim().length > 100) return { error: 'Nazwa banku może mieć maksymalnie 100 znaków' }
    if (formData.description && formData.description.trim().length > 500) return { error: 'Opis może mieć maksymalnie 500 znaków' }
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
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

/** Zakończ lokatę i zaksięguj odsetki netto (po podatku Belki) do funduszu */
export async function matureDeposit(id: string): Promise<{ error?: string; success?: boolean; netInterest?: number; incomeId?: string | null }> {
  try {
    const { profile, user } = await getActor()
    if (profile.role === 'user' || profile.role === 'najemca') return { error: 'Brak uprawnień' }

    const admin = getSupabaseAdminClient()

    const { data: deposit, error: fetchErr } = await admin
      .from('community_deposits')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !deposit) return { error: 'Nie znaleziono lokaty' }
    if (profile.role === 'admin' && profile.community_id !== deposit.community_id)
      return { error: 'Brak uprawnień do tej wspólnoty' }
    if (deposit.status !== 'active') return { error: 'Lokata już jest zakończona' }

    const today = new Date().toISOString().slice(0, 10)
    const endDate = deposit.end_date ?? today

    let netInterest = 0
    if (deposit.interest_rate && deposit.interest_rate > 0) {
      netInterest = calcNetInterest(deposit.amount, deposit.interest_rate, deposit.start_date, endDate)
    }

    const { error: closeErr } = await admin
      .from('community_deposits')
      .update({ status: 'closed' })
      .eq('id', id)

    if (closeErr) return { error: closeErr.message }

    let incomeId: string | null = null
    if (netInterest > 0) {
      const bankLabel = deposit.bank_name ? ` — ${deposit.bank_name}` : ''
      const { data: incomeRow, error: incomeErr } = await admin
        .from('community_income')
        .insert({
          community_id: deposit.community_id,
          category: 'odsetki',
          description: `Odsetki z lokaty${bankLabel} (po podatku Belki 19%)`,
          amount: netInterest,
          income_date: endDate,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (incomeErr) return { error: `Lokata zamknięta, ale błąd przy księgowaniu: ${incomeErr.message}` }
      incomeId = incomeRow?.id ?? null
    }

    revalidatePath('/admin/finanse/lokaty')
    revalidatePath('/admin/finanse/przychody')
    revalidatePath('/admin/dashboard')
    return { success: true, netInterest, incomeId }
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

/** Usuń lokatę bez żadnych operacji finansowych (np. błędny wpis) */
export async function deleteDeposit(id: string): Promise<{ error?: string; success?: boolean }> {
  try {
    const { profile } = await getActor()
    if (profile.role === 'user' || profile.role === 'najemca') return { error: 'Brak uprawnień' }

    const admin = getSupabaseAdminClient()

    if (profile.role === 'admin') {
      const { data } = await admin.from('community_deposits').select('community_id').eq('id', id).single()
      if (data?.community_id !== profile.community_id) return { error: 'Brak uprawnień' }
    }

    const { error } = await admin.from('community_deposits').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/admin/finanse/lokaty')
    revalidatePath('/admin/dashboard')
    return { success: true }
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

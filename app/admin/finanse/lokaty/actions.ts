'use server'

import { getAuthProfile } from '@/lib/getAuthProfile'
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
  if (profile.role === 'admin' && profile.community_id !== formData.community_id)
    return { error: 'Brak uprawnień do tej wspólnoty' }
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

/** Zakończ lokatę i zaksięguj odsetki netto (po podatku Belki) do funduszu */
export async function matureDeposit(id: string) {
  const { profile, user } = await getAuthProfile()
  if (profile.role === 'user') return { error: 'Brak uprawnień' }

  const admin = getSupabaseAdminClient()

  // Pobierz lokatę
  const { data: deposit, error: fetchErr } = await admin
    .from('community_deposits')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !deposit) return { error: 'Nie znaleziono lokaty' }
  if (profile.role === 'admin' && profile.community_id !== deposit.community_id)
    return { error: 'Brak uprawnień do tej wspólnoty' }
  if (deposit.status !== 'active') return { error: 'Lokata już jest zakończona' }

  // Oblicz odsetki netto (po Belce), tylko jeśli mamy oprocentowanie i datę zakończenia
  let netInterest = 0
  const today = new Date().toISOString().slice(0, 10)
  const endDate = deposit.end_date ?? today

  if (deposit.interest_rate && deposit.interest_rate > 0) {
    netInterest = calcNetInterest(deposit.amount, deposit.interest_rate, deposit.start_date, endDate)
  }

  // Zamknij lokatę
  const { error: closeErr } = await admin
    .from('community_deposits')
    .update({ status: 'closed' })
    .eq('id', id)

  if (closeErr) return { error: closeErr.message }

  // Dodaj odsetki netto do community_income (tylko jeśli > 0)
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

    if (incomeErr) return { error: `Lokata zamknięta, ale błąd przy księgowaniu odsetek: ${incomeErr.message}` }
    incomeId = incomeRow?.id ?? null
  }

  revalidatePath('/admin/finanse/lokaty')
  revalidatePath('/admin/finanse/przychody')
  revalidatePath('/admin/dashboard')
  return { success: true, netInterest, incomeId }
}

/** Usuń lokatę bez żadnych operacji finansowych (np. błędny wpis) */
export async function deleteDeposit(id: string) {
  const { profile } = await getAuthProfile()
  if (profile.role === 'user') return { error: 'Brak uprawnień' }

  const admin = getSupabaseAdminClient()

  // Sprawdź właściciela (admin tylko swoją wspólnotę)
  if (profile.role === 'admin') {
    const { data } = await admin.from('community_deposits').select('community_id').eq('id', id).single()
    if (data?.community_id !== profile.community_id) return { error: 'Brak uprawnień' }
  }

  const { error } = await admin.from('community_deposits').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/finanse/lokaty')
  revalidatePath('/admin/dashboard')
  return { success: true }
}

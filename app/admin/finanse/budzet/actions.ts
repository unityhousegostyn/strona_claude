'use server'

import { revalidatePath } from 'next/cache'
import { getAuthProfileAction } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { BUDGET_CATEGORIES } from './constants'

async function requireAdminPlus() {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) return { error: auth.error as string, profile: null as never }
  if (!['super_admin', 'admin'].includes(auth.profile.role)) return { error: 'Brak dostępu', profile: null as never }
  return { error: null, profile: auth.profile }
}

/** requireAdminPlus + izolacja wspólnoty: admin widzi/edytuje tylko swoją */
async function requireAdminPlusForCommunity(communityId: string) {
  const result = await requireAdminPlus()
  if (result.error) return result
  if (result.profile.role === 'admin' && result.profile.community_id !== communityId)
    return { error: 'Brak dostępu do tej wspólnoty', profile: null as never }
  return result
}

export interface BudgetItem {
  category: string
  planned: number
  actual: number
  variance: number   // actual - planned (ujemna = oszczędność)
  pct: number        // (actual/planned)*100, 0 gdy brak planu
  overBudget: boolean
}

export interface BudgetData {
  communityId: string
  year: number
  items: BudgetItem[]
  totalPlanned: number
  totalActual: number
  totalVariance: number
}


export async function getBudget(communityId: string, year: number): Promise<{
  data: BudgetData | null
  error?: string
}> {
  // requireAdminPlus bez izolacji = admin mógł czytać budżety obcych wspólnot
  const auth = await requireAdminPlusForCommunity(communityId)
  if (auth.error) return { data: null, error: auth.error }

  const admin = getSupabaseAdminClient()

  // Plan budżetowy
  const { data: planRows } = await admin
    .from('community_budgets')
    .select('category, planned_amount')
    .eq('community_id', communityId)
    .eq('year', year)

  const planMap = new Map<string, number>()
  for (const r of planRows ?? []) {
    planMap.set(r.category, Number(r.planned_amount))
  }

  // Rzeczywiste koszty w danym roku
  const { data: expenses } = await admin
    .from('community_expenses')
    .select('category, amount')
    .eq('community_id', communityId)
    .gte('expense_date', `${year}-01-01`)
    .lte('expense_date', `${year}-12-31`)

  const actualMap = new Map<string, number>()
  for (const e of expenses ?? []) {
    const cat = e.category ?? 'pozostałe'
    actualMap.set(cat, (actualMap.get(cat) ?? 0) + Number(e.amount))
  }

  // Połącz wszystkie kategorie (z planu + z rzeczywistych)
  const allCats = new Set([...planMap.keys(), ...actualMap.keys()])

  const items: BudgetItem[] = BUDGET_CATEGORIES
    .filter(c => allCats.has(c.value) || planMap.has(c.value))
    .map(c => {
      const planned = planMap.get(c.value) ?? 0
      const actual = actualMap.get(c.value) ?? 0
      const variance = actual - planned
      const pct = planned > 0 ? Math.round((actual / planned) * 100) : (actual > 0 ? 999 : 0)
      return { category: c.value, planned, actual, variance, pct, overBudget: pct > 110 && planned > 0 }
    })

  // Dodaj kategorie z kosztów które nie ma w BUDGET_CATEGORIES
  for (const cat of actualMap.keys()) {
    if (!BUDGET_CATEGORIES.find(c => c.value === cat) && !items.find(i => i.category === cat)) {
      const actual = actualMap.get(cat) ?? 0
      const planned = planMap.get(cat) ?? 0
      items.push({ category: cat, planned, actual, variance: actual - planned, pct: planned > 0 ? Math.round((actual/planned)*100) : 999, overBudget: false })
    }
  }

  const totalPlanned = items.reduce((s, i) => s + i.planned, 0)
  const totalActual  = items.reduce((s, i) => s + i.actual, 0)

  return {
    data: {
      communityId,
      year,
      items,
      totalPlanned,
      totalActual,
      totalVariance: totalActual - totalPlanned,
    }
  }
}

export async function saveBudgetItems(
  communityId: string,
  year: number,
  items: { category: string; planned_amount: number }[],
): Promise<{ error?: string }> {
  const auth = await requireAdminPlusForCommunity(communityId)
  if (auth.error) return { error: auth.error }

  const admin = getSupabaseAdminClient()
  const rows = items.map(item => ({
    community_id: communityId,
    year,
    category: item.category,
    planned_amount: item.planned_amount,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await admin
    .from('community_budgets')
    .upsert(rows, { onConflict: 'community_id,year,category' })

  if (error) return { error: error.message }
  revalidatePath('/admin/finanse/budzet')
  return {}
}

export async function seedBudgetFromExpenses(
  communityId: string,
  year: number,
): Promise<{ seeded: number; error?: string }> {
  const auth = await requireAdminPlusForCommunity(communityId)
  if (auth.error) return { seeded: 0, error: auth.error }

  const admin = getSupabaseAdminClient()

  // Pobierz wszystkie koszty danej wspólnoty za rok
  const { data: expenses, error: fetchErr } = await admin
    .from('community_expenses')
    .select('category, amount')
    .eq('community_id', communityId)
    .gte('expense_date', `${year}-01-01`)
    .lte('expense_date', `${year}-12-31`)
    .not('expense_date', 'is', null)

  if (fetchErr) return { seeded: 0, error: fetchErr.message }
  if (!expenses?.length) return { seeded: 0, error: 'Brak kosztów dla wybranego roku.' }

  // Suma per kategoria
  const sumMap = new Map<string, number>()
  for (const e of expenses) {
    const cat = (e.category?.trim() || 'pozostałe')
    sumMap.set(cat, (sumMap.get(cat) ?? 0) + Number(e.amount))
  }

  const rows = Array.from(sumMap.entries()).map(([category, total]) => ({
    community_id: communityId,
    year,
    category,
    planned_amount: Math.round(total * 100) / 100,
    updated_at: new Date().toISOString(),
  }))

  const { error: upsertErr } = await admin
    .from('community_budgets')
    .upsert(rows, { onConflict: 'community_id,year,category' })

  if (upsertErr) return { seeded: 0, error: upsertErr.message }
  revalidatePath('/admin/finanse/budzet')
  return { seeded: rows.length }
}

export async function getAvailableYears(communityId: string): Promise<number[]> {
  // Brak auth check = dowolny zalogowany user mógł odczytać lata kosztów wspólnoty
  const auth = await requireAdminPlusForCommunity(communityId)
  if (auth.error) return [new Date().getFullYear()]
  const admin = getSupabaseAdminClient()
  const { data } = await admin
    .from('community_expenses')
    .select('expense_date')
    .eq('community_id', communityId)
    .not('expense_date', 'is', null)

  const years = new Set<number>()
  const currentYear = new Date().getFullYear()
  years.add(currentYear)
  years.add(currentYear - 1)

  for (const row of data ?? []) {
    const y = new Date(row.expense_date).getFullYear()
    if (y >= 2020 && y <= currentYear + 1) years.add(y)
  }

  return Array.from(years).sort((a, b) => b - a)
}

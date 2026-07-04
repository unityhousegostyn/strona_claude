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
  /** actual - planned; ujemna = oszczędność */
  variance: number
  /** planned - actual; ujemna = przekroczenie */
  remaining: number
  /** (actual/planned)*100; 0 gdy brak planu */
  pct: number
  /** prognoza roczna = actual * (12/month); null gdy rok historyczny lub brak danych */
  forecast: number | null
  overBudget: boolean
}

export interface BudgetData {
  communityId: string
  year: number
  items: BudgetItem[]
  totalPlanned: number
  totalActual: number
  totalRemaining: number
  totalForecast: number | null
  /** miesiąc użyty do prognozy (1–12); 12 dla lat historycznych */
  forecastMonth: number
}

/** Pobierz dane budżetu (plan + wykonanie) dla danej wspólnoty i roku */
export async function getBudget(communityId: string, year: number): Promise<{
  data: BudgetData | null
  error?: string
}> {
  const auth = await requireAdminPlusForCommunity(communityId)
  if (auth.error) return { data: null, error: auth.error }

  const admin = getSupabaseAdminClient()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1 // 1–12
  const forecastMonth = year === currentYear ? currentMonth : 12

  const [planRes, expRes] = await Promise.all([
    admin.from('community_budgets')
      .select('category, planned_amount')
      .eq('community_id', communityId)
      .eq('year', year),
    admin.from('community_expenses')
      .select('category, amount')
      .eq('community_id', communityId)
      .gte('expense_date', `${year}-01-01`)
      .lte('expense_date', `${year}-12-31`),
  ])

  const planMap = new Map<string, number>()
  for (const r of planRes.data ?? []) planMap.set(r.category, Number(r.planned_amount))

  const actualMap = new Map<string, number>()
  for (const e of expRes.data ?? []) {
    const cat = e.category ?? 'pozostałe'
    actualMap.set(cat, (actualMap.get(cat) ?? 0) + Number(e.amount))
  }

  const allCats = new Set([...planMap.keys(), ...actualMap.keys()])

  const items: BudgetItem[] = BUDGET_CATEGORIES
    .filter(c => allCats.has(c.value))
    .map(c => {
      const planned = planMap.get(c.value) ?? 0
      const actual  = actualMap.get(c.value) ?? 0
      const variance  = actual - planned
      const remaining = planned - actual
      const pct = planned > 0 ? Math.round((actual / planned) * 100) : (actual > 0 ? 999 : 0)
      const forecast = actual > 0 && forecastMonth > 0
        ? Math.round((actual / forecastMonth) * 12 * 100) / 100
        : null
      return {
        category: c.value,
        planned, actual, variance, remaining, pct, forecast,
        overBudget: pct > 110 && planned > 0,
      }
    })

  // Kategorie z kosztów spoza stałej listy
  for (const cat of actualMap.keys()) {
    if (!BUDGET_CATEGORIES.find(c => c.value === cat)) {
      const actual  = actualMap.get(cat) ?? 0
      const planned = planMap.get(cat) ?? 0
      const pct = planned > 0 ? Math.round((actual / planned) * 100) : 999
      items.push({
        category: cat, planned, actual,
        variance: actual - planned,
        remaining: planned - actual,
        pct,
        forecast: actual > 0 ? Math.round((actual / forecastMonth) * 12 * 100) / 100 : null,
        overBudget: false,
      })
    }
  }

  const totalPlanned   = items.reduce((s, i) => s + i.planned, 0)
  const totalActual    = items.reduce((s, i) => s + i.actual, 0)
  const totalRemaining = totalPlanned - totalActual
  const forecasts      = items.map(i => i.forecast).filter((f): f is number => f !== null)
  const totalForecast  = forecasts.length > 0
    ? Math.round(forecasts.reduce((s, f) => s + f, 0) * 100) / 100
    : null

  return {
    data: {
      communityId, year, items,
      totalPlanned:   Math.round(totalPlanned   * 100) / 100,
      totalActual:    Math.round(totalActual    * 100) / 100,
      totalRemaining: Math.round(totalRemaining * 100) / 100,
      totalForecast,
      forecastMonth,
    },
  }
}

/** Zapisz pozycje planu budżetowego */
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

  // Usuń stare pozycje dla tego roku (czyste nadpisanie)
  const { error: delErr } = await admin
    .from('community_budgets')
    .delete()
    .eq('community_id', communityId)
    .eq('year', year)
  if (delErr) return { error: delErr.message }

  if (rows.length === 0) {
    revalidatePath('/admin/finanse/budzet')
    return {}
  }

  const { error } = await admin.from('community_budgets').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/admin/finanse/budzet')
  return {}
}

/** Pobierz rzeczywiste wykonanie (sumy kosztów per kategoria) dla danego roku.
 *  Używane jako podpowiedź przy ustawianiu planu na rok N+1. */
export async function getPreviousYearExecution(
  communityId: string,
  year: number,
): Promise<{ data: Record<string, number>; error?: string }> {
  const auth = await requireAdminPlusForCommunity(communityId)
  if (auth.error) return { data: {}, error: auth.error }

  const admin = getSupabaseAdminClient()
  const { data, error } = await admin
    .from('community_expenses')
    .select('category, amount')
    .eq('community_id', communityId)
    .gte('expense_date', `${year}-01-01`)
    .lte('expense_date', `${year}-12-31`)

  if (error) return { data: {}, error: error.message }

  const result: Record<string, number> = {}
  for (const e of data ?? []) {
    const cat = e.category ?? 'pozostałe'
    result[cat] = Math.round(((result[cat] ?? 0) + Number(e.amount)) * 100) / 100
  }
  return { data: result }
}

/** Pobierz dostępne lata (z kosztów + bieżący + następny) */
export async function getAvailableYears(communityId: string): Promise<number[]> {
  const auth = await requireAdminPlusForCommunity(communityId)
  if (auth.error) return [new Date().getFullYear()]

  const admin = getSupabaseAdminClient()
  const { data } = await admin
    .from('community_expenses')
    .select('expense_date')
    .eq('community_id', communityId)
    .not('expense_date', 'is', null)

  const currentYear = new Date().getFullYear()
  const years = new Set<number>([currentYear, currentYear + 1, currentYear - 1])

  for (const row of data ?? []) {
    const y = new Date(row.expense_date).getFullYear()
    if (y >= 2020 && y <= currentYear + 1) years.add(y)
  }

  return Array.from(years).sort((a, b) => b - a)
}

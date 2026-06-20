'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthProfileAction } from '@/lib/getAuthProfile'
import type { ExpenseCategory } from './categories'
import { EXPENSE_CATEGORIES } from './categories'

async function getActor() {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) throw new Error(auth.error)
  return { user: auth.user, profile: auth.profile }
}

// ── DODAJ KOSZT ──────────────────────────────────────────────────
export async function addExpense(data: {
  community_id: string
  category: ExpenseCategory
  description: string
  amount: number
  expense_date: string
  invoice_number?: string
  is_renovation_fund?: boolean
}): Promise<{ error?: string; id?: string }> {
  const { user, profile } = await getActor()
  if (profile.role === 'user') return { error: 'Brak uprawnień' }
  if (profile.role === 'admin' && profile.community_id !== data.community_id)
    return { error: 'Brak uprawnień do tej wspólnoty' }
  if (!data.description.trim()) return { error: 'Opis jest wymagany' }
  if (!data.amount || data.amount <= 0) return { error: 'Kwota musi być większa niż 0' }
  if (!data.expense_date) return { error: 'Data jest wymagana' }

  const admin = getSupabaseAdminClient()
  const { data: row, error } = await admin.from('community_expenses').insert({
    community_id: data.community_id,
    category: data.category,
    description: data.description.trim(),
    amount: data.amount,
    expense_date: data.expense_date,
    invoice_number: data.invoice_number?.trim() || null,
    is_renovation_fund: data.is_renovation_fund ?? (data.category === 'fundusz_remontowy'),
    created_by: user.id,
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/admin/finanse/koszty')
  revalidatePath('/admin/dashboard')
  return { id: row.id }
}

// ── EDYTUJ KOSZT ─────────────────────────────────────────────────
export async function updateExpense(id: string, data: {
  category: ExpenseCategory
  description: string
  amount: number
  expense_date: string
  invoice_number?: string
  is_renovation_fund?: boolean
}): Promise<{ error?: string }> {
  const { profile } = await getActor()
  if (profile.role === 'user') return { error: 'Brak uprawnień' }

  const admin = getSupabaseAdminClient()

  if (profile.role === 'admin') {
    const { data: existing } = await admin.from('community_expenses').select('community_id').eq('id', id).single()
    if (!existing) return { error: 'Koszt nie istnieje' }
    if (existing.community_id !== profile.community_id) return { error: 'Brak uprawnień do tej wspólnoty' }
  }

  const { error } = await admin.from('community_expenses').update({
    category: data.category,
    description: data.description.trim(),
    amount: data.amount,
    expense_date: data.expense_date,
    invoice_number: data.invoice_number?.trim() || null,
    is_renovation_fund: data.is_renovation_fund ?? (data.category === 'fundusz_remontowy'),
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/finanse/koszty')
  revalidatePath('/admin/dashboard')
  return {}
}

// ── USUŃ KOSZT ───────────────────────────────────────────────────
export async function deleteExpense(id: string): Promise<{ error?: string }> {
  const { profile } = await getActor()
  if (profile.role === 'user') return { error: 'Brak uprawnień' }

  const admin = getSupabaseAdminClient()

  if (profile.role === 'admin') {
    const { data: existing } = await admin.from('community_expenses').select('community_id').eq('id', id).single()
    if (!existing) return { error: 'Koszt nie istnieje' }
    if (existing.community_id !== profile.community_id) return { error: 'Brak uprawnień do tej wspólnoty' }
  }

  const { error } = await admin.from('community_expenses').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/finanse/koszty')
  revalidatePath('/admin/dashboard')
  return {}
}

// ── IMPORT CSV ───────────────────────────────────────────────────
// Oczekiwany format CSV: data;opis;kategoria;kwota;nr_faktury
// Przykład: 2026-06-01;Faktura ZGKIM;zarząd;500.00;FV/123/2026
export async function importExpensesCSV(
  community_id: string,
  csvText: string,
): Promise<{ imported: number; errors: string[] }> {
  try {
    const auth = await getAuthProfileAction()
    if (auth.error !== null) return { imported: 0, errors: [auth.error] }
    const { user, profile } = { user: auth.user!, profile: auth.profile! }

    if (profile.role === 'user') return { imported: 0, errors: ['Brak uprawnień'] }
    if (profile.role === 'admin' && profile.community_id !== community_id)
      return { imported: 0, errors: ['Brak uprawnień do tej wspólnoty'] }

    const validCategories = EXPENSE_CATEGORIES.map(c => c.value)
    const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean)
    const rows: any[] = []
    const errors: string[] = []

    const startIdx = lines[0]?.toLowerCase().startsWith('data') ? 1 : 0

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(/[;,]/).map(p => p.trim().replace(/^"|"$/g, ''))
      if (parts.length < 4) {
        errors.push(`Wiersz ${i + 1}: za mało kolumn`)
        continue
      }
      const [expense_date, description, category, amountStr, invoice_number] = parts
      const amount = parseFloat(amountStr?.replace(',', '.') ?? '')

      if (!expense_date || !/^\d{4}-\d{2}-\d{2}$/.test(expense_date)) {
        errors.push(`Wiersz ${i + 1}: nieprawidłowa data "${expense_date}"`)
        continue
      }
      if (!description) { errors.push(`Wiersz ${i + 1}: brak opisu`); continue }
      if (!validCategories.includes(category as ExpenseCategory)) {
        errors.push(`Wiersz ${i + 1}: nieznana kategoria "${category}"`)
        continue
      }
      if (isNaN(amount) || amount <= 0) {
        errors.push(`Wiersz ${i + 1}: nieprawidłowa kwota "${amountStr}"`)
        continue
      }
      rows.push({
        community_id,
        category,
        description,
        amount,
        expense_date,
        invoice_number: invoice_number || null,
        created_by: user.id,
      })
    }

    if (rows.length > 0) {
      const admin = getSupabaseAdminClient()
      const { error } = await admin.from('community_expenses').insert(rows)
      if (error) return { imported: 0, errors: [`DB: ${error.message}`, ...errors] }
    }

    revalidatePath('/admin/finanse/koszty')
    revalidatePath('/admin/dashboard')
    return { imported: rows.length, errors }
  } catch (e: any) {
    return { imported: 0, errors: [`Błąd serwera: ${e?.message ?? String(e)}`] }
  }
}

// ── BULK UPDATE KATEGORII ────────────────────────────────────────
export async function bulkUpdateCategory(
  ids: string[],
  category: ExpenseCategory
): Promise<{ error?: string; updated?: number }> {
  try {
    const { profile } = await getActor()
    if (profile.role === 'user') return { error: 'Brak uprawnień' }
    if (!ids.length) return { error: 'Brak zaznaczonych wpisów' }
    const admin = getSupabaseAdminClient()

    if (profile.role === 'admin') {
      const { data: rows } = await admin.from('community_expenses').select('id, community_id').in('id', ids)
      const foreign = (rows ?? []).some(r => r.community_id !== profile.community_id)
      if (foreign || (rows ?? []).length !== ids.length) return { error: 'Brak uprawnień do części wybranych wpisów' }
    }

    const { error } = await admin
      .from('community_expenses')
      .update({ category })
      .in('id', ids)
    if (error) return { error: error.message }
    revalidatePath('/admin/finanse/koszty')
    revalidatePath('/admin/dashboard')
    return { updated: ids.length }
  } catch (e: any) {
    return { error: e?.message ?? String(e) }
  }
}

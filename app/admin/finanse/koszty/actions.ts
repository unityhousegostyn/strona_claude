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

// ── PARSER EKSPORTU BANKOWEGO ("Zestawienie operacji") ────────────
// Banki (np. Santander) eksportują CSV, w którym każdy wiersz jest
// dodatkowo owinięty w zewnętrzny cudzysłów, a wewnętrzne cudzysłowy są
// zdublowane (CSV-w-CSV). Po zdjęciu tej warstwy wiersz jest już
// standardowym CSV rozdzielanym przecinkiem. Kolumna "Typ transakcji"
// (Przelew z rachunku / Opłata / Zlecenie stałe...) to typ operacji
// bankowej, NIE kategoria kosztu w naszym systemie — stąd próby
// importu takiego pliku jako natywnego CSV kończyły się błędem
// "nieznana kategoria".
function unwrapBankLine(line: string): string {
  let s = line.trim()
  if (s.endsWith(';')) s = s.slice(0, -1)
  if (s.startsWith('"')) s = s.slice(1)
  if (s.endsWith('"')) s = s.slice(0, -1)
  return s.replace(/""/g, '"')
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = false }
      } else cur += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { out.push(cur); cur = '' }
      else cur += ch
    }
  }
  out.push(cur)
  return out
}

function isBankExport(firstLine: string): boolean {
  const lower = firstLine.toLowerCase()
  return lower.includes('data operacji') && lower.includes('typ transakcji')
}

// Banki eksportują "Zestawienie operacji" w co najmniej dwóch wariantach CSV:
// (A) każde pole osobno w cudzysłowie: "f1","f2","f3" — standardowy CSV,
//     parseCsvLine działa na nim bezpośrednio i daje >=4 pól;
// (B) CAŁY wiersz dodatkowo owinięty w jeden zewnętrzny cudzysłów z
//     zdublowanymi cudzysłowami wewnątrz (CSV-w-CSV), zakończony ";" —
//     parseCsvLine na surowym wierszu zwróci wtedy tylko 1 "pole" (cały
//     wiersz), które trzeba dodatkowo "rozpakować" przed ponownym parsowaniem.
function parseBankLine(line: string): string[] {
  const direct = parseCsvLine(line)
  if (direct.length >= 4) return direct
  return parseCsvLine(unwrapBankLine(line))
}

function guessExpenseCategory(text: string): ExpenseCategory {
  const t = text.toUpperCase()
  if (/WODOCI[ĄA]G|KANALIZ/.test(t)) return 'woda'
  if (/WYNAGRODZENIE ZARZ/.test(t)) return 'wynagrodzenie_zarządcy'
  if (/ODBI[OÓ]R ODPAD|ZAGOSPODAROWANIE ODPAD|[ŚS]MIECI/.test(t)) return 'śmieci'
  if (/OP[ŁL]ATA ZA PROWADZENIE|PROWIZJ|OP[ŁL]ATA BANKOWA/.test(t)) return 'opłaty_bankowe'
  if (/\bENEA\b|ENERGA|ENERGI[AE] ELEKTR|\bGAZ\b/.test(t)) return 'energia'
  if (/UBEZPIECZ|TUIR|WARTA S\.?A/.test(t)) return 'ubezpieczenie'
  if (/PRZEGL[ĄA]D|KOMINIARSK/.test(t)) return 'przeglądy_budynków'
  if (/SPRZ[ĄA]TANI/.test(t)) return 'sprzątanie'
  return 'inne'
}

// Etykiety używane przez bank do oznaczania pól szczegółów operacji —
// używane do odsiania "surowych" pól bez rozpoznanej etykiety (ostatni fallback).
const BANK_DETAIL_LABEL = /^(Tytu[lł]|Nazwa (odbiorcy|nadawcy)|Rachunek (odbiorcy|nadawcy)|Adres (odbiorcy|nadawcy)|Referencje własne zleceniodawcy|Numer telefonu|Lokalizacja|'?Operacja|Numer referencyjny):/i

function buildBankDescription(fields: string[], typTransakcji: string): string {
  const details = fields.slice(6).map(f => f.trim()).filter(Boolean)
  const titleField = details.find(f => /^Tytu[lł]:/i.test(f))
  const nameField = details.find(f => /^Nazwa (odbiorcy|nadawcy):/i.test(f))
  const locField = details.find(f => /^Lokalizacja:/i.test(f))
  const title = titleField?.replace(/^Tytu[lł]:\s*/i, '').trim().replace(/\s+/g, ' ')
  const name = nameField?.replace(/^Nazwa (odbiorcy|nadawcy):\s*/i, '').trim().replace(/\s+/g, ' ')
  // "Lokalizacja: Adres: Nazwa Sprzedawcy Miasto: X Kraj: Y" — wyciągamy nazwę sprzedawcy
  const loc = locField
    ?.replace(/^Lokalizacja:\s*(Adres:\s*)?/i, '')
    .replace(/\s*(Miasto|Kraj):.*$/i, '')
    .trim()
    .replace(/\s+/g, ' ')
  const titleIsJustRefNumber = !!title && /^\d+$/.test(title)
  // Pierwsze pole bez rozpoznanej etykiety — ostatni fallback (np. "OPŁATA ZA PROWADZENIE RACHUNKU")
  const unlabeled = details.find(f => !BANK_DETAIL_LABEL.test(f))

  let desc: string
  if (name && title && !titleIsJustRefNumber) desc = `${name} — ${title}`
  else if (name) desc = name
  else if (title && !titleIsJustRefNumber) desc = title
  else if (loc) desc = loc
  else if (unlabeled) desc = unlabeled
  else if (details[0]) desc = details[0]
  else desc = typTransakcji

  return desc.slice(0, 250)
}

async function importBankStatementCSV(
  community_id: string,
  user_id: string,
  lines: string[],
): Promise<{ imported: number; errors: string[] }> {
  const rows: any[] = []
  const errors: string[] = []
  let skippedIncome = 0

  for (let i = 1; i < lines.length; i++) {
    const fields = parseBankLine(lines[i])
    if (fields.length < 4) { errors.push(`Wiersz ${i + 1}: nieprawidłowy format`); continue }

    const [dateRaw, , typTransakcji, kwotaRaw] = fields
    const amount = parseFloat((kwotaRaw ?? '').replace(',', '.'))
    if (isNaN(amount)) { errors.push(`Wiersz ${i + 1}: nieprawidłowa kwota "${kwotaRaw}"`); continue }

    // Wpływy (kwota dodatnia) to przychody — pomijamy przy imporcie kosztów
    if (amount >= 0) { skippedIncome++; continue }

    if (!dateRaw || !/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
      errors.push(`Wiersz ${i + 1}: nieprawidłowa data "${dateRaw}"`)
      continue
    }

    const description = buildBankDescription(fields, typTransakcji) || typTransakcji || 'Operacja bankowa'
    const category = guessExpenseCategory(`${description} ${typTransakcji}`)

    rows.push({
      community_id,
      category,
      description,
      amount: Math.abs(amount),
      expense_date: dateRaw,
      invoice_number: null,
      is_renovation_fund: category === 'fundusz_remontowy',
      created_by: user_id,
    })
  }

  if (rows.length > 0) {
    const admin = getSupabaseAdminClient()
    const { error } = await admin.from('community_expenses').insert(rows)
    if (error) return { imported: 0, errors: [`DB: ${error.message}`, ...errors] }
  }

  const notes: string[] = []
  notes.push('Wykryto eksport z banku — kategorie przypisano automatycznie na podstawie tytułu operacji; sprawdź je i popraw zaznaczając wpisy i klikając "Zmień kategorię".')
  if (skippedIncome > 0) notes.push(`Pominięto ${skippedIncome} wpływów (to przychody, nie koszty — zaimportuj je w module Przychody).`)

  revalidatePath('/admin/finanse/koszty')
  revalidatePath('/admin/dashboard')
  return { imported: rows.length, errors: [...notes, ...errors] }
}

// ── IMPORT CSV ───────────────────────────────────────────────────
// Oczekiwany format CSV: data;opis;kategoria;kwota;nr_faktury
// Przykład: 2026-06-01;Faktura ZGKIM;zarząd;500.00;FV/123/2026
// Wspierany jest też bezpośredni import "Zestawienia operacji" z banku
// (wykrywany automatycznie po nagłówku) — patrz importBankStatementCSV.
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

    const rawLines = csvText.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim().length > 0)
    if (rawLines.length > 0 && isBankExport(rawLines[0])) {
      return importBankStatementCSV(community_id, user.id, rawLines)
    }

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

// ── GRUPOWE USUWANIE ──────────────────────────────────────────────
export async function bulkDeleteExpenses(ids: string[]): Promise<{ error?: string; deleted?: number }> {
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
      .delete()
      .in('id', ids)
    if (error) return { error: error.message }
    revalidatePath('/admin/finanse/koszty')
    revalidatePath('/admin/dashboard')
    return { deleted: ids.length }
  } catch (e: any) {
    return { error: e?.message ?? String(e) }
  }
}

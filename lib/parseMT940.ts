/**
 * Parser plików MT940 (wyciągi bankowe SWIFT).
 * Obsługuje najpopularniejsze warianty PKO BP, Pekao, mBank, ING, Santander.
 */
import { createHash } from 'crypto'

export interface MT940Transaction {
  /** Data waluty RRMMDD */
  valueDate: string       // ISO: YYYY-MM-DD
  /** Kwota, zawsze dodatnia */
  amount: number
  /** C = credit (wpływ), D = debit (wydatek) */
  direction: 'C' | 'D'
  /** Surowy opis z :86: */
  description: string
  /** Numer referencyjny z :61: */
  ref?: string
  /** Tytuł przelewu (wyodrębniony z opisu) */
  title?: string
  /** Nadawca lub odbiorca (wyodrębniony z opisu) */
  counterparty?: string
  /** SHA-256 hash do deduplication — unikalny identyfikator transakcji */
  txHash: string
}

/** Generuje SHA-256 hash z kluczowych pól transakcji */
export function computeTxHash(
  valueDate: string,
  amount: number,
  direction: string,
  ref: string | undefined,
  description: string,
): string {
  const raw = `${valueDate}|${amount.toFixed(2)}|${direction}|${ref ?? ''}|${description}`
  return createHash('sha256').update(raw).digest('hex')
}

export interface MT940Statement {
  accountNumber?: string
  openingBalance?: number
  closingBalance?: number
  transactions: MT940Transaction[]
  rawErrors: string[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(raw: string): string {
  // YYMMDD → YYYY-MM-DD
  if (raw.length < 6) return ''
  const yy = raw.slice(0, 2)
  const mm = raw.slice(2, 4)
  const dd = raw.slice(4, 6)
  const year = parseInt(yy, 10) < 50 ? `20${yy}` : `19${yy}`
  return `${year}-${mm}-${dd}`
}

function parseAmount(raw: string): number {
  // Europejski format: 1.234,56 lub 1234,56 lub 1234.56
  const cleaned = raw.replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

/**
 * Wyodrębnia pola z tagu :86: (opis transakcji).
 * Banki polskie używają różnych formatów — staramy się obsłużyć wszystkie.
 */
function extractDescription(raw: string): { title?: string; counterparty?: string } {
  // Format z kodami ~00, ~20-~29 (ING, mBank, PKO)
  const titleMatch = raw.match(/(?:~20|\/TXT\/|TYTUL:\s*)([^\n~\/]+)/i)
  const nameMatch  = raw.match(/(?:~32|~33|\/NAME\/|NADAWCA:\s*|ODBIORCA:\s*)([^\n~\/]+)/i)

  if (titleMatch || nameMatch) {
    return {
      title:        titleMatch?.[1]?.trim(),
      counterparty: nameMatch?.[1]?.trim(),
    }
  }

  // Fallback: pierwsze 2 linie jako nazwa i tytuł
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  return {
    counterparty: lines[0],
    title:        lines[1],
  }
}

// ── Główny parser ─────────────────────────────────────────────────────────────

export function parseMT940(content: string): MT940Statement {
  const result: MT940Statement = { transactions: [], rawErrors: [] }

  // Normalizacja końców linii
  const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Wyodrębnij numer konta z :25:
  const acctMatch = text.match(/:25:([^\n]+)/)
  if (acctMatch) result.accountNumber = acctMatch[1].trim()

  // Saldo otwarcia z :60F: lub :60M:
  const openMatch = text.match(/:60[FM]:([CD])(\d{6})(EUR|PLN|USD)?([\d,.]+)/)
  if (openMatch) {
    const sign = openMatch[1] === 'C' ? 1 : -1
    result.openingBalance = sign * parseAmount(openMatch[4])
  }

  // Saldo zamknięcia z :62F:
  const closeMatch = text.match(/:62[FM]:([CD])(\d{6})(EUR|PLN|USD)?([\d,.]+)/)
  if (closeMatch) {
    const sign = closeMatch[1] === 'C' ? 1 : -1
    result.closingBalance = sign * parseAmount(closeMatch[4])
  }

  // Parsuj transakcje: :61: + opcjonalny :86:
  // Użyj lookahead żeby złapać koniec tagu przed następnym
  const txRegex = /:61:([\s\S]*?)(?=:6[0-9]:|:86:|$)/g
  const descRegex = /:86:([\s\S]*?)(?=:6[0-9]:|:61:|$)/g

  // Podziel na bloki transakcji
  const blocks: { line61: string; line86?: string }[] = []

  // Podziel na tagi ogólnie
  const tagSections = text.split(/(?=:\d{2}[A-Z]?:)/)

  let lastTx: { line61: string; line86?: string } | null = null
  for (const section of tagSections) {
    if (section.startsWith(':61:')) {
      if (lastTx) blocks.push(lastTx)
      lastTx = { line61: section.slice(4).trim() }
    } else if (section.startsWith(':86:') && lastTx) {
      lastTx.line86 = section.slice(4).trim()
    }
  }
  if (lastTx) blocks.push(lastTx)

  for (const block of blocks) {
    try {
      // :61: format: YYMMDD[YYMMDD]D/CAmount[N]<ref>[//bankref]
      // np: 2601030103D1234,56NMSCNONREF//12345678
      const line = block.line61.split('\n')[0]
      const match = line.match(/^(\d{6})(\d{6})?([CD]R?)([A-Z]?)([\d,.]+)([A-Z]{4})(.*)$/)
      if (!match) {
        result.rawErrors.push(`Nie można sparsować :61:: ${line.slice(0, 40)}`)
        continue
      }

      const valueDate  = parseDate(match[1])
      const direction  = match[3].startsWith('C') ? 'C' : 'D'
      const amount     = parseAmount(match[5])
      const ref        = match[7]?.split('//')[0]?.trim()

      const descRaw    = block.line86 ?? ''
      const { title, counterparty } = extractDescription(descRaw)
      const txHash     = computeTxHash(valueDate, amount, direction, ref, descRaw)

      result.transactions.push({
        valueDate,
        amount,
        direction,
        description: descRaw,
        ref,
        title,
        counterparty,
        txHash,
      })
    } catch (e: any) {
      result.rawErrors.push(`Błąd parsowania bloku: ${e?.message}`)
    }
  }

  return result
}

// ── Dopasowanie do lokali ─────────────────────────────────────────────────────

export interface Apartment {
  id: string
  number: string
  owner_name: string
  community_id: string
}

export interface MatchResult {
  tx: MT940Transaction
  apartment: Apartment | null
  confidence: number   // 0-100
  matchReason: string
}

/**
 * Dopasowuje transakcje kredytowe do lokali po:
 * 1. Numerze lokalu w tytule/opisie (pewność 90)
 * 2. Nazwisku właściciela w nadawcy/opisie (pewność 70)
 * 3. Kwocie (pewność 30 — tylko podpowiedź)
 */
export function matchTransactions(
  transactions: MT940Transaction[],
  apartments: Apartment[],
): MatchResult[] {
  const credits = transactions.filter(t => t.direction === 'C')

  return credits.map(tx => {
    const searchText = [tx.title, tx.counterparty, tx.description].join(' ').toUpperCase()

    // 1. Szukaj numeru lokalu (np. "LOK 12", "LOKAL 12", "MIESZKANIE 12", "12A", "M12")
    for (const apt of apartments) {
      const num = apt.number.toUpperCase().replace(/\s+/g, '')
      // Wzorce: LOK12, LOKAL12, M.12, M12, MIESZANIA12, bezpośredni nr "12"
      const patterns = [
        new RegExp(`\\b(LOK\\.?\\s*|LOKAL\\s*|MIESZKANIE\\s*|MIESZK\\.?\\s*|M\\.?\\s*)${escapeRe(num)}\\b`, 'i'),
        new RegExp(`\\b${escapeRe(num)}\\b`),
      ]
      for (const pat of patterns) {
        if (pat.test(searchText)) {
          return { tx, apartment: apt, confidence: 90, matchReason: `nr lokalu "${apt.number}"` }
        }
      }
    }

    // 2. Szukaj nazwiska właściciela
    for (const apt of apartments) {
      const parts = apt.owner_name.toUpperCase().split(/\s+/)
      const lastName = parts[parts.length - 1]   // zakładamy "Imię Nazwisko"
      if (lastName.length >= 4 && searchText.includes(lastName)) {
        return { tx, apartment: apt, confidence: 70, matchReason: `nazwisko "${apt.owner_name}"` }
      }
    }

    // 3. Brak dopasowania
    return { tx, apartment: null, confidence: 0, matchReason: 'brak dopasowania' }
  })
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

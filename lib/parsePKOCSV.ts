/**
 * Parser pliku CSV z PKO BP (iPKO).
 * Zwraca ten sam format MT940Statement co parseMT940.ts —
 * dzięki temu matchTransactions i reszta kodu działają bez zmian.
 *
 * Obsługiwane warianty kolumn PKO BP:
 *  - "Data operacji";"Data waluty";"Typ transakcji";"Kwota";"Waluta";"Saldo po transakcji";"Opis transakcji"
 *  - "Data";"Opis operacji";"Rachunek/Karta";"Kwota";"Saldo"  (starszy format)
 */

import { computeTxHash, type MT940Statement, type MT940Transaction } from './parseMT940'

// Rozdziel linię CSV uwzględniając cudzysłowy (pola mogą zawierać ;)
function splitCSVLine(line: string, sep = ';'): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === sep && !inQuotes) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

function parsePolishAmount(s: string): number {
  // "150,00" lub "-150,00" lub "1 234,56"
  const cleaned = s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

export function parsePKOCSV(content: string): MT940Statement {
  const result: MT940Statement = { transactions: [], rawErrors: [] }

  const lines = content
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  if (!lines.length) return result

  // Znajdź linię nagłówka kolumn — szukamy "Data operacji" lub "Data"
  let headerIdx = -1
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const lower = lines[i].toLowerCase()
    if (lower.includes('data operacji') || lower.includes('data waluty') || lower.includes('typ transakcji')) {
      headerIdx = i
      break
    }
    // Starszy format
    if (lower.startsWith('"data"') || lower.startsWith('data;')) {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) {
    result.rawErrors.push('Nie rozpoznano nagłówka CSV. Oczekiwano kolumny "Data operacji" lub "Data".')
    return result
  }

  // Próba wyciągnięcia numeru konta z linii przed nagłówkiem
  for (let i = 0; i < headerIdx; i++) {
    const parts = splitCSVLine(lines[i])
    for (const p of parts) {
      const m = p.match(/PL\d{2}[\s\d]{20,}/)
      if (m) { result.accountNumber = m[0].replace(/\s/g, ''); break }
    }
    if (result.accountNumber) break
  }

  const headers = splitCSVLine(lines[headerIdx]).map(h => h.toLowerCase().replace(/"/g, ''))

  // Mapowanie nazw kolumn → indeksy
  const idx = {
    date:        headers.findIndex(h => h.includes('data operacji') || h === 'data'),
    valueDate:   headers.findIndex(h => h.includes('data waluty')),
    type:        headers.findIndex(h => h.includes('typ transakcji') || h.includes('opis operacji') || h.includes('typ operacji')),
    amount:      headers.findIndex(h => h === 'kwota'),
    description: headers.findIndex(h => h.includes('opis transakcji') || h.includes('tytul') || h.includes('tytuł') || h.includes('opis')),
    ref:         headers.findIndex(h => h.includes('referencyjny') || h.includes('numer ref')),
  }

  if (idx.date === -1 || idx.amount === -1) {
    result.rawErrors.push(`Nie znaleziono wymaganych kolumn (data, kwota). Nagłówki: ${headers.join(', ')}`)
    return result
  }

  // Parsuj wiersze danych
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line.startsWith('"Numer rachunku') || line.startsWith('"Suma')) continue

    try {
      const cols = splitCSVLine(line)
      if (cols.length < 3) continue

      const dateRaw = cols[idx.date]?.replace(/"/g, '').trim() ?? ''
      // PKO BP używa YYYY-MM-DD
      const valueDate = dateRaw.match(/^\d{4}-\d{2}-\d{2}$/) ? dateRaw : ''
      if (!valueDate) continue

      const amountRaw  = cols[idx.amount]?.replace(/"/g, '').trim() ?? ''
      const amountVal  = parsePolishAmount(amountRaw)
      if (amountVal === 0 || isNaN(amountVal)) continue

      // Ujemna kwota = debit, dodatnia = credit
      const direction: 'C' | 'D' = amountVal >= 0 ? 'C' : 'D'
      const amount = Math.abs(amountVal)

      const descIdx    = idx.description >= 0 ? idx.description : (idx.type >= 0 ? idx.type : -1)
      const description = descIdx >= 0 ? (cols[descIdx]?.replace(/"/g, '').trim() ?? '') : ''
      const ref         = idx.ref >= 0 ? (cols[idx.ref]?.replace(/"/g, '').trim() || undefined) : undefined

      // Wyodrębnij tytuł przelewu z opisu — PKO BP często daje "Nadawca: ...\nTytuł: ..."
      let title       = description
      let counterparty: string | undefined
      const titleMatch = description.match(/[Tt]ytu[łl][:\s]+([^\n]+)/)
      const nameMatch  = description.match(/(?:[Nn]adawca|[Oo]dbiorca)[:\s]+([^\n]+)/)
      if (titleMatch) title = titleMatch[1].trim()
      if (nameMatch)  counterparty = nameMatch[1].trim()

      const txHash = computeTxHash(valueDate, amount, direction, ref, description)

      result.transactions.push({
        valueDate,
        amount,
        direction,
        description,
        ref,
        title,
        counterparty,
        txHash,
      })
    } catch (e: any) {
      result.rawErrors.push(`Wiersz ${i + 1}: ${e?.message}`)
    }
  }

  return result
}

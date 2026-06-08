/**
 * Logika rozliczeń wspólnoty mieszkaniowej
 * Podstawa prawna: Ustawa o własności lokali z 24.06.1994 r.
 */

export interface SettlementApartment {
  id: string
  community_id: string
  number: string
  owner_name: string
  owner_id: string | null
  area_m2: number
  share_numerator: number | null
  share_denominator: number | null
  persons_count: number
  has_meter: boolean
  floor: number | null
  notes: string | null
  active: boolean
}

export interface SettlementRate {
  id: string
  community_id: string
  effective_from: string          // ISO date: '2026-01-01'
  water_price_m3: number
  water_ryczalt_m3: number
  garbage_per_person: number
  renovation_rate_m2: number
  operating_rate_m2: number
  manager_fee_type: 'per_m2' | 'fixed'
  manager_fee_value: number
}

export interface SettlementEntry {
  id: string
  apartment_id: string
  year: number
  month: number
  paid: number
  water_correction: number
  notes: string | null
}

export interface MonthlyRow {
  month: number
  monthName: string
  hasRates: boolean
  balance_start: number
  paid: number
  renovation: number
  operating: number
  manager: number
  water: number
  garbage: number
  correction: number
  total_due: number
  balance_end: number
  entry: SettlementEntry | null
}

const MONTH_NAMES = [
  'Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
  'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'
]

/** Znajdź stawki obowiązujące w danym miesiącu */
export function getRatesForMonth(
  rates: SettlementRate[],
  year: number,
  month: number
): SettlementRate | null {
  // Porównanie rok*100+miesiąc — unika problemów z timezone przy Date('YYYY-MM-DD')
  const targetYM = year * 100 + month

  const valid = rates
    .filter(r => {
      const [ry, rm] = r.effective_from.split('-').map(Number)
      return ry * 100 + rm <= targetYM
    })
    .sort((a, b) => {
      const [ay, am] = a.effective_from.split('-').map(Number)
      const [by, bm] = b.effective_from.split('-').map(Number)
      return (by * 100 + bm) - (ay * 100 + am)
    })

  return valid[0] ?? null
}

/** Oblicz składniki miesięczne dla lokalu */
export function calcMonthCharges(
  apt: SettlementApartment,
  rates: SettlementRate,
  entry: SettlementEntry | null
): {
  renovation: number
  operating: number
  manager: number
  water: number
  garbage: number
  correction: number
  total_due: number
  paid: number
} {
  const r = (v: number) => Math.round(v * 100) / 100

  const renovation = r(rates.renovation_rate_m2 * apt.area_m2)
  const operating  = r(rates.operating_rate_m2  * apt.area_m2)
  const manager    = rates.manager_fee_type === 'per_m2'
    ? r(rates.manager_fee_value * apt.area_m2)
    : r(rates.manager_fee_value)                   // stała kwota
  const water      = r(rates.water_ryczalt_m3 * rates.water_price_m3)
  const garbage    = r(apt.persons_count * rates.garbage_per_person)
  const correction = r(entry?.water_correction ?? 0)
  const paid       = r(entry?.paid ?? 0)

  const total_due = r(renovation + operating + manager + water + garbage + correction)

  return { renovation, operating, manager, water, garbage, correction, total_due, paid }
}

/** Oblicz pełną tabelę 12 miesięcy dla lokalu */
export function buildYearlyTable(
  apt: SettlementApartment,
  rates: SettlementRate[],
  entries: SettlementEntry[],
  year: number,
  initialBalance = 0
): MonthlyRow[] {
  const rows: MonthlyRow[] = []
  let balance = initialBalance

  const now = new Date()
  const currentYear  = now.getFullYear()
  const currentMonth = now.getMonth() + 1  // 1-based

  for (let month = 1; month <= 12; month++) {
    const entry   = entries.find(e => e.month === month) ?? null

    // Bieżący i przyszłe miesiące bez wpłaty — pokaż jako puste (nie naliczaj)
    const isFuture = year > currentYear || (year === currentYear && month >= currentMonth)
    if (isFuture && !entry) {
      rows.push({
        month,
        monthName: MONTH_NAMES[month - 1],
        hasRates: false,
        balance_start: balance,
        paid: 0, renovation: 0, operating: 0, manager: 0,
        water: 0, garbage: 0, correction: 0, total_due: 0,
        balance_end: balance,
        entry: null,
      })
      continue
    }

    const monthRates = getRatesForMonth(rates, year, month)
    const balance_start = balance

    if (!monthRates) {
      const paid = entry?.paid ?? 0
      const balance_end = Math.round((balance_start + paid) * 100) / 100
      rows.push({
        month,
        monthName: MONTH_NAMES[month - 1],
        hasRates: false,
        balance_start,
        paid,
        renovation: 0, operating: 0, manager: 0,
        water: 0, garbage: 0, correction: 0, total_due: 0,
        balance_end,
        entry,
      })
      balance = balance_end
      continue
    }

    const charges = calcMonthCharges(apt, monthRates, entry)
    const balance_end = Math.round((balance_start + charges.paid - charges.total_due) * 100) / 100

    rows.push({
      month,
      monthName: MONTH_NAMES[month - 1],
      hasRates: true,
      balance_start,
      balance_end,
      entry,
      ...charges,
    })

    balance = balance_end
  }

  return rows
}

/** Formatuj PLN */
export function pln(v: number): string {
  return v.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
}

/** Udział jako string */
export function shareStr(apt: SettlementApartment): string {
  if (apt.share_numerator && apt.share_denominator) {
    return `${apt.share_numerator}/${apt.share_denominator}`
  }
  return '—'
}

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
  // 'ryczalt' = stała m³/mies, 'meter' = odczyt licznika,
  // 'zaliczka' = woda wyliczana z wpłaty mieszkańca (wpłacono − pozostałe opłaty = kwota za wodę)
  water_billing_type: 'ryczalt' | 'meter' | 'zaliczka'
}

export interface SettlementEntry {
  id: string
  apartment_id: string
  year: number
  month: number
  paid: number
  water_correction: number
  water_m3: number   // zużycie wody w m³ (dla billing_type='meter')
  notes: string | null
  persons_count: number | null  // nadpisanie liczby osób (śmieci); NULL = domyślna z lokalu
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
  persons_used: number  // faktyczna liczba osób użyta do naliczenia śmieci
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
  const persons    = entry?.persons_count ?? apt.persons_count
  const garbage    = r(persons * rates.garbage_per_person)
  const correction = r(entry?.water_correction ?? 0)
  const paid       = r(entry?.paid ?? 0)

  // 'zaliczka': woda to różnica między wpłatą a pozostałymi opłatami (samonaliczenie
  // mieszkańca) — liczona tylko wtedy, gdy mamy faktyczny wpis (wpłatę) za miesiąc;
  // bez wpisu (np. podgląd stawek w zawiadomieniu) woda = 0, tak jak przy 'meter'.
  const water = rates.water_billing_type === 'meter'
    ? r((entry?.water_m3 ?? 0) * rates.water_price_m3)
    : rates.water_billing_type === 'zaliczka'
      ? (entry ? r(paid - (renovation + operating + manager + garbage + correction)) : 0)
      : r(rates.water_ryczalt_m3 * rates.water_price_m3)

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

  // Tylko dla modelu 'zaliczka': najpierw pokrywamy bieżące i zaległe opłaty
  // stałe (fundusze, zarządca, śmieci, korekta) ze WSZYSTKICH dotychczasowych
  // wpłat narastająco, a dopiero nadwyżka ponad to liczy się jako woda. Dzięki
  // temu spóźniona wpłata pokrywająca kilka miesięcy zaległości nie zostaje
  // błędnie zaksięgowana w całości jako woda za miesiąc, w którym wpłynęła.
  let cumFixedDue = 0
  let cumPaid = 0
  let cumWaterAttributed = 0

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
        persons_used: apt.persons_count,
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
        persons_used: entry?.persons_count ?? apt.persons_count,
      })
      balance = balance_end
      continue
    }

    const charges = calcMonthCharges(apt, monthRates, entry)

    // Model 'zaliczka': przelicz wodę narastająco (zaległe opłaty stałe mają
    // priorytet przed wodą), niezależnie od tego, co calcMonthCharges policzył
    // dla samego tego miesiąca w izolacji.
    if (monthRates.water_billing_type === 'zaliczka') {
      const r = (v: number) => Math.round(v * 100) / 100
      cumFixedDue = r(cumFixedDue + charges.renovation + charges.operating + charges.manager + charges.garbage + charges.correction)
      cumPaid = r(cumPaid + charges.paid)
      const totalWaterAvailable = Math.max(0, r(cumPaid - cumFixedDue))
      charges.water = r(totalWaterAvailable - cumWaterAttributed)
      cumWaterAttributed = totalWaterAvailable
      charges.total_due = r(charges.renovation + charges.operating + charges.manager + charges.water + charges.garbage + charges.correction)
    }

    const balance_end = Math.round((balance_start + charges.paid - charges.total_due) * 100) / 100

    rows.push({
      month,
      monthName: MONTH_NAMES[month - 1],
      hasRates: true,
      balance_start,
      balance_end,
      entry,
      persons_used: entry?.persons_count ?? apt.persons_count,
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

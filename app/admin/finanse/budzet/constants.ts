export interface BudgetCategory {
  value: string
  label: string
}

export interface BudgetFund {
  key: string
  label: string
  categories: BudgetCategory[]
}

export const BUDGET_FUNDS: BudgetFund[] = [
  {
    key: 'eksploatacyjny',
    label: 'Fundusz eksploatacyjny',
    categories: [
      { value: 'woda',                     label: 'Woda / kanalizacja' },
      { value: 'energia',                  label: 'Energia / gaz' },
      { value: 'sprzątanie',               label: 'Sprzątanie' },
      { value: 'śmieci',                   label: 'Odpady / śmieci' },
      { value: 'fundusz_eksploatacyjny',   label: 'Fundusz eksploatacyjny (ogólny)' },
      { value: 'wynagrodzenie_zarządcy',   label: 'Wynagrodzenie zarządcy' },
      { value: 'koszty_administracji',     label: 'Koszty administracji' },
      { value: 'opłaty_bankowe',           label: 'Opłaty bankowe' },
      { value: 'najem',                    label: 'Najem (przychód z lokali)' },
    ],
  },
  {
    key: 'remontowy',
    label: 'Fundusz remontowy',
    categories: [
      { value: 'fundusz_remontowy',        label: 'Fundusz remontowy (ogólny)' },
      { value: 'remonty',                  label: 'Remonty / naprawy' },
      { value: 'przeglądy_budynków',       label: 'Przeglądy budynków' },
      { value: 'ubezpieczenie',            label: 'Ubezpieczenie' },
      { value: 'podatek_od_nieruchomości', label: 'Podatek od nieruchomości' },
    ],
  },
  {
    key: 'inne',
    label: 'Pozostałe',
    categories: [
      { value: 'zarząd',      label: 'Zarządzanie (inne)' },
      { value: 'pozostałe',   label: 'Pozostałe' },
      { value: 'inne',        label: 'Inne' },
    ],
  },
]

/** Flat lista wszystkich kategorii — do lookupów */
export const BUDGET_CATEGORIES: BudgetCategory[] = BUDGET_FUNDS.flatMap(f => f.categories)

/** Zwróć etykietę dla wartości kategorii */
export function catLabel(cat: string): string {
  return BUDGET_CATEGORIES.find(c => c.value === cat)?.label ?? cat
}

/** Zwróć klucz funduszu dla danej kategorii */
export function catFund(cat: string): string {
  for (const fund of BUDGET_FUNDS) {
    if (fund.categories.some(c => c.value === cat)) return fund.key
  }
  return 'inne'
}

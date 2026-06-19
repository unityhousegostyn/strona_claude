export type IncomeCategory =
  | 'odsetki'
  | 'zwrot'
  | 'dotacja'
  | 'lokata'
  | 'inne'

export const INCOME_CATEGORIES: { value: IncomeCategory; label: string }[] = [
  { value: 'odsetki', label: 'Odsetki od lokat' },
  { value: 'zwrot', label: 'Zwrot / refundacja' },
  { value: 'dotacja', label: 'Dotacja' },
  { value: 'lokata', label: 'Przelew na lokatę (kapitał)' },
  { value: 'inne', label: 'Inne' },
]

/** Kategorie, które NIE są przychodem operacyjnym — wykluczone z sum w raportach */
export const NON_INCOME_CATEGORIES: IncomeCategory[] = ['lokata']

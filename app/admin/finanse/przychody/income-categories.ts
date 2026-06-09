export type IncomeCategory =
  | 'odsetki'
  | 'zwrot'
  | 'dotacja'
  | 'inne'

export const INCOME_CATEGORIES: { value: IncomeCategory; label: string }[] = [
  { value: 'odsetki', label: 'Odsetki od lokat' },
  { value: 'zwrot', label: 'Zwrot / refundacja' },
  { value: 'dotacja', label: 'Dotacja' },
  { value: 'inne', label: 'Inne' },
]

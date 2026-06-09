export type ExpenseCategory =
  | 'zarząd'
  | 'woda'
  | 'śmieci'
  | 'remonty'
  | 'ubezpieczenie'
  | 'energia'
  | 'fundusz_remontowy'
  | 'inne'

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'zarząd', label: 'Zarządzanie' },
  { value: 'woda', label: 'Woda / kanalizacja' },
  { value: 'śmieci', label: 'Odpady / śmieci' },
  { value: 'remonty', label: 'Remonty / naprawy' },
  { value: 'ubezpieczenie', label: 'Ubezpieczenie' },
  { value: 'energia', label: 'Energia / gaz' },
  { value: 'fundusz_remontowy', label: 'Fundusz remontowy' },
  { value: 'inne', label: 'Inne' },
]

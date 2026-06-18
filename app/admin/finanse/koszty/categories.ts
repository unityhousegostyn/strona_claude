export type ExpenseCategory =
  | 'fundusz_remontowy'
  | 'fundusz_eksploatacyjny'
  | 'wynagrodzenie_zarządcy'
  | 'woda'
  | 'śmieci'
  | 'remonty'
  | 'ubezpieczenie'
  | 'energia'
  | 'zarząd'
  | 'inne'

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'fundusz_remontowy',      label: 'Fundusz remontowy' },
  { value: 'fundusz_eksploatacyjny', label: 'Fundusz eksploatacyjny' },
  { value: 'wynagrodzenie_zarządcy', label: 'Wynagrodzenie zarządcy' },
  { value: 'woda',                   label: 'Woda / kanalizacja' },
  { value: 'śmieci',                 label: 'Odpady / śmieci' },
  { value: 'remonty',                label: 'Remonty / naprawy' },
  { value: 'ubezpieczenie',          label: 'Ubezpieczenie' },
  { value: 'energia',                label: 'Energia / gaz' },
  { value: 'zarząd',                 label: 'Zarządzanie (inne)' },
  { value: 'inne',                   label: 'Inne' },
]

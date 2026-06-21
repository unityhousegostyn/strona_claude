export type ExpenseCategory =
  | 'fundusz_remontowy'
  | 'fundusz_eksploatacyjny'
  | 'wynagrodzenie_zarządcy'
  | 'koszty_administracji'
  | 'woda'
  | 'śmieci'
  | 'sprzątanie'
  | 'opłaty_bankowe'
  | 'przeglądy_budynków'
  | 'remonty'
  | 'ubezpieczenie'
  | 'energia'
  | 'najem'
  | 'zarząd'
  | 'inne'

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'fundusz_remontowy',      label: 'Fundusz remontowy' },
  { value: 'fundusz_eksploatacyjny', label: 'Fundusz eksploatacyjny' },
  { value: 'wynagrodzenie_zarządcy', label: 'Wynagrodzenie zarządcy' },
  { value: 'koszty_administracji',   label: 'Koszty administracji' },
  { value: 'woda',                   label: 'Woda / kanalizacja' },
  { value: 'śmieci',                 label: 'Odpady / śmieci' },
  { value: 'sprzątanie',             label: 'Sprzątanie' },
  { value: 'opłaty_bankowe',         label: 'Opłaty bankowe' },
  { value: 'przeglądy_budynków',     label: 'Przeglądy budynków' },
  { value: 'remonty',                label: 'Remonty / naprawy' },
  { value: 'ubezpieczenie',          label: 'Ubezpieczenie' },
  { value: 'energia',                label: 'Energia / gaz' },
  { value: 'najem',                  label: 'Najem (fundusz eksploatacyjny)' },
  { value: 'zarząd',                 label: 'Zarządzanie (inne)' },
  { value: 'inne',                   label: 'Inne' },
]

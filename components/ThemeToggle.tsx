'use client'

import { useTheme } from './ThemeProvider'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Przełącz na tryb jasny' : 'Przełącz na tryb ciemny'}
      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition hover:bg-[#33200d] text-[#b45309] hover:text-[#fde68a]"
    >
      <span className="text-base">{theme === 'dark' ? '☀️' : '🌙'}</span>
      <span>{theme === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}</span>
    </button>
  )
}

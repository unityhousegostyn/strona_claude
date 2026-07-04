'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'dark',
  toggle: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    const migrated = localStorage.getItem('theme_v2')
    let initial: Theme = 'light'
    if (!migrated) {
      // One-time migration to light mode after redesign
      localStorage.setItem('theme_v2', '1')
      localStorage.setItem('theme', 'light')
      initial = 'light'
    } else {
      initial = saved ?? 'light'
    }
    setTheme(initial)
    applyTheme(initial)
  }, [])

  function applyTheme(t: Theme) {
    const html = document.documentElement
    if (t === 'dark') {
      html.classList.add('dark')
      html.classList.remove('light')
    } else {
      html.classList.remove('dark')
      html.classList.add('light')
    }
  }

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    applyTheme(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

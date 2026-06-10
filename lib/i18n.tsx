'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import pl from '@/messages/pl.json'
import uk from '@/messages/uk.json'
import en from '@/messages/en.json'

export type Locale = 'pl' | 'uk' | 'en'

const MESSAGES: Record<Locale, typeof pl> = { pl, uk, en }

export const LOCALE_LABELS: Record<Locale, string> = {
  pl: '🇵🇱 Polski',
  uk: '🇺🇦 Українська',
  en: '🇬🇧 English',
}

const STORAGE_KEY = 'app_locale'

interface I18nContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'pl',
  setLocale: () => {},
  t: (key) => key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('pl')

  useEffect(() => {
    const stored = (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null) as Locale | null
    if (stored && MESSAGES[stored]) setLocaleState(stored)
  }, [])

  const setLocale = (l: Locale) => {
    setLocaleState(l)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, l)
  }

  const t = (key: string): string => {
    const parts = key.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let val: any = MESSAGES[locale]
    for (const part of parts) {
      if (val == null) break
      val = val[part]
    }
    if (typeof val === 'string') return val
    // Fallback to pl
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fallback: any = MESSAGES['pl']
    for (const part of parts) {
      if (fallback == null) break
      fallback = fallback[part]
    }
    return typeof fallback === 'string' ? fallback : key
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

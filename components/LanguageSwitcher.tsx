'use client'

import { useI18n, LOCALE_LABELS, type Locale } from '@/lib/i18n'

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()
  const locales = Object.keys(LOCALE_LABELS) as Locale[]

  return (
    <div className="flex gap-1 flex-wrap">
      {locales.map(l => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`text-xs px-3 py-1.5 rounded-lg transition ${
            locale === l
              ? 'bg-green-600 text-white font-semibold'
              : 'bg-stone-200 text-stone-500 hover:bg-stone-300 hover:text-stone-800'
          }`}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  )
}

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
              ? 'bg-blue-600 text-white font-semibold'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
          }`}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  )
}

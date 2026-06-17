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
              ? 'bg-teal-600 text-white font-semibold'
              : 'bg-[#162418] text-[#4d9e94] hover:bg-[#1c2e1e] hover:text-[#d1fae5]'
          }`}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  )
}

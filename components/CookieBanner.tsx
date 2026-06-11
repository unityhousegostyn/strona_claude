'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('cookie_notice_accepted')) {
      setVisible(true)
    }
  }, [])

  const accept = () => {
    localStorage.setItem('cookie_notice_accepted', '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9998] px-4 pb-4 pointer-events-none">
      <div className="max-w-2xl mx-auto bg-[#1e1810] border border-[#1e3324] rounded-2xl shadow-2xl shadow-black/60 px-5 py-4 flex items-center gap-4 flex-wrap pointer-events-auto">
        <div className="flex-1 min-w-0 flex items-start gap-3">
          <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="text-sm text-[#a7f3d0] leading-relaxed">
            Ta aplikacja używa wyłącznie{' '}
            <span className="text-[#ecfdf5] font-medium">niezbędnych plików cookie</span>
            {' '}do obsługi sesji logowania. Nie stosujemy śledzenia ani reklam.{' '}
            <Link href="/privacy" className="text-emerald-500 hover:underline whitespace-nowrap">
              Polityka prywatności →
            </Link>
          </p>
        </div>
        <button
          onClick={accept}
          className="flex-shrink-0 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          Rozumiem
        </button>
      </div>
    </div>
  )
}

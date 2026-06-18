'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const REFRESH_MS = 5 * 60_000 // 5 minut

const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const

export default function SuperAdminRefreshTimer() {
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_MS / 1000)
  const deadline = useRef<number>(Date.now() + REFRESH_MS)
  const rafRef   = useRef<number | null>(null)

  const scheduleRefresh = useCallback(() => {
    deadline.current = Date.now() + REFRESH_MS
  }, [])

  // Tick — aktualizuje licznik i odświeża gdy dojdzie do zera
  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, deadline.current - Date.now())
      setSecondsLeft(Math.ceil(remaining / 1000))

      if (remaining <= 0) {
        window.location.reload()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  // Reset timera przy aktywności
  useEffect(() => {
    EVENTS.forEach(ev => window.addEventListener(ev, scheduleRefresh, { passive: true }))
    return () => EVENTS.forEach(ev => window.removeEventListener(ev, scheduleRefresh))
  }, [scheduleRefresh])

  const min = Math.floor(secondsLeft / 60)
  const sec = secondsLeft % 60
  const display = `${min}:${String(sec).padStart(2, '0')}`

  // Kolor: normalny → żółty → czerwony w ostatnich 30s
  const urgent = secondsLeft <= 30
  const warn   = secondsLeft <= 60 && !urgent

  return (
    <div
      title="Czas do automatycznego odświeżenia danych"
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors ${
        urgent
          ? 'bg-red-950/40 text-red-400 border border-red-900/50'
          : warn
          ? 'bg-yellow-950/30 text-yellow-400 border border-yellow-900/40'
          : 'bg-[#081918] text-[#4d9e94] border border-[#0f2d2a]'
      }`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10"/>
        <path d="M20.49 15a9 9 0 1 1-.12-5.99"/>
      </svg>
      {display}
    </div>
  )
}

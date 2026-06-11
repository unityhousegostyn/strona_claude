'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const IDLE_MS = 5 * 60_000        // 5 minut
const WARN_MS = 30_000        // ostrzeżenie 30s przed końcem

const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'focus', 'click'] as const

export default function InactivityLogout() {
  const [countdown, setCountdown] = useState<number | null>(null)
  const idleTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }, [supabase])

  const clearTimers = useCallback(() => {
    if (idleTimer.current)  clearTimeout(idleTimer.current)
    if (warnTimer.current)  clearTimeout(warnTimer.current)
    if (countRef.current)   clearInterval(countRef.current)
    setCountdown(null)
  }, [])

  const resetTimer = useCallback(() => {
    clearTimers()

    warnTimer.current = setTimeout(() => {
      // Zacznij odliczanie
      let sec = Math.round(WARN_MS / 1000)
      setCountdown(sec)
      countRef.current = setInterval(() => {
        sec -= 1
        setCountdown(sec)
        if (sec <= 0) {
          clearInterval(countRef.current!)
        }
      }, 1000)
    }, IDLE_MS - WARN_MS)

    idleTimer.current = setTimeout(() => {
      logout()
    }, IDLE_MS)
  }, [clearTimers, logout])

  const stayActive = useCallback(() => {
    resetTimer()
  }, [resetTimer])

  useEffect(() => {
    resetTimer()

    EVENTS.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }))

    // Wylogowanie przy zamknięciu/odświeżeniu zakładki
    const handleUnload = () => {
      navigator.sendBeacon?.('/api/logout')
    }
    window.addEventListener('pagehide', handleUnload)

    return () => {
      clearTimers()
      EVENTS.forEach(ev => window.removeEventListener(ev, resetTimer))
      window.removeEventListener('pagehide', handleUnload)
    }
  }, [resetTimer, clearTimers])

  if (countdown === null) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#121c15] border border-[#1e3324] rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center space-y-5">
        <div className="text-5xl">⏱️</div>
        <div>
          <h2 className="text-lg font-bold text-[#ecfdf5]">Brak aktywności</h2>
          <p className="text-sm text-[#6b9478] mt-1">Zostaniesz automatycznie wylogowany za</p>
        </div>
        <div className="text-6xl font-mono font-bold text-red-400">
          {countdown}s
        </div>
        <button
          onClick={stayActive}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition text-sm"
        >
          Zostań zalogowany
        </button>
      </div>
    </div>
  )
}

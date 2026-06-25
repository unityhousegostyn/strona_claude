/**
 * In-memory rate limiter dla prób weryfikacji PINu głosowania.
 * Keyed by userId — odporna na rotację IP, chroni przed brute-force
 * na każdym koncie niezależnie.
 *
 * Limit: 5 błędnych prób w oknie 15 minut → blokada konta na czas okna.
 * Po prawidłowym PINie licznik jest resetowany.
 */

interface PinWindow {
  attempts: number
  resetAt: number
}

const windows = new Map<string, PinWindow>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minut

/** Zwraca true gdy próba jest dozwolona, false gdy przekroczono limit. */
export function checkPinRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = windows.get(userId)

  if (!entry || now > entry.resetAt) {
    windows.set(userId, { attempts: 1, resetAt: now + WINDOW_MS })
    return true
  }

  if (entry.attempts >= MAX_ATTEMPTS) return false

  entry.attempts++
  return true
}

/** Resetuje licznik po udanej weryfikacji. */
export function clearPinRateLimit(userId: string): void {
  windows.delete(userId)
}

/** Ile prób pozostało (dla komunikatu błędu). */
export function remainingPinAttempts(userId: string): number {
  const now = Date.now()
  const entry = windows.get(userId)
  if (!entry || now > entry.resetAt) return MAX_ATTEMPTS
  return Math.max(0, MAX_ATTEMPTS - entry.attempts)
}

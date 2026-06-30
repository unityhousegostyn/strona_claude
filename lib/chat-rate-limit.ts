/**
 * In-memory rate limiter dla endpointu /api/chat.
 * Keyed by userId — chroni przed spalaniem kredytów Anthropic API
 * przez jednego użytkownika.
 *
 * Limit: 20 zapytań na godzinę per konto.
 * W produkcji można zastąpić Upstash Redis dla persistence między
 * instancjami serwera — na jednym workerie ten in-memory jest wystarczający.
 */

interface ChatWindow {
  count: number
  resetAt: number
}

const windows = new Map<string, ChatWindow>()

const MAX_REQUESTS = 20
const WINDOW_MS = 60 * 60 * 1000 // 1 godzina

/** Zwraca true gdy zapytanie jest dozwolone, false gdy przekroczono limit. */
export function checkChatRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = windows.get(userId)

  if (!entry || now > entry.resetAt) {
    windows.set(userId, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }

  if (entry.count >= MAX_REQUESTS) return false

  entry.count++
  return true
}

/** Ile zapytań pozostało w bieżącym oknie (dla nagłówka Retry-After). */
export function remainingChatRequests(userId: string): number {
  const now = Date.now()
  const entry = windows.get(userId)
  if (!entry || now > entry.resetAt) return MAX_REQUESTS
  return Math.max(0, MAX_REQUESTS - entry.count)
}

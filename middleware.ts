import { NextRequest, NextResponse } from 'next/server'

// ── Rate limiting (in-memory, per IP) ────────────────────────────────────────
// Prosty sliding window — dla produkcji zamień na Redis/Upstash

interface Window {
  count: number
  resetAt: number
}

const windows = new Map<string, Window>()

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/':      { max: 60,  windowMs: 60_000 },   // API: 60 req/min
  '/login':     { max: 10,  windowMs: 60_000 },   // Login: 10 req/min
  '/register':  { max: 5,   windowMs: 60_000 },   // Rejestracja: 5 req/min
  '/admin/':    { max: 200, windowMs: 60_000 },   // Panel: 200 req/min
}

function getLimit(pathname: string) {
  for (const [prefix, limit] of Object.entries(LIMITS)) {
    if (pathname.startsWith(prefix)) return limit
  }
  return null
}

function getRealIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

function checkRateLimit(ip: string, pathname: string): boolean {
  const limit = getLimit(pathname)
  if (!limit) return true

  const key = `${ip}:${Object.keys(LIMITS).find(p => pathname.startsWith(p))}`
  const now = Date.now()
  const win = windows.get(key)

  if (!win || now > win.resetAt) {
    windows.set(key, { count: 1, resetAt: now + limit.windowMs })
    return true
  }

  if (win.count >= limit.max) return false

  win.count++
  return true
}

// ── Security headers ─────────────────────────────────────────────────────────

function addSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  )
  return res
}

// ── Middleware ───────────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = getRealIp(request)

  // Rate limiting
  if (!checkRateLimit(ip, pathname)) {
    return new NextResponse(
      JSON.stringify({ error: 'Zbyt wiele żądań. Poczekaj chwilę.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
        },
      }
    )
  }

  const res = NextResponse.next()
  return addSecurityHeaders(res)
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/:path*',
    '/login',
    '/register',
  ],
}

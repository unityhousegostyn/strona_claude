import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── Rate limiting (in-memory, per IP) ────────────────────────────────────────
interface RateWindow { count: number; resetAt: number }
const windows = new Map<string, RateWindow>()

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/':     { max: 60,  windowMs: 60_000 },
  '/login':    { max: 10,  windowMs: 60_000 },
  '/register': { max: 5,   windowMs: 60_000 },
  '/admin/':   { max: 200, windowMs: 60_000 },
}

function getRealIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
}

function checkRateLimit(ip: string, pathname: string): boolean {
  const prefix = Object.keys(LIMITS).find(p => pathname.startsWith(p))
  if (!prefix) return true
  const limit = LIMITS[prefix]
  const key = `${ip}:${prefix}`
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

function addSecurityHeaders(res: NextResponse): void {
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
}

// ── Proxy (Supabase auth + routing) ──────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = getRealIp(request)

  // Rate limiting
  if (!checkRateLimit(ip, pathname)) {
    return new NextResponse(
      JSON.stringify({ error: 'Zbyt wiele zadań. Poczekaj chwilę.' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
    )
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            const { maxAge, expires, ...sessionOptions } = options as any ?? {}
            supabaseResponse.cookies.set(name, value, sessionOptions)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAdminRoute    = pathname.startsWith('/admin')
  const isLoginPage     = pathname === '/login'
  const adminOnlyPrefixes = ['/admin/users', '/admin/communities']
  const isAdminOnlyRoute  = adminOnlyPrefixes.some(p => pathname.startsWith(p))

  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()
    profile = data
  }

  // Niezalogowany na /admin
  if (isAdminRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Konto oczekujące
  if (isAdminRoute && profile?.status === 'pending') {
    return NextResponse.redirect(new URL('/login?status=pending', request.url))
  }

  // Trasy tylko dla admin/super_admin
  if (isAdminOnlyRoute && profile?.role === 'user') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  // Zalogowany nie wraca na /login
  if (isLoginPage && user && profile && profile.status !== 'pending') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  // Sprawdź poziom MFA — jeśli użytkownik ma 2FA a nie zweryfikował, przekieruj
  if (user && isAdminRoute && !pathname.startsWith('/mfa-verify')) {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aalData?.nextLevel === 'aal2' && aalData?.currentLevel !== 'aal2') {
      const mfaUrl = new URL('/mfa-verify', request.url)
      return NextResponse.redirect(mfaUrl)
    }
  }

  addSecurityHeaders(supabaseResponse)
  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*', '/login', '/register', '/mfa-verify'],
}

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/audit'

/**
 * POST /api/log-login
 * Rejestruje logowanie w audit logu.
 *
 * Body: { token: string }  — access_token z sesji Supabase
 *
 * Weryfikacja przez admin.auth.getUser(token) — niezależna od cookie session
 * i niezależna od middleware (nie podlega redirect dla strony /login).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { token } = body as { token?: unknown }

    if (!token || typeof token !== 'string' || token.length < 10) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const admin = getSupabaseAdminClient()
    const { data: { user }, error } = await admin.auth.getUser(token)

    if (error || !user) {
      console.error('[log-login] getUser failed:', error?.message ?? 'no user')
      return NextResponse.json({ ok: false, reason: 'auth' }, { status: 401 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown'
    const ua = request.headers.get('user-agent') ?? 'unknown'

    await logActivity({
      userId: user.id,
      action: 'login',
      meta: { ip, ua: ua.slice(0, 200) },
    })

    console.log('[log-login] ok — user:', user.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[log-login] error:', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

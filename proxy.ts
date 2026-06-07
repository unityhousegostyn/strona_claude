import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
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
            // Sesja tylko na czas przeglądarki — brak maxAge/expires
            const { maxAge, expires, ...sessionOptions } = options as any ?? {}
            supabaseResponse.cookies.set(name, value, sessionOptions)
          })
        },
      },
    }
  )

  // 🔥 Pobierz sesję
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAdminRoute = pathname.startsWith('/admin')
  const isLoginPage = pathname === '/login'

  // Trasy dostępne tylko dla admin i super_admin
  const adminOnlyPrefixes = [
    '/admin/users',
    '/admin/communities',
  ]
  const isAdminOnlyRoute = adminOnlyPrefixes.some((p) => pathname.startsWith(p))

  // 🔥 Jeśli user istnieje → pobierz profil
  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    profile = data
  }

  // 🔥 1. Blokada dla niezalogowanych na /admin
  if (isAdminRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 🔥 2. Blokada dla pending — czeka na akceptację admina
  if (isAdminRoute && profile?.status === 'pending') {
    return NextResponse.redirect(new URL('/login?status=pending', request.url))
  }

  // 🔥 3. Blokada tras admin-only dla roli 'user'
  if (isAdminOnlyRoute && profile?.role === 'user') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  // 🔥 4. Jeśli user jest zalogowany i aktywny → nie wpuszczaj na /login
  if (isLoginPage && user && profile && profile.status !== 'pending') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
}

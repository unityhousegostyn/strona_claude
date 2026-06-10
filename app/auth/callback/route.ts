import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Przesuń status unconfirmed → pending (teraz trafia do kolejki akceptacji admina)
        const admin = getSupabaseAdminClient()
        await admin
          .from('profiles')
          .update({ status: 'pending' })
          .eq('id', user.id)
          .eq('status', 'unconfirmed')

        // Wyloguj — user musi poczekać na akceptację, nie ma jeszcze dostępu
        await supabase.auth.signOut()
      }

      return NextResponse.redirect(new URL('/login?verified=true', request.url))
    }
  }

  return NextResponse.redirect(new URL('/login?error=invalid-link', request.url))
}

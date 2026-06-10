import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = (searchParams.get('type') ?? 'signup') as 'signup' | 'email'

  if (!token_hash) {
    return NextResponse.redirect(new URL('/login?error=invalid-link', request.url))
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(c) { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
      },
    }
  )

  // verifyOtp nie wymaga PKCE — działa bezpośrednio z tokenem z maila
  const { error } = await supabase.auth.verifyOtp({ token_hash, type })

  if (!error) {
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const admin = getSupabaseAdminClient()
      await admin
        .from('profiles')
        .update({ status: 'pending' })
        .eq('id', user.id)
        .eq('status', 'unconfirmed')

      await supabase.auth.signOut()
    }

    return NextResponse.redirect(new URL('/login?verified=true', request.url))
  }

  return NextResponse.redirect(new URL('/login?error=invalid-link', request.url))
}

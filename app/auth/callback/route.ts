import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { sendNewUserPendingEmail } from '@/lib/email'

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

  const { error } = await supabase.auth.verifyOtp({ token_hash, type })

  if (error) {
    return NextResponse.redirect(new URL('/login?error=invalid-link', request.url))
  }

  // Pobierz ID właśnie zweryfikowanego użytkownika
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const admin = getSupabaseAdminClient()

    // Pobierz profil konkretnie tego usera
    const { data: profile } = await admin
      .from('profiles')
      .select('id, full_name, email, status')
      .eq('id', user.id)
      .maybeSingle()

    if (profile) {
      if (profile.status === 'invited') {
        // Zaproszony — od razu aktywny
        await admin.from('profiles').update({ status: 'active' }).eq('id', profile.id)
      } else if (profile.status === 'unconfirmed') {
        // Zwykła rejestracja — czeka na akceptację admina
        await admin.from('profiles').update({ status: 'pending' }).eq('id', profile.id)

        const notifyEmail = process.env.SUPER_ADMIN_EMAIL ?? process.env.EMAIL_USER
        if (notifyEmail) {
          try {
            await sendNewUserPendingEmail({
              to: notifyEmail,
              userName: profile.full_name ?? profile.email ?? 'Nieznany',
              userEmail: profile.email ?? '',
            })
          } catch {}
        }
      }
    }
  }

  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login?verified=true', request.url))
}

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

  // Email zweryfikowany — szukamy profilu ze statusem unconfirmed
  // i aktualizujemy go na pending
  const admin = getSupabaseAdminClient()

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .eq('status', 'unconfirmed')
    .order('created_at', { ascending: false })
    .limit(5)

  // Znajdź profil który właśnie potwierdził email (najnowszy unconfirmed)
  // verifyOtp nie zwraca zawsze user — używamy listy unconfirmed jako fallback
  if (profiles && profiles.length > 0) {
    const profile = profiles[0]

    await admin
      .from('profiles')
      .update({ status: 'pending' })
      .eq('id', profile.id)
      .eq('status', 'unconfirmed')

    // EMAIL_USER to konto wysyłające = super_admin — zawsze dostępne
    const notifyEmail = process.env.EMAIL_USER
    if (notifyEmail) {
      try {
        await sendNewUserPendingEmail({
          to: notifyEmail,
          userName: profile.full_name ?? profile.email ?? 'Nieznany',
          userEmail: profile.email ?? '',
        })
      } catch {
        // nie blokujemy
      }
    }
  }

  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login?verified=true', request.url))
}

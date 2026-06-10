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

  // verifyOtp zwraca user bezpośrednio — nie polegamy na sesji SSR
  const { data: verifyData, error } = await supabase.auth.verifyOtp({ token_hash, type })

  if (error || !verifyData?.user) {
    return NextResponse.redirect(new URL('/login?error=invalid-link', request.url))
  }

  const verifiedUser = verifyData.user
  const admin = getSupabaseAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email, status')
    .eq('id', verifiedUser.id)
    .single()

  if (profile?.status === 'unconfirmed') {
    await admin
      .from('profiles')
      .update({ status: 'pending' })
      .eq('id', verifiedUser.id)

    // Pobierz IDs super_adminów
    const { data: superAdminProfiles } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'super_admin')
      .eq('status', 'active')

    // Emaile z auth — profiles.email bywa null dla kont zakładanych przez admina
    const superAdminEmails: string[] = []
    for (const sa of superAdminProfiles ?? []) {
      const { data: authUser } = await admin.auth.admin.getUserById(sa.id)
      if (authUser?.user?.email) superAdminEmails.push(authUser.user.email)
    }

    if (superAdminEmails.length > 0) {
      try {
        await sendNewUserPendingEmail({
          to: superAdminEmails,
          userName: profile.full_name ?? verifiedUser.email ?? 'Nieznany',
          userEmail: profile.email ?? verifiedUser.email ?? '',
        })
      } catch {
        // nie blokujemy redirecta
      }
    }
  }

  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login?verified=true', request.url))
}

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Klient z sesją użytkownika (do auth checks w pages/layouts)
export async function getSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Sesja tylko na czas przeglądarki — brak maxAge/expires
              const { maxAge, expires, ...sessionOptions } = options as any ?? {}
              cookieStore.set(name, value, sessionOptions)
            })
          } catch {
            // Server Component — nie można ustawiać cookies
          }
        },
      },
    }
  )
}

// Klient admina (service role) — tylko do operacji admin (np. tworzenie użytkowników)
export function getSupabaseAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
    }
  )
}

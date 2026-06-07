import { createBrowserClient } from '@supabase/ssr'

export function getSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (url, options = {}) =>
          fetch(url, {
            ...options,
            credentials: 'include', // 🔥 KLUCZOWE — bez tego cookies NIE DZIAŁAJĄ
          }),
      },
    }
  )
}

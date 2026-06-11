import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import WnioskiClient from './WnioskiClient'

export default async function WnioskiPage() {
  const { user, profile } = await getAuthProfile()
  const admin = getSupabaseAdminClient()

  const isAdmin = profile.role === 'admin'
  const isSuperAdmin = profile.role === 'super_admin'
  const isUser = profile.role === 'user'

  // Pobierz wnioski (bez embedded join do profiles — FK jest do auth.users, nie profiles)
  let query = admin
    .from('community_requests')
    .select('*, community:communities(name)')
    .order('created_at', { ascending: false })

  if (isUser) {
    query = query.eq('user_id', user.id) as any
  } else if (isAdmin && profile.community_id) {
    query = query.eq('community_id', profile.community_id) as any
  }

  const { data: requests, error } = await query

  if (error) {
    console.error('[wnioski/page] query error:', error.message)
  }

  const list = requests ?? []

  // Pobierz dane profili dla znalezionych user_id
  let profileMap: Record<string, { full_name: string | null; email: string }> = {}
  if (list.length > 0) {
    const userIds = [...new Set(list.map((r: any) => r.user_id))]
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)
    for (const p of profiles ?? []) {
      profileMap[p.id] = { full_name: p.full_name, email: p.email }
    }
  }

  // Scal dane
  const enriched = list.map((r: any) => ({
    ...r,
    profile: profileMap[r.user_id] ?? null,
  }))

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-[#ecfdf5]">Wnioski do administracji</h2>
        <p className="text-sm text-[#4d7a5f] mt-1">
          {isUser
            ? 'Złóż wniosek o zaświadczenie, naprawę lub udostępnienie dokumentów.'
            : 'Przeglądaj i obsługuj wnioski mieszkańców.'}
        </p>
      </div>
      <WnioskiClient
        requests={enriched as any}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        communityId={profile.community_id}
      />
    </div>
  )
}

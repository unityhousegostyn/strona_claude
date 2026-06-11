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

  // Buduj zapytanie
  let query = admin
    .from('community_requests')
    .select('*, profile:profiles(full_name, email), community:communities(name)')
    .order('created_at', { ascending: false })

  if (isUser) {
    // Mieszkaniec widzi tylko swoje wnioski
    query = query.eq('user_id', user.id) as any
  } else if (isAdmin && profile.community_id) {
    // Admin widzi wnioski swojej wspólnoty
    query = query.eq('community_id', profile.community_id) as any
  }
  // super_admin widzi wszystko

  const { data: requests } = await query

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-[#f0ebe0]">Wnioski do administracji</h2>
        <p className="text-sm text-[#6a5a48] mt-1">
          {isUser
            ? 'Złóż wniosek o zaświadczenie, naprawę lub udostępnienie dokumentów.'
            : 'Przeglądaj i obsługuj wnioski mieszkańców.'}
        </p>
      </div>
      <WnioskiClient
        requests={(requests ?? []) as any}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        communityId={profile.community_id}
      />
    </div>
  )
}

import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MessagesClient from './MessagesClient'

export default async function MessagesPage() {
  const { profile } = await getAuthProfile()
  if (profile.role === 'user' || profile.role === 'najemca') redirect('/admin/dashboard')

  const admin = getSupabaseAdminClient()

  // Pobierz wspólnoty (super_admin widzi wszystkie, admin tylko swoją)
  let communities: { id: string; name: string }[] = []
  if (profile.role === 'super_admin') {
    const { data } = await admin.from('communities').select('id, name').order('name')
    communities = data ?? []
  } else if (profile.community_id) {
    const { data } = await admin.from('communities').select('id, name').eq('id', profile.community_id).single()
    if (data) communities = [data]
  }

  // Pobierz mieszkańców dla domyślnej wspólnoty
  const defaultCommunityId = communities[0]?.id ?? null
  let residents: { id: string; full_name: string | null; email: string }[] = []
  if (defaultCommunityId) {
    const { data } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .eq('community_id', defaultCommunityId)
      .eq('role', 'user')
      .eq('status', 'active')
      .not('email', 'is', null)
      .order('full_name')
    residents = (data ?? []) as typeof residents
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-[#f0fdfa]">Wyślij wiadomość</h2>
        <p className="text-sm text-[#115e59] mt-1">Wyślij email do mieszkańców bezpośrednio z systemu</p>
      </div>
      <MessagesClient
        communities={communities}
        initialResidents={residents}
        isSuperAdmin={profile.role === 'super_admin'}
      />
    </div>
  )
}

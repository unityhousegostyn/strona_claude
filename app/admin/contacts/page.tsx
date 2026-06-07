import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import ContactsClient from './ContactsClient'

export default async function ContactsPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const admin = getSupabaseAdminClient()
  const isSuperAdmin = profile.role === 'super_admin'
  const canEdit = profile.role === 'admin' || profile.role === 'super_admin'

  // Pobierz kontakty
  const contactsQuery = admin
    .from('contacts')
    .select('*')
    .order('category')
    .order('name')

  if (!isSuperAdmin && profile.community_id) {
    contactsQuery.or(`community_id.eq.${profile.community_id},community_id.is.null`)
  }

  const { data: rawContacts } = await contactsQuery

  // Pobierz wspólnoty dla mapowania nazw
  let communities: { id: string; name: string }[] = []
  const communityMap: Record<string, string> = {}

  if (isSuperAdmin) {
    const { data } = await admin.from('communities').select('id, name').order('name')
    communities = data ?? []
    for (const c of communities) communityMap[c.id] = c.name
  }

  const contacts = (rawContacts ?? []).map((c: any) => ({
    ...c,
    communityName: c.community_id ? (communityMap[c.community_id] ?? null) : null,
  }))

  return (
    <div className="max-w-3xl">
      <ContactsClient
        contacts={contacts}
        canEdit={canEdit}
        isSuperAdmin={isSuperAdmin}
        defaultCommunityId={profile.community_id}
        communities={communities}
      />
    </div>
  )
}

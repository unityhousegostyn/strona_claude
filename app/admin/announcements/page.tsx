import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AnnouncementsList from './AnnouncementsList'

export default async function AnnouncementsPage() {
  const { user, profile } = await getAuthProfile()

  const admin = getSupabaseAdminClient()
  const isSuperAdmin = profile.role === 'super_admin'

  // Zapytanie 1: ogłoszenia — prosty select bez joina
  const { data: announcements } = await admin
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })

  // Zapytanie 2: junction table — bez joina do communities
  const { data: junctions } = await admin
    .from('announcement_communities')
    .select('announcement_id, community_id')

  // Zapytanie 3: wszystkie wspólnoty do mapowania nazw
  const { data: communities } = await admin
    .from('communities')
    .select('id, name')

  const communityMap: Record<string, string> = {}
  for (const c of communities ?? []) {
    communityMap[c.id] = c.name
  }

  // Mapa: announcement_id → lista community_id
  const junctionMap: Record<string, string[]> = {}
  for (const j of junctions ?? []) {
    if (!junctionMap[j.announcement_id]) junctionMap[j.announcement_id] = []
    junctionMap[j.announcement_id].push(j.community_id)
  }

  // Filtruj dla nie-super_admin
  const visible = isSuperAdmin
    ? (announcements ?? [])
    : (announcements ?? []).filter((a: any) => {
        if (a.target === 'all') return true
        if (a.target === 'one') return a.community_id === profile.community_id
        if (a.target === 'selected') {
          return (junctionMap[a.id] ?? []).includes(profile.community_id ?? '')
        }
        return false
      })

  const canEdit = isSuperAdmin || profile.role === 'admin'

  const targetLabel = (a: any) => {
    if (a.target === 'all') return { text: 'Wszystkie wspólnoty', cls: 'bg-blue-950/40 text-blue-400' }
    if (a.target === 'one') return { text: communityMap[a.community_id] ?? '—', cls: 'bg-gray-900 text-gray-400' }
    const names = (junctionMap[a.id] ?? []).map((cid) => communityMap[cid] ?? cid)
    return { text: names.join(', ') || '—', cls: 'bg-purple-950/30 text-purple-400' }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-100">Ogłoszenia</h2>
        {canEdit && (
          <Link
            href="/admin/announcements/add"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            + Dodaj ogłoszenie
          </Link>
        )}
      </div>

      <AnnouncementsList
        announcements={visible}
        communityMap={communityMap}
        junctionMap={junctionMap}
        canEdit={canEdit}
      />
    </div>
  )
}

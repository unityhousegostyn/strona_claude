import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AnnouncementsPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

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
          return (junctionMap[a.id] ?? []).includes(profile.community_id)
        }
        return false
      })

  const canEdit = isSuperAdmin || profile.role === 'admin'

  const targetLabel = (a: any) => {
    if (a.target === 'all') return { text: 'Wszystkie wspólnoty', cls: 'bg-blue-50 text-blue-700' }
    if (a.target === 'one') return { text: communityMap[a.community_id] ?? '—', cls: 'bg-gray-100 text-gray-600' }
    const names = (junctionMap[a.id] ?? []).map((cid) => communityMap[cid] ?? cid)
    return { text: names.join(', ') || '—', cls: 'bg-purple-50 text-purple-700' }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Ogłoszenia</h2>
        {canEdit && (
          <Link
            href="/admin/announcements/add"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            + Dodaj ogłoszenie
          </Link>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-gray-400">Brak ogłoszeń.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((a: any) => {
            const { text, cls } = targetLabel(a)
            return (
              <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{a.title}</p>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{a.content}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
                        {text}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(a.created_at).toLocaleDateString('pl-PL')}
                      </span>
                    </div>
                  </div>
                  {canEdit && (
                    <Link
                      href={`/admin/announcements/${a.id}`}
                      className="text-sm text-blue-600 hover:underline whitespace-nowrap"
                    >
                      Edytuj
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

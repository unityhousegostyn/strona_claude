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

  // Pobierz ogłoszenia z powiązanymi wspólnotami (junction)
  const { data: all } = await admin
    .from('announcements')
    .select('*, community:communities(name), announcement_communities(community:communities(id, name))')
    .order('created_at', { ascending: false })

  // Filtruj dla nie-super_admin: pokaż target='all' lub ogłoszenia dla ich wspólnoty
  const announcements = isSuperAdmin
    ? (all ?? [])
    : (all ?? []).filter((a: any) => {
        if (a.target === 'all') return true
        if (a.target === 'one') return a.community_id === profile.community_id
        if (a.target === 'selected') {
          return (a.announcement_communities ?? []).some(
            (ac: any) => ac.community?.id === profile.community_id
          )
        }
        return false
      })

  const canEdit = isSuperAdmin || profile.role === 'admin'

  const targetLabel = (a: any) => {
    if (a.target === 'all') return { text: 'Wszystkie wspólnoty', cls: 'bg-blue-50 text-blue-700' }
    if (a.target === 'one') return { text: a.community?.name ?? '—', cls: 'bg-gray-100 text-gray-600' }
    const names = (a.announcement_communities ?? []).map((ac: any) => ac.community?.name).filter(Boolean)
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

      {announcements.length === 0 ? (
        <p className="text-sm text-gray-400">Brak ogłoszeń.</p>
      ) : (
        <div className="space-y-3">
          {announcements.map((a: any) => {
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

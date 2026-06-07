import { getSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AnnouncementsPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const query = supabase
    .from('announcements')
    .select('*, community:communities(name)')
    .order('created_at', { ascending: false })

  if (profile.role !== 'super_admin') {
    query.eq('community_id', profile.community_id)
  }

  const { data: announcements } = await query
  const canEdit = profile.role === 'super_admin' || profile.role === 'admin'

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

      {!announcements || announcements.length === 0 ? (
        <p className="text-sm text-gray-400">Brak ogłoszeń.</p>
      ) : (
        <div className="space-y-3">
          {announcements.map((a: any) => (
            <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-900">{a.title}</p>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{a.content}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {a.community?.name} · {new Date(a.created_at).toLocaleDateString('pl-PL')}
                  </p>
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
          ))}
        </div>
      )}
    </div>
  )
}
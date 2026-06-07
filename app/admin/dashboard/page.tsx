import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, community:communities(*)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const role = profile.role
  const admin = getSupabaseAdminClient()

  let communitiesCount = 0
  let usersCount = 0
  let ticketsCount = 0
  let announcements: any[] = []

  if (role === 'super_admin') {
    const [c, u, t, a] = await Promise.all([
      admin.from('communities').select('id', { count: 'exact', head: true }),
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      admin.from('tickets').select('id', { count: 'exact', head: true }),
      admin.from('announcements').select('*').order('created_at', { ascending: false }).limit(5),
    ])
    communitiesCount = c.count ?? 0
    usersCount = u.count ?? 0
    ticketsCount = t.count ?? 0
    announcements = a.data ?? []
  } else {
    const communityId = profile.community_id
    const [t, a] = await Promise.all([
      admin.from('tickets').select('id', { count: 'exact', head: true }).eq('community_id', communityId),
      admin.from('announcements').select('*').eq('community_id', communityId).order('created_at', { ascending: false }).limit(5),
    ])
    ticketsCount = t.count ?? 0
    announcements = a.data ?? []
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">
          {role === 'super_admin' ? 'Widok globalny' : `Wspólnota: ${profile.community?.name ?? '—'}`}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {role === 'super_admin' && (
          <>
            <StatCard label="Wspólnoty" value={communitiesCount} icon="🏢" />
            <StatCard label="Użytkownicy" value={usersCount} icon="👥" />
          </>
        )}
        <StatCard label="Zgłoszenia" value={ticketsCount} icon="🎫" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Ostatnie ogłoszenia</h3>
        {announcements.length === 0 ? (
          <p className="text-sm text-gray-400">Brak ogłoszeń.</p>
        ) : (
          <div className="space-y-2">
            {announcements.map((a: any) => (
              <div key={a.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                <p className="font-medium text-gray-800 text-sm">{a.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(a.created_at).toLocaleDateString('pl-PL')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4">
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}
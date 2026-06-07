import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StatsChart from './StatsChart'

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

  const admin = getSupabaseAdminClient()
  const role = profile.role
  const communityId = profile.community_id
  const community = (profile as any).community

  // ─── SUPER ADMIN ───────────────────────────────────────────────
  if (role === 'super_admin') {
    const [c, u, t, a, allTickets, communities] = await Promise.all([
      admin.from('communities').select('id', { count: 'exact', head: true }),
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      admin.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      admin.from('announcements').select('*').order('created_at', { ascending: false }).limit(5),
      admin.from('tickets').select('status, community_id'),
      admin.from('communities').select('id, name'),
    ])

    const commMap: Record<string, string> = {}
    for (const c of communities.data ?? []) commMap[c.id] = c.name
    const statsMap: Record<string, { otwarte: number; zamknięte: number }> = {}
    for (const t of allTickets.data ?? []) {
      const key = t.community_id ?? 'Brak'
      if (!statsMap[key]) statsMap[key] = { otwarte: 0, zamknięte: 0 }
      if (t.status === 'open') statsMap[key].otwarte++
      else statsMap[key].zamknięte++
    }
    const chartData = Object.entries(statsMap).map(([id, v]) => ({ name: commMap[id] ?? id, ...v }))

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Witaj, {profile.full_name?.split(' ')[0] ?? 'Super Admin'} 👋
          </h2>
          <p className="text-sm text-gray-500 mt-1">Widok globalny — wszystkie wspólnoty</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Wspólnoty" value={c.count ?? 0} icon="🏢" href="/admin/communities" />
          <StatCard label="Użytkownicy" value={u.count ?? 0} icon="👥" href="/admin/users" />
          <StatCard label="Otwarte zgłoszenia" value={t.count ?? 0} icon="🎫" href="/admin/tickets" />
          <StatCard label="Ogłoszenia" value={(a.data ?? []).length} icon="📢" href="/admin/announcements" />
        </div>

        <StatsChart data={chartData} title="Zgłoszenia per wspólnota" />

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-800">Ostatnie ogłoszenia</h3>
            <Link href="/admin/announcements/add" className="text-sm text-blue-600 hover:underline">+ Dodaj</Link>
          </div>
          <AnnouncementList announcements={a.data ?? []} />
        </div>
      </div>
    )
  }

  // ─── ADMIN ─────────────────────────────────────────────────────
  if (role === 'admin') {
    const now = new Date()
    const [t, openTickets, a, docs, pending, tickets] = await Promise.all([
      admin.from('tickets').select('id', { count: 'exact', head: true }).eq('community_id', communityId).eq('status', 'open'),
      admin.from('tickets').select('id, title, status, created_at').eq('community_id', communityId).eq('status', 'open').order('created_at', { ascending: false }).limit(5),
      admin.from('announcements').select('*').order('created_at', { ascending: false }).limit(5),
      admin.from('documents').select('id', { count: 'exact', head: true }).or(`community_id.eq.${communityId},target.eq.all`),
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      admin.from('tickets').select('status, created_at').eq('community_id', communityId),
    ])

    const months: Record<string, { otwarte: number; zamknięte: number }> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = d.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' })
      months[key] = { otwarte: 0, zamknięte: 0 }
    }
    for (const tick of tickets.data ?? []) {
      const key = new Date(tick.created_at).toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' })
      if (months[key]) tick.status === 'open' ? months[key].otwarte++ : months[key].zamknięte++
    }
    const chartData = Object.entries(months).map(([name, v]) => ({ name, ...v }))

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Witaj, {profile.full_name?.split(' ')[0] ?? 'Administratorze'} 👋
          </h2>
          <p className="text-sm text-gray-500 mt-1">{community?.name ?? '—'}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Otwarte zgłoszenia" value={t.count ?? 0} icon="🎫" href="/admin/tickets" color="yellow" />
          <StatCard label="Dokumenty" value={docs.count ?? 0} icon="📁" href="/admin/documents" />
          <StatCard label="Oczekujących" value={pending.count ?? 0} icon="⏳" href="/admin/users" color={pending.count ? 'red' : undefined} />
          <StatCard label="Ogłoszenia" value={(a.data ?? []).length} icon="📢" href="/admin/announcements" />
        </div>

        <StatsChart data={chartData} title="Zgłoszenia — ostatnie 6 miesięcy" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-800">Otwarte zgłoszenia</h3>
              <Link href="/admin/tickets" className="text-sm text-blue-600 hover:underline">Zobacz wszystkie</Link>
            </div>
            {(openTickets.data ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">Brak otwartych zgłoszeń.</p>
            ) : (
              <div className="space-y-2">
                {(openTickets.data ?? []).map((t: any) => (
                  <Link key={t.id} href={`/admin/tickets/${t.id}`}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-200 transition">
                    <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
                    <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full ml-2 flex-shrink-0">Otwarte</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-800">Ostatnie ogłoszenia</h3>
              <Link href="/admin/announcements/add" className="text-sm text-blue-600 hover:underline">+ Dodaj</Link>
            </div>
            <AnnouncementList announcements={a.data ?? []} />
          </div>
        </div>
      </div>
    )
  }

  // ─── USER (MIESZKANIEC) ─────────────────────────────────────────
  const [myTickets, announcements, docs, unread] = await Promise.all([
    admin.from('tickets').select('id, title, status, created_at')
      .eq('created_by', user.id).order('created_at', { ascending: false }).limit(5),
    admin.from('announcements').select('*')
      .or(`target.eq.all,community_id.eq.${communityId}`)
      .order('created_at', { ascending: false }).limit(5),
    admin.from('documents').select('id, name, storage_path, created_at')
      .or(`target.eq.all,community_id.eq.${communityId}`)
      .order('created_at', { ascending: false }).limit(4),
    admin.from('announcements').select('id', { count: 'exact', head: true })
      .not('id', 'in', `(SELECT announcement_id FROM read_announcements WHERE user_id = '${user.id}')`)
      .or(`target.eq.all,community_id.eq.${communityId}`),
  ])

  const openCount = (myTickets.data ?? []).filter((t: any) => t.status === 'open').length

  return (
    <div className="space-y-6">
      {/* Powitanie */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
        <h2 className="text-2xl font-bold">
          Witaj, {profile.full_name?.split(' ')[0] ?? 'mieszkańcu'} 👋
        </h2>
        <p className="text-blue-100 mt-1 text-sm">{community?.name ?? '—'} · {community?.address ?? ''}</p>
        <div className="flex gap-4 mt-4">
          <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
            <p className="text-xl font-bold">{unread.count ?? 0}</p>
            <p className="text-xs text-blue-100">Nowe ogłoszenia</p>
          </div>
          <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
            <p className="text-xl font-bold">{openCount}</p>
            <p className="text-xs text-blue-100">Otwarte zgłoszenia</p>
          </div>
        </div>
      </div>

      {/* Szybkie akcje */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickAction href="/admin/announcements" icon="📢" label="Ogłoszenia"
          badge={unread.count ? `${unread.count} nowych` : undefined} badgeColor="blue" />
        <QuickAction href="/admin/tickets" icon="🎫" label="Moje zgłoszenia"
          badge={openCount ? `${openCount} otwartych` : undefined} badgeColor="yellow" />
        <QuickAction href="/admin/documents" icon="📁" label="Dokumenty" />
        <QuickAction href="/admin/profile" icon="👤" label="Mój profil" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Ostatnie ogłoszenia */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-800">Ostatnie ogłoszenia</h3>
            <Link href="/admin/announcements" className="text-sm text-blue-600 hover:underline">Zobacz wszystkie</Link>
          </div>
          {(announcements.data ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">Brak ogłoszeń.</p>
          ) : (
            <div className="space-y-2">
              {(announcements.data ?? []).map((a: any) => (
                <Link key={a.id} href={`/admin/announcements/${a.id}`}
                  className="block bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-200 transition">
                  <p className="text-sm font-medium text-gray-800 truncate">{a.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(a.created_at).toLocaleDateString('pl-PL')}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Moje zgłoszenia */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-800">Moje zgłoszenia</h3>
            <Link href="/admin/tickets" className="text-sm text-blue-600 hover:underline">Nowe zgłoszenie</Link>
          </div>
          {(myTickets.data ?? []).length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-6 text-center">
              <p className="text-sm text-gray-400 mb-3">Nie masz jeszcze żadnych zgłoszeń.</p>
              <Link href="/admin/tickets"
                className="text-sm text-blue-600 font-medium hover:underline">
                Zgłoś problem →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {(myTickets.data ?? []).map((t: any) => (
                <Link key={t.id} href={`/admin/tickets/${t.id}`}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-200 transition">
                  <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${
                    t.status === 'open' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {t.status === 'open' ? 'Otwarte' : 'Zamknięte'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ostatnie dokumenty */}
      {(docs.data ?? []).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-800">Ostatnie dokumenty</h3>
            <Link href="/admin/documents" className="text-sm text-blue-600 hover:underline">Zobacz wszystkie</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(docs.data ?? []).map((d: any) => {
              const ext = d.name.split('.').pop()?.toLowerCase()
              const icon = ext === 'pdf' ? '📄' : ['doc','docx'].includes(ext) ? '📝' : ['xls','xlsx'].includes(ext) ? '📊' : '📁'
              return (
                <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-blue-200 transition">
                  <p className="text-3xl mb-2">{icon}</p>
                  <p className="text-xs font-medium text-gray-700 truncate">{d.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(d.created_at).toLocaleDateString('pl-PL')}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Komponenty pomocnicze ──────────────────────────────────────

function StatCard({ label, value, icon, href, color }: {
  label: string; value: number; icon: string; href: string; color?: string
}) {
  const colorMap: Record<string, string> = {
    yellow: 'text-yellow-600',
    red: 'text-red-600',
  }
  return (
    <Link href={href} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:border-blue-200 transition">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className={`text-xl font-bold ${colorMap[color ?? ''] ?? 'text-gray-900'}`}>{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </Link>
  )
}

function QuickAction({ href, icon, label, badge, badgeColor }: {
  href: string; icon: string; label: string; badge?: string; badgeColor?: string
}) {
  const badgeColors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    yellow: 'bg-yellow-100 text-yellow-700',
  }
  return (
    <Link href={href}
      className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-blue-300 hover:bg-blue-50 transition text-center">
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      {badge && (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColors[badgeColor ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
          {badge}
        </span>
      )}
    </Link>
  )
}

function AnnouncementList({ announcements }: { announcements: any[] }) {
  if (announcements.length === 0) return <p className="text-sm text-gray-400">Brak ogłoszeń.</p>
  return (
    <div className="space-y-2">
      {announcements.map((a: any) => (
        <Link key={a.id} href={`/admin/announcements/${a.id}`}
          className="block bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-200 transition">
          <p className="text-sm font-medium text-gray-800 truncate">{a.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{new Date(a.created_at).toLocaleDateString('pl-PL')}</p>
        </Link>
      ))}
    </div>
  )
}

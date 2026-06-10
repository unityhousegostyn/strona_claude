import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StatsChart from './StatsChart'
import {
  buildYearlyTable, pln,
  type SettlementApartment, type SettlementRate, type SettlementEntry,
} from '@/lib/settlementCalc'

export default async function DashboardPage() {
  const { user, profile } = await getAuthProfile()

  const admin = getSupabaseAdminClient()
  const role = profile.role
  const communityId = profile.community_id

  // Wspólnota osobno
  const { data: community } = profile.community_id
    ? await admin.from('communities').select('*').eq('id', profile.community_id).single()
    : { data: null }

  // ─── SUPER ADMIN ───────────────────────────────────────────────
  if (role === 'super_admin') {
    const currentYear = new Date().getFullYear()
    const [
      commCount, userCount, ticketCount, pendingCount, boardCount,
      allTickets, communities, recentTickets, recentPosts, postAuthors,
      allApartments, allVotes, yearEntries, activeUsers, yearExpenses,
    ] = await Promise.all([
      admin.from('communities').select('id', { count: 'exact', head: true }),
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      admin.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      admin.from('board_posts').select('id', { count: 'exact', head: true }),
      admin.from('tickets').select('status, community_id'),
      admin.from('communities').select('id, name').order('name'),
      admin.from('tickets').select('id, title, status, created_at, community_id')
        .order('created_at', { ascending: false }).limit(5),
      admin.from('board_posts').select('id, content, created_at, author_id, community_id')
        .order('created_at', { ascending: false }).limit(5),
      admin.from('profiles').select('id, full_name, email'),
      admin.from('settlement_apartments').select('id, community_id').eq('active', true),
      admin.from('votes').select('id, community_id, status, title, deadline, created_at').order('created_at', { ascending: false }),
      admin.from('settlement_entries').select('paid, apartment:settlement_apartments!inner(community_id)').eq('year', currentYear),
      admin.from('profiles').select('id, community_id').eq('role', 'user').eq('status', 'active'),
      admin.from('community_expenses').select('community_id, amount').eq('year', currentYear),
    ])

    const commMap: Record<string, string> = {}
    for (const c of communities.data ?? []) commMap[c.id] = c.name

    const authorMap: Record<string, string> = {}
    for (const a of postAuthors.data ?? []) {
      authorMap[a.id] = a.full_name ?? a.email ?? '—'
    }

    // Per-community stats
    interface CommStats { apartments: number; users: number; openTickets: number; openVotes: number; totalPaid: number; totalExpenses: number }
    const commStats: Record<string, CommStats> = {}
    for (const c of communities.data ?? []) {
      commStats[c.id] = { apartments: 0, users: 0, openTickets: 0, openVotes: 0, totalPaid: 0, totalExpenses: 0 }
    }
    for (const a of allApartments.data ?? []) {
      if (commStats[a.community_id]) commStats[a.community_id].apartments++
    }
    for (const u of activeUsers.data ?? []) {
      if (u.community_id && commStats[u.community_id]) commStats[u.community_id].users++
    }
    for (const t of allTickets.data ?? []) {
      if (t.community_id && commStats[t.community_id] && t.status === 'open') commStats[t.community_id].openTickets++
    }
    for (const v of allVotes.data ?? []) {
      const isActive = v.status === 'open' && (!v.deadline || new Date(v.deadline) > new Date())
      if (isActive && commStats[v.community_id]) commStats[v.community_id].openVotes++
    }
    for (const e of yearEntries.data ?? []) {
      const commId = (e.apartment as any)?.community_id
      if (commId && commStats[commId]) commStats[commId].totalPaid += e.paid ?? 0
    }
    for (const e of yearExpenses.data ?? []) {
      if (commStats[e.community_id]) commStats[e.community_id].totalExpenses += e.amount ?? 0
    }

    const totalApartments = (allApartments.data ?? []).length
    const openVotesCount = (allVotes.data ?? []).filter(v => v.status === 'open' && (!v.deadline || new Date(v.deadline) > new Date())).length
    const activeVotesList = (allVotes.data ?? []).filter(v => v.status === 'open' && (!v.deadline || new Date(v.deadline) > new Date())).slice(0, 3)

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-[#f0ebe0]">
            Witaj, {profile.full_name?.split(' ')[0] ?? 'Super Admin'} 👋
          </h2>
          <p className="text-sm text-[#6a5a48] mt-1">Widok globalny — wszystkie wspólnoty</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Wspólnoty" value={commCount.count ?? 0} icon="🏢" href="/admin/communities" />
          <StatCard label="Mieszkań łącznie" value={totalApartments} icon="🏠" href="/admin/communities" />
          <StatCard label="Aktywni użytkownicy" value={userCount.count ?? 0} icon="👥" href="/admin/users" />
          <StatCard label="Oczekujących" value={pendingCount.count ?? 0} icon="⏳" href="/admin/users" color={pendingCount.count ? 'red' : undefined} />
          <StatCard label="Otwarte zgłoszenia" value={ticketCount.count ?? 0} icon="🎫" href="/admin/tickets" color={ticketCount.count ? 'yellow' : undefined} />
          <StatCard label="Aktywne głosowania" value={openVotesCount} icon="🗳️" href="/admin/votes" color={openVotesCount ? 'blue' : undefined} />
        </div>

        {/* Per-community overview */}
        <div>
          <h3 className="text-sm font-semibold text-[#6a5a48] uppercase tracking-wide mb-3">Przegląd wspólnot</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(communities.data ?? []).map((c) => {
              const s = commStats[c.id] ?? { apartments: 0, users: 0, openTickets: 0, openVotes: 0, totalPaid: 0 }
              return (
                <div key={c.id} className="bg-[#241e14] border border-[#3a2e1e] rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-[#f0ebe0]">{c.name}</h4>
                    <Link href="/admin/communities" className="text-xs text-[#6a5a48] hover:text-amber-400 transition">Edytuj →</Link>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#18140e] rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-[#f0ebe0]">{s.apartments}</p>
                      <p className="text-xs text-[#6a5a48] mt-0.5">Mieszkań</p>
                    </div>
                    <div className="bg-[#18140e] rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-[#f0ebe0]">{s.users}</p>
                      <p className="text-xs text-[#6a5a48] mt-0.5">Mieszkańców</p>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${s.openTickets > 0 ? 'bg-yellow-950/30' : 'bg-[#18140e]'}`}>
                      <p className={`text-lg font-bold ${s.openTickets > 0 ? 'text-yellow-400' : 'text-[#f0ebe0]'}`}>{s.openTickets}</p>
                      <p className="text-xs text-[#6a5a48] mt-0.5">Zgłoszenia</p>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${s.totalPaid - s.totalExpenses >= 0 ? 'bg-amber-950/20' : 'bg-red-950/20'}`}>
                      <p className={`text-lg font-bold ${s.totalPaid - s.totalExpenses >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                        {pln(s.totalPaid - s.totalExpenses)}
                      </p>
                      <p className="text-xs text-[#6a5a48] mt-0.5">Saldo {currentYear}</p>
                    </div>
                  </div>
                  {s.openVotes > 0 && (
                    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/20 border border-amber-800/40 rounded-lg px-3 py-2">
                      <span>🗳️</span>
                      <span>{s.openVotes} aktywne głosowanie{s.openVotes > 1 ? 'a' : ''}</span>
                      <Link href="/admin/votes" className="ml-auto underline hover:no-underline">Zobacz</Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Aktywne głosowania */}
        {activeVotesList.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-[#ddd5c5]">Aktywne głosowania</h3>
              <Link href="/admin/votes" className="text-sm text-amber-500 hover:underline">Wszystkie</Link>
            </div>
            <div className="space-y-2">
              {activeVotesList.map((v: any) => (
                <Link key={v.id} href="/admin/votes"
                  className="flex items-center justify-between bg-[#241e14] border border-amber-800/40 rounded-xl px-4 py-3 hover:border-green-700 transition">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#ddd5c5] truncate">{v.title}</p>
                    <p className="text-xs text-[#7a6a58] mt-0.5">{commMap[v.community_id] ?? '—'}{v.deadline ? ` · do ${new Date(v.deadline).toLocaleDateString('pl-PL')}` : ''}</p>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full ml-2 flex-shrink-0 bg-amber-900/30 text-amber-400">● Otwarte</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Ostatnie zgłoszenia + posty */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-[#ddd5c5]">Ostatnie zgłoszenia</h3>
              <Link href="/admin/tickets" className="text-sm text-amber-500 hover:underline">Zobacz wszystkie</Link>
            </div>
            <div className="space-y-2">
              {(recentTickets.data ?? []).length === 0
                ? <p className="text-sm text-[#7a6a58]">Brak zgłoszeń.</p>
                : (recentTickets.data ?? []).map((t: any) => (
                  <Link key={t.id} href={`/admin/tickets/${t.id}`}
                    className="flex items-center justify-between bg-[#241e14] border border-[#3a2e1e] rounded-xl px-4 py-3 hover:border-green-700 transition">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#ddd5c5] truncate">{t.title}</p>
                      <p className="text-xs text-[#7a6a58] mt-0.5">{commMap[t.community_id] ?? '—'}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${
                      t.status === 'open' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-green-100 text-amber-400'
                    }`}>{t.status === 'open' ? 'Otwarte' : 'Zamknięte'}</span>
                  </Link>
                ))
              }
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-[#ddd5c5]">Ostatnie posty na tablicy</h3>
              <Link href="/admin/board" className="text-sm text-amber-500 hover:underline">Tablica</Link>
            </div>
            <div className="space-y-2">
              {(recentPosts.data ?? []).length === 0
                ? <p className="text-sm text-[#7a6a58]">Brak postów.</p>
                : (recentPosts.data ?? []).map((p: any) => (
                  <Link key={p.id} href="/admin/board"
                    className="block bg-[#241e14] border border-[#3a2e1e] rounded-xl px-4 py-3 hover:border-green-700 transition">
                    <p className="text-sm text-[#ddd5c5] line-clamp-1">{p.content}</p>
                    <p className="text-xs text-[#7a6a58] mt-1">
                      {authorMap[p.author_id] ?? '—'} · {commMap[p.community_id] ?? '—'} · {new Date(p.created_at).toLocaleDateString('pl-PL')}
                    </p>
                  </Link>
                ))
              }
            </div>
          </div>
        </div>

        {/* Szybkie akcje */}
        <div>
          <h3 className="text-sm font-semibold text-[#6a5a48] uppercase tracking-wide mb-3">Szybkie akcje</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickAction href="/admin/users" icon="👥" label="Użytkownicy" badge={pendingCount.count ? `${pendingCount.count} czeka` : undefined} badgeColor="red" />
            <QuickAction href="/admin/communities" icon="🏢" label="Wspólnoty" />
            <QuickAction href="/admin/votes" icon="🗳️" label="Głosowania" badge={openVotesCount ? `${openVotesCount} aktywnych` : undefined} badgeColor="blue" />
            <QuickAction href="/admin/audit" icon="🔍" label="Audit Log" />
          </div>
        </div>
      </div>
    )
  }

  // ─── ADMIN ─────────────────────────────────────────────────────
  if (role === 'admin') {
    const now = new Date()
    const [
      openTicketCount, openTickets, docCount, pendingCount, boardCount,
      tickets, recentAnnouncements, recentBoardPosts, boardAuthors,
    ] = await Promise.all([
      admin.from('tickets').select('id', { count: 'exact', head: true }).eq('community_id', communityId).eq('status', 'open'),
      admin.from('tickets').select('id, title, status, created_at').eq('community_id', communityId).eq('status', 'open').order('created_at', { ascending: false }).limit(5),
      admin.from('documents').select('id', { count: 'exact', head: true }).or(`community_id.eq.${communityId},target.eq.all`),
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      admin.from('board_posts').select('id', { count: 'exact', head: true }).eq('community_id', communityId),
      admin.from('tickets').select('status, created_at').eq('community_id', communityId),
      admin.from('announcements').select('*').order('created_at', { ascending: false }).limit(4),
      admin.from('board_posts').select('id, content, created_at, author_id').eq('community_id', communityId).order('created_at', { ascending: false }).limit(4),
      admin.from('profiles').select('id, full_name, email'),
    ])

    const authorMap: Record<string, string> = {}
    for (const a of boardAuthors.data ?? []) {
      authorMap[a.id] = a.full_name ?? a.email ?? '—'
    }

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
          <h2 className="text-2xl font-bold text-[#f0ebe0]">
            Witaj, {profile.full_name?.split(' ')[0] ?? 'Administratorze'} 👋
          </h2>
          <p className="text-sm text-[#6a5a48] mt-1">{community?.name ?? '—'}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Otwarte zgłoszenia" value={openTicketCount.count ?? 0} icon="🎫" href="/admin/tickets" color="yellow" />
          <StatCard label="Dokumenty" value={docCount.count ?? 0} icon="📁" href="/admin/documents" />
          <StatCard label="Oczekujących" value={pendingCount.count ?? 0} icon="⏳" href="/admin/users" color={pendingCount.count ? 'red' : undefined} />
          <StatCard label="Posty na tablicy" value={boardCount.count ?? 0} icon="💬" href="/admin/board" />
        </div>

        <StatsChart data={chartData} title="Zgłoszenia — ostatnie 6 miesięcy" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-[#ddd5c5]">Otwarte zgłoszenia</h3>
              <Link href="/admin/tickets" className="text-sm text-amber-500 hover:underline">Zobacz wszystkie</Link>
            </div>
            {(openTickets.data ?? []).length === 0
              ? <p className="text-sm text-[#7a6a58]">Brak otwartych zgłoszeń.</p>
              : <div className="space-y-2">
                  {(openTickets.data ?? []).map((t: any) => (
                    <Link key={t.id} href={`/admin/tickets/${t.id}`}
                      className="flex items-center justify-between bg-[#241e14] border border-[#3a2e1e] rounded-xl px-4 py-3 hover:border-green-700 transition">
                      <p className="text-sm font-medium text-[#ddd5c5] truncate">{t.title}</p>
                      <span className="text-xs text-yellow-400 bg-yellow-950/30 px-2 py-0.5 rounded-full ml-2 flex-shrink-0">Otwarte</span>
                    </Link>
                  ))}
                </div>
            }
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-[#ddd5c5]">Ostatnie posty na tablicy</h3>
              <Link href="/admin/board" className="text-sm text-amber-500 hover:underline">Tablica</Link>
            </div>
            {(recentBoardPosts.data ?? []).length === 0
              ? <p className="text-sm text-[#7a6a58]">Brak postów na tablicy.</p>
              : <div className="space-y-2">
                  {(recentBoardPosts.data ?? []).map((p: any) => (
                    <Link key={p.id} href="/admin/board"
                      className="block bg-[#241e14] border border-[#3a2e1e] rounded-xl px-4 py-3 hover:border-green-700 transition">
                      <p className="text-sm text-[#ddd5c5] line-clamp-1">{p.content}</p>
                      <p className="text-xs text-[#7a6a58] mt-1">
                        {authorMap[p.author_id] ?? '—'} · {new Date(p.created_at).toLocaleDateString('pl-PL')}
                      </p>
                    </Link>
                  ))}
                </div>
            }
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-[#ddd5c5]">Ostatnie ogłoszenia</h3>
            <Link href="/admin/announcements/add" className="text-sm text-amber-500 hover:underline">+ Dodaj</Link>
          </div>
          <AnnouncementList announcements={recentAnnouncements.data ?? []} />
        </div>
      </div>
    )
  }

  // ─── USER (MIESZKANIEC) ─────────────────────────────────────────
  const currentYear = new Date().getFullYear()

  // Rozliczenia — znajdź lokal użytkownika
  const { data: myApartment } = await admin
    .from('settlement_apartments')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()

  let settlementRows: ReturnType<typeof buildYearlyTable> = []
  let settlementApartmentId: string | null = null

  if (myApartment) {
    settlementApartmentId = myApartment.id
    const [ratesRes, entriesRes] = await Promise.all([
      admin.from('settlement_rates').select('*')
        .eq('community_id', myApartment.community_id)
        .order('effective_from', { ascending: false }),
      admin.from('settlement_entries').select('*')
        .eq('apartment_id', myApartment.id).eq('year', currentYear),
    ])
    settlementRows = buildYearlyTable(
      myApartment as SettlementApartment,
      (ratesRes.data ?? []) as SettlementRate[],
      (entriesRes.data ?? []) as SettlementEntry[],
      currentYear,
    )
  }

  const [myTickets, announcements, docs, unreadRes, boardPosts, boardAuthorsRes] = await Promise.all([
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
    admin.from('board_posts').select('id, content, created_at, author_id')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false }).limit(4),
    admin.from('profiles').select('id, full_name, email'),
  ])

  const authorMap: Record<string, string> = {}
  for (const a of boardAuthorsRes.data ?? []) {
    authorMap[a.id] = a.full_name ?? a.email ?? '—'
  }

  const openCount = (myTickets.data ?? []).filter((t: any) => t.status === 'open').length
  const unreadCount = unreadRes.count ?? 0

  return (
    <div className="space-y-6">
      {/* Powitanie */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl p-6 text-white">
        <h2 className="text-2xl font-bold">
          Witaj, {profile.full_name?.split(' ')[0] ?? 'mieszkańcu'} 👋
        </h2>
        <p className="text-green-100 mt-1 text-sm">{community?.name ?? '—'} · {community?.address ?? ''}</p>
        <div className="flex gap-3 mt-4 flex-wrap">
          <div className="bg-[#241e14]/20 rounded-xl px-4 py-2 text-center">
            <p className="text-xl font-bold">{unreadCount}</p>
            <p className="text-xs text-green-100">Nowe ogłoszenia</p>
          </div>
          <div className="bg-[#241e14]/20 rounded-xl px-4 py-2 text-center">
            <p className="text-xl font-bold">{openCount}</p>
            <p className="text-xs text-green-100">Otwarte zgłoszenia</p>
          </div>
          <div className="bg-[#241e14]/20 rounded-xl px-4 py-2 text-center">
            <p className="text-xl font-bold">{(boardPosts.data ?? []).length}</p>
            <p className="text-xs text-green-100">Nowe posty</p>
          </div>
        </div>
      </div>

      {/* Szybkie akcje */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickAction href="/admin/announcements" icon="📢" label="Ogłoszenia"
          badge={unreadCount ? `${unreadCount} nowych` : undefined} badgeColor="blue" />
        <QuickAction href="/admin/tickets" icon="🎫" label="Moje zgłoszenia"
          badge={openCount ? `${openCount} otwartych` : undefined} badgeColor="yellow" />
        <QuickAction href="/admin/board" icon="💬" label="Tablica" />
        <QuickAction href="/admin/documents" icon="📁" label="Dokumenty" />
      </div>

      {/* Karta rozliczeniowa */}
      {myApartment && (() => {
        const currentMonth = new Date().getMonth() + 1
        const currentRow = settlementRows.find(r => r.month === currentMonth)
        const finalBalance = settlementRows[11]?.balance_end ?? 0
        const totalPaid = settlementRows.reduce((s, r) => s + r.paid, 0)
        const totalDue = settlementRows.reduce((s, r) => s + r.total_due, 0)

        return (
          <div className="bg-[#241e14] border border-[#3a2e1e] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-[#f0ebe0]">Rozliczenie {currentYear}</h3>
                <p className="text-xs text-[#6a5a48] mt-0.5">Lokal {myApartment.number} · {myApartment.owner_name}</p>
              </div>
              <Link
                href={`/admin/settlements/${myApartment.id}`}
                className="text-sm text-amber-500 hover:underline"
              >
                Pełny widok →
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Saldo końcowe */}
              <div className={`rounded-xl p-3 ${finalBalance >= 0 ? 'bg-amber-950/30 border border-amber-800' : 'bg-red-950/30 border border-red-900'}`}>
                <p className="text-xs text-[#6a5a48] mb-1">Saldo {currentYear}</p>
                <p className={`text-lg font-bold ${finalBalance >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                  {pln(finalBalance)}
                </p>
                <p className={`text-xs mt-0.5 ${finalBalance >= 0 ? 'text-amber-500' : 'text-red-600'}`}>
                  {finalBalance >= 0 ? 'Nadpłata' : 'Niedopłata'}
                </p>
              </div>

              {/* Bieżący miesiąc */}
              <div className="bg-[#18140e] border border-[#3a2e1e] rounded-xl p-3">
                <p className="text-xs text-[#6a5a48] mb-1">Naliczono ten mies.</p>
                <p className="text-lg font-bold text-[#f0ebe0]">
                  {currentRow?.hasRates ? pln(currentRow.total_due) : '—'}
                </p>
                <p className="text-xs text-[#6a5a48] mt-0.5">
                  {currentRow?.hasRates ? 'do zapłaty' : 'brak stawek'}
                </p>
              </div>

              {/* Wpłacono w roku */}
              <div className="bg-[#18140e] border border-[#3a2e1e] rounded-xl p-3">
                <p className="text-xs text-[#6a5a48] mb-1">Wpłacono {currentYear}</p>
                <p className="text-lg font-bold text-amber-400">{pln(totalPaid)}</p>
                <p className="text-xs text-[#6a5a48] mt-0.5">łącznie</p>
              </div>

              {/* Naliczono w roku */}
              <div className="bg-[#18140e] border border-[#3a2e1e] rounded-xl p-3">
                <p className="text-xs text-[#6a5a48] mb-1">Naliczono {currentYear}</p>
                <p className="text-lg font-bold text-[#b8a898]">{pln(totalDue)}</p>
                <p className="text-xs text-[#6a5a48] mt-0.5">łącznie</p>
              </div>
            </div>

            {/* Pasek miesięczny — miniaturowa wizualizacja */}
            <div className="mt-4">
              <div className="flex gap-1 items-end h-8">
                {settlementRows.map((row) => {
                  const max = Math.max(...settlementRows.map(r => r.total_due), 1)
                  const height = row.hasRates ? Math.max(4, Math.round((row.total_due / max) * 32)) : 4
                  const isCurrentMonth = row.month === currentMonth
                  const isPast = row.month < currentMonth
                  return (
                    <div
                      key={row.month}
                      title={`${row.monthName}: ${pln(row.total_due)}`}
                      style={{ height: `${height}px` }}
                      className={`flex-1 rounded-sm transition ${
                        isCurrentMonth
                          ? 'bg-green-500'
                          : isPast && row.paid > 0
                          ? 'bg-amber-700/60'
                          : isPast
                          ? 'bg-red-800/60'
                          : 'bg-[#2a2218]'
                      }`}
                    />
                  )
                })}
              </div>
              <div className="flex justify-between text-xs text-stone-300 mt-1">
                <span>Sty</span><span>Cze</span><span>Gru</span>
              </div>
            </div>
          </div>
        )
      })()}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Ostatnie ogłoszenia */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-[#ddd5c5]">Ostatnie ogłoszenia</h3>
            <Link href="/admin/announcements" className="text-sm text-amber-500 hover:underline">Zobacz wszystkie</Link>
          </div>
          {(announcements.data ?? []).length === 0
            ? <p className="text-sm text-[#7a6a58]">Brak ogłoszeń.</p>
            : <div className="space-y-2">
                {(announcements.data ?? []).map((a: any) => (
                  <Link key={a.id} href={`/admin/announcements/${a.id}`}
                    className="block bg-[#241e14] border border-[#3a2e1e] rounded-xl px-4 py-3 hover:border-green-700 transition">
                    <p className="text-sm font-medium text-[#ddd5c5] truncate">{a.title}</p>
                    <p className="text-xs text-[#7a6a58] mt-0.5">{new Date(a.created_at).toLocaleDateString('pl-PL')}</p>
                  </Link>
                ))}
              </div>
          }
        </div>

        {/* Tablica — ostatnie posty */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-[#ddd5c5]">Tablica sąsiedzka</h3>
            <Link href="/admin/board" className="text-sm text-amber-500 hover:underline">Przejdź</Link>
          </div>
          {(boardPosts.data ?? []).length === 0
            ? <div className="bg-[#241e14] border border-dashed border-[#3a2e1e] rounded-xl p-5 text-center">
                <p className="text-sm text-[#7a6a58] mb-2">Tablica jest pusta.</p>
                <Link href="/admin/board" className="text-sm text-amber-500 hover:underline">Napisz pierwszą wiadomość →</Link>
              </div>
            : <div className="space-y-2">
                {(boardPosts.data ?? []).map((p: any) => (
                  <Link key={p.id} href="/admin/board"
                    className="block bg-[#241e14] border border-[#3a2e1e] rounded-xl px-4 py-3 hover:border-green-700 transition">
                    <p className="text-sm text-[#ddd5c5] line-clamp-1">{p.content}</p>
                    <p className="text-xs text-[#7a6a58] mt-1">
                      {authorMap[p.author_id] ?? '—'} · {new Date(p.created_at).toLocaleDateString('pl-PL')}
                    </p>
                  </Link>
                ))}
              </div>
          }
        </div>
      </div>

      {/* Moje zgłoszenia */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-[#ddd5c5]">Moje zgłoszenia</h3>
          <Link href="/admin/tickets" className="text-sm text-amber-500 hover:underline">Nowe zgłoszenie</Link>
        </div>
        {(myTickets.data ?? []).length === 0
          ? <div className="bg-[#241e14] border border-dashed border-[#3a2e1e] rounded-xl p-6 text-center">
              <p className="text-sm text-[#7a6a58] mb-3">Nie masz jeszcze żadnych zgłoszeń.</p>
              <Link href="/admin/tickets" className="text-sm text-amber-500 font-medium hover:underline">Zgłoś problem →</Link>
            </div>
          : <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(myTickets.data ?? []).map((t: any) => (
                <Link key={t.id} href={`/admin/tickets/${t.id}`}
                  className="flex items-center justify-between bg-[#241e14] border border-[#3a2e1e] rounded-xl px-4 py-3 hover:border-green-700 transition">
                  <p className="text-sm font-medium text-[#ddd5c5] truncate">{t.title}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${
                    t.status === 'open' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-green-100 text-amber-400'
                  }`}>{t.status === 'open' ? 'Otwarte' : 'Zamknięte'}</span>
                </Link>
              ))}
            </div>
        }
      </div>

      {/* Ostatnie dokumenty */}
      {(docs.data ?? []).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-[#ddd5c5]">Ostatnie dokumenty</h3>
            <Link href="/admin/documents" className="text-sm text-amber-500 hover:underline">Zobacz wszystkie</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(docs.data ?? []).map((d: any) => {
              const ext = d.name.split('.').pop()?.toLowerCase()
              const icon = ext === 'pdf' ? '📄' : ['doc','docx'].includes(ext) ? '📝' : ['xls','xlsx'].includes(ext) ? '📊' : '📁'
              return (
                <div key={d.id} className="bg-[#241e14] border border-[#3a2e1e] rounded-xl p-4 text-center hover:border-green-700 transition">
                  <p className="text-3xl mb-2">{icon}</p>
                  <p className="text-xs font-medium text-[#b8a898] truncate">{d.name}</p>
                  <p className="text-xs text-[#7a6a58] mt-1">{new Date(d.created_at).toLocaleDateString('pl-PL')}</p>
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
  const colorMap: Record<string, string> = { yellow: 'text-yellow-400', red: 'text-red-400', blue: 'text-amber-400' }
  return (
    <Link href={href} className="bg-[#241e14] border border-[#3a2e1e] rounded-xl p-4 flex items-center gap-3 hover:border-green-700 transition">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className={`text-xl font-bold ${colorMap[color ?? ''] ?? 'text-[#f0ebe0]'}`}>{value}</p>
        <p className="text-xs text-[#6a5a48]">{label}</p>
      </div>
    </Link>
  )
}

function QuickAction({ href, icon, label, badge, badgeColor }: {
  href: string; icon: string; label: string; badge?: string; badgeColor?: string
}) {
  const badgeColors: Record<string, string> = {
    blue: 'bg-amber-900/40 text-amber-400',
    yellow: 'bg-yellow-900/40 text-yellow-400',
  }
  return (
    <Link href={href}
      className="bg-[#241e14] border border-[#3a2e1e] rounded-xl p-4 flex flex-col items-center gap-2 hover:border-green-600 hover:bg-amber-950/40 transition text-center">
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-semibold text-[#b8a898]">{label}</span>
      {badge && (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColors[badgeColor ?? ''] ?? 'bg-[#241e14] text-[#7a6a58]'}`}>
          {badge}
        </span>
      )}
    </Link>
  )
}

function AnnouncementList({ announcements }: { announcements: any[] }) {
  if (announcements.length === 0) return <p className="text-sm text-[#7a6a58]">Brak ogłoszeń.</p>
  return (
    <div className="space-y-2">
      {announcements.map((a: any) => (
        <Link key={a.id} href={`/admin/announcements/${a.id}`}
          className="block bg-[#241e14] border border-[#3a2e1e] rounded-xl px-4 py-3 hover:border-green-700 transition">
          <p className="text-sm font-medium text-[#ddd5c5] truncate">{a.title}</p>
          <p className="text-xs text-[#7a6a58] mt-0.5">{new Date(a.created_at).toLocaleDateString('pl-PL')}</p>
        </Link>
      ))}
    </div>
  )
}

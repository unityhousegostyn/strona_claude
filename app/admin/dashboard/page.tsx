import React from 'react'
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
    const now = new Date()

    const [
      commCount, userCount, ticketCount, pendingCount,
      allTickets, communities, recentTickets, recentPosts, postAuthors,
      allApartments, allVotes, allEntries, activeUsers, allExpenses,
      allIncome, recentAudit,
    ] = await Promise.all([
      admin.from('communities').select('id', { count: 'exact', head: true }),
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      admin.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      admin.from('tickets').select('status, community_id, created_at'),
      admin.from('communities').select('id, name').order('name'),
      admin.from('tickets').select('id, title, status, created_at, community_id')
        .order('created_at', { ascending: false }).limit(4),
      admin.from('board_posts').select('id, content, created_at, author_id, community_id')
        .order('created_at', { ascending: false }).limit(4),
      admin.from('profiles').select('id, full_name, email'),
      admin.from('settlement_apartments').select('id, community_id').eq('active', true),
      admin.from('votes').select('id, community_id, status, title, deadline, created_at').order('created_at', { ascending: false }),
      admin.from('settlement_entries').select('paid, apartment:settlement_apartments!inner(community_id)'),
      admin.from('profiles').select('id, community_id').eq('role', 'user').eq('status', 'active'),
      admin.from('community_expenses').select('community_id, amount'),
      admin.from('community_income').select('community_id, amount'),
      admin.from('audit_logs').select('id, action, target_type, created_at, user_id').order('created_at', { ascending: false }).limit(8),
    ])

    const commMap: Record<string, string> = {}
    for (const c of communities.data ?? []) commMap[c.id] = c.name

    const authorMap: Record<string, string> = {}
    for (const a of postAuthors.data ?? []) {
      authorMap[a.id] = a.full_name ?? a.email ?? '—'
    }

    // Per-community stats
    interface CommStats { apartments: number; users: number; openTickets: number; openVotes: number; totalPaid: number; totalExpenses: number; totalIncome: number }
    const commStats: Record<string, CommStats> = {}
    for (const c of communities.data ?? []) {
      commStats[c.id] = { apartments: 0, users: 0, openTickets: 0, openVotes: 0, totalPaid: 0, totalExpenses: 0, totalIncome: 0 }
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
      const isActive = v.status === 'open' && (!v.deadline || new Date(v.deadline) > now)
      if (isActive && commStats[v.community_id]) commStats[v.community_id].openVotes++
    }
    for (const e of allEntries.data ?? []) {
      const commId = (e.apartment as any)?.community_id
      if (commId && commStats[commId]) commStats[commId].totalPaid += e.paid ?? 0
    }
    for (const e of allExpenses.data ?? []) {
      if (commStats[e.community_id]) commStats[e.community_id].totalExpenses += e.amount ?? 0
    }
    for (const e of allIncome.data ?? []) {
      if (commStats[e.community_id]) commStats[e.community_id].totalIncome += e.amount ?? 0
    }

    const totalApartments = (allApartments.data ?? []).length
    const openVotesCount = (allVotes.data ?? []).filter(v => v.status === 'open' && (!v.deadline || new Date(v.deadline) > now)).length
    const activeVotesList = (allVotes.data ?? []).filter(v => v.status === 'open' && (!v.deadline || new Date(v.deadline) > now)).slice(0, 3)

    // Wykres zgłoszeń — ostatnie 6 miesięcy (wszystkie wspólnoty)
    const months6: Record<string, { otwarte: number; zamknięte: number }> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = d.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' })
      months6[key] = { otwarte: 0, zamknięte: 0 }
    }
    for (const tick of allTickets.data ?? []) {
      const key = new Date(tick.created_at).toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' })
      if (months6[key]) tick.status === 'open' ? months6[key].otwarte++ : months6[key].zamknięte++
    }
    const chartData = Object.entries(months6).map(([name, v]) => ({ name, ...v }))

    // Łączne sumy finansowe (wszystkie lata — saldo bieżące konta)
    const totalPaidAll = Object.values(commStats).reduce((s, c) => s + c.totalPaid, 0)
    const totalExpAll = Object.values(commStats).reduce((s, c) => s + c.totalExpenses, 0)
    const totalIncomeAll = Object.values(commStats).reduce((s, c) => s + c.totalIncome, 0)
    const totalBalance = totalPaidAll + totalIncomeAll - totalExpAll

    return (
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#f0ebe0]">
              Witaj, {profile.full_name?.split(' ')[0] ?? 'Super Admin'} 👋
            </h2>
            <p className="text-sm text-[#6a5a48] mt-1">
              {now.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          {pendingCount.count! > 0 && (
            <Link href="/admin/users" className="flex items-center gap-2 bg-red-950/40 border border-red-800/60 text-red-400 text-xs font-medium px-3 py-2 rounded-lg hover:bg-red-950/60 transition">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/></svg>
              {pendingCount.count} oczekujących na akceptację
            </Link>
          )}
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCardSvg label="Wspólnoty" value={commCount.count ?? 0} href="/admin/communities"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h2v11H4zm6 0h2v11h-2zm6 0h2v11h-2z"/>} />
          <StatCardSvg label="Mieszkań" value={totalApartments} href="/admin/communities"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>} />
          <StatCardSvg label="Aktywnych" value={userCount.count ?? 0} href="/admin/users"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>} />
          <StatCardSvg label="Oczekujących" value={pendingCount.count ?? 0} href="/admin/users" accent={pendingCount.count ? 'red' : undefined}
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>} />
          <StatCardSvg label="Zgłoszenia" value={ticketCount.count ?? 0} href="/admin/tickets" accent={ticketCount.count ? 'yellow' : undefined}
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>} />
          <StatCardSvg label="Głosowania" value={openVotesCount} href="/admin/votes" accent={openVotesCount ? 'amber' : undefined}
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>} />
        </div>

        {/* ── Finanse + Wykres ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Podsumowanie finansowe */}
          <div className="bg-[#241e14] border border-[#3a2e1e] rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#b8a898] uppercase tracking-wide">Stan konta</h3>
              <Link href="/admin/finanse/raporty" className="text-xs text-amber-500 hover:underline">Raporty →</Link>
            </div>
            <div className={`rounded-xl p-4 ${totalBalance >= 0 ? 'bg-amber-950/30 border border-amber-800/40' : 'bg-red-950/30 border border-red-900/40'}`}>
              <p className="text-xs text-[#6a5a48] mb-1">Łączne saldo</p>
              <p className={`text-3xl font-bold tabular-nums ${totalBalance >= 0 ? 'text-amber-400' : 'text-red-400'}`}>{pln(totalBalance)}</p>
              <p className="text-xs text-[#6a5a48] mt-1">wpłaty + przychody − koszty, wszystkie wspólnoty</p>
            </div>
            <div className="space-y-3">
              {(communities.data ?? []).map(c => {
                const s = commStats[c.id] ?? { totalPaid: 0, totalExpenses: 0, totalIncome: 0 }
                const bal = s.totalPaid + s.totalIncome - s.totalExpenses
                const pct = s.totalExpenses > 0 ? Math.min(100, Math.round(((s.totalPaid + s.totalIncome) / s.totalExpenses) * 100)) : (s.totalPaid + s.totalIncome > 0 ? 100 : 0)
                return (
                  <div key={c.id}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-[#b8a898] truncate max-w-[140px]">{c.name}</p>
                      <p className={`text-xs font-semibold tabular-nums ${bal >= 0 ? 'text-amber-400' : 'text-red-400'}`}>{pln(bal)}</p>
                    </div>
                    <div className="h-1.5 bg-[#18140e] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${bal >= 0 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[10px] text-[#4a3c28]">wpłacono {pln(s.totalPaid)}</span>
                      <span className="text-[10px] text-[#4a3c28]">koszty {pln(s.totalExpenses)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Wykres zgłoszeń */}
          <div className="lg:col-span-2">
            <StatsChart data={chartData} title="Zgłoszenia — ostatnie 6 miesięcy (wszystkie wspólnoty)" />
          </div>
        </div>

        {/* ── Przegląd wspólnot ── */}
        <div>
          <h3 className="text-xs font-semibold text-[#6a5a48] uppercase tracking-widest mb-3">Przegląd wspólnot</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(communities.data ?? []).map((c) => {
              const s = commStats[c.id] ?? { apartments: 0, users: 0, openTickets: 0, openVotes: 0, totalPaid: 0, totalExpenses: 0, totalIncome: 0 }
              const bal = s.totalPaid + s.totalIncome - s.totalExpenses
              return (
                <div key={c.id} className="bg-[#241e14] border border-[#3a2e1e] rounded-xl p-5 hover:border-[#4a3c28] transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-[#f0ebe0]">{c.name}</h4>
                      <p className="text-xs text-[#6a5a48] mt-0.5">{s.apartments} mieszkań · {s.users} mieszkańców</p>
                    </div>
                    <Link href="/admin/communities" className="text-xs text-[#6a5a48] hover:text-amber-400 transition ml-2 flex-shrink-0">Edytuj →</Link>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className={`rounded-lg p-3 text-center ${s.openTickets > 0 ? 'bg-yellow-950/30 border border-yellow-900/40' : 'bg-[#18140e]'}`}>
                      <p className={`text-xl font-bold tabular-nums ${s.openTickets > 0 ? 'text-yellow-400' : 'text-[#f0ebe0]'}`}>{s.openTickets}</p>
                      <p className="text-[10px] text-[#6a5a48] mt-0.5">Zgłoszenia</p>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${s.openVotes > 0 ? 'bg-amber-950/30 border border-amber-900/40' : 'bg-[#18140e]'}`}>
                      <p className={`text-xl font-bold tabular-nums ${s.openVotes > 0 ? 'text-amber-400' : 'text-[#f0ebe0]'}`}>{s.openVotes}</p>
                      <p className="text-[10px] text-[#6a5a48] mt-0.5">Głosowania</p>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${bal >= 0 ? 'bg-amber-950/20 border border-amber-900/30' : 'bg-red-950/20 border border-red-900/30'}`}>
                      <p className={`text-sm font-bold tabular-nums leading-tight ${bal >= 0 ? 'text-amber-400' : 'text-red-400'}`}>{pln(bal)}</p>
                      <p className="text-[10px] text-[#6a5a48] mt-0.5">Stan konta</p>
                    </div>
                  </div>
                  {/* mini pasek płatności */}
                  {s.totalExpenses > 0 && (
                    <div>
                      <div className="h-1 bg-[#18140e] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${bal >= 0 ? 'bg-amber-600' : 'bg-red-600'}`}
                          style={{ width: `${Math.min(100, Math.round(((s.totalPaid + s.totalIncome) / s.totalExpenses) * 100))}%` }} />
                      </div>
                      <p className="text-[10px] text-[#4a3c28] mt-0.5">
                        {Math.min(100, Math.round(((s.totalPaid + s.totalIncome) / s.totalExpenses) * 100))}% pokrycia kosztów
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Aktywne głosowania ── */}
        {activeVotesList.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[#6a5a48] uppercase tracking-widest">Aktywne głosowania</h3>
              <Link href="/admin/votes" className="text-xs text-amber-500 hover:underline">Wszystkie</Link>
            </div>
            <div className="space-y-2">
              {activeVotesList.map((v: any) => (
                <Link key={v.id} href="/admin/votes"
                  className="flex items-center justify-between bg-[#241e14] border border-amber-800/30 rounded-xl px-4 py-3 hover:border-amber-600/50 transition">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#ddd5c5] truncate">{v.title}</p>
                    <p className="text-xs text-[#7a6a58] mt-0.5">{commMap[v.community_id] ?? '—'}{v.deadline ? ` · do ${new Date(v.deadline).toLocaleDateString('pl-PL')}` : ''}</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full ml-3 flex-shrink-0 bg-amber-900/30 text-amber-400 border border-amber-800/40">
                    ● Otwarte
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Ostatnie zgłoszenia + Aktywność ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Ostatnie zgłoszenia */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[#6a5a48] uppercase tracking-widest">Ostatnie zgłoszenia</h3>
              <Link href="/admin/tickets" className="text-xs text-amber-500 hover:underline">Wszystkie →</Link>
            </div>
            <div className="space-y-2">
              {(recentTickets.data ?? []).length === 0
                ? <p className="text-sm text-[#7a6a58]">Brak zgłoszeń.</p>
                : (recentTickets.data ?? []).map((t: any) => (
                  <Link key={t.id} href={`/admin/tickets/${t.id}`}
                    className="flex items-center gap-3 bg-[#241e14] border border-[#3a2e1e] rounded-xl px-4 py-3 hover:border-[#4a3c28] transition group">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.status === 'open' ? 'bg-yellow-400' : 'bg-[#4a3c28]'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#ddd5c5] truncate group-hover:text-[#f0ebe0] transition">{t.title}</p>
                      <p className="text-xs text-[#6a5a48] mt-0.5">{commMap[t.community_id] ?? '—'} · {new Date(t.created_at).toLocaleDateString('pl-PL')}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                      t.status === 'open' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-[#2a2218] text-[#6a5a48]'
                    }`}>{t.status === 'open' ? 'Otwarte' : 'Zamknięte'}</span>
                  </Link>
                ))
              }
            </div>
          </div>

          {/* Ostatnia aktywność (audit log) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[#6a5a48] uppercase tracking-widest">Ostatnia aktywność</h3>
              <Link href="/admin/audit" className="text-xs text-amber-500 hover:underline">Audit log →</Link>
            </div>
            <div className="bg-[#241e14] border border-[#3a2e1e] rounded-xl divide-y divide-[#3a2e1e]/60">
              {(recentAudit.data ?? []).length === 0
                ? <p className="text-sm text-[#7a6a58] p-4">Brak aktywności.</p>
                : (recentAudit.data ?? []).map((log: any) => (
                  <div key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-base flex-shrink-0">{auditIcon(log.action)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#b8a898] truncate">{auditLabel(log.action, log.target_type)}</p>
                      <p className="text-[10px] text-[#4a3c28] mt-0.5">{timeAgo(log.created_at)}</p>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        {/* ── Szybkie akcje ── */}
        <div>
          <h3 className="text-xs font-semibold text-[#6a5a48] uppercase tracking-widest mb-3">Szybkie akcje</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickAction href="/admin/users" icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>}
              label="Użytkownicy" badge={pendingCount.count ? `${pendingCount.count} czeka` : undefined} badgeColor="red" />
            <QuickAction href="/admin/communities" icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h2v11H4zm6 0h2v11h-2zm6 0h2v11h-2z"/>}
              label="Wspólnoty" />
            <QuickAction href="/admin/votes" icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>}
              label="Głosowania" badge={openVotesCount ? `${openVotesCount} aktywnych` : undefined} badgeColor="blue" />
            <QuickAction href="/admin/audit" icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>}
              label="Audit Log" />
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
          <StatCardSvg label="Otwarte zgłoszenia" value={openTicketCount.count ?? 0} href="/admin/tickets" accent="yellow"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>} />
          <StatCardSvg label="Dokumenty" value={docCount.count ?? 0} href="/admin/documents"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>} />
          <StatCardSvg label="Oczekujących" value={pendingCount.count ?? 0} href="/admin/users" accent={pendingCount.count ? 'red' : undefined}
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>} />
          <StatCardSvg label="Posty na tablicy" value={boardCount.count ?? 0} href="/admin/board"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>} />
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

function StatCardSvg({ label, value, href, icon, accent }: {
  label: string; value: number; href: string; icon: React.ReactNode; accent?: 'red' | 'yellow' | 'amber'
}) {
  const accentMap = {
    red:    { text: 'text-red-400',    bg: 'bg-red-950/30',    border: 'border-red-900/40',    icon: 'text-red-500' },
    yellow: { text: 'text-yellow-400', bg: 'bg-yellow-950/30', border: 'border-yellow-900/40', icon: 'text-yellow-500' },
    amber:  { text: 'text-amber-400',  bg: 'bg-amber-950/30',  border: 'border-amber-900/40',  icon: 'text-amber-500' },
  }
  const ac = accent ? accentMap[accent] : null
  return (
    <Link href={href}
      className={`bg-[#241e14] border rounded-xl p-4 flex flex-col gap-2 hover:border-[#4a3c28] transition group ${ac ? ac.border : 'border-[#3a2e1e]'}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${ac ? ac.bg : 'bg-[#18140e]'}`}>
        <svg className={`w-4 h-4 ${ac ? ac.icon : 'text-[#6a5a48]'} group-hover:scale-110 transition-transform`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
      </div>
      <div>
        <p className={`text-2xl font-bold tabular-nums ${ac ? ac.text : 'text-[#f0ebe0]'}`}>{value}</p>
        <p className="text-xs text-[#6a5a48] mt-0.5">{label}</p>
      </div>
    </Link>
  )
}

function QuickAction({ href, icon, label, badge, badgeColor }: {
  href: string; icon: React.ReactNode; label: string; badge?: string; badgeColor?: string
}) {
  const badgeColors: Record<string, string> = {
    red:  'bg-red-900/40 text-red-400',
    blue: 'bg-amber-900/40 text-amber-400',
    yellow: 'bg-yellow-900/40 text-yellow-400',
  }
  return (
    <Link href={href}
      className="bg-[#241e14] border border-[#3a2e1e] rounded-xl p-4 flex flex-col items-center gap-3 hover:border-amber-800/60 hover:bg-amber-950/20 transition text-center group">
      <div className="w-10 h-10 rounded-xl bg-[#18140e] flex items-center justify-center group-hover:bg-amber-950/40 transition">
        <svg className="w-5 h-5 text-amber-600 group-hover:text-amber-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
      </div>
      <span className="text-xs font-semibold text-[#b8a898] group-hover:text-[#f0ebe0] transition">{label}</span>
      {badge && (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColors[badgeColor ?? ''] ?? 'bg-[#2a2218] text-[#7a6a58]'}`}>
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
          className="block bg-[#241e14] border border-[#3a2e1e] rounded-xl px-4 py-3 hover:border-[#4a3c28] transition">
          <p className="text-sm font-medium text-[#ddd5c5] truncate">{a.title}</p>
          <p className="text-xs text-[#7a6a58] mt-0.5">{new Date(a.created_at).toLocaleDateString('pl-PL')}</p>
        </Link>
      ))}
    </div>
  )
}

function auditIcon(action: string): string {
  if (action.includes('ticket')) return '🎫'
  if (action.includes('comment')) return '💬'
  if (action.includes('announcement')) return '📢'
  if (action.includes('settlement') || action.includes('opening_balance')) return '💰'
  if (action.includes('user') || action.includes('profile')) return '👤'
  if (action.includes('vote') || action.includes('resolution')) return '🗳️'
  if (action.includes('community')) return '🏢'
  if (action.includes('document')) return '📁'
  if (action.includes('expense')) return '📊'
  if (action.includes('contact')) return '📞'
  return '📝'
}

function auditLabel(action: string, targetType: string): string {
  const map: Record<string, string> = {
    create_ticket: 'Nowe zgłoszenie',
    toggle_ticket_status: 'Zmiana statusu zgłoszenia',
    add_comment: 'Nowy komentarz',
    edit_ticket: 'Edycja zgłoszenia',
    create_announcement: 'Nowe ogłoszenie',
    upsert_opening_balance: 'Zmiana salda otwarcia',
    create_expense: 'Nowy koszt',
    create_income: 'Nowy przychód',
    create_community: 'Nowa wspólnota',
    update_community: 'Edycja wspólnoty',
    create_vote: 'Nowa uchwała',
    cast_vote: 'Głos oddany',
  }
  return map[action] ?? action.replace(/_/g, ' ')
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'przed chwilą'
  if (diff < 3600) return `${Math.floor(diff / 60)} min temu`
  if (diff < 86400) return `${Math.floor(diff / 3600)} godz. temu`
  return `${Math.floor(diff / 86400)} dni temu`
}

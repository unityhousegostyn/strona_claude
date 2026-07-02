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
      allIncome, allDeposits, recentAudit,
    ] = await Promise.all([
      admin.from('communities').select('id', { count: 'exact', head: true }),
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      admin.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      admin.from('tickets').select('status, community_id, created_at'),
      admin.from('communities').select('id, name, opening_balance_eksploatacyjny, opening_balance_remont').order('name'),
      admin.from('tickets').select('id, title, status, created_at, community_id')
        .order('created_at', { ascending: false }).limit(4),
      admin.from('board_posts').select('id, content, created_at, author_id, community_id')
        .order('created_at', { ascending: false }).limit(4),
      admin.from('profiles').select('id, full_name, email'),
      admin.from('settlement_apartments').select('id, community_id, persons_count').eq('active', true),
      admin.from('votes').select('id, community_id, status, title, deadline, created_at').order('created_at', { ascending: false }),
      admin.from('settlement_entries').select('paid, apartment:settlement_apartments!inner(community_id)'),
      admin.from('profiles').select('id, community_id').eq('role', 'user').eq('status', 'active'),
      admin.from('community_expenses').select('community_id, amount'),
      admin.from('community_income').select('community_id, amount'),
      admin.from('community_deposits').select('community_id, amount, status'),
      admin.from('activity_logs').select('id, action, target_type, created_at, user_id').order('created_at', { ascending: false }).limit(8),
    ])

    const commMap: Record<string, string> = {}
    for (const c of communities.data ?? []) commMap[c.id] = c.name

    const authorMap: Record<string, string> = {}
    for (const a of postAuthors.data ?? []) {
      authorMap[a.id] = a.full_name ?? a.email ?? '—'
    }

    // Per-community stats
    interface CommStats { apartments: number; residents: number; users: number; openTickets: number; openVotes: number; totalPaid: number; totalExpenses: number; totalIncome: number; totalDeposits: number; openingBalance: number }
    const commStats: Record<string, CommStats> = {}
    for (const c of communities.data ?? []) {
      const cc = c as any
      commStats[c.id] = { apartments: 0, residents: 0, users: 0, openTickets: 0, openVotes: 0, totalPaid: 0, totalExpenses: 0, totalIncome: 0, totalDeposits: 0, openingBalance: (cc.opening_balance_eksploatacyjny ?? 0) + (cc.opening_balance_remont ?? 0) }
    }
    for (const a of allApartments.data ?? []) {
      if (commStats[a.community_id]) {
        commStats[a.community_id].apartments++
        commStats[a.community_id].residents += (a as any).persons_count ?? 0
      }
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
    for (const d of allDeposits.data ?? []) {
      if (d.status === 'active' && commStats[d.community_id]) commStats[d.community_id].totalDeposits += d.amount ?? 0
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

    // ── Health & Alerts ──────────────────────────────────────────
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fortyEightHoursLater = new Date(now.getTime() + 48 * 60 * 60 * 1000)
    const staleOpenTickets = (allTickets.data ?? []).filter((t: any) =>
      t.status === 'open' && new Date(t.created_at) < sevenDaysAgo
    )
    const expiringVotes48h = (allVotes.data ?? []).filter((v: any) =>
      v.status === 'open' && v.deadline &&
      new Date(v.deadline) > now &&
      new Date(v.deadline) < fortyEightHoursLater
    )
    const negativeBalComms = (communities.data ?? []).filter((c: any) => {
      const s = commStats[c.id]
      if (!s) return false
      return (s.openingBalance + s.totalPaid + s.totalIncome - s.totalExpenses) < 0
    })
    const healthProblems = [
      (pendingCount.count ?? 0) > 0,
      staleOpenTickets.length > 0,
      expiringVotes48h.length > 0,
      negativeBalComms.length > 0,
    ].filter(Boolean).length
    const healthLabel = healthProblems === 0 ? 'DOSKONAŁY' : healthProblems === 1 ? 'DOBRY' : healthProblems <= 2 ? 'UWAGA' : 'KRYTYCZNY'
    const healthColor = healthProblems === 0 ? 'text-teal-400' : healthProblems <= 2 ? 'text-yellow-400' : 'text-red-400'
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const thisMonthTix = (allTickets.data ?? []).filter((t: any) => new Date(t.created_at) >= thisMonthStart).length
    const lastMonthTix = (allTickets.data ?? []).filter((t: any) => { const d = new Date(t.created_at); return d >= prevMonthStart && d < thisMonthStart }).length
    const ticketTrend = thisMonthTix - lastMonthTix

    return (
      <div className="space-y-5">

        {/* ── Header + System Health ─────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-[#f0fdfa]">
              Witaj, {profile.full_name?.split(' ')[0] ?? 'Super Admin'} 👋
            </h2>
            <p className="text-sm text-[#115e59] mt-1">
              {now.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Warsaw' })}
            </p>
          </div>
          <div className="flex items-center gap-3 bg-[#0c2825] border border-[#134e48] rounded-xl px-4 py-2.5">
            <div className="flex gap-1.5">
              {[
                (pendingCount.count ?? 0) > 0,
                staleOpenTickets.length > 0,
                expiringVotes48h.length > 0,
                negativeBalComms.length > 0,
              ].map((bad, i) => (
                <div key={i} className={`w-2.5 h-2.5 rounded-full ${bad ? (i > 1 ? 'bg-red-500' : 'bg-yellow-500') : 'bg-teal-500'}`} />
              ))}
            </div>
            <span className={`text-sm font-semibold ${healthColor}`}>Stan systemu: {healthLabel}</span>
            {healthProblems > 0 && (
              <span className="text-xs text-[#1f5c55]">
                · {healthProblems} {healthProblems === 1 ? 'kwestia wymaga uwagi' : 'kwestie wymagają uwagi'}
              </span>
            )}
          </div>
        </div>

        {/* ── KPI Row ───────────────────────────────────────────── */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <KpiTile label="Wspólnoty" value={commCount.count ?? 0} href="/admin/communities" trend={null}
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h2v11H4zm6 0h2v11h-2zm6 0h2v11h-2z"/>} />
          <KpiTile label="Mieszkań" value={totalApartments} href="/admin/communities" trend={null}
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>} />
          <KpiTile label="Aktywnych" value={userCount.count ?? 0} href="/admin/users" trend={null}
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>} />
          <KpiTile label="Oczekujących" value={pendingCount.count ?? 0} href="/admin/users" trend={null} accent={pendingCount.count ? 'red' : undefined}
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>} />
          <KpiTile label="Zgłoszenia" value={ticketCount.count ?? 0} href="/admin/tickets" trend={ticketTrend} accent={ticketCount.count ? 'yellow' : undefined}
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>} />
          <KpiTile label="Głosowania" value={openVotesCount} href="/admin/votes" trend={null} accent={openVotesCount ? 'amber' : undefined}
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>} />
        </div>

        {/* ── Main: Left + Right columns ────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-4 items-start">

          {/* LEFT */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Community Matrix */}
            <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#0f2d2a]">
                <h3 className="text-xs font-semibold text-[#115e59] uppercase tracking-widest">Macierz wspólnot</h3>
                <Link href="/admin/communities" className="text-xs text-teal-500 hover:underline">Zarządzaj →</Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#0f2d2a]">
                      <th className="text-left px-5 py-2 text-[10px] font-medium text-[#133835] uppercase tracking-wider">Wspólnota</th>
                      <th className="text-center px-3 py-2 text-[10px] font-medium text-[#133835] uppercase tracking-wider">Lokale</th>
                      <th className="text-center px-3 py-2 text-[10px] font-medium text-[#133835] uppercase tracking-wider">Mieszk.</th>
                      <th className="text-center px-3 py-2 text-[10px] font-medium text-[#133835] uppercase tracking-wider">Zgłosz.</th>
                      <th className="text-center px-3 py-2 text-[10px] font-medium text-[#133835] uppercase tracking-wider">Głosowan.</th>
                      <th className="text-right px-5 py-2 text-[10px] font-medium text-[#133835] uppercase tracking-wider">Saldo</th>
                      <th className="px-5 py-2 text-[10px] font-medium text-[#133835] uppercase tracking-wider" style={{ minWidth: '110px' }}>Pokrycie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0a1e1c]">
                    {(communities.data ?? []).map((c: any) => {
                      const s = commStats[c.id] ?? { apartments: 0, users: 0, openTickets: 0, openVotes: 0, totalPaid: 0, totalExpenses: 0, totalIncome: 0, totalDeposits: 0, openingBalance: 0 }
                      const bal = s.openingBalance + s.totalPaid + s.totalIncome - s.totalExpenses
                      const pct = s.totalExpenses > 0 ? Math.min(100, Math.round(((s.totalPaid + s.totalIncome) / s.totalExpenses) * 100)) : (s.totalPaid + s.totalIncome > 0 ? 100 : 0)
                      return (
                        <tr key={c.id} className="hover:bg-[#051210] transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-semibold text-[#f0fdfa]">{c.name}</p>
                            <p className="text-[10px] text-[#133835] mt-0.5">{s.users} kont</p>
                          </td>
                          <td className="px-3 py-3 text-center text-[#99f6e4]">{s.apartments}</td>
                          <td className="px-3 py-3 text-center">
                            {s.residents > 0
                              ? <span className="font-semibold text-[#99f6e4]">{s.residents}</span>
                              : <span className="text-[#133835]">—</span>
                            }
                          </td>
                          <td className="px-3 py-3 text-center">
                            {s.openTickets > 0
                              ? <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-950/40 text-yellow-400 border border-yellow-900/40">{s.openTickets}</span>
                              : <span className="text-[#133835]">—</span>
                            }
                          </td>
                          <td className="px-3 py-3 text-center">
                            {s.openVotes > 0
                              ? <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-950/40 text-teal-400 border border-teal-900/40">{s.openVotes}</span>
                              : <span className="text-[#133835]">—</span>
                            }
                          </td>
                          <td className={`px-5 py-3 text-right font-semibold tabular-nums ${bal >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                            {pln(bal)}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-[#051210] rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${bal >= 0 ? 'bg-teal-600' : 'bg-red-600'}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] text-[#133835] w-8 text-right tabular-nums">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chart + Finance side-by-side */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3">
                <StatsChart data={chartData} title="Zgłoszenia — ostatnie 6 miesięcy (wszystkie wspólnoty)" />
              </div>
              <div className="lg:col-span-2 bg-[#081918] border border-[#0f2d2a] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[#115e59] uppercase tracking-widest">Stan kont</h3>
                  <Link href="/admin/finanse/raporty" className="text-xs text-teal-500 hover:underline">Raporty →</Link>
                </div>
                <p className="text-[10px] text-[#133835] -mt-2">Środki wspólnot są odrębne i nie sumują się.</p>
                <div className="space-y-4">
                  {(communities.data ?? []).map((c: any) => {
                    const s = commStats[c.id] ?? { totalPaid: 0, totalExpenses: 0, totalIncome: 0, totalDeposits: 0, openingBalance: 0 }
                    const bal = s.openingBalance + s.totalPaid + s.totalIncome - s.totalExpenses
                    const pct = s.totalExpenses > 0 ? Math.min(100, Math.round(((s.totalPaid + s.totalIncome) / s.totalExpenses) * 100)) : (s.totalPaid + s.totalIncome > 0 ? 100 : 0)
                    return (
                      <div key={c.id}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-[#99f6e4] truncate max-w-[140px]">{c.name}</p>
                          <p className={`text-xs font-semibold tabular-nums ${bal >= 0 ? 'text-teal-400' : 'text-red-400'}`}>{pln(bal)}</p>
                        </div>
                        <div className="h-1.5 bg-[#051210] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${bal >= 0 ? 'bg-teal-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                        {s.totalDeposits > 0 && (
                          <p className="text-[10px] text-[#133835] mt-0.5">🏦 lokata: {pln(s.totalDeposits)}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div className="w-full lg:w-64 flex-shrink-0 space-y-4">

            {/* Alert Center */}
            <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4">
              <h3 className="text-xs font-semibold text-[#115e59] uppercase tracking-widest mb-3">🚨 Wymaga uwagi</h3>
              {healthProblems === 0 ? (
                <p className="text-xs text-teal-600 py-2 text-center">✓ Wszystko w porządku</p>
              ) : (
                <div className="space-y-2">
                  {(pendingCount.count ?? 0) > 0 && (
                    <Link href="/admin/users" className="flex items-start gap-2.5 p-2.5 rounded-lg bg-red-950/20 border border-red-900/40 hover:border-red-700/60 transition">
                      <span className="text-sm flex-shrink-0 mt-0.5">👤</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-red-300">{pendingCount.count} oczekujących</p>
                        <p className="text-[10px] text-red-800 mt-0.5">czeka na akceptację</p>
                      </div>
                    </Link>
                  )}
                  {staleOpenTickets.length > 0 && (
                    <Link href="/admin/tickets" className="flex items-start gap-2.5 p-2.5 rounded-lg bg-yellow-950/20 border border-yellow-900/40 hover:border-yellow-700/60 transition">
                      <span className="text-sm flex-shrink-0 mt-0.5">⏰</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-yellow-300">{staleOpenTickets.length} zaległych zgłoszeń</p>
                        <p className="text-[10px] text-yellow-800 mt-0.5">bez odpowiedzi &gt; 7 dni</p>
                      </div>
                    </Link>
                  )}
                  {expiringVotes48h.length > 0 && (
                    <Link href="/admin/votes" className="flex items-start gap-2.5 p-2.5 rounded-lg bg-teal-950/30 border border-teal-800/40 hover:border-teal-600/60 transition">
                      <span className="text-sm flex-shrink-0 mt-0.5">🗳️</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-teal-300">{expiringVotes48h.length === 1 ? 'Głosowanie kończy się' : `${expiringVotes48h.length} głosowań kończy się`}</p>
                        <p className="text-[10px] text-teal-800 mt-0.5">w ciągu 48h</p>
                      </div>
                    </Link>
                  )}
                  {negativeBalComms.length > 0 && (
                    <Link href="/admin/finanse/raporty" className="flex items-start gap-2.5 p-2.5 rounded-lg bg-red-950/20 border border-red-900/40 hover:border-red-700/60 transition">
                      <span className="text-sm flex-shrink-0 mt-0.5">📉</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-red-300 truncate">{negativeBalComms.map((c: any) => c.name).join(', ')}</p>
                        <p className="text-[10px] text-red-800 mt-0.5">ujemne saldo konta</p>
                      </div>
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Activity Timeline */}
            <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-[#115e59] uppercase tracking-widest">Aktywność</h3>
                <Link href="/admin/audit" className="text-xs text-teal-500 hover:underline">Audit →</Link>
              </div>
              {(() => {
                const logs = recentAudit.data ?? []
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                const yesterdayStart = new Date(todayStart.getTime() - 86400000)
                const todayLogs = logs.filter((l: any) => new Date(l.created_at) >= todayStart)
                const yestLogs = logs.filter((l: any) => new Date(l.created_at) >= yesterdayStart && new Date(l.created_at) < todayStart)
                const olderLogs = logs.filter((l: any) => new Date(l.created_at) < yesterdayStart)
                const groups: { label: string; items: typeof logs }[] = []
                if (todayLogs.length > 0) groups.push({ label: 'Dziś', items: todayLogs.slice(0, 3) })
                if (yestLogs.length > 0) groups.push({ label: 'Wczoraj', items: yestLogs.slice(0, 2) })
                if (olderLogs.length > 0 && groups.length < 2) groups.push({ label: 'Wcześniej', items: olderLogs.slice(0, 2) })
                if (groups.length === 0) return <p className="text-xs text-[#133835] text-center py-2">Brak aktywności</p>
                return (
                  <div className="space-y-3">
                    {groups.map(group => (
                      <div key={group.label}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className="text-[9px] font-semibold uppercase tracking-widest text-[#133835] flex-shrink-0">{group.label}</p>
                          <div className="flex-1 h-px bg-[#0f2d2a]" />
                        </div>
                        <div className="space-y-2">
                          {group.items.map((log: any) => (
                            <div key={log.id} className="flex items-start gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#0f766e] flex-shrink-0 mt-1.5" />
                              <div>
                                <p className="text-[11px] text-[#99f6e4] leading-snug">{auditLabel(log.action, log.target_type)}</p>
                                <p className="text-[10px] text-[#133835] mt-0.5">
                                  {new Date(log.created_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })}
                                  {' · '}{auditIcon(log.action)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* Quick Actions */}
            <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4">
              <h3 className="text-xs font-semibold text-[#115e59] uppercase tracking-widest mb-3">Szybkie akcje</h3>
              <div className="grid grid-cols-2 gap-2">
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
          <h2 className="text-2xl font-bold text-[#f0fdfa]">
            Witaj, {profile.full_name?.split(' ')[0] ?? 'Administratorze'} 👋
          </h2>
          <p className="text-sm text-[#115e59] mt-1">{community?.name ?? '—'}</p>
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
              <h3 className="text-base font-semibold text-[#ccfbf1]">Otwarte zgłoszenia</h3>
              <Link href="/admin/tickets" className="text-sm text-teal-500 hover:underline">Zobacz wszystkie</Link>
            </div>
            {(openTickets.data ?? []).length === 0
              ? <p className="text-sm text-[#0f766e]">Brak otwartych zgłoszeń.</p>
              : <div className="space-y-2">
                  {(openTickets.data ?? []).map((t: any) => (
                    <Link key={t.id} href={`/admin/tickets/${t.id}`}
                      className="flex items-center justify-between bg-[#081918] border border-[#0f2d2a] rounded-xl px-4 py-3 hover:border-green-700 transition">
                      <p className="text-sm font-medium text-[#ccfbf1] truncate">{t.title}</p>
                      <span className="text-xs text-yellow-400 bg-yellow-950/30 px-2 py-0.5 rounded-full ml-2 flex-shrink-0">Otwarte</span>
                    </Link>
                  ))}
                </div>
            }
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-[#ccfbf1]">Ostatnie posty na tablicy</h3>
              <Link href="/admin/board" className="text-sm text-teal-500 hover:underline">Tablica</Link>
            </div>
            {(recentBoardPosts.data ?? []).length === 0
              ? <p className="text-sm text-[#0f766e]">Brak postów na tablicy.</p>
              : <div className="space-y-2">
                  {(recentBoardPosts.data ?? []).map((p: any) => (
                    <Link key={p.id} href="/admin/board"
                      className="block bg-[#081918] border border-[#0f2d2a] rounded-xl px-4 py-3 hover:border-green-700 transition">
                      <p className="text-sm text-[#ccfbf1] line-clamp-1">{p.content}</p>
                      <p className="text-xs text-[#0f766e] mt-1">
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
            <h3 className="text-base font-semibold text-[#ccfbf1]">Ostatnie ogłoszenia</h3>
            <Link href="/admin/announcements/add" className="text-sm text-teal-500 hover:underline">+ Dodaj</Link>
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
          <div className="bg-[#081918]/20 rounded-xl px-4 py-2 text-center">
            <p className="text-xl font-bold">{unreadCount}</p>
            <p className="text-xs text-green-100">Nowe ogłoszenia</p>
          </div>
          <div className="bg-[#081918]/20 rounded-xl px-4 py-2 text-center">
            <p className="text-xl font-bold">{openCount}</p>
            <p className="text-xs text-green-100">Otwarte zgłoszenia</p>
          </div>
          <div className="bg-[#081918]/20 rounded-xl px-4 py-2 text-center">
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
          <div className="bg-[#081918] border border-[#0f2d2a] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-[#f0fdfa]">Rozliczenie {currentYear}</h3>
                <p className="text-xs text-[#115e59] mt-0.5">Lokal {myApartment.number} · {myApartment.owner_name}</p>
              </div>
              <Link
                href={`/admin/settlements/${myApartment.id}`}
                className="text-sm text-teal-500 hover:underline"
              >
                Pełny widok →
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Saldo końcowe */}
              <div className={`rounded-xl p-3 ${finalBalance >= 0 ? 'bg-teal-950/30 border border-teal-800' : 'bg-red-950/30 border border-red-900'}`}>
                <p className="text-xs text-[#115e59] mb-1">Saldo {currentYear}</p>
                <p className={`text-lg font-bold ${finalBalance >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                  {pln(finalBalance)}
                </p>
                <p className={`text-xs mt-0.5 ${finalBalance >= 0 ? 'text-teal-500' : 'text-red-600'}`}>
                  {finalBalance >= 0 ? 'Nadpłata' : 'Niedopłata'}
                </p>
              </div>

              {/* Bieżący miesiąc */}
              <div className="bg-[#051210] border border-[#0f2d2a] rounded-xl p-3">
                <p className="text-xs text-[#115e59] mb-1">Naliczono ten mies.</p>
                <p className="text-lg font-bold text-[#f0fdfa]">
                  {currentRow?.hasRates ? pln(currentRow.total_due) : '—'}
                </p>
                <p className="text-xs text-[#115e59] mt-0.5">
                  {currentRow?.hasRates ? 'do zapłaty' : 'brak stawek'}
                </p>
              </div>

              {/* Wpłacono w roku */}
              <div className="bg-[#051210] border border-[#0f2d2a] rounded-xl p-3">
                <p className="text-xs text-[#115e59] mb-1">Wpłacono {currentYear}</p>
                <p className="text-lg font-bold text-teal-400">{pln(totalPaid)}</p>
                <p className="text-xs text-[#115e59] mt-0.5">łącznie</p>
              </div>

              {/* Naliczono w roku */}
              <div className="bg-[#051210] border border-[#0f2d2a] rounded-xl p-3">
                <p className="text-xs text-[#115e59] mb-1">Naliczono {currentYear}</p>
                <p className="text-lg font-bold text-[#99f6e4]">{pln(totalDue)}</p>
                <p className="text-xs text-[#115e59] mt-0.5">łącznie</p>
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
                          ? 'bg-teal-700/60'
                          : isPast
                          ? 'bg-red-800/60'
                          : 'bg-[#0c2220]'
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
            <h3 className="text-base font-semibold text-[#ccfbf1]">Ostatnie ogłoszenia</h3>
            <Link href="/admin/announcements" className="text-sm text-teal-500 hover:underline">Zobacz wszystkie</Link>
          </div>
          {(announcements.data ?? []).length === 0
            ? <p className="text-sm text-[#0f766e]">Brak ogłoszeń.</p>
            : <div className="space-y-2">
                {(announcements.data ?? []).map((a: any) => (
                  <Link key={a.id} href={`/admin/announcements/${a.id}`}
                    className="block bg-[#081918] border border-[#0f2d2a] rounded-xl px-4 py-3 hover:border-green-700 transition">
                    <p className="text-sm font-medium text-[#ccfbf1] truncate">{a.title}</p>
                    <p className="text-xs text-[#0f766e] mt-0.5">{new Date(a.created_at).toLocaleDateString('pl-PL')}</p>
                  </Link>
                ))}
              </div>
          }
        </div>

        {/* Tablica — ostatnie posty */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-[#ccfbf1]">Tablica sąsiedzka</h3>
            <Link href="/admin/board" className="text-sm text-teal-500 hover:underline">Przejdź</Link>
          </div>
          {(boardPosts.data ?? []).length === 0
            ? <div className="bg-[#081918] border border-dashed border-[#0f2d2a] rounded-xl p-5 text-center">
                <p className="text-sm text-[#0f766e] mb-2">Tablica jest pusta.</p>
                <Link href="/admin/board" className="text-sm text-teal-500 hover:underline">Napisz pierwszą wiadomość →</Link>
              </div>
            : <div className="space-y-2">
                {(boardPosts.data ?? []).map((p: any) => (
                  <Link key={p.id} href="/admin/board"
                    className="block bg-[#081918] border border-[#0f2d2a] rounded-xl px-4 py-3 hover:border-green-700 transition">
                    <p className="text-sm text-[#ccfbf1] line-clamp-1">{p.content}</p>
                    <p className="text-xs text-[#0f766e] mt-1">
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
          <h3 className="text-base font-semibold text-[#ccfbf1]">Moje zgłoszenia</h3>
          <Link href="/admin/tickets" className="text-sm text-teal-500 hover:underline">Nowe zgłoszenie</Link>
        </div>
        {(myTickets.data ?? []).length === 0
          ? <div className="bg-[#081918] border border-dashed border-[#0f2d2a] rounded-xl p-6 text-center">
              <p className="text-sm text-[#0f766e] mb-3">Nie masz jeszcze żadnych zgłoszeń.</p>
              <Link href="/admin/tickets" className="text-sm text-teal-500 font-medium hover:underline">Zgłoś problem →</Link>
            </div>
          : <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(myTickets.data ?? []).map((t: any) => (
                <Link key={t.id} href={`/admin/tickets/${t.id}`}
                  className="flex items-center justify-between bg-[#081918] border border-[#0f2d2a] rounded-xl px-4 py-3 hover:border-green-700 transition">
                  <p className="text-sm font-medium text-[#ccfbf1] truncate">{t.title}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${
                    t.status === 'open' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-green-100 text-teal-400'
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
            <h3 className="text-base font-semibold text-[#ccfbf1]">Ostatnie dokumenty</h3>
            <Link href="/admin/documents" className="text-sm text-teal-500 hover:underline">Zobacz wszystkie</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(docs.data ?? []).map((d: any) => {
              const ext = d.name.split('.').pop()?.toLowerCase()
              const icon = ext === 'pdf' ? '📄' : ['doc','docx'].includes(ext) ? '📝' : ['xls','xlsx'].includes(ext) ? '📊' : '📁'
              return (
                <div key={d.id} className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4 text-center hover:border-green-700 transition">
                  <p className="text-3xl mb-2">{icon}</p>
                  <p className="text-xs font-medium text-[#99f6e4] truncate">{d.name}</p>
                  <p className="text-xs text-[#0f766e] mt-1">{new Date(d.created_at).toLocaleDateString('pl-PL')}</p>
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

function KpiTile({ label, value, href, icon, trend, accent }: {
  label: string; value: number; href: string; icon: React.ReactNode; trend: number | null; accent?: 'red' | 'yellow' | 'amber'
}) {
  const accentMap = {
    red:    { text: 'text-red-400',    bg: 'bg-red-950/30',    border: 'border-red-900/40',    icon: 'text-red-500' },
    yellow: { text: 'text-yellow-400', bg: 'bg-yellow-950/30', border: 'border-yellow-900/40', icon: 'text-yellow-500' },
    amber:  { text: 'text-teal-400',   bg: 'bg-teal-950/30',   border: 'border-teal-900/40',   icon: 'text-teal-500' },
  }
  const ac = accent ? accentMap[accent] : null
  return (
    <Link href={href}
      className={`bg-[#081918] border rounded-xl p-4 flex flex-col gap-2 hover:border-[#133835] transition group relative ${ac ? ac.border : 'border-[#0f2d2a]'}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${ac ? ac.bg : 'bg-[#051210]'}`}>
        <svg className={`w-4 h-4 ${ac ? ac.icon : 'text-[#115e59]'} group-hover:scale-110 transition-transform`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
      </div>
      <div>
        <p className={`text-2xl font-bold tabular-nums ${ac ? ac.text : 'text-[#f0fdfa]'}`}>{value}</p>
        <p className="text-xs text-[#115e59] mt-0.5">{label}</p>
      </div>
      {trend !== null && trend !== 0 && (
        <div className={`absolute top-3 right-3 text-[10px] font-bold ${trend > 0 ? 'text-yellow-500' : 'text-teal-500'}`}>
          {trend > 0 ? `▲ ${trend}` : `▼ ${Math.abs(trend)}`}
        </div>
      )}
    </Link>
  )
}

function StatCardSvg({ label, value, href, icon, accent }: {
  label: string; value: number; href: string; icon: React.ReactNode; accent?: 'red' | 'yellow' | 'amber'
}) {
  const accentMap = {
    red:    { text: 'text-red-400',    bg: 'bg-red-950/30',    border: 'border-red-900/40',    icon: 'text-red-500' },
    yellow: { text: 'text-yellow-400', bg: 'bg-yellow-950/30', border: 'border-yellow-900/40', icon: 'text-yellow-500' },
    amber:  { text: 'text-teal-400',  bg: 'bg-teal-950/30',  border: 'border-teal-900/40',  icon: 'text-teal-500' },
  }
  const ac = accent ? accentMap[accent] : null
  return (
    <Link href={href}
      className={`bg-[#081918] border rounded-xl p-4 flex flex-col gap-2 hover:border-[#133835] transition group ${ac ? ac.border : 'border-[#0f2d2a]'}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${ac ? ac.bg : 'bg-[#051210]'}`}>
        <svg className={`w-4 h-4 ${ac ? ac.icon : 'text-[#115e59]'} group-hover:scale-110 transition-transform`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
      </div>
      <div>
        <p className={`text-2xl font-bold tabular-nums ${ac ? ac.text : 'text-[#f0fdfa]'}`}>{value}</p>
        <p className="text-xs text-[#115e59] mt-0.5">{label}</p>
      </div>
    </Link>
  )
}

function QuickAction({ href, icon, label, badge, badgeColor }: {
  href: string; icon: React.ReactNode; label: string; badge?: string; badgeColor?: string
}) {
  const badgeColors: Record<string, string> = {
    red:  'bg-red-900/40 text-red-400',
    blue: 'bg-teal-900/40 text-teal-400',
    yellow: 'bg-yellow-900/40 text-yellow-400',
  }
  return (
    <Link href={href}
      className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4 flex flex-col items-center gap-3 hover:border-teal-800/60 hover:bg-teal-950/20 transition text-center group">
      <div className="w-10 h-10 rounded-xl bg-[#051210] flex items-center justify-center group-hover:bg-teal-950/40 transition">
        {typeof icon === 'string' ? (
          <span className="text-xl">{icon}</span>
        ) : (
          <svg className="w-5 h-5 text-teal-600 group-hover:text-teal-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {icon}
          </svg>
        )}
      </div>
      <span className="text-xs font-semibold text-[#99f6e4] group-hover:text-[#f0fdfa] transition">{label}</span>
      {badge && (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColors[badgeColor ?? ''] ?? 'bg-[#0c2220] text-[#0f766e]'}`}>
          {badge}
        </span>
      )}
    </Link>
  )
}

function AnnouncementList({ announcements }: { announcements: any[] }) {
  if (announcements.length === 0) return <p className="text-sm text-[#0f766e]">Brak ogłoszeń.</p>
  return (
    <div className="space-y-2">
      {announcements.map((a: any) => (
        <Link key={a.id} href={`/admin/announcements/${a.id}`}
          className="block bg-[#081918] border border-[#0f2d2a] rounded-xl px-4 py-3 hover:border-[#133835] transition">
          <p className="text-sm font-medium text-[#ccfbf1] truncate">{a.title}</p>
          <p className="text-xs text-[#0f766e] mt-0.5">{new Date(a.created_at).toLocaleDateString('pl-PL')}</p>
        </Link>
      ))}
    </div>
  )
}

function auditIcon(action: string): string {
  if (action === 'login') return '🔐'
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
    login: 'Zalogowano się',
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

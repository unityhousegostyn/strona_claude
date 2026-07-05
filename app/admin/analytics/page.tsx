import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AnalyticsClient, {
  type MonthlyFinance,
  type TicketStat,
  type VoteStat,
  type CommunityStat,
} from './AnalyticsClient'

export default async function AnalyticsPage() {
  const { profile } = await getAuthProfile()
  if (profile.role !== 'super_admin' && profile.role !== 'admin') redirect('/admin/dashboard')

  const admin = getSupabaseAdminClient()
  const now = new Date()
  const year = now.getFullYear()

  // Zakres: ostatnie 12 miesięcy
  const from12 = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const from12ISO = from12.toISOString().slice(0, 10)

  // Rok bieżący i poprzedni (dla YoY)
  const thisYearStart = `${year}-01-01`
  const prevYearStart = `${year - 1}-01-01`
  const prevYearEnd   = `${year - 1}-12-31`

  const communityFilter = profile.role === 'admin' ? profile.community_id : null

  // ── Równoległe zapytania ──────────────────────────────────────────
  const [
    expensesRes, incomeRes,
    prevExpensesRes, prevIncomeRes,
    ticketsRes, votesRes, voteChoicesRes,
    communitiesRes, usersRes, openTicketsRes,
  ] = await Promise.all([
    // koszty 12m
    communityFilter
      ? admin.from('community_expenses').select('expense_date, amount').eq('community_id', communityFilter).gte('expense_date', from12ISO)
      : admin.from('community_expenses').select('expense_date, amount, community_id').gte('expense_date', from12ISO),

    // przychody 12m
    communityFilter
      ? admin.from('community_income').select('income_date, amount').eq('community_id', communityFilter).gte('income_date', from12ISO)
      : admin.from('community_income').select('income_date, amount, community_id').gte('income_date', from12ISO),

    // koszty poprzedni rok (YoY)
    communityFilter
      ? admin.from('community_expenses').select('amount').eq('community_id', communityFilter).gte('expense_date', prevYearStart).lte('expense_date', prevYearEnd)
      : admin.from('community_expenses').select('amount').gte('expense_date', prevYearStart).lte('expense_date', prevYearEnd),

    // przychody poprzedni rok (YoY)
    communityFilter
      ? admin.from('community_income').select('amount').eq('community_id', communityFilter).gte('income_date', prevYearStart).lte('income_date', prevYearEnd)
      : admin.from('community_income').select('amount').gte('income_date', prevYearStart).lte('income_date', prevYearEnd),

    // zgłoszenia 12m
    communityFilter
      ? admin.from('tickets').select('created_at, status').eq('community_id', communityFilter).gte('created_at', from12ISO)
      : admin.from('tickets').select('created_at, status').gte('created_at', from12ISO),

    // głosowania wszystkie
    communityFilter
      ? admin.from('votes').select('id, title, community_id, status, created_at').eq('community_id', communityFilter).order('created_at', { ascending: false }).limit(20)
      : admin.from('votes').select('id, title, community_id, status, created_at').order('created_at', { ascending: false }).limit(20),

    // głosy oddane
    admin.from('vote_choices').select('vote_id'),

    // wspólnoty
    communityFilter
      ? admin.from('communities').select('id, name').eq('id', communityFilter)
      : admin.from('communities').select('id, name').order('name'),

    // aktywni użytkownicy per wspólnota
    communityFilter
      ? admin.from('profiles').select('community_id').eq('community_id', communityFilter).eq('role', 'user').eq('status', 'active')
      : admin.from('profiles').select('community_id').eq('role', 'user').eq('status', 'active'),

    // otwarte zgłoszenia
    communityFilter
      ? admin.from('tickets').select('community_id').eq('community_id', communityFilter).eq('status', 'open')
      : admin.from('tickets').select('community_id').eq('status', 'open'),
  ])

  // ── Apartmenty (do frekwencji głosowań) ──────────────────────────
  const { data: apartments } = await (communityFilter
    ? admin.from('settlement_apartments').select('id, community_id').eq('community_id', communityFilter).eq('active', true)
    : admin.from('settlement_apartments').select('id, community_id').eq('active', true))

  // ── Budowanie danych 12m ─────────────────────────────────────────
  const monthKeys: string[] = []
  const monthLabels: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    monthLabels.push(d.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' }))
  }

  const expMap: Record<string, number> = {}
  const incMap: Record<string, number> = {}
  for (const k of monthKeys) { expMap[k] = 0; incMap[k] = 0 }

  for (const e of expensesRes.data ?? []) {
    const k = e.expense_date.slice(0, 7)
    if (expMap[k] !== undefined) expMap[k] += Number(e.amount)
  }
  for (const e of incomeRes.data ?? []) {
    const k = e.income_date.slice(0, 7)
    if (incMap[k] !== undefined) incMap[k] += Number(e.amount)
  }

  let cumSaldo = 0
  const financeData: MonthlyFinance[] = monthKeys.map((k, i) => {
    cumSaldo += (incMap[k] - expMap[k])
    return { name: monthLabels[i], koszty: Math.round(expMap[k]), przychody: Math.round(incMap[k]), saldo: Math.round(cumSaldo) }
  })

  // ── YoY ──────────────────────────────────────────────────────────
  const thisYearExpenses = (expensesRes.data ?? []).filter(e => e.expense_date >= thisYearStart).reduce((s, e) => s + Number(e.amount), 0)
  const thisYearIncome   = (incomeRes.data ?? []).filter(e => e.income_date >= thisYearStart).reduce((s, e) => s + Number(e.amount), 0)
  const prevYearExpensesTotal = (prevExpensesRes.data ?? []).reduce((s, e) => s + Number(e.amount), 0)
  const prevYearIncomeTotal   = (prevIncomeRes.data ?? []).reduce((s, e) => s + Number(e.amount), 0)

  const expYoY = prevYearExpensesTotal > 0 ? ((thisYearExpenses - prevYearExpensesTotal) / prevYearExpensesTotal) * 100 : 0
  const incYoY = prevYearIncomeTotal   > 0 ? ((thisYearIncome   - prevYearIncomeTotal)   / prevYearIncomeTotal)   * 100 : 0

  // ── Tickets ──────────────────────────────────────────────────────
  const tickMap: Record<string, { otwarte: number; zamknięte: number }> = {}
  for (const k of monthKeys) tickMap[k] = { otwarte: 0, zamknięte: 0 }
  for (const t of ticketsRes.data ?? []) {
    const k = t.created_at.slice(0, 7)
    if (tickMap[k]) t.status === 'open' ? tickMap[k].otwarte++ : tickMap[k].zamknięte++
  }
  const ticketData: TicketStat[] = monthKeys.map((k, i) => ({ name: monthLabels[i], ...tickMap[k] }))

  // ── Votes ─────────────────────────────────────────────────────────
  const commMap: Record<string, string> = {}
  for (const c of communitiesRes.data ?? []) commMap[c.id] = c.name

  const apartmentsByComm: Record<string, number> = {}
  for (const a of apartments ?? []) {
    apartmentsByComm[a.community_id] = (apartmentsByComm[a.community_id] ?? 0) + 1
  }

  const choiceCountMap: Record<string, number> = {}
  for (const vc of voteChoicesRes.data ?? []) {
    choiceCountMap[vc.vote_id] = (choiceCountMap[vc.vote_id] ?? 0) + 1
  }

  const voteStats: VoteStat[] = (votesRes.data ?? []).map(v => ({
    title: v.title,
    communityName: commMap[v.community_id] ?? '—',
    totalApartments: apartmentsByComm[v.community_id] ?? 0,
    voted: choiceCountMap[v.id] ?? 0,
    status: v.status,
    createdAt: v.created_at,
  }))

  // ── Per-community stats ──────────────────────────────────────────
  const commExpMap: Record<string, number> = {}
  const commIncMap: Record<string, number> = {}
  for (const e of expensesRes.data ?? []) {
    const cid = (e as any).community_id ?? communityFilter
    if (cid) commExpMap[cid] = (commExpMap[cid] ?? 0) + Number(e.amount)
  }
  for (const e of incomeRes.data ?? []) {
    const cid = (e as any).community_id ?? communityFilter
    if (cid) commIncMap[cid] = (commIncMap[cid] ?? 0) + Number(e.amount)
  }
  const usersByComm: Record<string, number> = {}
  for (const u of usersRes.data ?? []) {
    if (u.community_id) usersByComm[u.community_id] = (usersByComm[u.community_id] ?? 0) + 1
  }
  const openByComm: Record<string, number> = {}
  for (const t of openTicketsRes.data ?? []) {
    if (t.community_id) openByComm[t.community_id] = (openByComm[t.community_id] ?? 0) + 1
  }

  const communityStats: CommunityStat[] = (communitiesRes.data ?? []).map(c => {
    const exp = commExpMap[c.id] ?? 0
    const inc = commIncMap[c.id] ?? 0
    return {
      name: c.name,
      expenses: Math.round(exp),
      income: Math.round(inc),
      balance: Math.round(inc - exp),
      users: usersByComm[c.id] ?? 0,
      openTickets: openByComm[c.id] ?? 0,
    }
  })

  const totalExpenses = Math.round(financeData.reduce((s, r) => s + r.koszty, 0))
  const totalIncome   = Math.round(financeData.reduce((s, r) => s + r.przychody, 0))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#f0fdfa]">Analytics</h1>
        <p className="text-sm text-[#115e59] mt-1">Trendy finansowe, zgłoszenia i aktywność — ostatnie 12 miesięcy</p>
      </div>

      <AnalyticsClient
        financeData={financeData}
        ticketData={ticketData}
        voteStats={voteStats}
        communityStats={communityStats}
        year={year}
        totalExpenses={totalExpenses}
        totalIncome={totalIncome}
        netBalance={totalIncome - totalExpenses}
        expensesYoY={expYoY}
        incomeYoY={incYoY}
      />
    </div>
  )
}

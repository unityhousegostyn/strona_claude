'use client'

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
  AreaChart, Area,
} from 'recharts'

export interface MonthlyFinance {
  name: string
  koszty: number
  przychody: number
  saldo: number
}

export interface VoteStat {
  title: string
  communityName: string
  totalApartments: number
  voted: number
  status: string
  createdAt: string
}

export interface TicketStat {
  name: string
  otwarte: number
  zamknięte: number
}

export interface CommunityStat {
  name: string
  expenses: number
  income: number
  balance: number
  users: number
  openTickets: number
}

interface Props {
  financeData: MonthlyFinance[]
  ticketData: TicketStat[]
  voteStats: VoteStat[]
  communityStats: CommunityStat[]
  year: number
  totalExpenses: number
  totalIncome: number
  netBalance: number
  expensesYoY: number
  incomeYoY: number
}

const TT_STYLE = {
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid #0f2d2a',
  backgroundColor: '#041614',
  color: '#f0fdfa',
}

function pln(v: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(v)
}

function Delta({ val }: { val: number }) {
  if (val === 0) return <span className="text-[#115e59] text-xs">—</span>
  return (
    <span className={`text-xs font-semibold ${val > 0 ? 'text-teal-400' : 'text-red-400'}`}>
      {val > 0 ? '▲' : '▼'} {Math.abs(Math.round(val))}%
    </span>
  )
}

export default function AnalyticsClient({
  financeData, ticketData, voteStats, communityStats,
  year, totalExpenses, totalIncome, netBalance,
  expensesYoY, incomeYoY,
}: Props) {
  const freeVotes = voteStats.filter(v => v.totalApartments > 0)

  return (
    <div className="space-y-6">

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Łączne koszty" value={pln(totalExpenses)} sub={`${year}`} delta={<Delta val={expensesYoY} />} accent="red" />
        <KpiCard label="Łączne przychody" value={pln(totalIncome)} sub={`${year}`} delta={<Delta val={incomeYoY} />} accent="teal" />
        <KpiCard label="Saldo netto" value={pln(netBalance)} sub="przychody − koszty" accent={netBalance >= 0 ? 'teal' : 'red'} />
        <KpiCard label="Frekwencja głosowań" value={freeVotes.length > 0
          ? `${Math.round(freeVotes.reduce((s, v) => s + (v.voted / v.totalApartments) * 100, 0) / freeVotes.length)}%`
          : '—'}
          sub={`${voteStats.length} głosowań`} accent="blue" />
      </div>

      {/* Finance chart */}
      <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5">
        <h3 className="text-xs font-semibold text-[#115e59] uppercase tracking-widest mb-4">Koszty vs przychody — ostatnie 12 miesięcy</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={financeData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#0f2d2a" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#0f766e' }} />
            <YAxis tick={{ fontSize: 11, fill: '#0f766e' }} tickFormatter={v => v >= 1000 ? `${v / 1000}k` : String(v)} />
            <Tooltip contentStyle={TT_STYLE} cursor={{ fill: '#0a1e1c' }}
              formatter={(v: any, name: any) => [pln(Number(v)), name === 'koszty' ? 'Koszty' : 'Przychody']} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#0f766e' }} />
            <Bar dataKey="koszty" fill="#ef4444" radius={[4, 4, 0, 0]} name="Koszty" />
            <Bar dataKey="przychody" fill="#0d9488" radius={[4, 4, 0, 0]} name="Przychody" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Saldo trend */}
      <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5">
        <h3 className="text-xs font-semibold text-[#115e59] uppercase tracking-widest mb-4">Skumulowane saldo (przychody − koszty)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={financeData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="salGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#0f2d2a" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#0f766e' }} />
            <YAxis tick={{ fontSize: 11, fill: '#0f766e' }} tickFormatter={v => v >= 1000 ? `${v / 1000}k` : String(v)} />
            <Tooltip contentStyle={TT_STYLE} cursor={{ stroke: '#0f766e' }}
              formatter={(v: any) => [pln(Number(v)), 'Saldo']} />
            <Area dataKey="saldo" stroke="#0d9488" fill="url(#salGrad)" strokeWidth={2} dot={false} name="Saldo" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row: tickets + votes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Tickets */}
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5">
          <h3 className="text-xs font-semibold text-[#115e59] uppercase tracking-widest mb-4">Zgłoszenia — ostatnie 12 miesięcy</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ticketData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f2d2a" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#0f766e' }} />
              <YAxis tick={{ fontSize: 10, fill: '#0f766e' }} allowDecimals={false} />
              <Tooltip contentStyle={TT_STYLE} cursor={{ fill: '#0a1e1c' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#0f766e' }} />
              <Bar dataKey="otwarte" fill="#f59e0b" radius={[3, 3, 0, 0]} name="Otwarte" />
              <Bar dataKey="zamknięte" fill="#2dd4bf" radius={[3, 3, 0, 0]} name="Zamknięte" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Votes frekwencja */}
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5">
          <h3 className="text-xs font-semibold text-[#115e59] uppercase tracking-widest mb-4">Frekwencja głosowań</h3>
          {voteStats.length === 0 ? (
            <p className="text-xs text-[#115e59] text-center py-8">Brak danych o głosowaniach</p>
          ) : (
            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
              {voteStats.slice(0, 10).map((v, i) => {
                const pct = v.totalApartments > 0 ? Math.round((v.voted / v.totalApartments) * 100) : 0
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-[#99f6e4] truncate max-w-[200px]" title={v.title}>{v.title}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-[#115e59]">{v.voted}/{v.totalApartments}</span>
                        <span className={`text-xs font-bold tabular-nums ${pct >= 50 ? 'text-teal-400' : pct >= 25 ? 'text-yellow-400' : 'text-red-400'}`}>{pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-[#051210] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 50 ? 'bg-teal-500' : pct >= 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-[#133835] mt-0.5">{v.communityName} · {new Date(v.createdAt).toLocaleDateString('pl-PL')}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Per-community table */}
      {communityStats.length > 1 && (
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#0f2d2a]">
            <h3 className="text-xs font-semibold text-[#115e59] uppercase tracking-widest">Porównanie wspólnot — {year}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#0f2d2a]">
                  {['Wspólnota', 'Koszty', 'Przychody', 'Saldo', 'Użytkownicy', 'Zgłoszenia'].map(h => (
                    <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold text-[#115e59] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0a1e1c]">
                {communityStats.map((c, i) => (
                  <tr key={i} className="hover:bg-[#051210] transition-colors">
                    <td className="px-5 py-3 font-medium text-[#f0fdfa]">{c.name}</td>
                    <td className="px-5 py-3 text-red-400 tabular-nums">{pln(c.expenses)}</td>
                    <td className="px-5 py-3 text-teal-400 tabular-nums">{pln(c.income)}</td>
                    <td className={`px-5 py-3 font-semibold tabular-nums ${c.balance >= 0 ? 'text-teal-400' : 'text-red-400'}`}>{pln(c.balance)}</td>
                    <td className="px-5 py-3 text-[#99f6e4]">{c.users}</td>
                    <td className="px-5 py-3">
                      {c.openTickets > 0
                        ? <span className="px-2 py-0.5 rounded-full bg-yellow-950/40 text-yellow-400 border border-yellow-900/40">{c.openTickets} otwartych</span>
                        : <span className="text-[#115e59]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}

function KpiCard({ label, value, sub, delta, accent }: {
  label: string; value: string; sub?: string; delta?: React.ReactNode; accent?: 'red' | 'teal' | 'blue'
}) {
  const colors = {
    red:  { border: 'border-red-900/40',    text: 'text-red-400' },
    teal: { border: 'border-teal-800/40',   text: 'text-teal-400' },
    blue: { border: 'border-blue-900/40',   text: 'text-blue-400' },
  }
  const ac = accent ? colors[accent] : { border: 'border-[#0f2d2a]', text: 'text-[#f0fdfa]' }
  return (
    <div className={`bg-[#081918] border ${ac.border} rounded-xl p-4`}>
      <p className="text-[10px] font-semibold text-[#115e59] uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${ac.text}`}>{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {sub && <p className="text-[10px] text-[#133835]">{sub}</p>}
        {delta}
      </div>
    </div>
  )
}

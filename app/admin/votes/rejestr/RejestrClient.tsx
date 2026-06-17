'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Choice { choice: string; share_value: number; apartment_id: string | null; user_id: string }
interface Vote {
  id: string
  title: string
  status: string
  voting_method: string
  created_at: string
  closed_at: string | null
  deadline: string | null
  resolution_number: number | null
  community_id: string
  community: { name: string } | null
  choices: Choice[]
}
interface Community { id: string; name: string }

interface Props {
  votes: Vote[]
  communities: Community[]
  isSuperAdmin: boolean
  aptCountByCommunity: Record<string, number>
}

function calcResults(vote: Vote) {
  const byShare = vote.voting_method === 'by_share'
  const yes = vote.choices.filter(c => c.choice === 'yes').reduce((s, c) => s + (byShare ? c.share_value : 1), 0)
  const no  = vote.choices.filter(c => c.choice === 'no').reduce((s, c) => s + (byShare ? c.share_value : 1), 0)
  const ab  = vote.choices.filter(c => c.choice === 'abstain').reduce((s, c) => s + (byShare ? c.share_value : 1), 0)
  const total = yes + no + ab
  const pct = (v: number) => total > 0 ? Math.round(v / total * 100) : 0
  const passed = yes > 0.5 // ponad 50% za (wg udziałów lub głosów)
  return { yes, no, ab, total, pct, passed }
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function resolutionLabel(vote: Vote) {
  const year = new Date(vote.created_at).getFullYear()
  return vote.resolution_number ? `${vote.resolution_number}/${year}` : '—'
}

export default function RejestrClient({ votes, communities, isSuperAdmin, aptCountByCommunity }: Props) {
  const [filterCommunity, setFilterCommunity] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterYear, setFilterYear] = useState<string>('all')

  const years = Array.from(new Set(votes.map(v => new Date(v.created_at).getFullYear()))).sort((a, b) => b - a)

  const filtered = votes.filter(v => {
    if (filterCommunity !== 'all' && v.community_id !== filterCommunity) return false
    if (filterStatus !== 'all' && v.status !== filterStatus) return false
    if (filterYear !== 'all' && String(new Date(v.created_at).getFullYear()) !== filterYear) return false
    return true
  })

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#ecfdf5]">📋 Rejestr uchwał</h2>
          <p className="text-sm text-[#4d7a5f] mt-0.5">Pełna historia głosowań i uchwał wspólnoty</p>
        </div>
        <Link href="/admin/votes"
          className="text-sm text-[#6b9478] hover:text-[#a7f3d0] border border-[#1e3324] px-3 py-1.5 rounded-lg transition">
          ← Głosowania
        </Link>
      </div>

      {/* Filtry */}
      <div className="flex flex-wrap gap-3">
        {isSuperAdmin && (
          <select className="input text-sm" value={filterCommunity} onChange={e => setFilterCommunity(e.target.value)}>
            <option value="all">Wszystkie wspólnoty</option>
            {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select className="input text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Wszystkie statusy</option>
          <option value="open">Otwarte</option>
          <option value="closed">Zamknięte</option>
        </select>
        <select className="input text-sm" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          <option value="all">Wszystkie lata</option>
          {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
        <span className="text-xs text-[#4d7a5f] self-center ml-auto">
          {filtered.length} {filtered.length === 1 ? 'uchwała' : filtered.length < 5 ? 'uchwały' : 'uchwał'}
        </span>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#4d7a5f]">
          <p className="text-4xl mb-3">📋</p>
          <p>Brak uchwał spełniających kryteria.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#1e3324]">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-[#1e3324] bg-[#121c15]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#4d7a5f] uppercase tracking-wider w-20">Nr</th>
                {isSuperAdmin && (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#4d7a5f] uppercase tracking-wider">Wspólnota</th>
                )}
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#4d7a5f] uppercase tracking-wider">Tytuł uchwały</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#4d7a5f] uppercase tracking-wider w-24">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#4d7a5f] uppercase tracking-wider w-20">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#4d7a5f] uppercase tracking-wider w-32">Wynik ZA</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#4d7a5f] uppercase tracking-wider w-24">Frekwencja</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e3324]">
              {filtered.map(vote => {
                const res = calcResults(vote)
                const totalApts = aptCountByCommunity[vote.community_id] ?? 0
                const voterApts = new Set(vote.choices.map(c => c.apartment_id ?? c.user_id)).size
                const frekwencja = totalApts > 0 ? Math.round(voterApts / totalApts * 100) : 0

                return (
                  <tr key={vote.id} className="bg-[#0d1410] hover:bg-[#121c15] transition">
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-emerald-400">
                      {resolutionLabel(vote)}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-[#6b9478] text-xs">{vote.community?.name ?? '—'}</td>
                    )}
                    <td className="px-4 py-3">
                      <p className="text-[#ecfdf5] font-medium leading-snug">{vote.title}</p>
                      <p className="text-xs text-[#4d7a5f] mt-0.5">
                        {vote.voting_method === 'by_share' ? 'wg udziałów' : '1 lokal = 1 głos'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6b9478] whitespace-nowrap">{fmtDate(vote.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        vote.status === 'open' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-[#162418] text-[#4d7a5f]'
                      }`}>
                        {vote.status === 'open' ? '● Otwarte' : '✓ Zamknięte'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-[#162418] rounded-full h-1.5 w-16">
                          <div
                            className={`h-1.5 rounded-full ${res.pct(res.yes) > 50 ? 'bg-emerald-500' : 'bg-red-500'}`}
                            style={{ width: `${res.pct(res.yes)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold ${res.pct(res.yes) > 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {res.pct(res.yes)}%
                        </span>
                      </div>
                      {vote.status === 'closed' && (
                        <p className={`text-xs mt-0.5 ${res.pct(res.yes) > 50 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {res.pct(res.yes) > 50 ? '✓ Przyjęta' : '✗ Odrzucona'}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[#6b9478]">{voterApts}/{totalApts || '?'}</span>
                      {totalApts > 0 && (
                        <p className="text-xs text-[#4d7a5f]">{frekwencja}%</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/api/votes/${vote.id}/raport`}
                        target="_blank"
                        className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-800/60 px-2 py-1 rounded transition whitespace-nowrap"
                      >
                        📄 Raport
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Podsumowanie */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Łącznie', value: filtered.length, color: 'text-[#ecfdf5]' },
            { label: 'Otwartych', value: filtered.filter(v => v.status === 'open').length, color: 'text-emerald-400' },
            { label: 'Zamkniętych', value: filtered.filter(v => v.status === 'closed').length, color: 'text-[#6b9478]' },
            {
              label: 'Przyjętych',
              value: filtered.filter(v => v.status === 'closed' && calcResults(v).pct(calcResults(v).yes) > 50).length,
              color: 'text-emerald-400',
            },
          ].map(s => (
            <div key={s.label} className="bg-[#121c15] border border-[#1e3324] rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-[#4d7a5f] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

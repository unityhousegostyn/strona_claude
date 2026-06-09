'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createVote, castVote, closeVote, deleteVote } from './actions'
import Link from 'next/link'

interface Choice { choice: string; share_value: number; user_id: string }
interface Vote {
  id: string
  community_id: string
  title: string
  description: string | null
  status: string
  voting_method: string
  deadline: string | null
  created_at: string
  community: { name: string } | null
  choices: Choice[]
}
interface Community { id: string; name: string }

interface Props {
  votes: Vote[]
  communities: Community[]
  userId: string
  communityId: string | null
  isAdmin: boolean
  isSuperAdmin: boolean
  hasPin: boolean
}

function calcResults(vote: Vote) {
  const byShare = vote.voting_method === 'by_share'
  const yes = vote.choices.filter(c => c.choice === 'yes').reduce((s, c) => s + (byShare ? c.share_value : 1), 0)
  const no  = vote.choices.filter(c => c.choice === 'no').reduce((s, c) => s + (byShare ? c.share_value : 1), 0)
  const ab  = vote.choices.filter(c => c.choice === 'abstain').reduce((s, c) => s + (byShare ? c.share_value : 1), 0)
  const total = yes + no + ab
  return { yes, no, ab, total, pct: (v: number) => total > 0 ? Math.round(v / total * 100) : 0 }
}

export default function VotesClient({ votes, communities, userId, communityId, isAdmin, isSuperAdmin, hasPin }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '',
    voting_method: 'by_share' as 'by_share' | 'one_per_owner',
    deadline: '', community_id: communityId ?? communities[0]?.id ?? '',
  })
  const [formError, setFormError] = useState<string | null>(null)

  // PIN modal state
  const [pinModal, setPinModal] = useState<{ voteId: string; choice: 'yes' | 'no' | 'abstain' } | null>(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)

  const handleCreate = () => {
    setFormError(null)
    startTransition(async () => {
      const res = await createVote({ ...form, deadline: form.deadline || null })
      if (res.error) { setFormError(res.error); return }
      setShowForm(false)
      setForm({ title: '', description: '', voting_method: 'by_share', deadline: '', community_id: communityId ?? communities[0]?.id ?? '' })
      router.refresh()
    })
  }

  const handleVote = (voteId: string, choice: 'yes' | 'no' | 'abstain') => {
    if (!hasPin) {
      alert('Ustaw PIN w Profilu przed głosowaniem.')
      return
    }
    setPin('')
    setPinError(null)
    setPinModal({ voteId, choice })
  }

  const handleConfirmVote = () => {
    if (!pinModal) return
    setPinError(null)
    startTransition(async () => {
      const res = await castVote({ vote_id: pinModal.voteId, choice: pinModal.choice, pin })
      if (res.error) { setPinError(res.error); return }
      setPinModal(null)
      setPin('')
      router.refresh()
    })
  }

  const handleClose = (voteId: string) => {
    if (!confirm('Zamknąć głosowanie? Nie będzie można cofnąć.')) return
    startTransition(async () => {
      await closeVote(voteId)
      router.refresh()
    })
  }

  const handleDelete = (voteId: string) => {
    if (!confirm('Usunąć uchwałę wraz z wszystkimi głosami?')) return
    startTransition(async () => {
      await deleteVote(voteId)
      router.refresh()
    })
  }

  const choiceLabel = { yes: 'ZA', no: 'PRZECIW', abstain: 'WSTRZYMUJĘ SIĘ' }
  const choiceColor = { yes: 'bg-green-600 hover:bg-green-500', no: 'bg-red-600 hover:bg-red-500', abstain: 'bg-gray-600 hover:bg-gray-500' }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">🗳️ Głosowania</h2>
          <p className="text-sm text-gray-500 mt-0.5">Uchwały wspólnoty mieszkaniowej</p>
        </div>
        <div className="flex items-center gap-3">
          {!hasPin && (
            <Link href="/admin/profile" className="text-xs text-orange-400 border border-orange-800 bg-orange-900/20 px-3 py-1.5 rounded-lg">
              ⚠ Ustaw PIN aby głosować
            </Link>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              + Nowa uchwała
            </button>
          )}
        </div>
      </div>

      {/* Formularz nowej uchwały */}
      {showForm && isAdmin && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-gray-200">Nowa uchwała</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Tytuł uchwały *</label>
              <input className="input w-full" placeholder="np. Uchwała nr 1/2026 w sprawie..." value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Opis / treść uchwały</label>
              <textarea className="input w-full min-h-24 resize-y" placeholder="Treść uchwały..."
                value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Metoda głosowania</label>
                <select className="input w-full" value={form.voting_method}
                  onChange={e => setForm(p => ({ ...p, voting_method: e.target.value as 'by_share' | 'one_per_owner' }))}>
                  <option value="by_share">Wg udziałów (art. 23 UWL)</option>
                  <option value="one_per_owner">1 lokal = 1 głos</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Termin głosowania</label>
                <input className="input w-full" type="datetime-local" value={form.deadline}
                  onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
              </div>
              {isSuperAdmin && (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Wspólnota</label>
                  <select className="input w-full" value={form.community_id}
                    onChange={e => setForm(p => ({ ...p, community_id: e.target.value }))}>
                    {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
          {formError && <p className="text-sm text-red-400">{formError}</p>}
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={isPending}
              className="bg-blue-600 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50">
              {isPending ? 'Tworzenie...' : 'Utwórz głosowanie'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-300">Anuluj</button>
          </div>
        </div>
      )}

      {/* Lista głosowań */}
      {votes.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">🗳️</p>
          <p>Brak głosowań. {isAdmin ? 'Utwórz pierwszą uchwałę.' : 'Administrator jeszcze nie dodał żadnych uchwał.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {votes.map(vote => {
            const res = calcResults(vote)
            const myChoice = vote.choices.find(c => c.user_id === userId)
            const isOpen = vote.status === 'open' && (!vote.deadline || new Date(vote.deadline) > new Date())
            const totalVoters = vote.choices.length

            return (
              <div key={vote.id} className={`bg-gray-900 border rounded-xl p-5 space-y-4 ${vote.status === 'open' ? 'border-gray-800' : 'border-gray-800/50 opacity-80'}`}>
                {/* Nagłówek */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${vote.status === 'open' ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                        {vote.status === 'open' ? '● Otwarte' : '✓ Zamknięte'}
                      </span>
                      {isSuperAdmin && vote.community && (
                        <span className="text-xs text-gray-500">{vote.community.name}</span>
                      )}
                      <span className="text-xs text-gray-600">
                        {vote.voting_method === 'by_share' ? 'wg udziałów' : '1 lokal = 1 głos'}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-gray-100">{vote.title}</h3>
                    {vote.description && (
                      <p className="text-sm text-gray-400 mt-1 whitespace-pre-wrap">{vote.description}</p>
                    )}
                    {vote.deadline && (
                      <p className="text-xs text-gray-500 mt-1">
                        Termin: {new Date(vote.deadline).toLocaleString('pl-PL')}
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      {vote.status === 'open' && (
                        <button onClick={() => handleClose(vote.id)} disabled={isPending}
                          className="text-xs text-yellow-400 hover:text-yellow-300 border border-yellow-800 px-2 py-1 rounded-lg transition">
                          Zamknij
                        </button>
                      )}
                      <button onClick={() => handleDelete(vote.id)} disabled={isPending}
                        className="text-xs text-gray-600 hover:text-red-400 transition">✕</button>
                    </div>
                  )}
                </div>

                {/* Wyniki */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Wyniki ({totalVoters} głosów)</span>
                    {vote.voting_method === 'by_share' && res.total > 0 && (
                      <span>Łączny udział: {(res.total * 100).toFixed(2)}%</span>
                    )}
                  </div>
                  {[
                    { label: 'Za', value: res.yes, pct: res.pct(res.yes), color: 'bg-green-500' },
                    { label: 'Przeciw', value: res.no, pct: res.pct(res.no), color: 'bg-red-500' },
                    { label: 'Wstrzymało się', value: res.ab, pct: res.pct(res.ab), color: 'bg-gray-500' },
                  ].map(r => (
                    <div key={r.label} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-24">{r.label}</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-2">
                        <div className={`${r.color} h-2 rounded-full transition-all`} style={{ width: `${r.pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-300 w-12 text-right">{r.pct}%</span>
                    </div>
                  ))}
                </div>

                {/* Głosowanie */}
                {isOpen && !myChoice && (
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-800">
                    <p className="w-full text-xs text-gray-500 mb-1">Twój głos:</p>
                    {(['yes', 'no', 'abstain'] as const).map(c => (
                      <button key={c} onClick={() => handleVote(vote.id, c)} disabled={isPending}
                        className={`${choiceColor[c]} text-white text-xs font-bold px-4 py-1.5 rounded-lg transition disabled:opacity-50`}>
                        {choiceLabel[c]}
                      </button>
                    ))}
                  </div>
                )}

                {myChoice && (
                  <div className="pt-1 border-t border-gray-800">
                    <p className="text-xs text-gray-500">
                      Twój głos: <span className={`font-semibold ${myChoice.choice === 'yes' ? 'text-green-400' : myChoice.choice === 'no' ? 'text-red-400' : 'text-gray-400'}`}>
                        {choiceLabel[myChoice.choice as keyof typeof choiceLabel]}
                      </span>
                      {!isOpen && vote.status === 'open' && <span className="text-gray-600"> · głosowanie zakończone</span>}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal PIN */}
      {pinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5">
            <div className="text-center">
              <p className="text-3xl mb-2">🔐</p>
              <h3 className="text-base font-semibold text-gray-100">Potwierdź głos PINem</h3>
              <p className="text-sm text-gray-400 mt-1">
                Głosujesz: <span className={`font-bold ${pinModal.choice === 'yes' ? 'text-green-400' : pinModal.choice === 'no' ? 'text-red-400' : 'text-gray-400'}`}>
                  {choiceLabel[pinModal.choice]}
                </span>
              </p>
            </div>
            <div className="flex justify-center">
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                className="input w-32 text-center text-2xl tracking-widest"
                placeholder="••••"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={e => e.key === 'Enter' && pin.length === 4 && handleConfirmVote()}
              />
            </div>
            {pinError && <p className="text-sm text-red-400 text-center">{pinError}</p>}
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setPinModal(null); setPin('') }}
                className="text-sm text-gray-500 hover:text-gray-300 px-4 py-2">
                Anuluj
              </button>
              <button onClick={handleConfirmVote} disabled={isPending || pin.length !== 4}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2 rounded-lg transition disabled:opacity-50">
                {isPending ? 'Wysyłanie...' : 'Potwierdź'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

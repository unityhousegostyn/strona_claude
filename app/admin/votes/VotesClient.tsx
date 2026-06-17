'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createVote, castVote, closeVote, deleteVote, uploadVoteAttachment, updateResolutionNumber } from './actions'
import Link from 'next/link'

interface Choice { choice: string; share_value: number; user_id: string; apartment_id: string | null }
interface Vote {
  id: string
  community_id: string
  title: string
  description: string | null
  status: string
  voting_method: string
  deadline: string | null
  created_at: string
  link_url: string | null
  attachment_path: string | null
  resolution_number: number | null
  community: { name: string } | null
  choices: Choice[]
}
interface Community { id: string; name: string }

interface Props {
  votes: Vote[]
  communities: Community[]
  userId: string
  userApartmentId: string | null
  communityId: string | null
  isAdmin: boolean
  isSuperAdmin: boolean
  hasPin: boolean
  nextResolutionNumber: number
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

function getAttachmentUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/documents/${path}`
}

function calcResults(vote: Vote) {
  const byShare = vote.voting_method === 'by_share'
  const yes = vote.choices.filter(c => c.choice === 'yes').reduce((s, c) => s + (byShare ? c.share_value : 1), 0)
  const no  = vote.choices.filter(c => c.choice === 'no').reduce((s, c) => s + (byShare ? c.share_value : 1), 0)
  const ab  = vote.choices.filter(c => c.choice === 'abstain').reduce((s, c) => s + (byShare ? c.share_value : 1), 0)
  const total = yes + no + ab
  return { yes, no, ab, total, pct: (v: number) => total > 0 ? Math.round(v / total * 100) : 0 }
}

export default function VotesClient({ votes, communities, userId, userApartmentId, communityId, isAdmin, isSuperAdmin, hasPin, nextResolutionNumber }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const currentYear = new Date().getFullYear()
  const [form, setForm] = useState({
    title: '', description: '',
    voting_method: 'by_share' as 'by_share' | 'one_per_owner',
    deadline: '', community_id: communityId ?? '',
    link_url: '',
    resolution_number: nextResolutionNumber,
  })
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Inline edit numeru uchwały
  const [editingResNum, setEditingResNum] = useState<string | null>(null) // voteId
  const [editResNumValue, setEditResNumValue] = useState<number>(1)

  // PIN modal
  const [pinModal, setPinModal] = useState<{ voteId: string; choice: 'yes' | 'no' | 'abstain' } | null>(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)

  const handleCreate = async () => {
    setFormError(null)
    let attachmentPath: string | null = null

    if (attachmentFile) {
      setUploading(true)
      try {
        const fd = new FormData()
        fd.append('file', attachmentFile)
        const { error: uploadError, path } = await uploadVoteAttachment(fd)
        if (uploadError || !path) {
          setFormError('Błąd przesyłania pliku: ' + (uploadError ?? 'nieznany błąd'))
          setUploading(false)
          return
        }
        attachmentPath = path
      } catch {
        setFormError('Błąd przesyłania pliku')
        setUploading(false)
        return
      }
      setUploading(false)
    }

    startTransition(async () => {
      const res = await createVote({
        ...form,
        deadline: form.deadline || null,
        link_url: form.link_url.trim() || null,
        attachment_path: attachmentPath,
      })
      if (res.error) { setFormError(res.error); return }
      setShowForm(false)
      setForm({ title: '', description: '', voting_method: 'by_share', deadline: '', community_id: communityId ?? '', link_url: '', resolution_number: nextResolutionNumber + 1 })
      setAttachmentFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      router.refresh()
    })
  }

  const handleVote = (voteId: string, choice: 'yes' | 'no' | 'abstain') => {
    if (!hasPin) { alert('Ustaw PIN w Profilu przed głosowaniem.'); return }
    setPin(''); setPinError(null)
    setPinModal({ voteId, choice })
  }

  const handleConfirmVote = () => {
    if (!pinModal) return
    setPinError(null)
    startTransition(async () => {
      const res = await castVote({ vote_id: pinModal.voteId, choice: pinModal.choice, pin })
      if (res.error) { setPinError(res.error); return }
      setPinModal(null); setPin('')
      router.refresh()
    })
  }

  const handleClose = (voteId: string) => {
    if (!confirm('Zamknąć głosowanie? Nie będzie można cofnąć.')) return
    startTransition(async () => { await closeVote(voteId); router.refresh() })
  }

  const handleDelete = (voteId: string) => {
    if (!confirm('Usunąć uchwałę wraz z wszystkimi głosami?')) return
    startTransition(async () => { await deleteVote(voteId); router.refresh() })
  }

  const handleSaveResNum = (voteId: string) => {
    startTransition(async () => {
      await updateResolutionNumber(voteId, editResNumValue)
      setEditingResNum(null)
      router.refresh()
    })
  }

  const choiceLabel = { yes: 'ZA', no: 'PRZECIW', abstain: 'WSTRZYMUJĘ SIĘ' }
  const choiceColor = { yes: 'bg-teal-600 hover:bg-teal-500', no: 'bg-red-600 hover:bg-red-500', abstain: 'bg-[#133835] hover:bg-[#5a4a38]' }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#f0fdfa]">🗳️ Głosowania</h2>
          <p className="text-sm text-[#115e59] mt-0.5">Uchwały wspólnoty mieszkaniowej</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {!hasPin && (
            <Link href="/admin/profile" className="text-xs text-orange-400 border border-orange-800 bg-orange-900/20 px-3 py-1.5 rounded-lg">
              ⚠ Ustaw PIN aby głosować
            </Link>
          )}
          <Link href="/admin/votes/rejestr"
            className="text-xs text-[#0f766e] hover:text-[#99f6e4] border border-[#0f2d2a] px-3 py-1.5 rounded-lg transition">
            📋 Rejestr uchwał
          </Link>
          {isAdmin && (
            <button onClick={() => setShowForm(!showForm)}
              className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
              + Nowa uchwała
            </button>
          )}
        </div>
      </div>

      {/* Formularz nowej uchwały */}
      {showForm && isAdmin && (
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-[#ccfbf1]">Nowa uchwała</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#0f766e] block mb-1">Numer uchwały</label>
              <div className="flex items-center gap-2">
                <input className="input w-24 text-center" type="number" min={1}
                  value={form.resolution_number}
                  onChange={e => setForm(p => ({ ...p, resolution_number: parseInt(e.target.value) || 1 }))} />
                <span className="text-sm text-[#115e59]">/ {currentYear}</span>
                <span className="text-xs text-[#115e59] ml-2">(edytowalne)</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-[#0f766e] block mb-1">Tytuł uchwały *</label>
              <input className="input w-full" placeholder="np. Uchwała nr 1/2026 w sprawie..."
                value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-[#0f766e] block mb-1">Opis / treść uchwały</label>
              <textarea className="input w-full min-h-24 resize-y" placeholder="Treść uchwały..."
                value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-[#0f766e] block mb-1">Metoda głosowania</label>
                <select className="input w-full" value={form.voting_method}
                  onChange={e => setForm(p => ({ ...p, voting_method: e.target.value as 'by_share' | 'one_per_owner' }))}>
                  <option value="by_share">Wg udziałów (art. 23 UWL)</option>
                  <option value="one_per_owner">1 lokal = 1 głos</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[#0f766e] block mb-1">Termin głosowania</label>
                <input className="input w-full" type="datetime-local" value={form.deadline}
                  onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
              </div>
              {isSuperAdmin && (
                <div>
                  <label className="text-xs text-[#0f766e] block mb-1">Wspólnota</label>
                  <select className="input w-full" value={form.community_id}
                    onChange={e => setForm(p => ({ ...p, community_id: e.target.value }))}>
                    <option value="">— wybierz wspólnotę —</option>
                    {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Dokumentacja */}
            <div className="border-t border-[#0f2d2a] pt-3 space-y-3">
              <p className="text-xs font-medium text-[#115e59] uppercase tracking-wider">Dokumentacja (opcjonalnie)</p>
              <div>
                <label className="text-xs text-[#0f766e] block mb-1">🔗 Link do dokumentu zewnętrznego</label>
                <input
                  className="input w-full"
                  type="url"
                  placeholder="https://..."
                  value={form.link_url}
                  onChange={e => setForm(p => ({ ...p, link_url: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-[#0f766e] block mb-1">📎 Załącznik</label>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    onChange={e => setAttachmentFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                    id="vote-attachment"
                  />
                  <label htmlFor="vote-attachment"
                    className="cursor-pointer text-sm bg-[#0c2220] hover:bg-[#0a1f1d] border border-[#0f2d2a] text-[#99f6e4] px-3 py-2 rounded-lg transition">
                    Wybierz plik
                  </label>
                  {attachmentFile ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm text-[#99f6e4] truncate max-w-48">{attachmentFile.name}</span>
                      <button type="button"
                        onClick={() => { setAttachmentFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                        className="text-xs text-[#115e59] hover:text-red-400 flex-shrink-0 transition">✕</button>
                    </div>
                  ) : (
                    <span className="text-xs text-[#115e59]">PDF, DOC, XLS, obraz</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {formError && <p className="text-sm text-red-400">{formError}</p>}
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={isPending || uploading}
              className="bg-teal-600 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50">
              {uploading ? 'Przesyłanie pliku...' : isPending ? 'Tworzenie...' : 'Utwórz głosowanie'}
            </button>
            <button onClick={() => { setShowForm(false); setAttachmentFile(null) }}
              className="text-sm text-[#115e59] hover:text-[#99f6e4]">Anuluj</button>
          </div>
        </div>
      )}

      {/* Lista głosowań */}
      {votes.length === 0 ? (
        <div className="text-center py-16 text-[#115e59]">
          <p className="text-4xl mb-3">🗳️</p>
          <p>{isAdmin ? 'Utwórz pierwszą uchwałę.' : 'Administrator jeszcze nie dodał żadnych uchwał.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {votes.map(vote => {
            const res = calcResults(vote)
            // Głos identyfikowany po lokalu (nie userze) — jedno mieszkanie = jeden głos
            const myChoice = userApartmentId
              ? vote.choices.find(c => c.apartment_id === userApartmentId)
              : vote.choices.find(c => c.user_id === userId)
            const isOpen = vote.status === 'open' && (!vote.deadline || new Date(vote.deadline) > new Date())
            // Liczba unikalnych lokali które zagłosowały
            const totalVoters = new Set(vote.choices.map(c => c.apartment_id ?? c.user_id)).size

            return (
              <div key={vote.id} className={`bg-[#081918] border rounded-xl p-5 space-y-4 ${vote.status === 'open' ? 'border-[#0f2d2a]' : 'border-[#0f2d2a]/50 opacity-80'}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${vote.status === 'open' ? 'bg-teal-900/30 text-teal-400' : 'bg-[#0c2220] text-[#115e59]'}`}>
                        {vote.status === 'open' ? '● Otwarte' : '✓ Zamknięte'}
                      </span>
                      {isSuperAdmin && vote.community && (
                        <span className="text-xs text-[#115e59]">{vote.community.name}</span>
                      )}
                      <span className="text-xs text-[#115e59]">
                        {vote.voting_method === 'by_share' ? 'wg udziałów' : '1 lokal = 1 głos'}
                      </span>
                      {/* Numer uchwały z inline edit dla admina */}
                      {isAdmin && (
                        editingResNum === vote.id ? (
                          <span className="flex items-center gap-1">
                            <input
                              type="number" min={1}
                              className="input w-14 text-center text-xs py-0.5 px-1 h-6"
                              value={editResNumValue}
                              onChange={e => setEditResNumValue(parseInt(e.target.value) || 1)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveResNum(vote.id); if (e.key === 'Escape') setEditingResNum(null) }}
                              autoFocus
                            />
                            <span className="text-xs text-[#115e59]">/{new Date(vote.created_at).getFullYear()}</span>
                            <button onClick={() => handleSaveResNum(vote.id)} disabled={isPending}
                              className="text-xs text-teal-400 hover:text-teal-300 px-1">✓</button>
                            <button onClick={() => setEditingResNum(null)}
                              className="text-xs text-[#115e59] hover:text-red-400 px-1">✕</button>
                          </span>
                        ) : (
                          <button
                            onClick={() => { setEditingResNum(vote.id); setEditResNumValue(vote.resolution_number ?? 1) }}
                            className="text-xs text-[#115e59] hover:text-teal-400 border border-[#0f2d2a] px-2 py-0.5 rounded transition"
                            title="Zmień numer uchwały"
                          >
                            Nr {vote.resolution_number ? `${vote.resolution_number}/${new Date(vote.created_at).getFullYear()}` : '—'} ✎
                          </button>
                        )
                      )}
                      {!isAdmin && vote.resolution_number && (
                        <span className="text-xs text-[#115e59]">
                          Nr {vote.resolution_number}/{new Date(vote.created_at).getFullYear()}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-[#f0fdfa]">{vote.title}</h3>
                    {vote.description && (
                      <p className="text-sm text-[#0f766e] mt-1 whitespace-pre-wrap">{vote.description}</p>
                    )}
                    {vote.deadline && (
                      <p className="text-xs text-[#115e59] mt-1">
                        Termin: {new Date(vote.deadline).toLocaleString('pl-PL')}
                      </p>
                    )}

                    {/* Załącznik i link */}
                    {(vote.link_url || vote.attachment_path) && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {vote.link_url && (
                          <a href={vote.link_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 bg-teal-950/30 border border-teal-800/50 px-2.5 py-1 rounded-lg transition">
                            🔗 Otwórz dokument
                          </a>
                        )}
                        {vote.attachment_path && (
                          <a href={getAttachmentUrl(vote.attachment_path)} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-[#99f6e4] hover:text-[#f0fdfa] bg-[#0c2220] border border-[#0f2d2a] px-2.5 py-1 rounded-lg transition">
                            📎 {vote.attachment_path.split('/').pop()?.replace(/^\d+_/, '') ?? 'Załącznik'}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link href={`/api/votes/${vote.id}/raport`} target="_blank"
                      className="text-xs text-[#0f766e] hover:text-teal-400 border border-[#0f2d2a] px-2 py-1 rounded-lg transition">
                      📄 Raport
                    </Link>
                    {isAdmin && vote.status === 'open' && (
                      <button onClick={() => handleClose(vote.id)} disabled={isPending}
                        className="text-xs text-yellow-400 hover:text-yellow-300 border border-yellow-800 px-2 py-1 rounded-lg transition">
                        Zamknij
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => handleDelete(vote.id)} disabled={isPending}
                        className="text-xs text-[#115e59] hover:text-red-400 transition">✕</button>
                    )}
                  </div>
                </div>

                {/* Wyniki */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#115e59] mb-1">
                    <span>Wyniki ({totalVoters} głosów)</span>
                    {vote.voting_method === 'by_share' && res.total > 0 && (
                      <span>Łączny udział: {(res.total * 100).toFixed(2)}%</span>
                    )}
                  </div>
                  {[
                    { label: 'Za', value: res.yes, pct: res.pct(res.yes), color: 'bg-green-500' },
                    { label: 'Przeciw', value: res.no, pct: res.pct(res.no), color: 'bg-red-500' },
                    { label: 'Wstrzymało się', value: res.ab, pct: res.pct(res.ab), color: 'bg-[#5a4a38]' },
                  ].map(r => (
                    <div key={r.label} className="flex items-center gap-3">
                      <span className="text-xs text-[#0f766e] w-24">{r.label}</span>
                      <div className="flex-1 bg-[#0c2220] rounded-full h-2">
                        <div className={`${r.color} h-2 rounded-full transition-all`} style={{ width: `${r.pct}%` }} />
                      </div>
                      <span className="text-xs text-[#99f6e4] w-12 text-right">{r.pct}%</span>
                    </div>
                  ))}
                </div>

                {/* Głosowanie */}
                {isOpen && !myChoice && !isSuperAdmin && (
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-[#0f2d2a]">
                    <p className="w-full text-xs text-[#115e59] mb-1">Twój głos:</p>
                    {(['yes', 'no', 'abstain'] as const).map(c => (
                      <button key={c} onClick={() => handleVote(vote.id, c)} disabled={isPending}
                        className={`${choiceColor[c]} text-white text-xs font-bold px-4 py-1.5 rounded-lg transition disabled:opacity-50`}>
                        {choiceLabel[c]}
                      </button>
                    ))}
                  </div>
                )}
                {isOpen && !myChoice && isSuperAdmin && (
                  <div className="pt-1 border-t border-[#0f2d2a]">
                    <p className="text-xs text-[#115e59] italic">Administrator nie głosuje w uchwałach.</p>
                  </div>
                )}
                {myChoice && (
                  <div className="pt-1 border-t border-[#0f2d2a]">
                    <p className="text-xs text-[#115e59]">
                      Twój głos: <span className={`font-semibold ${myChoice.choice === 'yes' ? 'text-teal-400' : myChoice.choice === 'no' ? 'text-red-400' : 'text-[#0f766e]'}`}>
                        {choiceLabel[myChoice.choice as keyof typeof choiceLabel]}
                      </span>
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-[#051210] border border-[#0f2d2a] rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5 overflow-y-auto max-h-[92dvh]">
            <div className="text-center">
              <p className="text-3xl mb-2">🔐</p>
              <h3 className="text-base font-semibold text-[#f0fdfa]">Potwierdź głos PINem</h3>
              <p className="text-sm text-[#0f766e] mt-1">
                Głosujesz: <span className={`font-bold ${pinModal.choice === 'yes' ? 'text-teal-400' : pinModal.choice === 'no' ? 'text-red-400' : 'text-[#0f766e]'}`}>
                  {choiceLabel[pinModal.choice]}
                </span>
              </p>
            </div>
            <div className="flex justify-center">
              <input
                type="password" inputMode="numeric" maxLength={4} autoFocus
                className="input w-32 text-center text-2xl tracking-widest"
                placeholder="••••" value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={e => e.key === 'Enter' && pin.length === 4 && handleConfirmVote()}
              />
            </div>
            {pinError && <p className="text-sm text-red-400 text-center">{pinError}</p>}
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setPinModal(null); setPin('') }}
                className="text-sm text-[#115e59] hover:text-[#99f6e4] px-4 py-2">Anuluj</button>
              <button onClick={handleConfirmVote} disabled={isPending || pin.length !== 4}
                className="bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold px-6 py-2 rounded-lg transition disabled:opacity-50">
                {isPending ? 'Wysyłanie...' : 'Potwierdź'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

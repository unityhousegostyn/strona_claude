'use client'

import { useState, useTransition } from 'react'
import { addDeposit, matureDeposit, deleteDeposit } from './actions'

type Deposit = {
  id: string
  community_id: string
  type: 'lokata' | 'konto_oszczednosciowe'
  bank_name: string | null
  description: string | null
  amount: number
  interest_rate: number | null
  start_date: string
  end_date: string | null
  status: 'active' | 'closed'
}

type Community = { id: string; name: string }

const BELKA = 0.19

function pln(n: number) {
  return n.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
}

function calcInterest(amount: number, rate: number, start: string, end: string | null): { gross: number; tax: number; net: number; days: number } | null {
  if (!amount || !rate || !start) return null
  const endDate = end ? new Date(end) : null
  const startDate = new Date(start)
  if (isNaN(startDate.getTime())) return null
  if (endDate && isNaN(endDate.getTime())) return null
  const msPerYear = 1000 * 60 * 60 * 24 * 365
  const durationMs = endDate ? endDate.getTime() - startDate.getTime() : null
  if (durationMs !== null && durationMs <= 0) return null
  const years = durationMs !== null ? durationMs / msPerYear : 1 // fallback: 1 rok dla kont bez terminu
  const days = durationMs !== null ? Math.round(durationMs / (1000 * 60 * 60 * 24)) : 365
  const gross = amount * (rate / 100) * years
  const tax = gross * BELKA
  const net = gross - tax
  return { gross, tax, net, days }
}

function daysLeft(end: string | null): number | null {
  if (!end) return null
  const diff = new Date(end).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

export default function LokatyClient({
  communities,
  initialDeposits,
  isSuperAdmin,
}: {
  communities: Community[]
  initialDeposits: Deposit[]
  isSuperAdmin: boolean
}) {
  const [deposits, setDeposits] = useState<Deposit[]>(initialDeposits)
  const [showForm, setShowForm] = useState(false)
  const [, startTransition] = useTransition()

  // Form state
  const [communityId, setCommunityId] = useState(communities[0]?.id ?? '')
  const [type, setType] = useState<'lokata' | 'konto_oszczednosciowe'>('lokata')
  const [bankName, setBankName] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const resetForm = () => {
    setBankName(''); setDescription(''); setAmount(''); setRate('')
    setStartDate(new Date().toISOString().slice(0, 10)); setEndDate('')
    setType('lokata'); setError(null)
  }

  const handleAdd = async () => {
    setError(null)
    const amt = parseFloat(amount.replace(',', '.'))
    if (!amt || amt <= 0) return setError('Podaj kwotę')
    if (!startDate) return setError('Podaj datę założenia')

    setSaving(true)
    const res = await addDeposit({
      community_id: communityId,
      type,
      bank_name: bankName || undefined,
      description: description || undefined,
      amount: amt,
      interest_rate: rate ? parseFloat(rate.replace(',', '.')) : undefined,
      start_date: startDate,
      end_date: endDate || undefined,
    })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setShowForm(false)
    resetForm()
    // refresh — revalidatePath handles server, but we need client refresh
    window.location.reload()
  }

  const handleMature = (id: string, netInterest: number) => {
    const label = netInterest > 0
      ? `Zakończyć lokatę i zaksięgować odsetki netto ${pln(netInterest)} do funduszu eksploatacyjnego?`
      : 'Zakończyć lokatę? (brak oprocentowania — odsetki nie zostaną zaksięgowane)'
    if (!confirm(label)) return
    startTransition(async () => {
      const res = await matureDeposit(id)
      if (res.error) { alert(`Błąd: ${res.error}`); return }
      setDeposits(d => d.map(x => x.id === id ? { ...x, status: 'closed' } : x))
      if (res.netInterest && res.netInterest > 0) {
        setSuccessMsg(`✅ Lokata zakończona. Odsetki netto ${pln(res.netInterest)} zostały dodane do Przychodów.`)
      } else {
        setSuccessMsg('✅ Lokata zakończona.')
      }
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Usunąć lokatę? Ta operacja nie księguje żadnych środków — użyj jej tylko jeśli wpis był błędny.')) return
    startTransition(async () => {
      const res = await deleteDeposit(id)
      if (res.error) { alert(`Błąd: ${res.error}`); return }
      setDeposits(d => d.filter(x => x.id !== id))
    })
  }

  const active = deposits.filter(d => d.status === 'active')
  const closed = deposits.filter(d => d.status === 'closed')
  const totalActive = active.reduce((s, d) => s + d.amount, 0)

  const commMap = Object.fromEntries(communities.map(c => [c.id, c.name]))

  const typeLabel = { lokata: '🏦 Lokata', konto_oszczednosciowe: '💳 Konto oszczędnościowe' }

  return (
    <div className="space-y-6">

      {/* Podsumowanie */}
      {active.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-4">
            <p className="text-xs text-[#b45309] mb-1">Środki zablokowane</p>
            <p className="text-2xl font-bold text-amber-400 tabular-nums">{pln(totalActive)}</p>
            <p className="text-xs text-[#a16207] mt-1">{active.length} aktywna(-ych)</p>
          </div>
          {active.map(d => {
            const days = daysLeft(d.end_date)
            const urgent = days !== null && days <= 30 && days >= 0
            const expired = days !== null && days < 0
            return (
              <div key={d.id} className={`rounded-xl p-4 border ${expired ? 'bg-red-950/20 border-red-900/40' : urgent ? 'bg-yellow-950/20 border-yellow-800/40' : 'bg-[#1e1409] border-[#33200d]'}`}>
                <p className="text-xs font-medium text-[#fde68a] truncate">{d.bank_name ?? typeLabel[d.type]}</p>
                <p className="text-lg font-bold text-[#fef9ee] tabular-nums mt-1">{pln(d.amount)}</p>
                {d.interest_rate && <p className="text-xs text-amber-500 mt-0.5">{d.interest_rate}% / rok</p>}
                {d.end_date && (
                  <p className={`text-xs mt-0.5 ${expired ? 'text-red-400 font-semibold' : urgent ? 'text-yellow-400' : 'text-[#a16207]'}`}>
                    {expired ? '⚠️ Termin minął!' : days === 0 ? '⚠️ Dziś upływa termin' : `📅 ${days} dni do terminu`}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Komunikat sukcesu */}
      {successMsg && (
        <div className="bg-green-950/20 border border-green-900/40 text-green-400 text-sm rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-green-600 hover:text-green-400 flex-shrink-0">✕</button>
        </div>
      )}

      {/* Lista aktywnych */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-[#a16207] uppercase tracking-widest">Aktywne lokaty i konta</h3>
          <button
            onClick={() => { setShowForm(v => !v); if (showForm) resetForm() }}
            className="flex items-center gap-1.5 text-sm font-semibold text-amber-500 hover:text-amber-400 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showForm ? 'M6 18L18 6M6 6l12 12' : 'M12 4v16m8-8H4'} />
            </svg>
            {showForm ? 'Anuluj' : 'Dodaj'}
          </button>
        </div>

        {/* Formularz */}
        {showForm && (
          <div className="bg-[#1e1409] border border-amber-800/40 rounded-xl p-5 mb-4 space-y-4">
            <h4 className="text-sm font-semibold text-[#fef9ee]">Nowa lokata / konto oszczędnościowe</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isSuperAdmin && communities.length > 1 && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#b45309] mb-1.5 uppercase tracking-wide">Wspólnota</label>
                  <select value={communityId} onChange={e => setCommunityId(e.target.value)} className="input w-full">
                    {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#b45309] mb-1.5 uppercase tracking-wide">Typ</label>
                <select value={type} onChange={e => setType(e.target.value as any)} className="input w-full">
                  <option value="lokata">🏦 Lokata terminowa</option>
                  <option value="konto_oszczednosciowe">💳 Konto oszczędnościowe</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#b45309] mb-1.5 uppercase tracking-wide">Bank</label>
                <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="np. PKO BP, Santander…" className="input w-full" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#b45309] mb-1.5 uppercase tracking-wide">Kwota (zł) *</label>
                <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="np. 50000" type="number" min="0" step="0.01" className="input w-full" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#b45309] mb-1.5 uppercase tracking-wide">Oprocentowanie (% / rok)</label>
                <input value={rate} onChange={e => setRate(e.target.value)} placeholder="np. 5.5" type="number" min="0" step="0.01" className="input w-full" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#b45309] mb-1.5 uppercase tracking-wide">Data założenia *</label>
                <input value={startDate} onChange={e => setStartDate(e.target.value)} type="date" className="input w-full" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#b45309] mb-1.5 uppercase tracking-wide">Termin (data zakończenia)</label>
                <input value={endDate} onChange={e => setEndDate(e.target.value)} type="date" className="input w-full" placeholder="Zostaw puste dla konta bez terminu" />
                <p className="text-xs text-[#3d2008] mt-1">Zostaw puste dla konta bez określonego terminu</p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#b45309] mb-1.5 uppercase tracking-wide">Opis / notatka</label>
                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="np. Lokata 6-miesięczna, nr rachunku…" className="input w-full" />
              </div>
            </div>

            {/* Kalkulator Belki — live */}
            {(() => {
              const amt = parseFloat(amount.replace(',', '.'))
              const r = parseFloat(rate.replace(',', '.'))
              const calc = amt > 0 && r > 0 ? calcInterest(amt, r, startDate, endDate || null) : null
              if (!calc) return null
              return (
                <div className="bg-[#18110a] border border-[#33200d] rounded-xl p-4">
                  <p className="text-xs font-semibold text-[#b45309] uppercase tracking-wide mb-3">
                    📊 Szacowany przychód{calc.days !== 365 ? ` (${calc.days} dni)` : ' (1 rok)'}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-[10px] text-[#a16207] mb-1">Odsetki brutto</p>
                      <p className="text-base font-bold text-[#fde68a] tabular-nums">{pln(calc.gross)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-[#a16207] mb-1">Podatek Belki (19%)</p>
                      <p className="text-base font-bold text-red-400 tabular-nums">−{pln(calc.tax)}</p>
                    </div>
                    <div className="text-center bg-green-950/20 border border-green-900/30 rounded-lg py-1.5">
                      <p className="text-[10px] text-green-600 mb-1">Zysk netto</p>
                      <p className="text-base font-bold text-green-400 tabular-nums">+{pln(calc.net)}</p>
                    </div>
                  </div>
                  {!endDate && (
                    <p className="text-[10px] text-[#3d2008] mt-2">* Wyliczenie dla 1 roku. Ustaw datę zakończenia, aby zobaczyć dokładną kwotę.</p>
                  )}
                </div>
              )
            })()}

            {error && <p className="text-sm text-red-400 bg-red-950/20 border border-red-900/40 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex justify-end">
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-40"
              >
                {saving ? 'Zapisuję…' : 'Dodaj lokatę'}
              </button>
            </div>
          </div>
        )}

        {active.length === 0 && !showForm ? (
          <div className="bg-[#1e1409] border border-dashed border-[#33200d] rounded-xl p-8 text-center">
            <p className="text-4xl mb-3">🏦</p>
            <p className="text-sm text-[#b45309]">Brak aktywnych lokat ani kont oszczędnościowych.</p>
            <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-amber-500 hover:underline">
              + Dodaj pierwszą lokatę
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map(d => <DepositRow key={d.id} d={d} commMap={commMap} isSuperAdmin={isSuperAdmin} onMature={handleMature} onDelete={handleDelete} showComm={isSuperAdmin && communities.length > 1} />)}
          </div>
        )}
      </div>

      {/* Zamknięte */}
      {closed.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[#a16207] uppercase tracking-widest mb-3">Zakończone</h3>
          <div className="space-y-2 opacity-60">
            {closed.map(d => <DepositRow key={d.id} d={d} commMap={commMap} isSuperAdmin={isSuperAdmin} onMature={() => {}} onDelete={handleDelete} showComm={isSuperAdmin && communities.length > 1} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function DepositRow({
  d, commMap, isSuperAdmin, onMature, onDelete, showComm
}: {
  d: Deposit
  commMap: Record<string, string>
  isSuperAdmin: boolean
  onMature: (id: string, netInterest: number) => void
  onDelete: (id: string) => void
  showComm: boolean
}) {
  const days = daysLeft(d.end_date)
  const expired = days !== null && days < 0
  const urgent = days !== null && days <= 30 && days >= 0
  const typeLabel: Record<string, string> = { lokata: '🏦 Lokata', konto_oszczednościowe: '💳 Konto oszcz.' }
  const calc = d.interest_rate ? calcInterest(d.amount, d.interest_rate, d.start_date, d.end_date) : null

  return (
    <div className={`bg-[#1e1409] border rounded-xl px-4 py-3.5 ${expired ? 'border-red-900/50' : urgent ? 'border-yellow-800/50' : 'border-[#33200d]'}`}>
      <div className="flex items-start gap-4">
        <div className="text-2xl flex-shrink-0 mt-0.5">{d.type === 'lokata' ? '🏦' : '💳'}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[#fef9ee]">
                {d.bank_name || typeLabel[d.type]}
                {d.status === 'closed' && <span className="ml-2 text-xs text-[#a16207] font-normal">(zakończona)</span>}
              </p>
              {d.description && <p className="text-xs text-[#b45309] mt-0.5 truncate">{d.description}</p>}
              {showComm && <p className="text-xs text-[#3d2008] mt-0.5">{commMap[d.community_id] ?? '—'}</p>}
            </div>
            <p className="text-base font-bold text-amber-400 tabular-nums flex-shrink-0">{pln(d.amount)}</p>
          </div>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {d.interest_rate != null && (
              <span className="text-xs text-amber-500 font-semibold">{d.interest_rate}% / rok</span>
            )}
            <span className="text-xs text-[#a16207]">od {new Date(d.start_date).toLocaleDateString('pl-PL')}</span>
            {d.end_date && (
              <span className={`text-xs font-medium ${expired ? 'text-red-400' : urgent ? 'text-yellow-400' : 'text-[#b45309]'}`}>
                {expired ? '⚠️ termin minął' : `do ${new Date(d.end_date).toLocaleDateString('pl-PL')}${days !== null ? ` (${days} dni)` : ''}`}
              </span>
            )}
          </div>

          {calc && (
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[#271a0c] flex-wrap">
              <span className="text-[10px] text-[#a16207]">
                brutto <span className="text-[#fde68a] font-semibold">{pln(calc.gross)}</span>
              </span>
              <span className="text-[10px] text-[#3d2008]">−</span>
              <span className="text-[10px] text-[#a16207]">
                Belka <span className="text-red-400 font-semibold">{pln(calc.tax)}</span>
              </span>
              <span className="text-[10px] text-[#3d2008]">=</span>
              <span className="text-xs font-bold text-green-400">netto +{pln(calc.net)}</span>
              {!d.end_date && <span className="text-[10px] text-[#33200d]">(szac. za 1 rok)</span>}
            </div>
          )}
        </div>
      </div>

      {/* Przyciski akcji */}
      {d.status === 'active' && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#271a0c]">
          {/* Zakończ i zaksięguj */}
          <button
            onClick={() => onMature(d.id, calc?.net ?? 0)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-950/30 border border-green-900/40 text-green-400 hover:bg-green-950/50 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Zakończ i zaksięguj{calc && calc.net > 0 ? ` (+${pln(calc.net)})` : ''}
          </button>

          {/* Usuń — błędny wpis */}
          <button
            onClick={() => onDelete(d.id)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-[#a16207] hover:text-red-400 hover:bg-red-950/20 border border-transparent hover:border-red-900/30 transition"
            title="Usuń bez księgowania (błędny wpis)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Usuń (błędny wpis)
          </button>
        </div>
      )}
    </div>
  )
}

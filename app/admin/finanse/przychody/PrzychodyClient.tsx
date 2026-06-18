'use client'
import BackButton from '@/components/BackButton'

import { useState, useTransition, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { addIncome, updateIncome, deleteIncome } from './actions'
import type { IncomeCategory } from './income-categories'
import { exportToExcel } from '@/lib/exportExcel'
import Pagination from '@/components/Pagination'

interface IncomeEntry {
  id: string; community_id: string; category: string; description: string
  amount: number; income_date: string; year: number; month: number; created_at: string
}
interface Props {
  incomeEntries: IncomeEntry[]
  settlementsMap: Record<string, Record<string, number>>
  communities: { id: string; name: string }[]
  commMap: Record<string, string>
  isSuperAdmin: boolean
  defaultCommunityId: string
  categories: { value: IncomeCategory; label: string }[]
  currentYear: number
}

const pln = (v: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(v)
const MONTHS = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru']

export default function PrzychodyClient({ incomeEntries, settlementsMap, communities, commMap, isSuperAdmin, defaultCommunityId, categories, currentYear }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const [filterComm, setFilterComm] = useState(isSuperAdmin ? '' : defaultCommunityId)
  const [filterYear, setFilterYear] = useState(currentYear)
  const [filterMonth, setFilterMonth] = useState(0)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'list' | 'summary'>('list')

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ community_id: isSuperAdmin ? '' : defaultCommunityId, category: 'inne' as IncomeCategory, description: '', amount: '', income_date: new Date().toISOString().slice(0,10) })
  const [formError, setFormError] = useState<string | null>(null)

  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ category: IncomeCategory; description: string; amount: string; income_date: string }>({ category: 'inne', description: '', amount: '', income_date: '' })
  const [editError, setEditError] = useState<string | null>(null)

  const [csvDragOver, setCsvDragOver] = useState(false)
  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const [importComm, setImportComm] = useState(isSuperAdmin ? '' : defaultCommunityId)
  const [listPage, setListPage] = useState(1)
  const LIST_PAGE_SIZE = 50

  const handleCsvFile = useCallback((file: File) => {
    setCsvFileName(file.name); setImportResult(null)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      const startIdx = lines[0]?.toLowerCase().startsWith('lokal') || lines[0]?.toLowerCase().startsWith('data') ? 1 : 0
      let imported = 0
      const errors: string[] = []
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(/[;,]/).map(p => p.trim().replace(/^"|"$/g, ''))
        const [dateStr, descStr, catStr, amtStr] = parts
        if (!dateStr || !amtStr) continue
        const amt = parseFloat(amtStr.replace(',', '.'))
        if (isNaN(amt) || amt <= 0) { errors.push(`Wiersz ${i+1}: nieprawidłowa kwota`); continue }
        const validCats = categories.map(c => c.value)
        const cat = (validCats.includes(catStr as IncomeCategory) ? catStr : 'inne') as IncomeCategory
        startTransition(async () => {
          const res = await addIncome({ community_id: importComm, category: cat, description: descStr || 'Import CSV', amount: amt, income_date: dateStr })
          if (!res.error) imported++
          else errors.push(`Wiersz ${i+1}: ${res.error}`)
        })
      }
      setTimeout(() => {
        setImportResult({ imported, errors }); setCsvFileName(null)
        if (imported > 0) router.refresh()
      }, 800)
    }
    reader.readAsText(file, 'utf-8')
  }, [importComm, router, startTransition, categories])

  const filtered = incomeEntries.filter(e => {
    if (filterComm && e.community_id !== filterComm) return false
    if (e.year !== filterYear) return false
    if (filterMonth && e.month !== filterMonth) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const matchDesc = e.description.toLowerCase().includes(q)
      const matchAmt = String(e.amount).replace('.', ',').includes(q) || String(e.amount).includes(q)
      if (!matchDesc && !matchAmt) return false
    }
    return true
  })

  // Łącz wpłaty mieszkańców + przychody ogólne (community_income)
  const monthlySettlements: Record<number, number> = {}
  const monthlyOther: Record<number, number> = {}
  for (let m = 1; m <= 12; m++) {
    const commIds = filterComm ? [filterComm] : communities.map(c => c.id)
    monthlySettlements[m] = commIds.reduce((s, cid) => s + (settlementsMap[cid]?.[`${filterYear}:${m}`] ?? 0), 0)
    monthlyOther[m] = filtered.filter(e => e.month === m).reduce((s, e) => s + e.amount, 0)
  }
  const totalSettlements = Object.values(monthlySettlements).reduce((s, v) => s + v, 0)
  const totalOther = filtered.reduce((s, e) => s + e.amount, 0)
  const totalAll = totalSettlements + totalOther
  const maxBar = Math.max(...Object.values(monthlySettlements).map((v,i) => v + (monthlyOther[i+1] ?? 0)), 1)

  const listTotalPages = Math.ceil(filtered.length / LIST_PAGE_SIZE)
  const paginatedList = filtered.slice((listPage - 1) * LIST_PAGE_SIZE, listPage * LIST_PAGE_SIZE)

  const catLabel = (cat: string) => categories.find(c => c.value === cat)?.label ?? cat
  const catColors: Record<string, string> = { odsetki:'bg-yellow-950/40 text-yellow-400', zwrot:'bg-teal-950/40 text-teal-400', dotacja:'bg-teal-950/40 text-teal-400', inne:'bg-[#0c2220] text-[#0f766e]' }

  const handleExportExcel = () => {
    const rows = filtered.map(e => ({
      'Data': e.income_date,
      'Opis': e.description,
      'Kategoria': catLabel(e.category),
      'Kwota (zł)': e.amount,
      ...(isSuperAdmin ? { 'Wspólnota': commMap[e.community_id] ?? '' } : {}),
    }))
    exportToExcel(rows, `przychody_${filterYear}`)
  }

  const handleAdd = () => {
    if (!form.description.trim()) { setFormError('Opis jest wymagany'); return }
    const amt = parseFloat(form.amount.replace(',', '.'))
    if (isNaN(amt) || amt <= 0) { setFormError('Podaj kwotę większą od 0'); return }
    setFormError(null)
    startTransition(async () => {
      const res = await addIncome({ ...form, amount: amt })
      if (res.error) { setFormError(res.error); return }
      setShowForm(false); setForm(p => ({ ...p, description: '', amount: '' })); router.refresh()
    })
  }
  const handleUpdate = () => {
    if (!editId) return
    const amt = parseFloat(editForm.amount.replace(',', '.'))
    if (!editForm.description.trim()) { setEditError('Opis jest wymagany'); return }
    if (isNaN(amt) || amt <= 0) { setEditError('Podaj kwotę większą od 0'); return }
    setEditError(null)
    startTransition(async () => {
      const res = await updateIncome(editId, { ...editForm, amount: amt })
      if (res.error) { setEditError(res.error); return }
      setEditId(null); router.refresh()
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Usunąć ten przychód?')) return
    startTransition(async () => { await deleteIncome(id); router.refresh() })
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <BackButton />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#f0fdfa]">💰 Przychody wspólnoty</h2>
          <p className="text-sm text-[#115e59] mt-0.5">Odsetki od lokat, zwroty, dotacje i inne dochody</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportExcel} disabled={filtered.length === 0} className="bg-[#0c2220] hover:bg-[#0a1f1d] text-[#ccfbf1] text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-40" title="Eksportuj do Excela">📊 Eksport Excel</button>
          <button onClick={() => setShowForm(!showForm)} className="bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">+ Dodaj przychód</button>
        </div>
      </div>

      {showForm && (
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-[#ccfbf1]">Nowy przychód</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isSuperAdmin && <div><label className="text-xs text-[#0f766e] block mb-1">Wspólnota *</label><select className="input w-full" value={form.community_id} onChange={e=>setForm(p=>({...p,community_id:e.target.value}))}><option value="">— wybierz wspólnotę —</option>{communities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
            <div><label className="text-xs text-[#0f766e] block mb-1">Kategoria *</label><select className="input w-full" value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value as IncomeCategory}))}>{categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
            <div className="sm:col-span-2"><label className="text-xs text-[#0f766e] block mb-1">Opis *</label><input className="input w-full" placeholder="np. Odsetki od lokaty bankowej" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} /></div>
            <div><label className="text-xs text-[#0f766e] block mb-1">Kwota (zł) *</label><input className="input w-full" type="number" step="0.01" min="0" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} /></div>
            <div><label className="text-xs text-[#0f766e] block mb-1">Data *</label><input className="input w-full" type="date" value={form.income_date} onChange={e=>setForm(p=>({...p,income_date:e.target.value}))} /></div>
          </div>
          {formError && <p className="text-sm text-red-400">{formError}</p>}
          <div className="flex gap-3">
            <button onClick={handleAdd} disabled={isPending} className="bg-teal-700 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50">{isPending ? 'Zapisuję...' : 'Dodaj przychód'}</button>
            <button onClick={() => setShowForm(false)} className="text-sm text-[#115e59] hover:text-[#99f6e4]">Anuluj</button>
          </div>
        </div>
      )}

      {/* Import CSV */}
      <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4 space-y-3">
        <div><p className="text-sm font-semibold text-[#99f6e4]">📥 Import przychodów z CSV</p><p className="text-xs text-[#115e59] mt-0.5">Format: <code className="text-[#0f766e]">data;opis;kategoria;kwota</code> (kategorie: odsetki, zwrot, dotacja, inne)</p></div>
        {isSuperAdmin && <select className="input text-sm w-full sm:w-auto" value={importComm} onChange={e=>setImportComm(e.target.value)}><option value="">— wybierz wspólnotę —</option>{communities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        <div onDragOver={e=>{e.preventDefault();setCsvDragOver(true)}} onDragLeave={()=>setCsvDragOver(false)} onDrop={e=>{e.preventDefault();setCsvDragOver(false);const f=e.dataTransfer.files[0];if(f)handleCsvFile(f)}} onClick={()=>fileRef.current?.click()} className={`cursor-pointer rounded-xl border-2 border-dashed transition-all py-8 px-4 text-center select-none ${csvDragOver?'border-green-500 bg-teal-950/20':csvFileName?'border-green-700 bg-teal-950/20':'border-[#0f2d2a] bg-[#0c2220]/30 hover:border-[#133835]'}`}>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handleCsvFile(f);if(fileRef.current)fileRef.current.value=''}} />
          <div className="text-3xl mb-2">{isPending?'⏳':csvFileName?'✅':'📂'}</div>
          {isPending?<p className="text-sm text-[#0f766e]">Importowanie...</p>:csvFileName?<p className="text-sm font-medium text-teal-400">{csvFileName}</p>:<><p className="text-sm font-medium text-[#99f6e4]">Przeciągnij plik CSV tutaj</p><p className="text-xs text-[#115e59] mt-1">lub kliknij żeby wybrać z dysku</p></>}
        </div>
        <a href={`data:text/plain;charset=utf-8,${encodeURIComponent('data;opis;kategoria;kwota\n2026-01-15;Odsetki od lokaty PKO BP;odsetki;376.88\n2026-03-15;Odsetki od lokaty PKO BP;odsetki;423.45')}`} download="szablon_przychodow.csv" className="text-xs text-teal-400 hover:text-teal-300 underline">Pobierz szablon</a>
        {importResult && <div className={`text-sm rounded-lg p-3 ${importResult.imported>0?'bg-teal-950/30 border border-teal-700 text-teal-400':'bg-red-950/30 border border-red-800 text-red-400'}`}>{importResult.imported>0&&<p className="font-semibold">✓ Zaimportowano {importResult.imported} wpisów.</p>}{importResult.errors.map((err,i)=><p key={i} className="text-xs mt-1">⚠ {err}</p>)}</div>}
      </div>

      {/* Filtry + tabs */}
      <div className="flex flex-wrap gap-3 items-center">
        {isSuperAdmin && <select className="input text-sm" value={filterComm} onChange={e=>setFilterComm(e.target.value)}><option value="">Wszystkie wspólnoty</option>{communities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        <select className="input text-sm" value={filterYear} onChange={e=>setFilterYear(Number(e.target.value))}><option value={currentYear}>{currentYear}</option><option value={currentYear-1}>{currentYear-1}</option><option value={currentYear-2}>{currentYear-2}</option></select>
        <select className="input text-sm" value={filterMonth} onChange={e=>setFilterMonth(Number(e.target.value))}>
          <option value={0}>Wszystkie miesiące</option>
          {MONTHS.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#115e59] text-sm">🔍</span>
          <input
            className="input w-full pl-8 text-sm"
            placeholder="Szukaj opisu, kwoty…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#115e59] hover:text-[#99f6e4] text-xs">✕</button>}
        </div>
        <div className="flex gap-1 bg-[#081918] rounded-lg p-1">
          {(['list','summary'] as const).map(t=><button key={t} onClick={()=>setTab(t)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${tab===t?'bg-[#0c2220] text-[#f0fdfa]':'text-[#115e59] hover:text-[#99f6e4]'}`}>{t==='list'?'📋 Lista':'📊 Podsumowanie'}</button>)}
        </div>
      </div>

      {tab==='summary'?(
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4 text-center"><p className="text-xs text-[#115e59] mb-1">Wpłaty mieszkańców</p><p className="text-2xl font-bold text-teal-400">{pln(totalSettlements)}</p></div>
            <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4 text-center"><p className="text-xs text-[#115e59] mb-1">Inne przychody</p><p className="text-2xl font-bold text-yellow-400">{pln(totalOther)}</p></div>
            <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4 text-center"><p className="text-xs text-[#115e59] mb-1">Razem przychody</p><p className="text-2xl font-bold text-teal-400">{pln(totalAll)}</p></div>
          </div>

          <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#0f766e] mb-1">Przychody miesięcznie — {filterYear}</h3>
            <div className="flex gap-4 text-xs text-[#115e59] mb-4">
              <span><span className="inline-block w-3 h-3 rounded-sm bg-teal-600/60 mr-1"/>Wpłaty mieszkańców</span>
              <span><span className="inline-block w-3 h-3 rounded-sm bg-yellow-500/60 mr-1"/>Inne przychody</span>
            </div>
            <div className="flex items-end gap-1 h-32">
              {MONTHS.map((name,idx)=>{const m=idx+1;const sett=monthlySettlements[m]??0;const oth=monthlyOther[m]??0;const tot=sett+oth;const hS=Math.max(oth>0?2:0,Math.round((sett/maxBar)*120));const hO=Math.max(oth>0?2:0,Math.round((oth/maxBar)*120));return(<div key={m} className="flex-1 flex flex-col items-center gap-0.5"><div className="flex flex-col justify-end w-full" style={{height:120}}><div title={`Inne: ${pln(oth)}`} style={{height:hO}} className="bg-yellow-500/60 rounded-t-sm"/><div title={`Wpłaty: ${pln(sett)}`} style={{height:hS}} className="bg-teal-600/60"/></div><span className="text-xs text-[#115e59]">{name}</span></div>)})}
            </div>
          </div>

          {filtered.length > 0 && (
            <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#0f766e] mb-4">Inne przychody według kategorii</h3>
              {(() => {
                const byCat: Record<string, number> = {}
                for (const e of filtered) byCat[e.category] = (byCat[e.category] ?? 0) + e.amount
                return Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>{
                  const pct = totalOther > 0 ? Math.round(amt/totalOther*100) : 0
                  return (<div key={cat} className="flex items-center gap-3 mb-3"><span className={`text-xs px-2 py-0.5 rounded-full w-32 text-center flex-shrink-0 ${catColors[cat]??catColors.inne}`}>{catLabel(cat)}</span><div className="flex-1 bg-[#0c2220] rounded-full h-2"><div className="bg-yellow-500 h-2 rounded-full" style={{width:`${pct}%`}}/></div><span className="text-sm font-semibold text-[#ccfbf1] w-28 text-right">{pln(amt)}</span></div>)
                })
              })()}
            </div>
          )}
        </div>
      ):(
        <div>
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-[#115e59]"><p className="text-3xl mb-3">💰</p><p>Brak przychodów za {filterYear} rok.</p><button onClick={() => setShowForm(true)} className="mt-4 text-sm text-teal-400 hover:underline">+ Dodaj pierwszy przychód</button></div>
          ) : (
            <div className="space-y-2">
              {paginatedList.map(e => editId === e.id ? (
                <div key={e.id} className="bg-[#081918] border border-teal-700 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <select className="input text-sm" value={editForm.category} onChange={x => setEditForm(p => ({ ...p, category: x.target.value as IncomeCategory }))}>
                      {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <input className="input text-sm sm:col-span-2" placeholder="Opis" value={editForm.description} onChange={x => setEditForm(p => ({ ...p, description: x.target.value }))} />
                    <input className="input text-sm" type="number" step="0.01" placeholder="Kwota" value={editForm.amount} onChange={x => setEditForm(p => ({ ...p, amount: x.target.value }))} />
                    <input className="input text-sm" type="date" value={editForm.income_date} onChange={x => setEditForm(p => ({ ...p, income_date: x.target.value }))} />
                  </div>
                  {editError && <p className="text-xs text-red-400">{editError}</p>}
                  <div className="flex gap-2">
                    <button onClick={handleUpdate} disabled={isPending} className="bg-teal-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50">{isPending ? 'Zapisuję...' : 'Zapisz'}</button>
                    <button onClick={() => setEditId(null)} className="text-xs text-[#115e59] hover:text-[#99f6e4]">Anuluj</button>
                  </div>
                </div>
              ) : (
                <div key={e.id} className="bg-[#081918] border border-[#0f2d2a] rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap hover:border-[#0f2d2a] transition">
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${catColors[e.category] ?? catColors.inne}`}>{catLabel(e.category)}</span>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-[#ccfbf1] truncate">{e.description}</p><p className="text-xs text-[#115e59] mt-0.5">{new Date(e.income_date).toLocaleDateString('pl-PL')}{isSuperAdmin && ` · ${commMap[e.community_id] ?? '—'}`}</p></div>
                  <p className="text-sm font-bold text-teal-400 flex-shrink-0">{pln(e.amount)}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => { setEditId(e.id); setEditForm({ category: e.category as IncomeCategory, description: e.description, amount: String(e.amount), income_date: e.income_date }); setEditError(null) }} className="text-xs text-teal-500 hover:underline">Edytuj</button>
                    <button onClick={() => handleDelete(e.id)} disabled={isPending} className="text-xs text-[#115e59] hover:text-red-400 transition">✕</button>
                  </div>
                </div>
              ))}
              {listTotalPages > 1 && <Pagination page={listPage} totalPages={listTotalPages} onPageChange={setListPage} />}
              <div className="mt-4 pt-4 border-t border-[#0f2d2a] flex justify-between items-center"><p className="text-sm text-[#115e59]">{filtered.length} pozycji</p><p className="text-base font-bold text-teal-400">Razem: {pln(totalOther)}</p></div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

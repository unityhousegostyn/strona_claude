'use client'
import BackButton from '@/components/BackButton'

import { useState, useTransition, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { addExpense, updateExpense, deleteExpense, importExpensesCSV, bulkUpdateCategory } from './actions'
import type { ExpenseCategory } from './categories'
import { exportToExcel } from '@/lib/exportExcel'
import Pagination from '@/components/Pagination'

interface Expense {
  id: string; community_id: string; category: string; description: string
  amount: number; expense_date: string; year: number; month: number
  invoice_number: string | null; created_at: string
}
interface Props {
  expenses: Expense[]
  communities: { id: string; name: string }[]
  commMap: Record<string, string>
  incomeMap: Record<string, Record<string, number>>
  isSuperAdmin: boolean
  defaultCommunityId: string
  categories: { value: ExpenseCategory; label: string }[]
  currentYear: number
}

const pln = (v: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(v)
const MONTHS = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru']

export default function KosztyClient({ expenses, communities, commMap, incomeMap, isSuperAdmin, defaultCommunityId, categories, currentYear }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const [filterComm, setFilterComm] = useState(isSuperAdmin ? '' : defaultCommunityId)
  const [filterYear, setFilterYear] = useState(currentYear)
  const [filterMonth, setFilterMonth] = useState(0)
  const [filterCat, setFilterCat] = useState('')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'list' | 'summary'>('list')

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ community_id: isSuperAdmin ? '' : defaultCommunityId, category: 'inne' as ExpenseCategory, description: '', amount: '', expense_date: new Date().toISOString().slice(0,10), invoice_number: '', is_renovation_fund: false })
  const [formError, setFormError] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ category: ExpenseCategory; description: string; amount: string; expense_date: string; invoice_number: string; is_renovation_fund: boolean }>({ category: 'inne', description: '', amount: '', expense_date: '', invoice_number: '', is_renovation_fund: false })
  const [editError, setEditError] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCat, setBulkCat] = useState<ExpenseCategory>('remonty')
  const [bulkResult, setBulkResult] = useState<string | null>(null)

  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const [importComm, setImportComm] = useState(isSuperAdmin ? '' : defaultCommunityId)
  const [csvDragOver, setCsvDragOver] = useState(false)
  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [listPage, setListPage] = useState(1)
  const LIST_PAGE_SIZE = 50

  const handleFile = useCallback((file: File) => {
    setCsvFileName(file.name); setImportResult(null)
    const reader = new FileReader()
    reader.onload = ev => {
      const buf = ev.target?.result as ArrayBuffer
      // Próbuj UTF-8 (fatal=true rzuca błąd przy złych bajtach); fallback na Windows-1250
      let text: string
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buf)
      } catch {
        text = new TextDecoder('windows-1250').decode(buf)
      }
      // Jeśli UTF-8 przeszedł ale zawiera znaki zastępcze — plik był w windows-1250
      if (text.includes('�')) {
        text = new TextDecoder('windows-1250').decode(buf)
      }
      startTransition(async () => {
        try {
          const res = await importExpensesCSV(importComm, text)
          setImportResult(res); setCsvFileName(null)
          if (res.imported > 0) router.refresh()
        } catch (err: any) {
          setImportResult({ imported: 0, errors: [err?.message ?? 'Nieznany błąd'] }); setCsvFileName(null)
        }
      })
    }
    reader.readAsArrayBuffer(file)
  }, [importComm, startTransition, router])

  const filtered = expenses.filter(e => {
    if (filterComm && e.community_id !== filterComm) return false
    if (e.year !== filterYear) return false
    if (filterMonth && e.month !== filterMonth) return false
    if (filterCat && e.category !== filterCat) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const matchDesc = e.description.toLowerCase().includes(q)
      const matchAmt = String(e.amount).replace('.', ',').includes(q) || String(e.amount).includes(q)
      const matchInv = e.invoice_number?.toLowerCase().includes(q)
      if (!matchDesc && !matchAmt && !matchInv) return false
    }
    return true
  })

  const monthlyExpenses: Record<number, number> = {}
  const monthlyIncome: Record<number, number> = {}
  for (let m = 1; m <= 12; m++) {
    monthlyExpenses[m] = filtered.filter(e => e.month === m).reduce((s, e) => s + e.amount, 0)
    const commIds = filterComm ? [filterComm] : communities.map(c => c.id)
    monthlyIncome[m] = commIds.reduce((s, cid) => s + (incomeMap[cid]?.[`${filterYear}:${m}`] ?? 0), 0)
  }
  const totalExpenses = filtered.reduce((s, e) => s + e.amount, 0)
  const totalIncome = Object.values(monthlyIncome).reduce((s, v) => s + v, 0)
  const byCat: Record<string, number> = {}
  for (const e of filtered) byCat[e.category] = (byCat[e.category] ?? 0) + e.amount

  const listTotalPages = Math.ceil(filtered.length / LIST_PAGE_SIZE)
  const paginatedList = filtered.slice((listPage - 1) * LIST_PAGE_SIZE, listPage * LIST_PAGE_SIZE)

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const toggleAll = () => setSelectedIds(prev =>
    prev.size === filtered.length ? new Set() : new Set(filtered.map(e => e.id))
  )
  const handleBulkCategory = () => {
    if (!selectedIds.size) return
    setBulkResult(null)
    startTransition(async () => {
      const res = await bulkUpdateCategory(Array.from(selectedIds), bulkCat)
      if (res.error) { setBulkResult('❌ ' + res.error); return }
      setBulkResult(`✓ Zmieniono kategorię dla ${res.updated} wpisów`)
      setSelectedIds(new Set())
      router.refresh()
    })
  }

  const handleAdd = () => {
    setFormError(null)
    startTransition(async () => {
      const res = await addExpense({ ...form, amount: parseFloat(form.amount.replace(',', '.')), is_renovation_fund: form.is_renovation_fund || form.category === 'fundusz_remontowy' })
      if (res.error) { setFormError(res.error); return }
      setShowForm(false); setForm(p => ({ ...p, description: '', amount: '', invoice_number: '', is_renovation_fund: false })); router.refresh()
    })
  }
  const handleUpdate = () => {
    if (!editId || !editForm.description || !editForm.amount || !editForm.expense_date) return
    setEditError(null)
    startTransition(async () => {
      const res = await updateExpense(editId, { category: editForm.category, description: editForm.description!, amount: parseFloat(String(editForm.amount).replace(',', '.')), expense_date: editForm.expense_date!, invoice_number: editForm.invoice_number, is_renovation_fund: editForm.is_renovation_fund || editForm.category === 'fundusz_remontowy' })
      if (res.error) { setEditError(res.error); return }
      setEditId(null); router.refresh()
    })
  }
  const handleDelete = (id: string) => {
    if (!confirm('Usunąć ten koszt?')) return
    startTransition(async () => { await deleteExpense(id); router.refresh() })
  }

  const handleExportExcel = () => {
    const rows = filtered.map(e => ({
      'Data': e.expense_date,
      'Opis': e.description,
      'Kategoria': catLabel(e.category),
      'Kwota (zł)': e.amount,
      'Nr faktury': e.invoice_number ?? '',
      ...(isSuperAdmin ? { 'Wspólnota': commMap[e.community_id] ?? '' } : {}),
    }))
    exportToExcel(rows, `koszty_${filterYear}`)
  }

  const catLabel = (cat: string) => categories.find(c => c.value === cat)?.label ?? cat
  const catColors: Record<string, string> = {
    fundusz_remontowy:      'bg-orange-950/40 text-orange-400',
    fundusz_eksploatacyjny: 'bg-teal-950/40 text-teal-400',
    wynagrodzenie_zarządcy: 'bg-purple-950/40 text-purple-400',
    koszty_administracji:   'bg-sky-950/40 text-sky-400',
    woda:                   'bg-cyan-950/40 text-cyan-400',
    śmieci:                 'bg-lime-950/40 text-lime-400',
    sprzątanie:             'bg-emerald-950/40 text-emerald-400',
    opłaty_bankowe:         'bg-slate-950/40 text-slate-400',
    remonty:                'bg-red-950/40 text-red-400',
    ubezpieczenie:          'bg-indigo-950/40 text-indigo-400',
    energia:                'bg-yellow-950/40 text-yellow-400',
    zarząd:                 'bg-teal-950/40 text-teal-300',
    inne:                   'bg-[#0c2220] text-[#0f766e]',
  }
  const maxBar = Math.max(...Object.values(monthlyExpenses), ...Object.values(monthlyIncome), 1)

  return (
    <div className="space-y-6 max-w-5xl">
      <BackButton />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#f0fdfa]">💸 Koszty wspólnoty</h2>
          <p className="text-sm text-[#115e59] mt-0.5">Faktury, remonty i inne wydatki</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportExcel} disabled={filtered.length === 0} className="bg-[#0c2220] hover:bg-[#0a1f1d] text-[#ccfbf1] text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-40" title="Eksportuj do Excela">📊 Eksport Excel</button>
          <button onClick={() => setShowForm(!showForm)} className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">+ Dodaj koszt</button>
        </div>
      </div>

      {showForm && (
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-[#ccfbf1]">Nowy koszt</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isSuperAdmin && <div><label className="text-xs text-[#0f766e] block mb-1">Wspólnota *</label><select className="input w-full" value={form.community_id} onChange={e => setForm(p => ({...p, community_id: e.target.value}))}><option value="">— wybierz wspólnotę —</option>{communities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
            <div><label className="text-xs text-[#0f766e] block mb-1">Kategoria *</label><select className="input w-full" value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value as ExpenseCategory}))}>{categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
            <div className="sm:col-span-2"><label className="text-xs text-[#0f766e] block mb-1">Opis *</label><input className="input w-full" placeholder="np. Faktura ZGKIM za wodę" value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} /></div>
            <div><label className="text-xs text-[#0f766e] block mb-1">Kwota (zł) *</label><input className="input w-full" type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} /></div>
            <div><label className="text-xs text-[#0f766e] block mb-1">Data *</label><input className="input w-full" type="date" value={form.expense_date} onChange={e => setForm(p => ({...p, expense_date: e.target.value}))} /></div>
            <div><label className="text-xs text-[#0f766e] block mb-1">Nr faktury</label><input className="input w-full" placeholder="FV/123/2026" value={form.invoice_number} onChange={e => setForm(p => ({...p, invoice_number: e.target.value}))} /></div>
            <div className="sm:col-span-2 flex items-center gap-2 pt-1">
              <input type="checkbox" id="form-renov" className="w-4 h-4 accent-orange-500" checked={form.is_renovation_fund || form.category === 'fundusz_remontowy'} onChange={e => setForm(p => ({...p, is_renovation_fund: e.target.checked}))} />
              <label htmlFor="form-renov" className="text-sm text-orange-400 cursor-pointer select-none">🔨 Wydatek z funduszu remontowego (wyłączony z planu gospodarczego)</label>
            </div>
          </div>
          {formError && <p className="text-sm text-red-400">{formError}</p>}
          <div className="flex gap-3">
            <button onClick={handleAdd} disabled={isPending} className="bg-teal-600 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50">{isPending ? 'Zapisuję...' : 'Dodaj koszt'}</button>
            <button onClick={() => setShowForm(false)} className="text-sm text-[#115e59] hover:text-[#99f6e4]">Anuluj</button>
          </div>
        </div>
      )}

      {/* Import CSV */}
      <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4 space-y-3">
        <div><p className="text-sm font-semibold text-[#99f6e4]">📥 Import z pliku CSV</p><p className="text-xs text-[#115e59] mt-0.5">Format: <code className="text-[#0f766e]">data;opis;kategoria;kwota;nr_faktury</code></p></div>
        {isSuperAdmin && <select className="input text-sm w-full sm:w-auto" value={importComm} onChange={e => setImportComm(e.target.value)}><option value="">— wybierz wspólnotę —</option>{communities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        <div onDragOver={e=>{e.preventDefault();setCsvDragOver(true)}} onDragLeave={()=>setCsvDragOver(false)} onDrop={e=>{e.preventDefault();setCsvDragOver(false);const f=e.dataTransfer.files[0];if(f)handleFile(f)}} onClick={()=>fileRef.current?.click()} className={`cursor-pointer rounded-xl border-2 border-dashed transition-all py-8 px-4 text-center select-none ${csvDragOver?'border-green-500 bg-teal-950/20':csvFileName?'border-green-700 bg-teal-950/20':'border-[#0f2d2a] bg-[#0c2220]/30 hover:border-[#133835]'}`}>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);if(fileRef.current)fileRef.current.value=''}} />
          <div className="text-3xl mb-2">{isPending?'⏳':csvFileName?'✅':'📂'}</div>
          {isPending?<p className="text-sm text-[#0f766e]">Importowanie...</p>:csvFileName?<p className="text-sm font-medium text-teal-400">{csvFileName}</p>:<><p className="text-sm font-medium text-[#99f6e4]">Przeciągnij plik CSV tutaj</p><p className="text-xs text-[#115e59] mt-1">lub kliknij żeby wybrać z dysku</p></>}
        </div>
        <a href={`data:text/plain;charset=utf-8,${encodeURIComponent('data;opis;kategoria;kwota;nr_faktury\n2026-06-01;Faktura ZGKIM za wodę;woda;1250.00;FV/100/2026')}`} download="szablon_kosztow.csv" className="text-xs text-teal-400 hover:text-teal-300 underline">Pobierz szablon</a>
        {importResult && <div className={`text-sm rounded-lg p-3 ${importResult.imported>0?'bg-teal-950/30 border border-teal-700 text-teal-400':'bg-red-950/30 border border-red-800 text-red-400'}`}>{importResult.imported>0&&<p className="font-semibold">✓ Zaimportowano {importResult.imported} wpisów.</p>}{importResult.errors.map((err,i)=><p key={i} className="text-xs mt-1">⚠ {err}</p>)}</div>}
      </div>

      {/* Filtry + tabs */}
      <div className="flex flex-wrap gap-3 items-center">
        {isSuperAdmin && <select className="input text-sm" value={filterComm} onChange={e=>setFilterComm(e.target.value)}><option value="">Wszystkie wspólnoty</option>{communities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        <select className="input text-sm" value={filterYear} onChange={e=>setFilterYear(Number(e.target.value))}><option value={currentYear}>{currentYear}</option><option value={currentYear-1}>{currentYear-1}</option></select>
        <select className="input text-sm" value={filterMonth} onChange={e=>setFilterMonth(Number(e.target.value))}>
          <option value={0}>Wszystkie miesiące</option>
          {MONTHS.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select className="input text-sm" value={filterCat} onChange={e=>setFilterCat(e.target.value)}><option value="">Wszystkie kategorie</option>{categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select>
        {(filterMonth !== 0 || filterCat !== '' || search !== '' || (isSuperAdmin && filterComm !== '')) && (
          <button onClick={() => { setFilterMonth(0); setFilterCat(''); setSearch(''); if (isSuperAdmin) setFilterComm('') }} className="text-xs text-[#115e59] hover:text-[#99f6e4] border border-[#0f2d2a] hover:border-[#133835] px-3 py-1.5 rounded-lg transition">✕ Wyczyść filtry</button>
        )}
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#115e59] text-sm">🔍</span>
          <input
            className="input w-full pl-8 text-sm"
            placeholder="Szukaj opisu, kwoty, nr faktury…"
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
            <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4 text-center"><p className="text-xs text-[#115e59] mb-1">Wpłaty mieszkańców</p><p className="text-2xl font-bold text-teal-400">{pln(totalIncome)}</p></div>
            <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4 text-center"><p className="text-xs text-[#115e59] mb-1">Koszty wspólnoty</p><p className="text-2xl font-bold text-red-400">{pln(totalExpenses)}</p></div>
            <div className={`rounded-xl p-4 text-center border ${totalIncome-totalExpenses>=0?'bg-teal-950/20 border-teal-800':'bg-red-950/20 border-red-900'}`}><p className="text-xs text-[#115e59] mb-1">Saldo</p><p className={`text-2xl font-bold ${totalIncome-totalExpenses>=0?'text-teal-400':'text-red-400'}`}>{pln(totalIncome-totalExpenses)}</p></div>
          </div>
          <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#0f766e] mb-4">Wpłaty vs Koszty — miesiącami</h3>
            <div className="flex items-end gap-1 h-32">
              {MONTHS.map((name,idx)=>{const m=idx+1;const inc=monthlyIncome[m]??0;const exp=monthlyExpenses[m]??0;const hI=Math.max(2,Math.round((inc/maxBar)*120));const hE=Math.max(2,Math.round((exp/maxBar)*120));return(<div key={m} className="flex-1 flex flex-col items-center gap-0.5"><div className="flex items-end gap-0.5 w-full justify-center" style={{height:120}}><div title={`Wpłaty: ${pln(inc)}`} style={{height:hI}} className="flex-1 bg-teal-600/60 rounded-t-sm"/><div title={`Koszty: ${pln(exp)}`} style={{height:hE}} className="flex-1 bg-red-500/60 rounded-t-sm"/></div><span className="text-xs text-[#115e59]">{name}</span></div>)})}
            </div>
          </div>
          <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#0f766e] mb-4">Koszty według kategorii</h3>
            {Object.keys(byCat).length===0?<p className="text-sm text-[#0f766e]">Brak kosztów.</p>:<div className="space-y-3">{Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>{const pct=totalExpenses>0?Math.round(amt/totalExpenses*100):0;return(<div key={cat} className="flex items-center gap-3"><span className={`text-xs px-2 py-0.5 rounded-full w-32 text-center flex-shrink-0 ${catColors[cat]??catColors.inne}`}>{catLabel(cat)}</span><div className="flex-1 bg-[#0c2220] rounded-full h-2"><div className="bg-green-500 h-2 rounded-full" style={{width:`${pct}%`}}/></div><span className="text-sm font-semibold text-[#ccfbf1] w-28 text-right">{pln(amt)}</span><span className="text-xs text-[#115e59] w-10 text-right">{pct}%</span></div>)})}</div>}
          </div>
        </div>
      ):(
        <div>
          {/* Bulk action bar */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <label className="flex items-center gap-2 text-xs text-[#0f766e] cursor-pointer select-none">
                <input type="checkbox" className="w-3.5 h-3.5 accent-green-500" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} />
                {selectedIds.size > 0 ? `Zaznaczono ${selectedIds.size} z ${filtered.length}` : `Zaznacz wszystkie (${filtered.length})`}
              </label>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 ml-2 flex-wrap">
                  <span className="text-xs text-[#0f766e]">→ zmień kategorię na:</span>
                  <select className="input text-xs py-1" value={bulkCat} onChange={e => setBulkCat(e.target.value as ExpenseCategory)}>
                    {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <button onClick={handleBulkCategory} disabled={isPending} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition">
                    {isPending ? '...' : `Zastosuj (${selectedIds.size})`}
                  </button>
                  <button onClick={() => setSelectedIds(new Set())} className="text-xs text-[#115e59] hover:text-[#99f6e4]">Odznacz</button>
                </div>
              )}
              {bulkResult && <span className={`text-xs ml-2 ${bulkResult.startsWith('✓') ? 'text-teal-400' : 'text-red-400'}`}>{bulkResult}</span>}
            </div>
          )}

          {filtered.length===0?<div className="text-center py-16 text-[#115e59]"><p className="text-3xl mb-3">💸</p><p>Brak kosztów.</p></div>:
          (!filterComm && isSuperAdmin) ? (
            // Grupowanie po wspólnotach gdy super_admin i "Wszystkie"
            <div className="space-y-6">
              {communities.map(comm => {
                const commFiltered = filtered.filter(e => e.community_id === comm.id)
                if (commFiltered.length === 0) return null
                const commTotal = commFiltered.reduce((s, e) => s + e.amount, 0)
                return (
                  <div key={comm.id}>
                    <div className="flex items-center gap-3 mb-3 px-1">
                      <div className="flex-1 h-px bg-[#0a1f1d]" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#99f6e4] bg-[#0c2220] border border-[#0f2d2a] px-3 py-1 rounded-full">{comm.name}</span>
                        <span className="text-xs text-red-400 font-semibold">{pln(commTotal)}</span>
                        <span className="text-xs text-[#115e59]">({commFiltered.length} wpisów)</span>
                      </div>
                      <div className="flex-1 h-px bg-[#0a1f1d]" />
                    </div>
                    <div className="space-y-2">
                      {commFiltered.map(e => editId===e.id?(
                        <div key={e.id} className="bg-[#081918] border border-teal-700 rounded-xl p-4 space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <select className="input text-sm" value={editForm.category} onChange={x=>setEditForm(p=>({...p,category:x.target.value as ExpenseCategory}))}>{categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select>
                            <input className="input text-sm sm:col-span-2" value={editForm.description} onChange={x=>setEditForm(p=>({...p,description:x.target.value}))}/>
                            <input className="input text-sm" type="number" step="0.01" value={editForm.amount} onChange={x=>setEditForm(p=>({...p,amount:x.target.value}))}/>
                            <input className="input text-sm" type="date" value={editForm.expense_date} onChange={x=>setEditForm(p=>({...p,expense_date:x.target.value}))}/>
                            <input className="input text-sm" placeholder="Nr faktury" value={editForm.invoice_number??''} onChange={x=>setEditForm(p=>({...p,invoice_number:x.target.value}))}/>
                          </div>
                          <label className="flex items-center gap-2 text-xs text-orange-400 cursor-pointer select-none"><input type="checkbox" className="w-3.5 h-3.5 accent-orange-500" checked={editForm.is_renovation_fund||editForm.category==='fundusz_remontowy'} onChange={x=>setEditForm(p=>({...p,is_renovation_fund:x.target.checked}))} />🔨 Z funduszu remontowego</label>
                          {editError&&<p className="text-xs text-red-400">{editError}</p>}
                          <div className="flex gap-2"><button onClick={handleUpdate} disabled={isPending} className="bg-teal-600 text-white text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50">{isPending?'Zapisuję...':'Zapisz'}</button><button onClick={()=>setEditId(null)} className="text-xs text-[#115e59] hover:text-[#99f6e4]">Anuluj</button></div>
                        </div>
                      ):(
                        <div key={e.id} onClick={() => toggleSelect(e.id)} className={`bg-[#081918] border rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap cursor-pointer transition ${selectedIds.has(e.id) ? 'border-green-600 bg-teal-950/10' : 'border-[#0f2d2a] hover:border-[#0f2d2a]'}`}>
                          <input type="checkbox" className="w-4 h-4 accent-green-500 flex-shrink-0" checked={selectedIds.has(e.id)} onChange={() => toggleSelect(e.id)} onClick={ev => ev.stopPropagation()} />
                          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${catColors[e.category]??catColors.inne}`}>{catLabel(e.category)}</span>
                          {e.is_renovation_fund && <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-950/40 text-orange-400 flex-shrink-0" title="Fundusz remontowy">🔨</span>}
                          <div className="flex-1 min-w-0"><p className="text-sm font-medium text-[#ccfbf1] truncate">{e.description}</p><p className="text-xs text-[#115e59] mt-0.5">{new Date(e.expense_date).toLocaleDateString('pl-PL')}{e.invoice_number&&` · ${e.invoice_number}`}</p></div>
                          <p className="text-sm font-bold text-red-400 flex-shrink-0">{pln(e.amount)}</p>
                          <div className="flex items-center gap-2 flex-shrink-0" onClick={ev => ev.stopPropagation()}>
                            <button onClick={()=>{setEditId(e.id);setEditForm({category:e.category as ExpenseCategory,description:e.description,amount:String(e.amount),expense_date:e.expense_date,invoice_number:e.invoice_number??'',is_renovation_fund:e.is_renovation_fund??false});setEditError(null)}} className="text-xs text-teal-500 hover:underline">Edytuj</button>
                            <button onClick={()=>handleDelete(e.id)} className="text-[#115e59] hover:text-red-400 transition text-sm">✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
          <div className="space-y-2">
            {paginatedList.map(e=>editId===e.id?(
              <div key={e.id} className="bg-[#081918] border border-teal-700 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <select className="input text-sm" value={editForm.category} onChange={x=>setEditForm(p=>({...p,category:x.target.value as ExpenseCategory}))}>{categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select>
                  <input className="input text-sm sm:col-span-2" value={editForm.description} onChange={x=>setEditForm(p=>({...p,description:x.target.value}))}/>
                  <input className="input text-sm" type="number" step="0.01" value={editForm.amount} onChange={x=>setEditForm(p=>({...p,amount:x.target.value}))}/>
                  <input className="input text-sm" type="date" value={editForm.expense_date} onChange={x=>setEditForm(p=>({...p,expense_date:x.target.value}))}/>
                  <input className="input text-sm" placeholder="Nr faktury" value={editForm.invoice_number??''} onChange={x=>setEditForm(p=>({...p,invoice_number:x.target.value}))}/>
                </div>
                <label className="flex items-center gap-2 text-xs text-orange-400 cursor-pointer select-none"><input type="checkbox" className="w-3.5 h-3.5 accent-orange-500" checked={editForm.is_renovation_fund||editForm.category==='fundusz_remontowy'} onChange={x=>setEditForm(p=>({...p,is_renovation_fund:x.target.checked}))} />🔨 Z funduszu remontowego</label>
                {editError&&<p className="text-xs text-red-400">{editError}</p>}
                <div className="flex gap-2"><button onClick={handleUpdate} disabled={isPending} className="bg-teal-600 text-white text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50">{isPending?'Zapisuję...':'Zapisz'}</button><button onClick={()=>setEditId(null)} className="text-xs text-[#115e59] hover:text-[#99f6e4]">Anuluj</button></div>
              </div>
            ):(
              <div key={e.id} onClick={() => toggleSelect(e.id)} className={`bg-[#081918] border rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap cursor-pointer transition ${selectedIds.has(e.id) ? 'border-green-600 bg-teal-950/10' : 'border-[#0f2d2a] hover:border-[#0f2d2a]'}`}>
                <input type="checkbox" className="w-4 h-4 accent-green-500 flex-shrink-0" checked={selectedIds.has(e.id)} onChange={() => toggleSelect(e.id)} onClick={ev => ev.stopPropagation()} />
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${catColors[e.category]??catColors.inne}`}>{catLabel(e.category)}</span>
                {e.is_renovation_fund && <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-950/40 text-orange-400 flex-shrink-0" title="Fundusz remontowy">🔨</span>}
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-[#ccfbf1] truncate">{e.description}</p><p className="text-xs text-[#115e59] mt-0.5">{new Date(e.expense_date).toLocaleDateString('pl-PL')}{isSuperAdmin&&` · ${commMap[e.community_id]??'—'}`}{e.invoice_number&&` · ${e.invoice_number}`}</p></div>
                <p className="text-sm font-bold text-red-400 flex-shrink-0">{pln(e.amount)}</p>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={ev => ev.stopPropagation()}>
                  <button onClick={()=>{setEditId(e.id);setEditForm({category:e.category as ExpenseCategory,description:e.description,amount:String(e.amount),expense_date:e.expense_date,invoice_number:e.invoice_number??'',is_renovation_fund:e.is_renovation_fund??false});setEditError(null)}} className="text-xs text-teal-500 hover:underline">Edytuj</button>
                  <button onClick={()=>handleDelete(e.id)} disabled={isPending} className="text-xs text-[#115e59] hover:text-red-400 transition">✕</button>
                </div>
              </div>
            ))}
            {listTotalPages > 1 && <Pagination page={listPage} totalPages={listTotalPages} onPageChange={p => { setListPage(p); setSelectedIds(new Set()) }} />}
            <div className="mt-4 pt-4 border-t border-[#0f2d2a] flex justify-between items-center"><p className="text-sm text-[#115e59]">{filtered.length} pozycji</p><p className="text-base font-bold text-red-400">Razem: {pln(totalExpenses)}</p></div>
          </div>
          )}
        </div>
      )}
    </div>
  )
}

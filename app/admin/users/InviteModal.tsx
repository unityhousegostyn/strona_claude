'use client'

import { useState, useRef, useCallback } from 'react'
import { sendInvitation, sendBulkInvitations } from './actions'

interface Props {
  communities: { id: string; name: string }[]
  isSuperAdmin: boolean
  adminCommunityId: string | null
}

type Contact = { email: string; full_name?: string }
type Tab = 'single' | 'bulk'
type ImportTab = 'paste' | 'file'

// ─── CSV / VCF parsery ────────────────────────────────────────────────────────

function parseEmails(text: string): Contact[] {
  const contacts: Contact[] = []
  const seen = new Set<string>()

  // Obsługuje formaty:
  // jan@wp.pl
  // Jan Kowalski <jan@wp.pl>
  // "Jan Kowalski" <jan@wp.pl>
  // jan@wp.pl, anna@wp.pl
  const emailRe = /(?:"?([^"<,;\n]+)"?\s*<)?([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})>?/g
  let m: RegExpExecArray | null
  while ((m = emailRe.exec(text)) !== null) {
    const email = m[2].trim().toLowerCase()
    const name = m[1]?.trim().replace(/^"|"$/g, '') || undefined
    if (!seen.has(email)) { seen.add(email); contacts.push({ email, full_name: name }) }
  }
  return contacts
}

// Właściwy parser RFC 4180 — obsługuje pola z przecinkami w cudzysłowach
function parseCsvRow(line: string, sep: string): string[] {
  const result: string[] = []
  let inQuote = false
  let field = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { field += '"'; i++ }
        else inQuote = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') { inQuote = true }
      else if (ch === sep) { result.push(field); field = '' }
      else { field += ch }
    }
  }
  result.push(field)
  return result
}

function parseCsv(text: string): Contact[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  // Wykryj separator (, lub ;)
  const sep = lines[0].includes(';') ? ';' : ','

  // Parsuj nagłówek przez właściwy parser
  const header = parseCsvRow(lines[0], sep).map(h => h.trim().toLowerCase())

  // Mapa kolumn — obsługuje Gmail, Outlook, Apple
  const emailCols = ['e-mail address','email 1 - value','email','e-mail','mail']
  const nameCols  = ['name','full name','imię i nazwisko','imie i nazwisko']
  const firstCols = ['first name','given name','imię','imie','first']
  const lastCols  = ['last name','family name','surname','nazwisko','last']

  const emailIdx = emailCols.map(k => header.indexOf(k)).find(i => i >= 0) ?? -1
  const nameIdx  = nameCols.map(k => header.indexOf(k)).find(i => i >= 0) ?? -1
  const firstIdx = firstCols.map(k => header.indexOf(k)).find(i => i >= 0) ?? -1
  const lastIdx  = lastCols.map(k => header.indexOf(k)).find(i => i >= 0) ?? -1

  if (emailIdx < 0) return []

  const contacts: Contact[] = []
  const seen = new Set<string>()

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i], sep)
    const email = cols[emailIdx]?.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue
    if (seen.has(email)) continue
    seen.add(email)

    let name: string | undefined
    if (nameIdx >= 0 && cols[nameIdx]?.trim()) {
      name = cols[nameIdx].trim()
    } else if (firstIdx >= 0 || lastIdx >= 0) {
      const first = firstIdx >= 0 ? cols[firstIdx]?.trim() : ''
      const last  = lastIdx  >= 0 ? cols[lastIdx]?.trim()  : ''
      name = [first, last].filter(Boolean).join(' ') || undefined
    }

    contacts.push({ email, full_name: name })
  }
  return contacts
}

function parseVcf(text: string): Contact[] {
  const contacts: Contact[] = []
  const seen = new Set<string>()
  const cards = text.split(/BEGIN:VCARD/i).slice(1)

  for (const card of cards) {
    const emailMatch = card.match(/^EMAIL[^:]*:(.+)$/im)
    const fnMatch    = card.match(/^FN:(.+)$/im)
    const email = emailMatch?.[1]?.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue
    if (seen.has(email)) continue
    seen.add(email)
    contacts.push({ email, full_name: fnMatch?.[1]?.trim() || undefined })
  }
  return contacts
}

// ─── Główny komponent ─────────────────────────────────────────────────────────

export default function InviteModal({ communities, isSuperAdmin, adminCommunityId }: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('single')
  const [importTab, setImportTab] = useState<ImportTab>('paste')

  // Single
  const [singleLoading, setSingleLoading] = useState(false)
  const [singleResult, setSingleResult] = useState<{ error?: string; success?: boolean } | null>(null)
  const singleFormRef = useRef<HTMLFormElement>(null)

  // Bulk
  const [pasteText, setPasteText] = useState('')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [bulkCommunityId, setBulkCommunityId] = useState(adminCommunityId ?? '')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ sent: number; skipped: { email: string; reason: string }[] } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function close() {
    setOpen(false)
    setSingleResult(null)
    setBulkResult(null)
    setContacts([])
    setPasteText('')
  }

  // ── Single submit ──────────────────────────────────────────────────────────
  async function handleSingleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSingleLoading(true)
    setSingleResult(null)
    const fd = new FormData(e.currentTarget)
    const res = await sendInvitation({
      email: fd.get('email') as string,
      full_name: fd.get('full_name') as string,
      apartment_number: fd.get('apartment_number') as string,
      community_id: (fd.get('community_id') as string) || adminCommunityId || '',
    })
    setSingleLoading(false)
    if (res.error) setSingleResult({ error: res.error })
    else { setSingleResult({ success: true }); singleFormRef.current?.reset() }
  }

  // ── Paste parse ────────────────────────────────────────────────────────────
  function handleParsePaste() {
    const parsed = parseEmails(pasteText)
    setContacts(prev => {
      const existing = new Set(prev.map(c => c.email))
      const newOnes = parsed.filter(c => !existing.has(c.email))
      return [...prev, ...newOnes]
    })
    setPasteText('')
  }

  // ── File import ────────────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      let parsed: Contact[] = []
      if (file.name.toLowerCase().endsWith('.vcf')) parsed = parseVcf(text)
      else parsed = parseCsv(text)

      if (parsed.length === 0) {
        alert('Nie znaleziono adresów email w pliku. Upewnij się że to plik CSV (Gmail/Outlook) lub VCF.')
        return
      }
      setContacts(prev => {
        const existing = new Set(prev.map(c => c.email))
        return [...prev, ...parsed.filter(c => !existing.has(c.email))]
      })
      setImportTab('paste') // pokaż listę
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function removeContact(email: string) {
    setContacts(prev => prev.filter(c => c.email !== email))
  }

  // ── Bulk submit ────────────────────────────────────────────────────────────
  async function handleBulkSend() {
    if (contacts.length === 0) return
    const commId = isSuperAdmin ? bulkCommunityId : (adminCommunityId ?? '')
    if (!commId) { alert('Wybierz wspólnotę'); return }
    setBulkLoading(true)
    try {
      const res = await sendBulkInvitations({ contacts, community_id: commId })
      setBulkResult(res)
      setContacts([])
    } catch (e: any) {
      alert(e.message)
    }
    setBulkLoading(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
        Zaproś mieszkańca
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close}/>

          <div className="relative w-full max-w-lg bg-[#081918] border border-[#0f2d2a] rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/60 overflow-hidden flex flex-col max-h-[92dvh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#0f2d2a] bg-[#051210] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-teal-700/30 border border-teal-700/50 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#f0fdfa]">Zaproś do wspólnoty</h2>
                  <p className="text-xs text-[#115e59]">Wyślij link rejestracyjny</p>
                </div>
              </div>
              <button onClick={close} className="text-[#115e59] hover:text-[#f0fdfa] transition p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#0f2d2a] bg-[#051210] flex-shrink-0">
              {(['single','bulk'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 text-xs font-semibold py-3 transition ${tab === t ? 'text-teal-400 border-b-2 border-teal-500' : 'text-[#115e59] hover:text-[#99f6e4]'}`}>
                  {t === 'single' ? '✉️  Jedna osoba' : `📋  Wiele osób${contacts.length > 0 ? ` (${contacts.length})` : ''}`}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1">

              {/* ── TAB: Jedna osoba ── */}
              {tab === 'single' && (
                <div className="px-6 py-5">
                  {singleResult?.success ? (
                    <div className="py-8 text-center space-y-4">
                      <div className="w-14 h-14 bg-teal-950/40 border border-teal-700/50 rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-7 h-7 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                        </svg>
                      </div>
                      <p className="text-base font-bold text-[#f0fdfa]">Wysłano!</p>
                      <p className="text-sm text-[#0f766e]">Zaproszenie ważne przez 7 dni.</p>
                      <div className="flex gap-3 justify-center">
                        <button onClick={() => setSingleResult(null)} className="text-sm text-teal-400 hover:text-teal-300 transition">Zaproś kolejną</button>
                        <button onClick={close} className="text-sm bg-[#0c2220] border border-[#0f2d2a] text-[#99f6e4] px-4 py-2 rounded-lg hover:border-[#133835] transition">Zamknij</button>
                      </div>
                    </div>
                  ) : (
                    <form ref={singleFormRef} onSubmit={handleSingleSubmit} className="space-y-4">
                      <Field label="Email *" name="email" type="email" placeholder="jan.kowalski@email.com" required />
                      <Field label="Imię i nazwisko" name="full_name" placeholder="Jan Kowalski" />
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Numer lokalu" name="apartment_number" placeholder="np. 12A" />
                        {isSuperAdmin && (
                          <div>
                            <label className="block text-xs font-semibold text-[#99f6e4] mb-1.5 uppercase tracking-wide">Wspólnota *</label>
                            <select name="community_id" required className="input w-full">
                              <option value="">Wybierz…</option>
                              {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                      {singleResult?.error && <ErrorBox msg={singleResult.error}/>}
                      <FlowInfo invited />
                      <div className="flex gap-3 pt-1">
                        <button type="button" onClick={close} className="flex-1 text-sm border border-[#0f2d2a] text-[#0f766e] px-4 py-2.5 rounded-lg hover:border-[#133835] transition">Anuluj</button>
                        <SubmitBtn loading={singleLoading} label="Wyślij zaproszenie"/>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* ── TAB: Wiele osób ── */}
              {tab === 'bulk' && (
                <div className="px-6 py-5 space-y-4">

                  {/* Wynik bulk */}
                  {bulkResult && (
                    <div className={`rounded-xl p-4 ${bulkResult.sent > 0 ? 'bg-teal-950/30 border border-teal-800/40' : 'bg-[#051210] border border-[#0f2d2a]'}`}>
                      <p className="text-sm font-bold text-[#f0fdfa] mb-1">
                        {bulkResult.sent > 0 ? `✅ Wysłano ${bulkResult.sent} zaproszeń` : 'Nie wysłano żadnych zaproszeń'}
                      </p>
                      {bulkResult.skipped.length > 0 && (
                        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                          <p className="text-xs text-[#0f766e] font-semibold">Pominięto ({bulkResult.skipped.length}):</p>
                          {bulkResult.skipped.map((s, i) => (
                            <p key={i} className="text-xs text-[#115e59]"><span className="text-[#99f6e4]">{s.email}</span> — {s.reason}</p>
                          ))}
                        </div>
                      )}
                      <button onClick={() => setBulkResult(null)} className="text-xs text-teal-500 hover:underline mt-2 block">Zaproś więcej</button>
                    </div>
                  )}

                  {!bulkResult && (
                    <>
                      {/* Import sub-tabs */}
                      <div className="flex gap-1 bg-[#051210] border border-[#0c2220] rounded-lg p-1">
                        {(['paste','file'] as ImportTab[]).map(it => (
                          <button key={it} onClick={() => setImportTab(it)}
                            className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition ${importTab === it ? 'bg-[#0c2220] text-[#f0fdfa]' : 'text-[#115e59] hover:text-[#99f6e4]'}`}>
                            {it === 'paste' ? '📝 Wklej adresy' : '📂 Importuj plik'}
                          </button>
                        ))}
                      </div>

                      {/* Wklej adresy */}
                      {importTab === 'paste' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-[#99f6e4] mb-1.5 uppercase tracking-wide">Adresy email</label>
                            <textarea
                              value={pasteText}
                              onChange={e => setPasteText(e.target.value)}
                              placeholder={'Jan Kowalski <jan@wp.pl>\nanna@gmail.com\njozef@poczta.pl, marta@o2.pl'}
                              rows={4}
                              className="input w-full text-xs resize-none"
                            />
                            <p className="text-xs text-[#133835] mt-1">Jeden per linię lub rozdzielone przecinkiem. Obsługuje format: <span className="text-[#115e59]">Imię Nazwisko &lt;email&gt;</span></p>
                          </div>
                          <button
                            onClick={handleParsePaste}
                            disabled={!pasteText.trim()}
                            className="w-full text-sm bg-[#0c2220] border border-[#0f2d2a] text-[#99f6e4] px-4 py-2 rounded-lg hover:border-teal-700/50 hover:text-teal-400 transition disabled:opacity-40"
                          >
                            Dodaj do listy →
                          </button>
                        </div>
                      )}

                      {/* Import pliku */}
                      {importTab === 'file' && (
                        <div className="space-y-3">
                          <div
                            onDrop={handleDrop}
                            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                            onDragLeave={() => setDragOver(false)}
                            onClick={() => fileRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${dragOver ? 'border-teal-600 bg-teal-950/20' : 'border-[#0f2d2a] hover:border-teal-700/50 hover:bg-teal-950/10'}`}
                          >
                            <div className="text-3xl mb-2">📂</div>
                            <p className="text-sm font-semibold text-[#99f6e4]">Przeciągnij plik lub kliknij</p>
                            <p className="text-xs text-[#115e59] mt-1">CSV (Gmail, Outlook, Apple) · VCF (kontakty)</p>
                            <input
                              ref={fileRef}
                              type="file"
                              accept=".csv,.vcf,.txt"
                              className="hidden"
                              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
                            />
                          </div>
                          {/* Instrukcja eksportu */}
                          <div className="bg-[#051210] border border-[#0c2220] rounded-xl px-4 py-3 text-xs text-[#115e59] space-y-1">
                            <p className="font-semibold text-[#0f766e] mb-1.5">Jak wyeksportować kontakty:</p>
                            <p><span className="text-[#99f6e4]">Gmail:</span> contacts.google.com → Eksportuj → Google CSV</p>
                            <p><span className="text-[#99f6e4]">Outlook:</span> Kontakty → Eksportuj → CSV</p>
                            <p><span className="text-[#99f6e4]">Apple:</span> Kontakty → Plik → Eksportuj jako vCard</p>
                          </div>
                        </div>
                      )}

                      {/* Lista kontaktów */}
                      {contacts.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-[#99f6e4] uppercase tracking-wide">Do wysłania ({contacts.length})</p>
                            <button onClick={() => setContacts([])} className="text-xs text-[#115e59] hover:text-red-400 transition">Wyczyść</button>
                          </div>
                          <div className="max-h-44 overflow-y-auto space-y-1 border border-[#0c2220] rounded-xl p-2 bg-[#051210]">
                            {contacts.map((c, i) => (
                              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#0c2220] group">
                                <div className="w-6 h-6 rounded-full bg-teal-900/30 border border-teal-800/30 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-bold text-teal-600">{(c.full_name?.[0] ?? c.email[0]).toUpperCase()}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  {c.full_name && <p className="text-xs font-medium text-[#99f6e4] truncate">{c.full_name}</p>}
                                  <p className="text-xs text-[#115e59] truncate">{c.email}</p>
                                </div>
                                <button onClick={() => removeContact(c.email)} className="text-[#0f2d2a] hover:text-red-400 transition opacity-0 group-hover:opacity-100 flex-shrink-0">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Wspólnota (tylko super_admin) */}
                      {isSuperAdmin && (
                        <div>
                          <label className="block text-xs font-semibold text-[#99f6e4] mb-1.5 uppercase tracking-wide">Wspólnota *</label>
                          <select value={bulkCommunityId} onChange={e => setBulkCommunityId(e.target.value)} className="input w-full">
                            <option value="">Wybierz…</option>
                            {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}

                      <FlowInfo invited />

                      {/* Wyślij */}
                      <div className="flex gap-3 pt-1">
                        <button type="button" onClick={close} className="flex-1 text-sm border border-[#0f2d2a] text-[#0f766e] px-4 py-2.5 rounded-lg hover:border-[#133835] transition">Anuluj</button>
                        <button
                          onClick={handleBulkSend}
                          disabled={contacts.length === 0 || bulkLoading || (isSuperAdmin && !bulkCommunityId)}
                          className="flex-1 flex items-center justify-center gap-2 text-sm bg-teal-700 hover:bg-teal-600 text-white font-semibold px-4 py-2.5 rounded-lg transition disabled:opacity-40"
                        >
                          {bulkLoading
                            ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Wysyłam…</>
                            : <>Wyślij {contacts.length > 0 ? contacts.length : ''} zaproszeń</>
                          }
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Mini-komponenty ──────────────────────────────────────────────────────────

function Field({ label, name, type = 'text', placeholder, required }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#99f6e4] mb-1.5 uppercase tracking-wide">{label}</label>
      <input name={name} type={type} placeholder={placeholder} required={required} className="input w-full"/>
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">{msg}</p>
}

function FlowInfo({ invited }: { invited?: boolean }) {
  return (
    <div className="bg-[#051210] border border-[#0c2220] rounded-xl px-4 py-3 text-xs text-[#115e59] space-y-0.5">
      <p className="font-semibold text-[#0f766e] mb-1">Jak to działa:</p>
      <p>1. Mieszkaniec dostaje email z linkiem (ważny 7 dni)</p>
      <p>2. Klika → formularz rejestracji z pre-wypełnionym emailem</p>
      <p>3. Po rejestracji konto od razu aktywne ✓</p>
    </div>
  )
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button type="submit" disabled={loading}
      className="flex-1 flex items-center justify-center gap-2 text-sm bg-teal-700 hover:bg-teal-600 text-white font-semibold px-4 py-2.5 rounded-lg transition disabled:opacity-50">
      {loading
        ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Wysyłam…</>
        : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>{label}</>
      }
    </button>
  )
}

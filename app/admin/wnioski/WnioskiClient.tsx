'use client'

import { useState } from 'react'
import Link from 'next/link'
import { submitRequest, updateRequestStatus, deleteRequest } from './actions'
import type { RequestType, RequestStatus } from './actions'

const TEMPLATE_FILES: Record<RequestType, string> = {
  zaswiadczenie_zamieszkania:  '/templates/wnioski/01_zaswiadczenie_o_zamieszkaniu.docx',
  zaswiadczenie_niezalegania:  '/templates/wnioski/02_zaswiadczenie_o_niezaleganiu.docx',
  zmiana_danych:               '/templates/wnioski/03_zmiana_danych.docx',
  naprawa:                     '/templates/wnioski/04_wniosek_o_naprawe.docx',
  dokumenty:                   '/templates/wnioski/05_udostepnienie_dokumentow.docx',
  inne:                        '/templates/wnioski/06_wniosek_ogolny.docx',
}

const REQUEST_TYPES: { value: RequestType; label: string; desc: string }[] = [
  { value: 'zaswiadczenie_zamieszkania',  label: 'Zaświadczenie o zamieszkaniu',      desc: 'Potwierdzenie zameldowania/zamieszkania w lokalu' },
  { value: 'zaswiadczenie_niezalegania', label: 'Zaświadczenie o niezaleganiu',       desc: 'Brak zaległości w opłatach na rzecz wspólnoty' },
  { value: 'zmiana_danych',              label: 'Zmiana danych osobowych/kontaktu',   desc: 'Aktualizacja adresu email, telefonu, danych właściciela' },
  { value: 'naprawa',                    label: 'Wniosek o naprawę / interwencję',    desc: 'Formalna prośba o naprawę, interwencję lub inspekcję' },
  { value: 'dokumenty',                  label: 'Udostępnienie dokumentów',           desc: 'Regulamin, uchwały, protokoły, sprawozdanie finansowe' },
  { value: 'inne',                       label: 'Inny wniosek',                       desc: 'Dowolna prośba do zarządu / administracji' },
]

const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; bg: string }> = {
  new:         { label: 'Nowy',         color: 'text-blue-400',   bg: 'bg-blue-950/40 border-blue-900/50' },
  in_progress: { label: 'W trakcie',    color: 'text-amber-400',  bg: 'bg-amber-950/40 border-amber-900/50' },
  done:        { label: 'Zakończony',   color: 'text-green-400',  bg: 'bg-green-950/40 border-green-900/50' },
  rejected:    { label: 'Odrzucony',    color: 'text-red-400',    bg: 'bg-red-950/40 border-red-900/50' },
}

type CommunityRequest = {
  id: string
  community_id: string
  user_id: string
  type: RequestType
  title: string
  description: string | null
  status: RequestStatus
  admin_note: string | null
  created_at: string
  updated_at: string
  profile?: { full_name: string | null; email: string } | null
  community?: { name: string } | null
}

interface Props {
  requests: CommunityRequest[]
  isAdmin: boolean
  isSuperAdmin: boolean
  communityId?: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function typeLabel(type: RequestType) {
  return REQUEST_TYPES.find(t => t.value === type)?.label ?? type
}

// ─── Formularz nowego wniosku (dla mieszkańca) ─────────────────────────────
function NewRequestForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [type, setType] = useState<RequestType>('zaswiadczenie_zamieszkania')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const selectedType = REQUEST_TYPES.find(t => t.value === type)!

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await submitRequest({ type, title, description })
    setLoading(false)
    if (res.error) { setError(res.error); return }
    setSuccess(true)
    setTitle('')
    setDescription('')
    onSubmitted()
    setTimeout(() => setSuccess(false), 4000)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#1a1410] border border-[#3a2e1e] rounded-xl p-5 space-y-4">
      <h3 className="text-base font-semibold text-[#f0ebe0]">Nowy wniosek</h3>

      {/* Typ wniosku */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {REQUEST_TYPES.map(rt => (
          <button
            key={rt.value}
            type="button"
            onClick={() => setType(rt.value)}
            className={`text-left px-3 py-2.5 rounded-lg border text-sm transition ${
              type === rt.value
                ? 'border-amber-600 bg-amber-950/30 text-amber-300'
                : 'border-[#3a2e1e] bg-[#241e14] text-[#a89880] hover:border-[#5a4a30] hover:text-[#f0ebe0]'
            }`}
          >
            <p className="font-medium">{rt.label}</p>
            <p className="text-xs opacity-60 mt-0.5">{rt.desc}</p>
          </button>
        ))}
      </div>

      {/* Tytuł */}
      <div>
        <label className="text-xs text-[#7a6a58] block mb-1">
          Tytuł wniosku <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={`np. Prośba o ${selectedType.label.toLowerCase()}`}
          required
          maxLength={200}
          className="w-full bg-[#241e14] border border-[#3a2e1e] rounded-lg px-3 py-2 text-sm text-[#f0ebe0] placeholder-[#5a4a30] focus:outline-none focus:border-amber-700"
        />
      </div>

      {/* Opis */}
      <div>
        <label className="text-xs text-[#7a6a58] block mb-1">Szczegóły (opcjonalnie)</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Opisz szczegółowo czego potrzebujesz, podaj dodatkowe informacje..."
          className="w-full bg-[#241e14] border border-[#3a2e1e] rounded-lg px-3 py-2 text-sm text-[#f0ebe0] placeholder-[#5a4a30] focus:outline-none focus:border-amber-700 resize-none"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {success && <p className="text-green-400 text-sm">✓ Wniosek złożony — administracja wkrótce się z Tobą skontaktuje.</p>}

      <button
        type="submit"
        disabled={loading || !title.trim()}
        className="px-5 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition"
      >
        {loading ? 'Wysyłanie…' : 'Złóż wniosek'}
      </button>
    </form>
  )
}

// ─── Wiersz wniosku (admin) ────────────────────────────────────────────────
function AdminRequestRow({ req, isSuperAdmin, onUpdated }: {
  req: CommunityRequest
  isSuperAdmin: boolean
  onUpdated: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<RequestStatus>(req.status)
  const [note, setNote] = useState(req.admin_note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const cfg = STATUS_CONFIG[status]

  async function handleSave() {
    setSaving(true)
    setError(null)
    const res = await updateRequestStatus(req.id, status, note)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    onUpdated()
    setExpanded(false)
  }

  async function handleDelete() {
    if (!confirm('Usunąć ten wniosek?')) return
    setDeleting(true)
    await deleteRequest(req.id)
    onUpdated()
  }

  const applicant = req.profile?.full_name || req.profile?.email || 'Mieszkaniec'

  return (
    <div className={`border rounded-xl ${cfg.bg} transition`}>
      <button
        type="button"
        className="w-full text-left px-4 py-3 flex items-start gap-3"
        onClick={() => setExpanded(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
            <span className="text-xs text-[#7a6a58]">{typeLabel(req.type)}</span>
            {isSuperAdmin && req.community && (
              <span className="text-xs text-[#5a4a30]">· {req.community.name}</span>
            )}
          </div>
          <p className="text-sm font-medium text-[#f0ebe0] truncate">{req.title}</p>
          <p className="text-xs text-[#7a6a58] mt-0.5">{applicant} · {formatDate(req.created_at)}</p>
        </div>
        <svg className={`w-4 h-4 text-[#5a4a30] mt-1 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#3a2e1e] pt-3">
          {req.description && (
            <p className="text-sm text-[#a89880] whitespace-pre-wrap">{req.description}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#7a6a58] block mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as RequestStatus)}
                className="w-full bg-[#241e14] border border-[#3a2e1e] rounded-lg px-3 py-2 text-sm text-[#f0ebe0] focus:outline-none focus:border-amber-700"
              >
                <option value="new">Nowy</option>
                <option value="in_progress">W trakcie</option>
                <option value="done">Zakończony</option>
                <option value="rejected">Odrzucony</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[#7a6a58] block mb-1">Odpowiedź dla mieszkańca</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                maxLength={500}
                placeholder="np. Zaświadczenie gotowe do odbioru w biurze"
                className="w-full bg-[#241e14] border border-[#3a2e1e] rounded-lg px-3 py-2 text-sm text-[#f0ebe0] placeholder-[#5a4a30] focus:outline-none focus:border-amber-700"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition"
            >
              {saving ? 'Zapisuję…' : 'Zapisz'}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-1.5 bg-transparent border border-red-900/50 hover:border-red-700 text-red-500 hover:text-red-400 text-sm rounded-lg transition disabled:opacity-40"
            >
              {deleting ? '…' : 'Usuń'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Wiersz wniosku (mieszkaniec — read only) ──────────────────────────────
function UserRequestRow({ req }: { req: CommunityRequest }) {
  const cfg = STATUS_CONFIG[req.status]
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`border rounded-xl ${cfg.bg}`}>
      <button
        type="button"
        className="w-full text-left px-4 py-3 flex items-start gap-3"
        onClick={() => setExpanded(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
            <span className="text-xs text-[#7a6a58]">{typeLabel(req.type)}</span>
          </div>
          <p className="text-sm font-medium text-[#f0ebe0] truncate">{req.title}</p>
          <p className="text-xs text-[#7a6a58] mt-0.5">{formatDate(req.created_at)}</p>
        </div>
        <svg className={`w-4 h-4 text-[#5a4a30] mt-1 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[#3a2e1e] pt-3 space-y-2">
          {req.description && (
            <p className="text-sm text-[#a89880] whitespace-pre-wrap">{req.description}</p>
          )}
          {req.admin_note && (
            <div className="bg-[#241e14] rounded-lg p-3 border border-[#3a2e1e]">
              <p className="text-xs text-[#7a6a58] mb-1">Odpowiedź administracji:</p>
              <p className="text-sm text-[#f0ebe0]">{req.admin_note}</p>
            </div>
          )}
          {!req.admin_note && req.status === 'new' && (
            <p className="text-xs text-[#5a4a30] italic">Oczekuje na rozpatrzenie przez administrację.</p>
          )}
          {/* Akcje */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href={`/admin/wnioski/${req.id}/print`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#3a2e1e] text-[#a89880] hover:text-[#f0ebe0] hover:border-[#5a4a30] transition"
            >
              🖨 Drukuj / Pobierz PDF
            </Link>
            <a
              href={TEMPLATE_FILES[req.type]}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#3a2e1e] text-[#a89880] hover:text-[#f0ebe0] hover:border-[#5a4a30] transition"
            >
              📄 Pobierz szablon DOCX
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Główny komponent ──────────────────────────────────────────────────────
export default function WnioskiClient({ requests: initial, isAdmin, isSuperAdmin }: Props) {
  const [requests, setRequests] = useState(initial)
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all')
  const [refresh, setRefresh] = useState(0)

  function handleRefresh() {
    setRefresh(r => r + 1)
    // Re-fetch happens via revalidatePath — page will update on next nav
    // For instant feedback we reload in admin mode
    if (isAdmin || isSuperAdmin) window.location.reload()
  }

  const filtered = statusFilter === 'all'
    ? requests
    : requests.filter(r => r.status === statusFilter)

  const newCount = requests.filter(r => r.status === 'new').length

  return (
    <div className="space-y-6">
      {/* Formularz — tylko mieszkaniec */}
      {!isAdmin && !isSuperAdmin && (
        <NewRequestForm onSubmitted={handleRefresh} />
      )}

      {/* Lista wniosków */}
      <div>
        {(isAdmin || isSuperAdmin) && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-[#f0ebe0]">Wnioski</h3>
              {newCount > 0 && (
                <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {newCount} nowych
                </span>
              )}
            </div>
            {/* Filtr statusu */}
            <div className="flex gap-1.5 flex-wrap">
              {(['all', 'new', 'in_progress', 'done', 'rejected'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
                    statusFilter === s
                      ? 'bg-amber-700 border-amber-600 text-white'
                      : 'bg-transparent border-[#3a2e1e] text-[#7a6a58] hover:text-[#f0ebe0] hover:border-[#5a4a30]'
                  }`}
                >
                  {s === 'all' ? 'Wszystkie' : STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isAdmin && !isSuperAdmin && requests.length > 0 && (
          <h3 className="text-sm font-semibold text-[#7a6a58] mb-3">Twoje wnioski</h3>
        )}

        {filtered.length === 0 ? (
          <p className="text-sm text-[#5a4a30] py-6 text-center">
            {statusFilter === 'all' ? 'Brak wniosków.' : `Brak wniosków o statusie „${STATUS_CONFIG[statusFilter]?.label}".`}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map(req =>
              isAdmin || isSuperAdmin
                ? <AdminRequestRow key={req.id} req={req} isSuperAdmin={isSuperAdmin} onUpdated={handleRefresh} />
                : <UserRequestRow key={req.id} req={req} />
            )}
          </div>
        )}
      </div>

      {/* Szablony do pobrania */}
      <div className="border border-[#3a2e1e] rounded-xl p-4 bg-[#1a1410]">
        <h3 className="text-sm font-semibold text-[#a89880] mb-3">📄 Szablony wniosków do druku (DOCX)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {REQUEST_TYPES.map(rt => (
            <a
              key={rt.value}
              href={TEMPLATE_FILES[rt.value]}
              download
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#3a2e1e] bg-[#241e14] text-[#7a6a58] hover:text-[#f0ebe0] hover:border-[#5a4a30] transition text-xs"
            >
              <span className="text-amber-600">↓</span>
              <span>{rt.label}</span>
            </a>
          ))}
        </div>
        <p className="text-xs text-[#5a4a30] mt-3">
          Pobierz szablon Word, wypełnij ręcznie i złóż w biurze — lub złóż wniosek elektronicznie powyżej.
        </p>
      </div>
    </div>
  )
}

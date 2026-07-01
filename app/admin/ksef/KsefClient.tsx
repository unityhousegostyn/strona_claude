'use client'

import { useState, useTransition } from 'react'
import { saveKsefSettings, runKsefSync, importQueueItem, skipQueueItem, getKsefQueue as fetchQueue, diagnoseKsefApi, diagnoseKsefQuery } from './actions'
import type { KsefSettings, SyncLogEntry, QueueItem } from './actions'

type Tab = 'ustawienia' | 'sync' | 'kolejka'

const CATEGORIES = [
  { value: 'fundusz_remontowy',       label: 'Fundusz remontowy' },
  { value: 'fundusz_eksploatacyjny',  label: 'Fundusz eksploatacyjny' },
  { value: 'wynagrodzenie_zarządcy',  label: 'Wynagrodzenie zarządcy' },
  { value: 'koszty_administracji',    label: 'Koszty administracji' },
  { value: 'woda',                    label: 'Woda / kanalizacja' },
  { value: 'śmieci',                  label: 'Odpady / śmieci' },
  { value: 'sprzątanie',              label: 'Sprzątanie' },
  { value: 'opłaty_bankowe',          label: 'Opłaty bankowe' },
  { value: 'przeglądy_budynków',      label: 'Przeglądy budynków' },
  { value: 'remonty',                 label: 'Remonty / naprawy' },
  { value: 'ubezpieczenie',           label: 'Ubezpieczenie' },
  { value: 'energia',                 label: 'Energia / gaz' },
  { value: 'najem',                   label: 'Najem (fundusz eksploatacyjny)' },
  { value: 'podatek_od_nieruchomości',label: 'Podatek od nieruchomości' },
  { value: 'zarząd',                  label: 'Zarządzanie (inne)' },
  { value: 'inne',                    label: 'Inne' },
]

function pln(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return s.slice(0, 10)
}

function fmtDateTime(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })
}

interface Props {
  settings: KsefSettings | null
  syncLog: SyncLogEntry[]
  initialQueue: QueueItem[]
  communities: { id: string; name: string; nip: string | null }[]
}

export default function KsefClient({ settings, syncLog: initialLog, initialQueue, communities }: Props) {
  const [tab, setTab] = useState<Tab>('ustawienia')
  const [isPending, startTransition] = useTransition()

  // ── Settings form ──────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    nip:            settings?.nip ?? '',
    ksef_token:     settings?.ksef_token ?? '',
    environment:    settings?.environment ?? 'prod',
    sync_from_date: settings?.sync_from_date ?? '',
    enabled:        settings?.enabled ?? false,
  })
  const [settingsMsg, setSettingsMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target
    setForm(f => ({
      ...f,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  function handleSaveSettings() {
    startTransition(async () => {
      const res = await saveKsefSettings({
        nip: form.nip,
        ksef_token: form.ksef_token,
        environment: form.environment as 'prod' | 'test',
        sync_from_date: form.sync_from_date,
        enabled: form.enabled,
      })
      setSettingsMsg(res.error ? { ok: false, text: res.error } : { ok: true, text: 'Zapisano.' })
    })
  }

  // ── Sync ───────────────────────────────────────────────────────────────────
  const [log, setLog] = useState<SyncLogEntry[]>(initialLog)
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [diagResults, setDiagResults] = useState<{ url: string; method: string; status: number; contentType: string; preview: string }[] | null>(null)
  const [diagLoading, setDiagLoading] = useState(false)
  const [queryDiag, setQueryDiag] = useState<Awaited<ReturnType<typeof diagnoseKsefQuery>> | null>(null)
  const [queryDiagLoading, setQueryDiagLoading] = useState(false)

  function handleDiagnose() {
    setDiagLoading(true)
    setDiagResults(null)
    startTransition(async () => {
      const { results } = await diagnoseKsefApi(form.environment as 'prod' | 'test')
      setDiagResults(results)
      setDiagLoading(false)
    })
  }

  function handleQueryDiagnose() {
    setQueryDiagLoading(true)
    setQueryDiag(null)
    startTransition(async () => {
      const res = await diagnoseKsefQuery()
      setQueryDiag(res)
      setQueryDiagLoading(false)
    })
  }

  function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    startTransition(async () => {
      const res = await runKsefSync()
      if (res.error) {
        setSyncMsg({ ok: false, text: res.error })
      } else {
        const range = res.dateFrom ? ` (zakres: ${res.dateFrom} – ${res.dateTo})` : ''
        const skippedInfo = res.skipped ? `, pominięto ${res.skipped} duplikatów` : ''
        const errInfo = res.insertErrors?.length ? ` ⚠ błędy insertów (${res.insertErrors.length}): ${res.insertErrors[0]}` : ''
        setSyncMsg({ ok: !res.insertErrors?.length, text: `Pobrano ${res.fetched} faktur z KSeF${range}, dodano ${res.imported} do kolejki${skippedInfo}.${errInfo}` })
        // Odśwież kolejkę po syncu — użytkownik nie musi klikać ręcznie
        const { items } = await fetchQueue('pending')
        setQueue(items)
        setQueueFilter('pending')
      }
      setSyncing(false)
    })
  }

  // ── Queue ──────────────────────────────────────────────────────────────────
  const [queue, setQueue] = useState<QueueItem[]>(initialQueue)
  const [queueFilter, setQueueFilter] = useState<'pending' | 'imported' | 'skipped' | 'all'>('pending')
  // Kategoria per faktura — edytowalna inline w tabeli
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({})
  function getCategory(item: QueueItem) {
    return categoryMap[item.id] ?? item.suggested_category ?? 'pozostałe'
  }
  function setCategory(id: string, cat: string) {
    setCategoryMap(prev => ({ ...prev, [id]: cat }))
  }

  const [importModal, setImportModal] = useState<QueueItem | null>(null)
  const [importForm, setImportForm] = useState({
    communityId: communities[0]?.id ?? '',
    category: 'pozostałe',
    description: '',
    expenseDate: new Date().toISOString().slice(0, 10),
  })
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function loadQueue(status: typeof queueFilter) {
    setQueueFilter(status)
    const { items } = await fetchQueue(status)
    setQueue(items)
  }

  function openImport(item: QueueItem) {
    setImportModal(item)
    setImportForm({
      communityId: item.community_id ?? communities[0]?.id ?? '',
      category: getCategory(item),   // używa kategorii wybranej w dropdownie tabeli
      description: item.seller_name ?? '',
      expenseDate: item.invoice_date ?? new Date().toISOString().slice(0, 10),
    })
    setImportMsg(null)
  }

  function handleImport() {
    if (!importModal) return
    startTransition(async () => {
      const res = await importQueueItem(
        importModal.id,
        importForm.communityId,
        importForm.category,
        importForm.description,
        importForm.expenseDate,
      )
      if (res.error) {
        setImportMsg({ ok: false, text: res.error })
      } else {
        setImportMsg({ ok: true, text: 'Zaimportowano.' })
        setTimeout(() => {
          setImportModal(null)
          loadQueue(queueFilter)
        }, 800)
      }
    })
  }

  function handleSkip(id: string) {
    startTransition(async () => {
      await skipQueueItem(id)
      loadQueue(queueFilter)
    })
  }

  // ─────────────────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'ustawienia', label: '⚙️ Ustawienia' },
    { id: 'sync',       label: '🔄 Synchronizacja', badge: log.filter(l => l.status === 'error').length || undefined },
    { id: 'kolejka',    label: '📥 Kolejka', badge: queue.filter(q => q.status === 'pending').length || undefined },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[#111827] dark:text-white mb-1">Integracja KSeF</h1>
      <p className="text-sm text-[#6b7280] mb-6">Krajowy System e-Faktur — automatyczne pobieranie faktur</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#f3f4f6] dark:bg-[#1f2937] rounded-xl p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all relative ${
              tab === t.id
                ? 'bg-white dark:bg-[#111827] text-[#0f766e] shadow-sm'
                : 'text-[#6b7280] hover:text-[#111827] dark:hover:text-white'
            }`}
          >
            {t.label}
            {t.badge ? (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Ustawienia ──────────────────────────────────────────────────────── */}
      {tab === 'ustawienia' && (
        <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#374151] dark:text-[#d1d5db] mb-1">
                NIP organizacji (10 cyfr)
              </label>
              <input
                name="nip"
                value={form.nip}
                onChange={handleFormChange}
                maxLength={10}
                placeholder="1234567890"
                className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#111827] text-[#111827] dark:text-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] dark:text-[#d1d5db] mb-1">
                Środowisko KSeF
              </label>
              <select
                name="environment"
                value={form.environment}
                onChange={handleFormChange}
                className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#111827] text-[#111827] dark:text-white px-3 py-2 text-sm"
              >
                <option value="prod">Produkcja (api.ksef.mf.gov.pl)</option>
                <option value="test">Test (api-test.ksef.mf.gov.pl)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#374151] dark:text-[#d1d5db] mb-1">
                Token KSeF
              </label>
              <input
                name="ksef_token"
                value={form.ksef_token}
                onChange={handleFormChange}
                type="password"
                placeholder="Token z portalu KSeF → Ustawienia → Tokeny API"
                className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#111827] text-[#111827] dark:text-white px-3 py-2 text-sm font-mono"
              />
              <p className="text-[11px] text-[#9ca3af] mt-1">
                Wygeneruj token w portalu KSeF: https://ksef.mf.gov.pl → Moje konto → Tokeny
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] dark:text-[#d1d5db] mb-1">
                Synchronizuj od daty
              </label>
              <input
                name="sync_from_date"
                value={form.sync_from_date ?? ''}
                onChange={handleFormChange}
                type="date"
                className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#111827] text-[#111827] dark:text-white px-3 py-2 text-sm"
              />
              <p className="text-[11px] text-[#9ca3af] mt-1">Dla pierwszej synchronizacji — później używana jest data ostatniego synca.</p>
            </div>

            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="enabled"
                name="enabled"
                checked={form.enabled}
                onChange={handleFormChange}
                className="w-4 h-4 accent-[#0f766e]"
              />
              <label htmlFor="enabled" className="text-sm font-medium text-[#111827] dark:text-white">
                Integracja aktywna
              </label>
            </div>
          </div>

          {settingsMsg && (
            <p className={`text-sm px-3 py-2 rounded-lg ${settingsMsg.ok ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-700'}`}>
              {settingsMsg.text}
            </p>
          )}

          <button
            onClick={handleSaveSettings}
            disabled={isPending}
            className="px-5 py-2 bg-[#0f766e] text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-[#0d6158] transition-colors"
          >
            {isPending ? 'Zapisuję…' : 'Zapisz ustawienia'}
          </button>

          {/* Status ostatniego synca */}
          {settings?.last_sync_at && (
            <div className="border-t border-[#e5e7eb] dark:border-[#374151] pt-4 text-sm text-[#6b7280]">
              <p>Ostatnia sync: <span className="font-medium text-[#111827] dark:text-white">{fmtDateTime(settings.last_sync_at)}</span></p>
              <p>Status: <span className={`font-medium ${settings.last_sync_status === 'success' ? 'text-teal-600' : 'text-red-500'}`}>{settings.last_sync_status}</span></p>
              {settings.last_sync_count != null && <p>Dodano do kolejki: <span className="font-medium">{settings.last_sync_count}</span></p>}
            </div>
          )}
        </div>
      )}

      {/* ── Synchronizacja ──────────────────────────────────────────────────── */}
      {tab === 'sync' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow p-6">
            <h2 className="font-semibold text-[#111827] dark:text-white mb-3">Ręczna synchronizacja</h2>
            <p className="text-sm text-[#6b7280] mb-4">
              Automatyczny sync uruchamia się codziennie o 02:00. Możesz też uruchomić go ręcznie.
            </p>
            {syncMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg mb-4 ${syncMsg.ok ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-700'}`}>
                {syncMsg.text}
              </p>
            )}
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleSync}
                disabled={isPending || syncing}
                className="px-5 py-2 bg-[#0f766e] text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-[#0d6158] transition-colors"
              >
                {syncing ? '⏳ Synchronizuję…' : '🔄 Synchronizuj teraz'}
              </button>
              <button
                onClick={handleDiagnose}
                disabled={isPending || diagLoading}
                className="px-4 py-2 bg-[#f3f4f6] dark:bg-[#374151] text-[#374151] dark:text-[#d1d5db] rounded-lg text-sm hover:bg-[#e5e7eb] disabled:opacity-50"
              >
                {diagLoading ? '⏳ Diagnozy…' : '🔍 Diagnostyka API'}
              </button>
              <button
                onClick={handleQueryDiagnose}
                disabled={isPending || queryDiagLoading}
                className="px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-lg text-sm hover:bg-amber-200 disabled:opacity-50"
              >
                {queryDiagLoading ? '⏳ Sprawdzam…' : '🧪 Ile faktur per zapytanie?'}
              </button>
            </div>

            {/* Wyniki diagnostyki zapytań */}
            {queryDiag && (
              <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
                  Diagnostyka zapytań KSeF — NIP: {queryDiag.nip ?? '?'}{queryDiag.error ? ` — BŁĄD: ${queryDiag.error}` : ''}
                </p>
                <div className="divide-y divide-amber-100 dark:divide-amber-900">
                  {queryDiag.rows?.map((r, i) => (
                    <div key={i} className="px-4 py-2 text-xs flex flex-col gap-1">
                      <div className="flex gap-3 items-center">
                        <span className="font-mono text-[#6b7280] w-20">{r.subjectType}</span>
                        <span className="font-mono text-[#6b7280] w-16">{r.dateType}</span>
                        <span className={`font-bold ${r.count > 0 ? 'text-teal-600' : 'text-[#9ca3af]'}`}>{r.count} faktur</span>
                        {r.error && <span className="text-red-500 text-[10px] truncate">{r.error}</span>}
                      </div>
                      {r.samples.map((s, j) => (
                        <div key={j} className="ml-36 text-[10px] font-mono text-[#6b7280]">{s}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Wyniki diagnostyki */}
            {diagResults && (
              <div className="mt-4 rounded-xl border border-[#e5e7eb] dark:border-[#374151] overflow-hidden">
                <p className="text-xs font-semibold text-[#6b7280] px-4 py-2 bg-[#f9fafb] dark:bg-[#111827] border-b border-[#e5e7eb] dark:border-[#374151]">
                  Wyniki diagnostyki API KSeF
                </p>
                <div className="divide-y divide-[#e5e7eb] dark:divide-[#374151]">
                  {diagResults.map((r, i) => (
                    <div key={i} className="px-4 py-2 text-xs">
                      <div className="flex gap-2 items-center mb-1">
                        <span className={`font-mono font-bold ${r.status === 200 || r.status === 400 ? 'text-teal-600' : r.status === 0 ? 'text-red-500' : 'text-orange-500'}`}>
                          {r.status || 'ERR'}
                        </span>
                        <span className="text-[#9ca3af] font-mono">{r.method}</span>
                        <span className="text-[#6b7280] break-all">{r.url}</span>
                        <span className="text-[#9ca3af] ml-auto shrink-0">{r.contentType.slice(0, 30)}</span>
                      </div>
                      <pre className="text-[10px] text-[#374151] dark:text-[#d1d5db] bg-[#f9fafb] dark:bg-[#1f2937] rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                        {r.preview}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Historia */}
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e5e7eb] dark:border-[#374151]">
              <h2 className="font-semibold text-[#111827] dark:text-white">Historia synchronizacji</h2>
            </div>
            {log.length === 0 ? (
              <p className="text-sm text-[#6b7280] px-6 py-4">Brak historii.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[#f9fafb] dark:bg-[#111827]">
                  <tr>
                    {['Data', 'Status', 'Pobrano', 'Dodano', 'Pominięto', 'Błąd'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-[#6b7280]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {log.map(l => (
                    <tr key={l.id} className="border-t border-[#e5e7eb] dark:border-[#374151]">
                      <td className="px-4 py-2 text-[#111827] dark:text-white whitespace-nowrap">{fmtDateTime(l.started_at)}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          l.status === 'success' ? 'bg-teal-100 text-teal-700'
                          : l.status === 'error' ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center text-[#374151] dark:text-[#d1d5db]">{l.invoices_fetched}</td>
                      <td className="px-4 py-2 text-center text-teal-600 font-medium">{l.invoices_imported}</td>
                      <td className="px-4 py-2 text-center text-[#374151] dark:text-[#d1d5db]">{l.invoices_skipped}</td>
                      <td className="px-4 py-2 text-red-500 text-xs max-w-[200px] truncate">{l.error_message ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Kolejka ─────────────────────────────────────────────────────────── */}
      {tab === 'kolejka' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2">
            {(['pending', 'imported', 'skipped', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => loadQueue(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  queueFilter === f
                    ? 'bg-[#0f766e] text-white'
                    : 'bg-[#f3f4f6] dark:bg-[#374151] text-[#374151] dark:text-[#d1d5db] hover:bg-[#e5e7eb]'
                }`}
              >
                {{ pending: 'Oczekujące', imported: 'Zaimportowane', skipped: 'Pominięte', all: 'Wszystkie' }[f]}
              </button>
            ))}
          </div>

          {queue.length === 0 ? (
            <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow px-6 py-8 text-center text-[#6b7280]">
              Brak faktur w kolejce dla wybranego filtra.
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f9fafb] dark:bg-[#111827]">
                  <tr>
                    {['Data', 'Sprzedawca', 'Kwota brutto', 'Kategoria', 'Status', 'Akcje'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-[#6b7280]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queue.map(item => (
                    <tr key={item.id} className="border-t border-[#e5e7eb] dark:border-[#374151]">
                      <td className="px-4 py-2 whitespace-nowrap text-[#374151] dark:text-[#d1d5db]">{fmtDate(item.invoice_date)}</td>
                      <td className="px-4 py-2">
                        <p className="font-medium text-[#111827] dark:text-white">{item.seller_name ?? '—'}</p>
                        <p className="text-[11px] text-[#9ca3af]">NIP: {item.seller_nip ?? '—'}</p>
                        {item.ksef_number && <p className="text-[10px] text-[#9ca3af] font-mono">{item.ksef_number}</p>}
                      </td>
                      <td className="px-4 py-2 font-semibold text-[#111827] dark:text-white whitespace-nowrap">{pln(item.gross_amount)}</td>
                      <td className="px-4 py-2">
                        {item.status === 'pending' ? (
                          <select
                            value={getCategory(item)}
                            onChange={e => setCategory(item.id, e.target.value)}
                            className="text-xs rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#1f2937] text-[#111827] dark:text-white px-2 py-1 w-full"
                          >
                            {CATEGORIES.map(c => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-[#6b7280]">{item.suggested_category ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          item.status === 'imported' ? 'bg-teal-100 text-teal-700'
                          : item.status === 'skipped' ? 'bg-gray-100 text-gray-500'
                          : 'bg-amber-100 text-amber-700'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {item.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => openImport(item)}
                              className="px-3 py-1 bg-[#0f766e] text-white rounded-lg text-xs font-semibold hover:bg-[#0d6158]"
                            >
                              Importuj
                            </button>
                            <button
                              onClick={() => handleSkip(item.id)}
                              className="px-3 py-1 bg-[#f3f4f6] dark:bg-[#374151] text-[#374151] dark:text-[#d1d5db] rounded-lg text-xs hover:bg-[#e5e7eb]"
                            >
                              Pomiń
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal importu ───────────────────────────────────────────────────── */}
      {importModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="font-bold text-lg text-[#111827] dark:text-white mb-1">Importuj fakturę</h2>
            <p className="text-sm text-[#6b7280] mb-4">
              {importModal.seller_name} · {pln(importModal.gross_amount)} · {fmtDate(importModal.invoice_date)}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#374151] dark:text-[#d1d5db] mb-1">Wspólnota</label>
                <select
                  value={importForm.communityId}
                  onChange={e => setImportForm(f => ({ ...f, communityId: e.target.value }))}
                  className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#111827] text-[#111827] dark:text-white px-3 py-2 text-sm"
                >
                  {communities.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.nip ? ` (${c.nip})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] dark:text-[#d1d5db] mb-1">Kategoria</label>
                <select
                  value={importForm.category}
                  onChange={e => setImportForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#111827] text-[#111827] dark:text-white px-3 py-2 text-sm"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] dark:text-[#d1d5db] mb-1">Opis</label>
                <input
                  value={importForm.description}
                  onChange={e => setImportForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#111827] text-[#111827] dark:text-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] dark:text-[#d1d5db] mb-1">Data kosztu</label>
                <input
                  type="date"
                  value={importForm.expenseDate}
                  onChange={e => setImportForm(f => ({ ...f, expenseDate: e.target.value }))}
                  className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#111827] text-[#111827] dark:text-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            {importMsg && (
              <p className={`mt-3 text-sm px-3 py-2 rounded-lg ${importMsg.ok ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-700'}`}>
                {importMsg.text}
              </p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleImport}
                disabled={isPending}
                className="flex-1 py-2 bg-[#0f766e] text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {isPending ? 'Importuję…' : 'Importuj jako koszt'}
              </button>
              <button
                onClick={() => setImportModal(null)}
                className="px-4 py-2 bg-[#f3f4f6] dark:bg-[#374151] text-[#374151] dark:text-[#d1d5db] rounded-lg text-sm"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

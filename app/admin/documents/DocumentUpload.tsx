'use client'

import { useRef, useState, useTransition } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import { saveDocument } from './actions'

type Target = 'all' | 'one' | 'selected'

interface Community {
  id: string
  name: string
}

interface Props {
  isSuperAdmin: boolean
  adminCommunityId: string | null
  communities: Community[]
}

export default function DocumentUpload({ isSuperAdmin, adminCommunityId, communities }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [showPanel, setShowPanel] = useState(false)
  const [target, setTarget] = useState<Target>('one')
  const [communityId, setCommunityId] = useState(adminCommunityId ?? '')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const toggleCommunity = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    if (target === 'one' && !communityId) return setError('Wybierz wspólnotę.')
    if (target === 'selected' && selectedIds.length === 0) return setError('Wybierz co najmniej jedną wspólnotę.')

    const supabase = getSupabaseBrowserClient()
    const storagePath = `${crypto.randomUUID()}/${file.name}`

    startTransition(async () => {
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, { upsert: false })

      if (uploadError) {
        setError('Błąd uploadu: ' + uploadError.message)
        return
      }

      try {
        await saveDocument({
          name: file.name,
          storage_path: storagePath,
          target,
          community_id: target === 'one' ? communityId : null,
          community_ids: target === 'selected' ? selectedIds : [],
        })
        setShowPanel(false)
        if (fileRef.current) fileRef.current.value = ''
      } catch (err: any) {
        setError(err.message)
      }
    })
  }

  return (
    <div className="space-y-3">
      {!showPanel ? (
        <button
          onClick={() => setShowPanel(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          + Dodaj dokument
        </button>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-gray-800 text-sm">Nowy dokument</h3>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Zasięg — tylko super_admin */}
          {isSuperAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zasięg</label>
              <div className="flex gap-2 flex-wrap">
                {([
                  { value: 'all', label: '🌐 Wszystkie' },
                  { value: 'selected', label: '☑️ Wybrane' },
                  { value: 'one', label: '🏢 Jedna' },
                ] as { value: Target; label: string }[]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTarget(opt.value)}
                    className={`text-sm px-3 py-1.5 rounded-lg border font-medium transition ${
                      target === opt.value
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isSuperAdmin && target === 'one' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wspólnota</label>
              <select
                value={communityId}
                onChange={(e) => setCommunityId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wybierz wspólnotę…</option>
                {communities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {isSuperAdmin && target === 'selected' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wybierz wspólnoty</label>
              <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {communities.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(c.id)}
                      onChange={() => toggleCommunity(c.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 items-center">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              {isPending ? 'Przesyłanie…' : 'Wybierz plik i wyślij'}
            </button>
            <button
              onClick={() => { setShowPanel(false); setError(null) }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Anuluj
            </button>
          </div>

          <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
        </div>
      )}
    </div>
  )
}

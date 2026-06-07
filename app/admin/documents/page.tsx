'use client'

import { useEffect, useState, useRef } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

export default function DocumentsPage() {
  const supabase = getSupabaseBrowserClient()
  const [profile, setProfile] = useState<any>(null)
  const [files, setFiles] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchFiles = async (p: any) => {
    const folder = p.community_id ?? ''
    const { data } = await supabase.storage
      .from('documents')
      .list(folder, { sortBy: { column: 'created_at', order: 'desc' } })
    setFiles(data ?? [])
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      await fetchFiles(p)
      setLoading(false)
    }
    load()
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setUploading(true)
    const path = `${profile.community_id}/${file.name}`
    await supabase.storage.from('documents').upload(path, file, { upsert: true })
    await fetchFiles(profile)
    setUploading(false)
  }

  const getPublicUrl = (name: string) => {
    const path = `${profile?.community_id}/${name}`
    const { data } = supabase.storage.from('documents').getPublicUrl(path)
    return data.publicUrl
  }

  const canUpload = profile?.role === 'super_admin' || profile?.role === 'admin'

  if (loading) return <p className="text-sm text-gray-400">Ladowanie...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Dokumenty</h2>
        {canUpload && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            {uploading ? 'Przesylanie...' : '+ Dodaj dokument'}
          </button>
        )}
        <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {files.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">Brak dokumentow.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {files.map((f) => (
              <li key={f.name} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">dokument</span>
                  <span className="text-sm font-medium text-gray-800">{f.name}</span>
                </div>
                <a
                  href={getPublicUrl(f.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Pobierz
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
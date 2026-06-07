import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DocumentUpload from './DocumentUpload'
import { deleteDocument } from './actions'

export default async function DocumentsPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const admin = getSupabaseAdminClient()
  const isSuperAdmin = profile.role === 'super_admin'
  const canUpload = isSuperAdmin || profile.role === 'admin'

  // Zapytanie 1: dokumenty + wspólnota (prosta relacja)
  const { data: docs } = await admin
    .from('documents')
    .select('*, community:communities(id, name)')
    .order('created_at', { ascending: false })

  // Zapytanie 2: junction table
  const { data: junctions } = await admin
    .from('document_communities')
    .select('document_id, community:communities(id, name)')

  const junctionMap: Record<string, { id: string; name: string }[]> = {}
  for (const j of junctions ?? []) {
    if (!junctionMap[j.document_id]) junctionMap[j.document_id] = []
    if (j.community) junctionMap[j.document_id].push(j.community as any)
  }

  const documents = isSuperAdmin
    ? (docs ?? [])
    : (docs ?? []).filter((d: any) => {
        if (d.target === 'all') return true
        if (d.target === 'one') return d.community_id === profile.community_id
        if (d.target === 'selected') {
          return (junctionMap[d.id] ?? []).some((c) => c.id === profile.community_id)
        }
        return false
      })

  const { data: communities } = isSuperAdmin
    ? await admin.from('communities').select('id, name').order('name')
    : { data: [] }

  const getPublicUrl = (storagePath: string) => {
    const { data } = admin.storage.from('documents').getPublicUrl(storagePath)
    return data.publicUrl
  }

  const targetLabel = (d: any) => {
    if (d.target === 'all') return { text: 'Wszystkie wspólnoty', cls: 'bg-blue-50 text-blue-700' }
    if (d.target === 'one') return { text: (d.community as any)?.name ?? '—', cls: 'bg-gray-100 text-gray-600' }
    const names = (junctionMap[d.id] ?? []).map((c) => c.name)
    return { text: names.join(', ') || '—', cls: 'bg-purple-50 text-purple-700' }
  }

  const fileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return '📄'
    if (['doc', 'docx'].includes(ext ?? '')) return '📝'
    if (['xls', 'xlsx'].includes(ext ?? '')) return '📊'
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext ?? '')) return '🖼️'
    return '📁'
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dokumenty</h2>

      {canUpload && (
        <DocumentUpload
          isSuperAdmin={isSuperAdmin}
          adminCommunityId={profile.community_id}
          communities={communities ?? []}
        />
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {documents.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">Brak dokumentów.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {documents.map((d: any) => {
              const { text, cls } = targetLabel(d)
              return (
                <li key={d.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl flex-shrink-0">{fileIcon(d.name)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{d.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
                          {text}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(d.created_at).toLocaleDateString('pl-PL')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <a
                      href={getPublicUrl(d.storage_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Pobierz
                    </a>
                    {canUpload && (
                      <form action={deleteDocument.bind(null, d.id, d.storage_path)}>
                        <button type="submit" className="text-sm text-red-500 hover:text-red-700">
                          Usuń
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { redirect } from 'next/navigation'
import DocumentUpload from './DocumentUpload'
import DocPreviewButton from './DocPreviewButton'
import { deleteDocument } from './actions'

export default async function DocumentsPage() {
  const { user, profile } = await getAuthProfile()

  const admin = getSupabaseAdminClient()
  const isSuperAdmin = profile.role === 'super_admin'
  const canUpload = isSuperAdmin || profile.role === 'admin'

  // Zapytanie 1: dokumenty — prosty select bez joina
  const { data: docs } = await admin
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  // Zapytanie 2: junction table
  const { data: junctions } = await admin
    .from('document_communities')
    .select('document_id, community_id')

  // Zapytanie 3: wszystkie wspólnoty
  const { data: allCommunities } = await admin
    .from('communities')
    .select('id, name')
    .order('name')

  const communityMap: Record<string, string> = {}
  for (const c of allCommunities ?? []) {
    communityMap[c.id] = c.name
  }

  const junctionMap: Record<string, string[]> = {}
  for (const j of junctions ?? []) {
    if (!junctionMap[j.document_id]) junctionMap[j.document_id] = []
    junctionMap[j.document_id].push(j.community_id)
  }

  const documents = isSuperAdmin
    ? (docs ?? [])
    : (docs ?? []).filter((d: any) => {
        if (d.target === 'all') return true
        if (d.target === 'one') return d.community_id === profile.community_id
        if (d.target === 'selected') {
          return (junctionMap[d.id] ?? []).includes(profile.community_id ?? '')
        }
        return false
      })

  const communities = isSuperAdmin ? (allCommunities ?? []) : []

  const getPublicUrl = (storagePath: string) => {
    const { data } = admin.storage.from('documents').getPublicUrl(storagePath)
    return data.publicUrl
  }

  const targetLabel = (d: any) => {
    if (d.target === 'all') return { text: 'Wszystkie wspólnoty', cls: 'bg-blue-950/40 text-blue-400' }
    if (d.target === 'one') return { text: communityMap[d.community_id] ?? '—', cls: 'bg-gray-900 text-gray-400' }
    const names = (junctionMap[d.id] ?? []).map((cid) => communityMap[cid] ?? cid)
    return { text: names.join(', ') || '—', cls: 'bg-purple-950/30 text-purple-400' }
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
      <h2 className="text-2xl font-bold text-gray-100">Dokumenty</h2>

      {canUpload && (
        <DocumentUpload
          isSuperAdmin={isSuperAdmin}
          adminCommunityId={profile.community_id}
          communities={communities ?? []}
        />
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
        {documents.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">Brak dokumentów.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {documents.map((d: any) => {
              const { text, cls } = targetLabel(d)
              return (
                <li key={d.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-950 transition gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl flex-shrink-0">{fileIcon(d.name)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">{d.name}</p>
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
                    <DocPreviewButton url={getPublicUrl(d.storage_path)} name={d.name} />
                    {canUpload && (
                      <form action={deleteDocument.bind(null, d.id, d.storage_path)}>
                        <button type="submit" className="text-sm text-red-500 hover:text-red-400">
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

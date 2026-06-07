'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient, getSupabaseServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/audit'

async function requireUploader() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Brak autoryzacji')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, community_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role === 'user') throw new Error('Brak uprawnień')
  return { user, profile }
}

export async function saveDocument(data: {
  name: string
  storage_path: string
  target: 'all' | 'one' | 'selected'
  community_id: string | null
  community_ids: string[]
}) {
  const { user, profile } = await requireUploader()

  // Walidacja wejścia
  const name = data.name?.trim()
  if (!name || name.length < 1 || name.length > 200) throw new Error('Nazwa pliku musi mieć 1–200 znaków')
  if (!['all', 'one', 'selected'].includes(data.target)) throw new Error('Nieprawidłowy cel dokumentu')
  if (!data.storage_path || data.storage_path.includes('..') || data.storage_path.length > 500) {
    throw new Error('Nieprawidłowa ścieżka pliku')
  }

  // Admin może dodawać dokumenty tylko do swojej wspólnoty
  if (profile.role === 'admin') {
    if (data.target !== 'one' || data.community_id !== profile.community_id) {
      throw new Error('Admin może dodawać dokumenty tylko do swojej wspólnoty')
    }
  }

  const admin = getSupabaseAdminClient()

  const { data: doc, error } = await admin
    .from('documents')
    .insert({
      name: data.name,
      storage_path: data.storage_path,
      target: data.target,
      community_id: data.target === 'one' ? data.community_id : null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await logActivity({ userId: user.id, action: 'upload_document', targetType: 'document', targetId: doc.id, meta: { name: data.name, target: data.target } })

  if (data.target === 'selected' && data.community_ids.length > 0) {
    const rows = data.community_ids.map((cid) => ({
      document_id: doc.id,
      community_id: cid,
    }))
    const { error: junctionError } = await admin
      .from('document_communities')
      .insert(rows)
    if (junctionError) throw new Error(junctionError.message)
  }

  revalidatePath('/admin/documents')
}

export async function deleteDocument(docId: string, storagePath: string) {
  const { user, profile } = await requireUploader()

  const admin = getSupabaseAdminClient()

  // Admin może usuwać tylko dokumenty swojej wspólnoty
  if (profile.role === 'admin') {
    const { data: doc } = await admin.from('documents').select('community_id').eq('id', docId).single()
    if (doc?.community_id !== profile.community_id) throw new Error('Brak uprawnień')
  }

  await admin.storage.from('documents').remove([storagePath])
  await admin.from('documents').delete().eq('id', docId)
  await logActivity({ userId: user.id, action: 'delete_document', targetType: 'document', targetId: docId })

  revalidatePath('/admin/documents')
}

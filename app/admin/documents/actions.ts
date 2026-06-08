'use server'
import { getAuthProfileAction } from '@/lib/getAuthProfile'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/audit'
import { extractText, splitIntoChunks } from '@/lib/docChunker'

async function requireUploader() {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) throw new Error(auth.error)
  if (auth.profile.role === 'user') throw new Error('Brak uprawnień')
  return { user: auth.user, profile: auth.profile }
}

export async function uploadDocument(formData: FormData) {
  const { user, profile } = await requireUploader()

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) throw new Error('Brak pliku')
  if (file.size > 20 * 1024 * 1024) throw new Error('Plik może mieć maksymalnie 20 MB')

  const target = formData.get('target') as string
  const community_id = formData.get('community_id') as string | null
  const community_ids = formData.getAll('community_ids') as string[]

  if (!['all', 'one', 'selected'].includes(target)) throw new Error('Nieprawidłowy cel dokumentu')

  const name = file.name.trim()
  if (!name || name.length > 200) throw new Error('Nazwa pliku musi mieć 1–200 znaków')

  // Admin może dodawać dokumenty tylko do swojej wspólnoty
  if (profile.role === 'admin') {
    if (target !== 'one' || community_id !== profile.community_id) {
      throw new Error('Admin może dodawać dokumenty tylko do swojej wspólnoty')
    }
  }

  const admin = getSupabaseAdminClient()

  // Upload pliku przez admin client — omija RLS
  const storagePath = `${crypto.randomUUID()}/${name}`
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await admin.storage
    .from('documents')
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadError) throw new Error('Błąd uploadu: ' + uploadError.message)

  const { data: doc, error } = await admin
    .from('documents')
    .insert({
      name,
      storage_path: storagePath,
      target,
      community_id: target === 'one' ? community_id : null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await logActivity({ userId: user.id, action: 'upload_document', targetType: 'document', targetId: doc.id, meta: { name, target } })

  // Ekstrakcja tekstu i zapis chunków dla AI chatbota
  try {
    const buffer = Buffer.from(arrayBuffer)
    const text = await extractText(buffer, name)
    if (text.trim().length > 0) {
      const chunks = splitIntoChunks(text)
      const chunkCommunityId = target === 'one' ? community_id : null
      const rows = chunks.map((content, chunk_index) => ({
        document_id: doc.id,
        community_id: chunkCommunityId,
        content,
        chunk_index,
      }))
      await admin.from('document_chunks').insert(rows)
    }
  } catch (e) {
    console.error('[uploadDocument] chunk extraction failed:', e)
    // nie blokuj uploadu jeśli ekstrakcja tekstu się nie powiedzie
  }

  if (target === 'selected' && community_ids.length > 0) {
    const rows = community_ids.map((cid) => ({ document_id: doc.id, community_id: cid }))
    const { error: junctionError } = await admin.from('document_communities').insert(rows)
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

'use server'
import { getAuthProfileAction } from '@/lib/getAuthProfile'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient } from '@/lib/supabase/server'

export async function createPost(content: string, communityId?: string): Promise<{ error?: string }> {
  try {
    const auth = await getAuthProfileAction()
    if (auth.error !== null) return { error: auth.error }
    const { user, profile } = auth

    const effectiveCommunityId = communityId ?? profile.community_id
    if (!effectiveCommunityId) return { error: 'Brak przypisanej wspólnoty' }

    const trimmed = content?.trim()
    if (!trimmed || trimmed.length < 3) return { error: 'Wiadomość musi mieć min. 3 znaki' }
    if (trimmed.length > 1000) return { error: 'Wiadomość może mieć max 1000 znaków' }

    const admin = getSupabaseAdminClient()
    const { error } = await admin.from('board_posts').insert({
      content: trimmed,
      community_id: effectiveCommunityId,
      author_id: user.id,
    })

    if (error) return { error: error.message }
    revalidatePath('/admin/board')
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

export async function deletePost(postId: string): Promise<{ error?: string }> {
  try {
    const auth = await getAuthProfileAction()
    if (auth.error !== null) return { error: auth.error }
    const { user, profile } = auth
    if (!profile) return { error: 'Brak autoryzacji' }

    const admin = getSupabaseAdminClient()
    const { data: post } = await admin
      .from('board_posts')
      .select('author_id, community_id')
      .eq('id', postId)
      .single()

    if (!post) return { error: 'Post nie istnieje' }

    // Własny post lub admin/super_admin tej wspólnoty
    const canDelete =
      post.author_id === user.id ||
      profile.role === 'super_admin' ||
      (profile.role === 'admin' && post.community_id === profile.community_id)

    if (!canDelete) return { error: 'Brak uprawnień' }

    await admin.from('board_posts').delete().eq('id', postId)
    revalidatePath('/admin/board')
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

export async function togglePin(postId: string, pinned: boolean): Promise<{ error?: string }> {
  try {
    const auth = await getAuthProfileAction()
    if (auth.error !== null) return { error: auth.error }
    const { user, profile } = auth

    if (!profile || profile.role === 'user') return { error: 'Brak uprawnień' }

    const admin = getSupabaseAdminClient()
    await admin.from('board_posts').update({ pinned: !pinned }).eq('id', postId)
    revalidatePath('/admin/board')
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

export async function createReply(postId: string, content: string): Promise<{ error?: string }> {
  try {
    const auth = await getAuthProfileAction()
    if (auth.error !== null) return { error: auth.error }
    const { user } = auth

    const trimmed = content?.trim()
    if (!trimmed || trimmed.length < 2) return { error: 'Odpowiedź musi mieć min. 2 znaki' }
    if (trimmed.length > 500) return { error: 'Odpowiedź może mieć max 500 znaków' }

    const admin = getSupabaseAdminClient()
    const { error } = await admin.from('board_replies').insert({
      post_id: postId,
      author_id: user.id,
      content: trimmed,
    })

    if (error) return { error: error.message }
    revalidatePath('/admin/board')
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

export async function deleteReply(replyId: string): Promise<{ error?: string }> {
  try {
    const auth = await getAuthProfileAction()
    if (auth.error !== null) return { error: auth.error }
    const { user, profile } = auth
    if (!profile) return { error: 'Brak autoryzacji' }

    const admin = getSupabaseAdminClient()
    const { data: reply } = await admin
      .from('board_replies')
      .select('author_id, post_id')
      .eq('id', replyId)
      .single()

    if (!reply) return { error: 'Odpowiedź nie istnieje' }

    const canDelete =
      reply.author_id === user.id ||
      profile.role === 'super_admin' ||
      profile.role === 'admin'

    if (!canDelete) return { error: 'Brak uprawnień' }

    await admin.from('board_replies').delete().eq('id', replyId)
    revalidatePath('/admin/board')
    return {}
  } catch (e: any) {
    return { error: e.message ?? 'Nieznany błąd' }
  }
}

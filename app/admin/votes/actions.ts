'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthProfileAction } from '@/lib/getAuthProfile'
import { verifyPin } from '@/lib/pin'

async function getActor() {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) throw new Error(auth.error)
  return { user: auth.user, profile: auth.profile }
}

// ── TWORZENIE UCHWAŁY ────────────────────────────────────────────────────────

export async function createVote(data: {
  title: string
  description?: string
  voting_method: 'by_share' | 'one_per_owner'
  deadline?: string | null
  community_id: string
}): Promise<{ error?: string; id?: string }> {
  const { user, profile } = await getActor()
  if (profile.role === 'user') return { error: 'Brak uprawnień' }
  if (profile.role === 'admin' && profile.community_id !== data.community_id)
    return { error: 'Brak uprawnień do tej wspólnoty' }

  if (!data.title.trim()) return { error: 'Tytuł jest wymagany' }

  const admin = getSupabaseAdminClient()
  const { data: vote, error } = await admin.from('votes').insert({
    community_id: data.community_id,
    created_by: user.id,
    title: data.title.trim(),
    description: data.description?.trim() || null,
    voting_method: data.voting_method,
    deadline: data.deadline || null,
    status: 'open',
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/admin/votes')
  return { id: vote.id }
}

// ── ODDANIE GŁOSU ────────────────────────────────────────────────────────────

export async function castVote(data: {
  vote_id: string
  choice: 'yes' | 'no' | 'abstain'
  pin: string
}): Promise<{ error?: string }> {
  const { user, profile } = await getActor()

  // Weryfikuj PIN
  const admin = getSupabaseAdminClient()
  const { data: profileData } = await admin
    .from('profiles')
    .select('voting_pin_hash')
    .eq('id', user.id)
    .single()

  if (!profileData?.voting_pin_hash)
    return { error: 'Nie masz ustawionego PINu. Ustaw PIN w Profilu przed głosowaniem.' }

  const pinValid = await verifyPin(data.pin, profileData.voting_pin_hash)
  if (!pinValid) return { error: 'Nieprawidłowy PIN' }

  // Sprawdź czy głosowanie jest otwarte
  const { data: vote } = await admin.from('votes').select('*').eq('id', data.vote_id).single()
  if (!vote) return { error: 'Głosowanie nie istnieje' }
  if (vote.status !== 'open') return { error: 'Głosowanie jest już zamknięte' }
  if (vote.deadline && new Date(vote.deadline) < new Date())
    return { error: 'Termin głosowania minął' }

  // Pobierz mieszkanie właściciela (dla udziału)
  const { data: apartment } = await admin
    .from('settlement_apartments')
    .select('id, share_numerator, share_denominator')
    .eq('owner_id', user.id)
    .eq('community_id', vote.community_id)
    .eq('active', true)
    .single()

  const shareValue = apartment?.share_numerator && apartment?.share_denominator
    ? apartment.share_numerator / apartment.share_denominator
    : 1

  const { error } = await admin.from('vote_choices').upsert({
    vote_id: data.vote_id,
    user_id: user.id,
    apartment_id: apartment?.id ?? null,
    choice: data.choice,
    share_value: shareValue,
  }, { onConflict: 'vote_id,user_id' })

  if (error) return { error: error.message }
  revalidatePath(`/admin/votes/${data.vote_id}`)
  revalidatePath('/admin/votes')
  return {}
}

// ── ZAMKNIĘCIE GŁOSOWANIA ────────────────────────────────────────────────────

export async function closeVote(voteId: string): Promise<{ error?: string }> {
  const { profile } = await getActor()
  if (profile.role === 'user') return { error: 'Brak uprawnień' }

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('votes')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', voteId)

  if (error) return { error: error.message }
  revalidatePath('/admin/votes')
  revalidatePath(`/admin/votes/${voteId}`)
  return {}
}

export async function deleteVote(voteId: string): Promise<{ error?: string }> {
  const { profile } = await getActor()
  if (profile.role === 'user') return { error: 'Brak uprawnień' }

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('votes').delete().eq('id', voteId)
  if (error) return { error: error.message }
  revalidatePath('/admin/votes')
  return {}
}

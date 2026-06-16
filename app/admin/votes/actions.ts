'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthProfileAction } from '@/lib/getAuthProfile'
import { verifyPin } from '@/lib/pin'
import { sendNewVoteEmail } from '@/lib/email'

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
  link_url?: string | null
  attachment_path?: string | null
}): Promise<{ error?: string; id?: string }> {
  const { user, profile } = await getActor()
  if (profile.role === 'user') return { error: 'Brak uprawnień' }
  if (profile.role === 'admin' && profile.community_id !== data.community_id)
    return { error: 'Brak uprawnień do tej wspólnoty' }

  if (!data.title.trim()) return { error: 'Tytuł jest wymagany' }

  if (data.link_url) {
    try { new URL(data.link_url) } catch {
      return { error: 'Nieprawidłowy adres URL linku' }
    }
  }

  const admin = getSupabaseAdminClient()
  const { data: vote, error } = await admin.from('votes').insert({
    community_id: data.community_id,
    created_by: user.id,
    title: data.title.trim(),
    description: data.description?.trim() || null,
    voting_method: data.voting_method,
    deadline: data.deadline || null,
    status: 'open',
    link_url: data.link_url || null,
    attachment_path: data.attachment_path || null,
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/admin/votes')

  // Wyślij emaile do aktywnych mieszkańców wspólnoty
  try {
    const [usersRes, communityRes] = await Promise.all([
      admin.from('profiles')
        .select('email')
        .eq('community_id', data.community_id)
        .eq('role', 'user')
        .eq('status', 'active')
        .not('email', 'is', null),
      admin.from('communities').select('name').eq('id', data.community_id).single(),
    ])
    const emails = (usersRes.data ?? []).map(u => u.email).filter(Boolean) as string[]
    if (emails.length > 0) {
      await sendNewVoteEmail({
        to: emails,
        voteTitle: data.title,
        voteDescription: data.description,
        deadline: data.deadline,
        communityName: communityRes.data?.name ?? '',
        voteId: vote.id,
      })
    }
  } catch {}

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

  // Pobierz lokal użytkownika z profiles.apartment_id (nowy system — wiele userów per lokal)
  const { data: profileWithApt } = await admin
    .from('profiles')
    .select('apartment_id')
    .eq('id', user.id)
    .single()

  const apartmentId = (profileWithApt as any)?.apartment_id ?? null

  if (!apartmentId)
    return { error: 'Nie masz przypisanego lokalu. Skontaktuj się z administratorem.' }

  // Pobierz udział lokalu
  const { data: apartment } = await admin
    .from('settlement_apartments')
    .select('id, share_numerator, share_denominator, community_id')
    .eq('id', apartmentId)
    .eq('community_id', vote.community_id)
    .eq('active', true)
    .single()

  if (!apartment)
    return { error: 'Twój lokal nie należy do tej wspólnoty lub jest nieaktywny.' }

  const shareValue = apartment.share_numerator && apartment.share_denominator
    ? apartment.share_numerator / apartment.share_denominator
    : 1

  // Sprawdź czy ten lokal już głosował
  const { data: existingVote } = await admin
    .from('vote_choices')
    .select('id, user_id')
    .eq('vote_id', data.vote_id)
    .eq('apartment_id', apartment.id)
    .maybeSingle()

  if (existingVote && existingVote.user_id !== user.id)
    return { error: 'Ten lokal już oddał głos w tej uchwale.' }

  const { error } = await admin.from('vote_choices').upsert({
    vote_id: data.vote_id,
    user_id: user.id,
    apartment_id: apartment.id,
    choice: data.choice,
    share_value: shareValue,
  }, { onConflict: 'vote_id,apartment_id' })

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

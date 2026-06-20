'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthProfileAction } from '@/lib/getAuthProfile'
import { verifyPin } from '@/lib/pin'
import { sendNewVoteEmail, sendVoteClosedEmail } from '@/lib/email'
import { logActivity } from '@/lib/audit'

async function getActor() {
  const auth = await getAuthProfileAction()
  if (auth.error !== null) throw new Error(auth.error)
  return { user: auth.user, profile: auth.profile }
}

// ── UPLOAD ZAŁĄCZNIKA (admin client omija RLS storage) ───────────────────────

export async function uploadVoteAttachment(formData: FormData): Promise<{ error?: string; path?: string }> {
  const { profile } = await getActor()
  if (profile.role === 'user') return { error: 'Brak uprawnień' }

  const file = formData.get('file') as File | null
  if (!file) return { error: 'Brak pliku' }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `votes/${Date.now()}_${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const admin = getSupabaseAdminClient()
  const { error } = await admin.storage
    .from('documents')
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (error) return { error: error.message }
  return { path }
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
  resolution_number?: number | null
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

  // Użyj numeru podanego przez użytkownika lub auto-wylicz
  let resolvedNumber = data.resolution_number ?? null
  if (!resolvedNumber) {
    const currentYear = new Date().getFullYear()
    const { data: lastNum } = await admin
      .from('votes')
      .select('resolution_number')
      .eq('community_id', data.community_id)
      .gte('created_at', `${currentYear}-01-01`)
      .order('resolution_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    resolvedNumber = ((lastNum as any)?.resolution_number ?? 0) + 1
  }

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
    resolution_number: resolvedNumber,
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/admin/votes')

  // Wyślij emaile do mieszkańców wspólnoty
  try {
    const [usersRes, communityRes] = await Promise.all([
      admin.from('profiles')
        .select('id, email')
        .eq('community_id', data.community_id)
        .eq('role', 'user')
        .in('status', ['active', 'pending']),  // uwzględnij też pending
      admin.from('communities').select('name').eq('id', data.community_id).single(),
    ])

    const profileUsers = usersRes.data ?? []

    // Dla profili bez emaila pobierz email z auth.users
    const missingEmailIds = profileUsers.filter(u => !u.email).map(u => u.id)
    let authEmailMap: Record<string, string> = {}
    if (missingEmailIds.length > 0) {
      const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 })
      for (const u of authList?.users ?? []) {
        if (missingEmailIds.includes(u.id) && u.email) {
          authEmailMap[u.id] = u.email
        }
      }
    }

    const emails = profileUsers
      .map(u => u.email || authEmailMap[u.id] || null)
      .filter(Boolean) as string[]

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

  let voteError: { message: string } | null = null

  if (existingVote) {
    // Ten sam użytkownik zmienia głos — UPDATE
    const { error } = await admin.from('vote_choices')
      .update({ choice: data.choice, share_value: shareValue, user_id: user.id })
      .eq('id', existingVote.id)
    voteError = error
  } else {
    // Pierwszy głos z tego lokalu — INSERT
    const { error } = await admin.from('vote_choices').insert({
      vote_id: data.vote_id,
      user_id: user.id,
      apartment_id: apartment.id,
      choice: data.choice,
      share_value: shareValue,
    })
    voteError = error
  }

  if (voteError) return { error: voteError.message }
  revalidatePath(`/admin/votes/${data.vote_id}`)
  revalidatePath('/admin/votes')
  return {}
}

// ── GŁOS W IMIENIU MIESZKAŃCA (tylko super_admin) ────────────────────────────
// Np. mieszkaniec oddał głos na papierowej karcie, nie ma konta / dostępu do
// internetu — super_admin wprowadza go ręcznie. Bez PINu (super_admin loguje
// się własną sesją), ale zawsze ze śladem audytowym (cast_by_admin, recorded_by).

export async function castVoteAsAdmin(data: {
  vote_id: string
  apartment_id: string
  choice: 'yes' | 'no' | 'abstain'
}): Promise<{ error?: string }> {
  const { user, profile } = await getActor()
  if (profile.role !== 'super_admin')
    return { error: 'Tylko super_admin może dodać głos w imieniu mieszkańca.' }

  const admin = getSupabaseAdminClient()

  const { data: vote } = await admin.from('votes').select('*').eq('id', data.vote_id).single()
  if (!vote) return { error: 'Głosowanie nie istnieje' }
  if (vote.status !== 'open') return { error: 'Głosowanie jest już zamknięte' }
  if (vote.deadline && new Date(vote.deadline) < new Date())
    return { error: 'Termin głosowania minął' }

  const { data: apartment } = await admin
    .from('settlement_apartments')
    .select('id, share_numerator, share_denominator, community_id')
    .eq('id', data.apartment_id)
    .eq('community_id', vote.community_id)
    .eq('active', true)
    .single()

  if (!apartment) return { error: 'Lokal nie należy do tej wspólnoty lub jest nieaktywny.' }

  const shareValue = apartment.share_numerator && apartment.share_denominator
    ? apartment.share_numerator / apartment.share_denominator
    : 1

  // Atrybucja głosu do mieszkańca przypisanego do lokalu (jeśli jest taki
  // profil) — żeby wynik czytało się naturalnie jako głos tego mieszkańca.
  // Jeśli lokal nie ma przypisanego konta, głos i tak zostaje zapisany
  // (user_id = super_admin), ale zawsze z flagą cast_by_admin = true.
  const { data: residentProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('apartment_id', apartment.id)
    .limit(1)
    .maybeSingle()

  const attributedUserId = residentProfile?.id ?? user.id

  const { data: existingChoice } = await admin
    .from('vote_choices')
    .select('id')
    .eq('vote_id', data.vote_id)
    .eq('apartment_id', apartment.id)
    .maybeSingle()

  let voteError: { message: string } | null = null

  if (existingChoice) {
    const { error } = await admin.from('vote_choices')
      .update({
        choice: data.choice,
        share_value: shareValue,
        user_id: attributedUserId,
        cast_by_admin: true,
        recorded_by: user.id,
      })
      .eq('id', existingChoice.id)
    voteError = error
  } else {
    const { error } = await admin.from('vote_choices').insert({
      vote_id: data.vote_id,
      user_id: attributedUserId,
      apartment_id: apartment.id,
      choice: data.choice,
      share_value: shareValue,
      cast_by_admin: true,
      recorded_by: user.id,
    })
    voteError = error
  }

  if (voteError) return { error: voteError.message }

  await logActivity({
    userId: user.id,
    action: 'cast_vote_as_admin',
    targetType: 'vote',
    targetId: data.vote_id,
    meta: { apartment_id: apartment.id, choice: data.choice },
  })

  revalidatePath(`/admin/votes/${data.vote_id}`)
  revalidatePath('/admin/votes')
  return {}
}

// ── ZMIANA NUMERU UCHWAŁY ────────────────────────────────────────────────────

export async function updateResolutionNumber(voteId: string, resolutionNumber: number): Promise<{ error?: string }> {
  const { profile } = await getActor()
  if (profile.role === 'user') return { error: 'Brak uprawnień' }

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('votes')
    .update({ resolution_number: resolutionNumber })
    .eq('id', voteId)

  if (error) return { error: error.message }
  revalidatePath('/admin/votes')
  revalidatePath('/admin/votes/rejestr')
  return {}
}

// ── ZAMKNIĘCIE GŁOSOWANIA ────────────────────────────────────────────────────

export async function closeVote(voteId: string): Promise<{ error?: string }> {
  const { profile } = await getActor()
  if (profile.role === 'user') return { error: 'Brak uprawnień' }

  return closeVoteAndNotify(voteId)
}

// ── PONOWNE OTWARCIE GŁOSOWANIA ───────────────────────────────────────────────
// Np. zamknięto przez pomyłkę, albo trzeba dopuścić jeszcze jeden głos.
// Jeśli termin już minął, czyścimy go (głosowanie staje się bezterminowe) —
// inaczej oddanie głosu i tak byłoby zablokowane przez sprawdzenie deadline.
// Admin może potem ustawić nowy termin przez "Edytuj".

export async function reopenVote(voteId: string): Promise<{ error?: string; deadlineCleared?: boolean }> {
  const { user, profile } = await getActor()
  if (profile.role === 'user') return { error: 'Brak uprawnień' }

  const admin = getSupabaseAdminClient()

  const { data: vote } = await admin.from('votes').select('deadline').eq('id', voteId).single()
  if (!vote) return { error: 'Głosowanie nie istnieje' }

  const deadlinePassed = !!(vote.deadline && new Date(vote.deadline) < new Date())

  const { error } = await admin.from('votes').update({
    status: 'open',
    closed_at: null,
    reminder_sent_at: null,
    ...(deadlinePassed ? { deadline: null } : {}),
  }).eq('id', voteId)

  if (error) return { error: error.message }

  await logActivity({ userId: user.id, action: 'reopen_vote', targetType: 'vote', targetId: voteId })

  revalidatePath('/admin/votes')
  revalidatePath('/admin/votes/rejestr')
  revalidatePath(`/admin/votes/${voteId}`)
  return { deadlineCleared: deadlinePassed }
}

/**
 * Właściwa logika zamknięcia głosowania (zapis statusu + e-mail z wynikami),
 * bez sprawdzania uprawnień zalogowanego użytkownika — używana przez:
 *  - closeVote() (akcja z panelu, sprawdza rolę przed wywołaniem),
 *  - cron /api/cron/close-votes (autoryzacja przez CRON_SECRET, brak sesji usera).
 */
export async function closeVoteAndNotify(voteId: string): Promise<{ error?: string }> {
  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('votes')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', voteId)

  if (error) return { error: error.message }
  revalidatePath('/admin/votes')
  revalidatePath(`/admin/votes/${voteId}`)

  // Wyślij email z wynikami do adminów i super_adminów wspólnoty
  try {
    const { data: vote } = await admin
      .from('votes')
      .select('title, community_id, voting_method, resolution_number, created_at, choices:vote_choices(choice, share_value, apartment_id)')
      .eq('id', voteId)
      .single()

    if (vote) {
      const choices = (vote.choices ?? []) as any[]
      const byShare = vote.voting_method === 'by_share'
      const yes     = choices.filter(c => c.choice === 'yes').reduce((s: number, c: any) => s + (byShare ? c.share_value : 1), 0)
      const no      = choices.filter(c => c.choice === 'no').reduce((s: number, c: any) => s + (byShare ? c.share_value : 1), 0)
      const abstain = choices.filter(c => c.choice === 'abstain').reduce((s: number, c: any) => s + (byShare ? c.share_value : 1), 0)
      const total   = yes + no + abstain

      const votedApts = new Set(choices.map((c: any) => c.apartment_id).filter(Boolean)).size

      const { count: aptCountNum } = await admin
        .from('settlement_apartments')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', vote.community_id)
      const totalApts = aptCountNum ?? 0

      // Bez minimum 50% frekwencji (udziałów przy głosowaniu wg udziałów, lub
      // lokali przy "1 lokal = 1 głos") uchwała jest nierozstrzygnięta —
      // niezależnie od rozkładu głosów wśród tych, co zagłosowali.
      const frekwencjaFrac = byShare ? total : (totalApts > 0 ? votedApts / totalApts : 0)
      const quorumMet = frekwencjaFrac >= 0.5
      const passed = (!quorumMet || total === 0) ? null : yes > total / 2

      const { data: community } = await admin.from('communities').select('name').eq('id', vote.community_id).single()

      // Pobierz emaile adminów i super_adminów
      const { data: adminProfiles } = await admin
        .from('profiles')
        .select('id, email')
        .eq('community_id', vote.community_id)
        .in('role', ['admin', 'super_admin'])
        .in('status', ['active'])

      const missingIds = (adminProfiles ?? []).filter(u => !u.email).map(u => u.id)
      let authEmailMap: Record<string, string> = {}
      if (missingIds.length > 0) {
        const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 })
        for (const u of authList?.users ?? []) {
          if (missingIds.includes(u.id) && u.email) authEmailMap[u.id] = u.email
        }
      }
      const emails = (adminProfiles ?? [])
        .map(u => u.email || authEmailMap[u.id] || null)
        .filter(Boolean) as string[]

      const year = new Date(vote.created_at).getFullYear()
      const resolutionNumber = vote.resolution_number ? `${vote.resolution_number}/${year}` : '—'

      if (emails.length > 0) {
        await sendVoteClosedEmail({
          to: emails,
          voteTitle: vote.title,
          communityName: community?.name ?? '',
          voteId,
          resolutionNumber,
          yes, no, abstain,
          totalApts,
          votedApts,
          passed,
          byShare,
        })
      }
    }
  } catch {}

  return {}
}

// ── EDYCJA UCHWAŁY ────────────────────────────────────────────────────────────

export async function updateVote(voteId: string, data: {
  title: string
  description?: string | null
  deadline?: string | null
  link_url?: string | null
}): Promise<{ error?: string }> {
  const { profile } = await getActor()
  if (profile.role === 'user') return { error: 'Brak uprawnień' }

  if (!data.title.trim()) return { error: 'Tytuł jest wymagany' }

  if (data.link_url) {
    try { new URL(data.link_url) } catch {
      return { error: 'Nieprawidłowy adres URL linku' }
    }
  }

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('votes').update({
    title: data.title.trim(),
    description: data.description?.trim() || null,
    deadline: data.deadline || null,
    link_url: data.link_url?.trim() || null,
  }).eq('id', voteId)

  if (error) return { error: error.message }
  revalidatePath('/admin/votes')
  revalidatePath('/admin/votes/rejestr')
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

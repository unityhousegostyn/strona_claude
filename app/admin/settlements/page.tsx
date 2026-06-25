import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import SettlementsMain from './SettlementsMain'

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ community?: string }>
}) {
  const { user, profile } = await getAuthProfile()

  if (profile.role === 'najemca') redirect('/admin/dashboard')

  const admin = getSupabaseAdminClient()

  // ── USER: przekieruj bezpośrednio do swojego mieszkania ──────────────────
  if (profile.role === 'user') {
    // Preferuj profiles.apartment_id (ustawiane przez assignApartment i addUser)
    const profileApartmentId = profile.apartment_id

    if (profileApartmentId) {
      const { data: apt } = await admin
        .from('settlement_apartments')
        .select('id')
        .eq('id', profileApartmentId)
        .eq('active', true)
        .maybeSingle()
      if (apt) redirect(`/admin/settlements/${apt.id}`)
    }

    // Fallback: stare przypisanie przez owner_id (approveUser / legacy)
    const { data: apt } = await admin
      .from('settlement_apartments')
      .select('id')
      .eq('owner_id', user.id)
      .eq('active', true)
      .maybeSingle()

    if (apt) redirect(`/admin/settlements/${apt.id}`)

    // Brak przypisanego mieszkania — pokaż komunikat
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
        <p className="text-4xl">🏠</p>
        <p className="text-[#99f6e4] font-medium">Brak przypisanego mieszkania</p>
        <p className="text-[#115e59] text-sm">
          Skontaktuj się z administratorem, aby przypisać Twoje konto do lokalu.
        </p>
      </div>
    )
  }

  const currentYear = new Date().getFullYear()

  // ── ADMIN: tylko własna wspólnota ────────────────────────────────────────
  if (profile.role === 'admin') {
    if (!profile.community_id) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
          <p className="text-4xl">⚠️</p>
          <p className="text-[#99f6e4] font-medium">Brak przypisanej wspólnoty</p>
          <p className="text-[#115e59] text-sm">Skontaktuj się z super administratorem.</p>
        </div>
      )
    }

    const [communityRes, aptsRes, ratesRes, entriesRes] = await Promise.all([
      admin.from('communities').select('id, name').eq('id', profile.community_id).single(),
      admin.from('settlement_apartments')
        .select('*').eq('community_id', profile.community_id)
        .eq('active', true).order('number'),
      admin.from('settlement_rates')
        .select('*').eq('community_id', profile.community_id)
        .order('effective_from', { ascending: false }),
      admin.from('settlement_entries')
        .select('*').eq('community_id', profile.community_id)
        .eq('year', currentYear),
    ])

    return (
      <SettlementsMain
        communities={communityRes.data ? [communityRes.data] : []}
        selectedCommunityId={profile.community_id}
        apartments={aptsRes.data ?? []}
        rates={ratesRes.data ?? []}
        entries={entriesRes.data ?? []}
        isAdmin={true}
      />
    )
  }

  // ── SUPER_ADMIN: wszystkie wspólnoty ─────────────────────────────────────
  const { community } = await searchParams
  const { data: communities } = await admin.from('communities').select('id, name').order('name')
  const selectedId = community ?? communities?.[0]?.id ?? null

  let apartments: any[] = []
  let rates: any[] = []
  let entries: any[] = []

  if (selectedId) {
    const [aptsRes, ratesRes, entriesRes] = await Promise.all([
      admin.from('settlement_apartments')
        .select('*').eq('community_id', selectedId)
        .eq('active', true).order('number'),
      admin.from('settlement_rates')
        .select('*').eq('community_id', selectedId)
        .order('effective_from', { ascending: false }),
      admin.from('settlement_entries')
        .select('*').eq('community_id', selectedId)
        .eq('year', currentYear),
    ])
    apartments = aptsRes.data ?? []
    rates = ratesRes.data ?? []
    entries = entriesRes.data ?? []
  }

  return (
    <SettlementsMain
      communities={communities ?? []}
      selectedCommunityId={selectedId}
      apartments={apartments}
      rates={rates}
      entries={entries}
      isAdmin={false}
    />
  )
}

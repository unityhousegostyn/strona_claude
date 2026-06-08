import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import SettlementsMain from './SettlementsMain'

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ community?: string }>
}) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'super_admin') redirect('/admin/dashboard')

  const admin = getSupabaseAdminClient()
  const { community } = await searchParams

  const { data: communities } = await admin
    .from('communities').select('id, name').order('name')

  const selectedId = community ?? communities?.[0]?.id ?? null

  let apartments: any[] = []
  let rates: any[] = []

  if (selectedId) {
    const [aptsRes, ratesRes] = await Promise.all([
      admin.from('settlement_apartments')
        .select('*').eq('community_id', selectedId)
        .eq('active', true).order('number'),
      admin.from('settlement_rates')
        .select('*').eq('community_id', selectedId)
        .order('effective_from', { ascending: false }),
    ])
    apartments = aptsRes.data ?? []
    rates = ratesRes.data ?? []
  }

  return (
    <SettlementsMain
      communities={communities ?? []}
      selectedCommunityId={selectedId}
      apartments={apartments}
      rates={rates}
    />
  )
}

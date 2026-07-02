import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WaterMetersClient from './WaterMetersClient'

export default async function WaterMetersPage() {
  const { profile } = await getAuthProfile()
  if (profile.role === 'user' || profile.role === 'najemca') redirect('/admin/dashboard')

  const admin = getSupabaseAdminClient()
  const isSuperAdmin = profile.role === 'super_admin'

  let readingsQuery = admin
    .from('water_meter_readings')
    .select(`
      id, reading_value, reading_date, status, note, rejection_reason, created_at, confirmed_at,
      apartment:settlement_apartments(number),
      community:communities(id, name),
      user:profiles!user_id(full_name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (!isSuperAdmin) {
    readingsQuery = readingsQuery.eq('community_id', profile.community_id ?? '')
  }

  const [{ data: rawReadings }, { data: communities }] = await Promise.all([
    readingsQuery,
    admin.from('communities').select('id, name').order('name'),
  ])

  // Normalize Supabase join shapes (may return [] instead of {})
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readings = ((rawReadings as any[]) ?? []).map((r: any) => ({
    ...r,
    apartment: Array.isArray(r.apartment) ? r.apartment[0] ?? null : r.apartment,
    community: Array.isArray(r.community) ? r.community[0] ?? null : r.community,
    user: Array.isArray(r.user) ? r.user[0] ?? null : r.user,
  }))

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-[#f0fdfa]">Odczyty liczników wody</h2>
      <WaterMetersClient
        readings={readings}
        isSuperAdmin={isSuperAdmin}
        communities={communities ?? []}
      />
    </div>
  )
}

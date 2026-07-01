import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getKsefSettings, getSyncLog, getKsefQueue } from './actions'
import KsefClient from './KsefClient'
import { getSupabaseAdminClient } from '@/lib/supabase/server'

export default async function KsefPage() {
  const { profile } = await getAuthProfile()
  if (profile.role !== 'super_admin') redirect('/admin/dashboard')

  const admin = getSupabaseAdminClient()
  const { data: communities } = await admin.from('communities').select('id, name, nip').order('name')

  const [{ settings }, syncLog, { items: queue }] = await Promise.all([
    getKsefSettings(),
    getSyncLog(),
    getKsefQueue('pending'),
  ])

  return (
    <KsefClient
      settings={settings}
      syncLog={syncLog}
      initialQueue={queue}
      communities={communities ?? []}
    />
  )
}

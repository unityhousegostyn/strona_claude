import { redirect, notFound } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import type { SettlementApartment, SettlementRate } from '@/lib/settlementCalc'
import type { Community } from '@/types'
import NoticeDocument from '../NoticeDocument'
import NoticeToolbar from '../NoticeToolbar'

export default async function ZawiadomieniePage({
  params,
}: {
  params: Promise<{ rateId: string; apartmentId: string }>
}) {
  const { user, profile } = await getAuthProfile()
  const { rateId, apartmentId } = await params

  const admin = getSupabaseAdminClient()

  const [rateRes, aptRes] = await Promise.all([
    admin.from('settlement_rates').select('*').eq('id', rateId).single(),
    admin.from('settlement_apartments').select('*').eq('id', apartmentId).single(),
  ])

  if (!rateRes.data || !aptRes.data) notFound()
  const rate = rateRes.data as SettlementRate
  const apartment = aptRes.data as SettlementApartment

  if (apartment.community_id !== rate.community_id) notFound()

  if (profile.role === 'user' && apartment.owner_id !== user.id) redirect('/admin/settlements')
  if (profile.role === 'admin' && profile.community_id !== rate.community_id) redirect('/admin/settlements')
  if (profile.role !== 'super_admin' && profile.role !== 'admin' && profile.role !== 'user') redirect('/admin/dashboard')

  const communityRes = await admin.from('communities').select('*').eq('id', rate.community_id).single()
  if (!communityRes.data) notFound()
  const community = communityRes.data as Community

  const generatedAt = new Date().toLocaleDateString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 20mm; }
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          nav, aside, header { display: none !important; }
          .no-print { display: none !important; }
        }
        body { font-family: 'Segoe UI', Arial, sans-serif; }
      `}</style>

      <div className="max-w-2xl mx-auto p-6 print:p-0">
        <NoticeToolbar />
        <NoticeDocument apartment={apartment} community={community} rate={rate} generatedAt={generatedAt} />
      </div>
    </>
  )
}

import { redirect, notFound } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import type { SettlementApartment, SettlementRate } from '@/lib/settlementCalc'
import type { Community } from '@/types'
import { formatDocDate } from '@/lib/documentBranding'
import NoticeDocument from '../NoticeDocument'
import NoticeToolbar from '../NoticeToolbar'

export default async function PrintAllZawiadomieniaPage({
  params,
}: {
  params: Promise<{ rateId: string }>
}) {
  const { profile } = await getAuthProfile()
  const { rateId } = await params

  if (profile.role !== 'super_admin' && profile.role !== 'admin') redirect('/admin/settlements')

  const admin = getSupabaseAdminClient()

  const rateRes = await admin.from('settlement_rates').select('*').eq('id', rateId).single()
  if (!rateRes.data) notFound()
  const rate = rateRes.data as SettlementRate

  if (profile.role === 'admin' && profile.community_id !== rate.community_id) redirect('/admin/settlements')

  const [communityRes, apartmentsRes] = await Promise.all([
    admin.from('communities').select('*').eq('id', rate.community_id).single(),
    admin.from('settlement_apartments').select('*')
      .eq('community_id', rate.community_id)
      .eq('active', true)
      .order('number'),
  ])

  if (!communityRes.data) notFound()
  const community = communityRes.data as Community
  const apartments: SettlementApartment[] = apartmentsRes.data ?? []

  const generatedAt = formatDocDate()

  return (
    <div className="max-w-2xl mx-auto">
      <style>{`
        @media print {
          .print-break-after { page-break-after: always; }
        }
      `}</style>

      <NoticeToolbar />

      {apartments.length === 0 ? (
        <p className="text-sm text-[#115e59]">Brak lokali w tej wspólnocie.</p>
      ) : (
        apartments.map((apt, i) => (
          <NoticeDocument
            key={apt.id}
            apartment={apt}
            community={community}
            rate={rate}
            generatedAt={generatedAt}
            pageBreakAfter={i < apartments.length - 1}
          />
        ))
      )}
    </div>
  )
}

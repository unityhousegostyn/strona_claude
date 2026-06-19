import { redirect, notFound } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import type { SettlementApartment, SettlementRate } from '@/lib/settlementCalc'
import type { Community } from '@/types'
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
          .print-break-after { page-break-after: always; }
        }
        body { font-family: 'Segoe UI', Arial, sans-serif; }
      `}</style>

      <div className="max-w-2xl mx-auto p-6 print:p-0">
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
    </>
  )
}

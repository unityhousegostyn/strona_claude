import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import type { SettlementApartment, SettlementRate } from '@/lib/settlementCalc'

export default async function ZawiadomieniaListPage({
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
    admin.from('communities').select('name').eq('id', rate.community_id).single(),
    admin.from('settlement_apartments').select('*')
      .eq('community_id', rate.community_id)
      .eq('active', true)
      .order('number'),
  ])

  const communityName = communityRes.data?.name ?? 'Wspólnota Mieszkaniowa'
  const apartments: SettlementApartment[] = apartmentsRes.data ?? []

  const effectiveFromLabel = rate.effective_from.split('-').slice(0, 2).reverse().join('.') + '.' + rate.effective_from.split('-')[0]

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/admin/settlements" className="text-sm text-[#0f766e] hover:text-[#ccfbf1] transition">
          ← Wróć do rozliczeń
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-[#f0fdfa] mb-1">Zawiadomienia o wysokości opłat</h1>
      <p className="text-[#0f766e] mb-6">{communityName} · stawki od {effectiveFromLabel}</p>

      {apartments.length === 0 ? (
        <p className="text-sm text-[#115e59]">Brak lokali w tej wspólnocie.</p>
      ) : (
        <>
          <div className="mb-4">
            <Link
              href={`/admin/settlements/rates/${rateId}/zawiadomienia/print-all`}
              className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition inline-flex items-center gap-2"
            >
              🖨️ Drukuj wszystkie zawiadomienia
            </Link>
          </div>

          <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl divide-y divide-[#0f2d2a]">
            {apartments.map(apt => (
              <Link
                key={apt.id}
                href={`/admin/settlements/rates/${rateId}/zawiadomienia/${apt.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-[#0c2220] transition"
              >
                <div>
                  <p className="font-semibold text-[#f0fdfa]">Lokal {apt.number}</p>
                  <p className="text-xs text-[#115e59]">{apt.owner_name}</p>
                </div>
                <span className="text-teal-400 text-sm">📄 Podgląd / wydruk →</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

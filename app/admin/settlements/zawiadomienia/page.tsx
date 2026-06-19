import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import type { SettlementRate } from '@/lib/settlementCalc'

export default async function ZawiadomieniaHubPage() {
  const { profile } = await getAuthProfile()

  if (profile.role !== 'super_admin' && profile.role !== 'admin') redirect('/admin/settlements')

  const admin = getSupabaseAdminClient()

  const communitiesQuery = admin.from('communities').select('id, name').order('name')
  const { data: communities } = profile.role === 'admin' && profile.community_id
    ? await communitiesQuery.eq('id', profile.community_id)
    : await communitiesQuery

  const list = communities ?? []

  // Dla każdej wspólnoty znajdź najnowszą (aktualną) stawkę
  const ratesByComm = await Promise.all(
    list.map(c =>
      admin.from('settlement_rates')
        .select('*')
        .eq('community_id', c.id)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle()
    )
  )

  const rows = list.map((c, i) => ({
    community: c,
    rate: (ratesByComm[i].data ?? null) as SettlementRate | null,
  }))

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/admin/settlements" className="text-sm text-[#0f766e] hover:text-[#ccfbf1] transition">
          ← Wróć do rozliczeń
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-[#f0fdfa] mb-1">📄 Zawiadomienia o wysokości opłat</h1>
      <p className="text-[#0f766e] mb-6">Wybierz wspólnotę, aby przejść do listy lokali i wygenerować zawiadomienia.</p>

      {rows.length === 0 ? (
        <p className="text-sm text-[#115e59]">Brak wspólnot.</p>
      ) : (
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl divide-y divide-[#0f2d2a]">
          {rows.map(({ community, rate }) => (
            <div key={community.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-semibold text-[#f0fdfa]">{community.name}</p>
                {rate ? (
                  <p className="text-xs text-[#115e59]">
                    Aktualna stawka od {rate.effective_from.split('-').slice(0, 2).reverse().join('.') + '.' + rate.effective_from.split('-')[0]}
                  </p>
                ) : (
                  <p className="text-xs text-[#115e59]">Brak zdefiniowanych stawek</p>
                )}
              </div>
              {rate ? (
                <Link
                  href={`/admin/settlements/rates/${rate.id}/zawiadomienia`}
                  className="text-teal-400 hover:text-teal-300 text-sm font-medium transition"
                >
                  Otwórz →
                </Link>
              ) : (
                <Link
                  href={`/admin/settlements?community=${community.id}`}
                  className="text-[#115e59] hover:text-teal-300 text-sm transition"
                >
                  Dodaj stawki →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

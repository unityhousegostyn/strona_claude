import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import type { SettlementRate } from '@/lib/settlementCalc'

export default async function ZawiadomieniaHubPage() {
  const { user, profile } = await getAuthProfile()

  const admin = getSupabaseAdminClient()

  // ── MIESZKANIEC: pokaż zawiadomienia dla własnego lokalu ─────────────────
  if (profile.role === 'user') {
    let apartmentId: string | null = profile.apartment_id ?? null

    if (!apartmentId) {
      const { data: legacyApt } = await admin
        .from('settlement_apartments')
        .select('id')
        .eq('owner_id', user.id)
        .eq('active', true)
        .maybeSingle()
      apartmentId = legacyApt?.id ?? null
    }

    if (!apartmentId) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
          <p className="text-4xl">📄</p>
          <p className="text-[#99f6e4] font-medium">Brak przypisanego mieszkania</p>
          <p className="text-[#115e59] text-sm">Skontaktuj się z administratorem, aby przypisać Twoje konto do lokalu.</p>
        </div>
      )
    }

    const { data: apt } = await admin
      .from('settlement_apartments')
      .select('id, number, community_id')
      .eq('id', apartmentId)
      .maybeSingle()

    if (!apt) redirect('/admin/settlements')

    const { data: rates } = await admin
      .from('settlement_rates')
      .select('id, effective_from')
      .eq('community_id', apt.community_id)
      .order('effective_from', { ascending: false })

    const rateList = rates ?? []

    return (
      <div className="max-w-xl mx-auto p-6">
        <div className="mb-6">
          <Link href="/admin/settlements" className="text-sm text-[#0f766e] hover:text-[#ccfbf1] transition">
            ← Wróć do rozliczeń
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-[#f0fdfa] mb-1">📄 Zawiadomienia o wysokości opłat</h1>
        <p className="text-[#0f766e] mb-6">Lokal nr {apt.number} — wybierz okres stawek, aby wyświetlić zawiadomienie.</p>

        {rateList.length === 0 ? (
          <p className="text-sm text-[#115e59]">Brak zdefiniowanych stawek.</p>
        ) : (
          <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl divide-y divide-[#0f2d2a]">
            {rateList.map((rate, i) => (
              <div key={rate.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <p className="font-semibold text-[#f0fdfa]">
                    Od: {rate.effective_from.split('-').slice(0, 2).reverse().join('.') + '.' + rate.effective_from.split('-')[0]}
                  </p>
                  {i === 0 && (
                    <span className="text-xs bg-teal-900/30 text-teal-400 px-2 py-0.5 rounded-full">Aktualne</span>
                  )}
                </div>
                <Link
                  href={`/admin/settlements/rates/${rate.id}/zawiadomienia/${apt.id}`}
                  className="text-teal-400 hover:text-teal-300 text-sm font-medium transition"
                >
                  Otwórz →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (profile.role !== 'super_admin' && profile.role !== 'admin') redirect('/admin/settlements')

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

import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MT940Client from './MT940Client'

export default async function MT940Page() {
  const { profile } = await getAuthProfile()
  if (profile.role !== 'super_admin' && profile.role !== 'admin') redirect('/admin/dashboard')

  const admin = getSupabaseAdminClient()

  // Super_admin: wybierz wspólnotę z query param lub pierwszą z listy
  const communities = profile.role === 'super_admin'
    ? (await admin.from('communities').select('id, name').order('name')).data ?? []
    : []

  const communityId = profile.community_id ??
    (communities[0]?.id ?? '')

  const { data: community } = await admin.from('communities')
    .select('id, name')
    .eq('id', communityId)
    .single()

  const { data: apartments } = await admin
    .from('settlement_apartments')
    .select('id, number, owner_name, community_id')
    .eq('community_id', communityId)
    .eq('active', true)
    .order('number')

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-[#f0fdfa]">Import MT940</h1>
        <p className="text-sm text-[#115e59] mt-1">
          Wczytaj wyciąg bankowy SWIFT MT940 — system automatycznie dopasuje transakcje do lokali.
        </p>
      </div>

      {/* Info box */}
      <div className="bg-teal-950/20 border border-teal-800/30 rounded-xl p-4 text-sm text-[#99f6e4] space-y-1">
        <p className="font-semibold">Jak to działa?</p>
        <p className="text-xs text-[#115e59]">1. Eksportuj wyciąg z banku w formacie MT940 (.sta lub .txt)</p>
        <p className="text-xs text-[#115e59]">2. Wczytaj plik — system znajdzie wpłaty i dopasuje je do lokali po numerze lokalu lub nazwisku właściciela</p>
        <p className="text-xs text-[#115e59]">3. Sprawdź dopasowania, popraw ręcznie jeśli trzeba, wybierz miesiąc i potwierdź</p>
        <p className="text-xs text-[#115e59]">4. Kwoty zostaną <strong>dodane</strong> do istniejących wpłat (nie zastąpią ich)</p>
      </div>

      <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 bg-teal-950/40 rounded-lg flex items-center justify-center text-teal-400 font-bold text-sm">🏦</div>
          <div>
            <p className="font-semibold text-[#f0fdfa] text-sm">{community?.name ?? '—'}</p>
            <p className="text-xs text-[#115e59]">{(apartments ?? []).length} aktywnych lokali</p>
          </div>
        </div>

        <MT940Client
          communityId={communityId}
          communityName={community?.name ?? ''}
          apartments={(apartments ?? []) as Array<{ id: string; number: string; owner_name: string; community_id: string }>}
        />
      </div>
    </div>
  )
}

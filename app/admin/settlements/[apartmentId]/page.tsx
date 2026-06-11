import { redirect, notFound } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import MonthlyTable from './MonthlyTable'

export default async function ApartmentSettlementPage({
  params,
  searchParams,
}: {
  params: Promise<{ apartmentId: string }>
  searchParams: Promise<{ year?: string }>
}) {
  const { user, profile } = await getAuthProfile()

  const { apartmentId } = await params
  const { year: yearParam } = await searchParams
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()

  const admin = getSupabaseAdminClient()

  const aptRes = await admin
    .from('settlement_apartments').select('*').eq('id', apartmentId).single()
  if (!aptRes.data) notFound()

  const apartment = aptRes.data

  // Sprawdź uprawnienia
  if (profile.role === 'user') {
    // User widzi tylko swoje mieszkanie
    if (apartment.owner_id !== user.id) redirect('/admin/settlements')
  } else if (profile.role === 'admin') {
    // Admin widzi tylko mieszkania swojej wspólnoty
    if (apartment.community_id !== profile.community_id) redirect('/admin/settlements')
  } else if (profile.role !== 'super_admin') {
    redirect('/admin/dashboard')
  }

  const readonly = profile.role === 'user'

  const [ratesRes, entriesRes, reconcRes, openingBalanceRes] = await Promise.all([
    admin.from('settlement_rates').select('*')
      .eq('community_id', apartment.community_id)
      .order('effective_from', { ascending: false }),
    admin.from('settlement_entries').select('*')
      .eq('apartment_id', apartmentId).eq('year', year),
    admin.from('settlement_water_reconciliation').select('*')
      .eq('apartment_id', apartmentId).eq('year', year),
    admin.from('settlement_opening_balances').select('balance')
      .eq('apartment_id', apartmentId).eq('year', year).maybeSingle(),
  ])

  const rates = ratesRes.data ?? []
  const entries = entriesRes.data ?? []
  const reconciliations = reconcRes.data ?? []
  const openingBalance = openingBalanceRes.data?.balance ?? 0

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#4d7a5f]">
        {profile.role !== 'user' && (
          <>
            <Link href="/admin/settlements" className="hover:text-[#a7f3d0] transition">Rozliczenia</Link>
            <span>›</span>
          </>
        )}
        <span className="text-[#a7f3d0]">Lokal {apartment.number}</span>
      </div>

      {/* Header lokalu */}
      <div className="bg-[#121c15] border border-[#1e3324] rounded-xl p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#ecfdf5]">Lokal nr {apartment.number}</h2>
            <p className="text-sm text-[#6b9478] mt-1">{apartment.owner_name}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-[#4d7a5f]">Powierzchnia</p>
              <p className="font-semibold text-[#d1fae5] mt-0.5">{Number(apartment.area_m2).toFixed(4)} m²</p>
            </div>
            <div>
              <p className="text-xs text-[#4d7a5f]">Udział KW</p>
              <p className="font-semibold text-[#d1fae5] mt-0.5">
                {apartment.share_numerator && apartment.share_denominator
                  ? `${apartment.share_numerator}/${apartment.share_denominator}`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#4d7a5f]">Osoby</p>
              <p className="font-semibold text-[#d1fae5] mt-0.5">{apartment.persons_count}</p>
            </div>
            <div>
              <p className="text-xs text-[#4d7a5f]">Wodomierz</p>
              <p className="font-semibold text-[#d1fae5] mt-0.5">{apartment.has_meter ? '✓ Tak' : '✗ Nie'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Akcje */}
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/settlements/${apartmentId}/print?year=${year}`}
          target="_blank"
          className="text-xs bg-[#162418] hover:bg-[#1c2e1e] text-[#a7f3d0] hover:text-white border border-[#1e3324] px-3 py-1.5 rounded-lg transition font-medium"
        >
          🖨️ Pobierz PDF
        </Link>
      </div>

      {/* Rok */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-[#6b9478]">Rok obrachunkowy:</label>
        <div className="flex gap-1">
          {[year - 1, year, year + 1].map(y => (
            <Link key={y} href={`/admin/settlements/${apartmentId}?year=${y}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                y === year
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#121c15] text-[#6b9478] hover:text-[#d1fae5] border border-[#1e3324]'
              }`}>
              {y}
            </Link>
          ))}
        </div>
      </div>

      {rates.length === 0 && (
        <div className="bg-yellow-900/20 border border-yellow-800 text-yellow-400 text-sm rounded-xl px-4 py-3">
          ⚠️ Brak stawek dla tej wspólnoty.
          {profile.role !== 'user' && ' Dodaj stawki w zakładce „Stawki" na stronie rozliczeń.'}
        </div>
      )}

      <MonthlyTable
        apartment={apartment}
        rates={rates}
        entries={entries}
        reconciliations={reconciliations}
        year={year}
        readonly={readonly}
        savedOpeningBalance={openingBalance}
      />

    </div>
  )
}

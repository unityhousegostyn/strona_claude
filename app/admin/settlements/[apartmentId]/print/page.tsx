import { redirect, notFound } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import {
  buildYearlyTable, pln, shareStr,
  type SettlementApartment, type SettlementRate, type SettlementEntry
} from '@/lib/settlementCalc'
import { formatDocDate } from '@/lib/documentBranding'
import DocumentPaper from '@/components/print/DocumentPaper'
import DocumentHeader from '@/components/print/DocumentHeader'
import DocumentFooter from '@/components/print/DocumentFooter'
import PrintClient from './PrintClient'

export default async function PrintPage({
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

  const aptRes = await admin.from('settlement_apartments').select('*').eq('id', apartmentId).single()
  if (!aptRes.data) notFound()
  const apartment = aptRes.data

  if (profile.role === 'user' && apartment.owner_id !== user.id) redirect('/admin/settlements')
  if (profile.role === 'admin' && apartment.community_id !== profile.community_id) redirect('/admin/settlements')
  if (profile.role !== 'super_admin' && profile.role !== 'admin' && profile.role !== 'user') redirect('/admin/dashboard')

  const [communityRes, ratesRes, entriesRes] = await Promise.all([
    admin.from('communities').select('name, address').eq('id', apartment.community_id).single(),
    admin.from('settlement_rates').select('*')
      .eq('community_id', apartment.community_id)
      .order('effective_from', { ascending: false }),
    admin.from('settlement_entries').select('*')
      .eq('apartment_id', apartmentId).eq('year', year),
  ])

  const communityName = communityRes.data?.name ?? 'Wspólnota Mieszkaniowa'
  const communityAddress = communityRes.data?.address ?? null
  const rates: SettlementRate[] = ratesRes.data ?? []
  const entries: SettlementEntry[] = entriesRes.data ?? []

  const rows = buildYearlyTable(apartment as SettlementApartment, rates, entries, year)
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0)
  const totalDue  = rows.reduce((s, r) => s + r.total_due, 0)
  const totalRenovation = rows.reduce((s, r) => s + r.renovation, 0)
  const totalOperating  = rows.reduce((s, r) => s + r.operating, 0)
  const totalManager    = rows.reduce((s, r) => s + r.manager, 0)
  const totalWater      = rows.reduce((s, r) => s + r.water, 0)
  const totalGarbage    = rows.reduce((s, r) => s + r.garbage, 0)
  const totalCorrection = rows.reduce((s, r) => s + r.correction, 0)
  const finalBalance    = rows[11]?.balance_end ?? 0

  const generatedAt = formatDocDate()

  return (
    <div className="max-w-5xl mx-auto">
      <PrintClient />

      <DocumentPaper size="a4-landscape">
        <DocumentHeader
          title={`Rozliczenie lokalu — ${year}`}
          communityName={communityName}
          communityAddress={communityAddress}
          meta={[{ label: 'Wygenerowano', value: generatedAt }]}
        />

        {/* Dane lokalu */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 p-4 bg-[#f8fafb] rounded-xl border border-[#e5e7eb]">
          <div>
            <p className="text-xs text-[#6b7280] uppercase tracking-wide">Lokal</p>
            <p className="font-bold text-[#111827] text-lg mt-0.5">{apartment.number}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280] uppercase tracking-wide">Właściciel</p>
            <p className="font-semibold text-[#374151] mt-0.5">{apartment.owner_name}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280] uppercase tracking-wide">Powierzchnia</p>
            <p className="font-semibold text-[#374151] mt-0.5">{Number(apartment.area_m2).toFixed(4)} m²</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280] uppercase tracking-wide">Udział / Osoby</p>
            <p className="font-semibold text-[#374151] mt-0.5">
              {shareStr(apartment as SettlementApartment)} / {apartment.persons_count} os.
            </p>
          </div>
        </div>

        {/* Tabela rozliczenia */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#f1f5f4]">
                {['Miesiąc','Saldo pocz.','Wpłacono','Fund. rem.','Fund. ekspl.','Zarządca','Ryczałt wody','Śmieci','Korekta','Razem','Saldo końc.'].map(h => (
                  <th key={h} className="px-2 py-2 text-right first:text-left text-[#374151] font-semibold border border-[#e5e7eb] whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.month} className={i % 2 === 0 ? 'bg-white' : 'bg-[#f8fafb]'}>
                  <td className="px-2 py-1.5 font-medium text-[#111827] border border-[#e5e7eb]">{row.monthName}</td>
                  <td className={`px-2 py-1.5 text-right border border-[#e5e7eb] ${row.balance_start >= 0 ? 'text-teal-700' : 'text-red-600'}`}>{pln(row.balance_start)}</td>
                  <td className="px-2 py-1.5 text-right text-teal-700 border border-[#e5e7eb] font-medium">{pln(row.paid)}</td>
                  <td className="px-2 py-1.5 text-right text-[#374151] border border-[#e5e7eb]">{row.hasRates ? pln(row.renovation) : '—'}</td>
                  <td className="px-2 py-1.5 text-right text-[#374151] border border-[#e5e7eb]">{row.hasRates ? pln(row.operating) : '—'}</td>
                  <td className="px-2 py-1.5 text-right text-[#374151] border border-[#e5e7eb]">{row.hasRates ? pln(row.manager) : '—'}</td>
                  <td className="px-2 py-1.5 text-right text-[#374151] border border-[#e5e7eb]">{row.hasRates ? pln(row.water) : '—'}</td>
                  <td className="px-2 py-1.5 text-right text-[#374151] border border-[#e5e7eb]">{row.hasRates ? pln(row.garbage) : '—'}</td>
                  <td className={`px-2 py-1.5 text-right border border-[#e5e7eb] ${row.correction !== 0 ? 'text-amber-600' : 'text-[#9ca3af]'}`}>{row.correction !== 0 ? pln(row.correction) : '—'}</td>
                  <td className="px-2 py-1.5 text-right font-semibold text-[#111827] border border-[#e5e7eb]">{row.hasRates ? pln(row.total_due) : '—'}</td>
                  <td className={`px-2 py-1.5 text-right font-bold border border-[#e5e7eb] ${row.balance_end >= 0 ? 'text-teal-700' : 'text-red-600'}`}>{pln(row.balance_end)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#ecfdf9] font-bold">
                <td className="px-2 py-2 text-[#111827] border border-[#e5e7eb] border-t-2 border-t-[#0f766e]">RAZEM {year}</td>
                <td className="px-2 py-2 text-right text-[#9ca3af] border border-[#e5e7eb] border-t-2 border-t-[#0f766e]">—</td>
                <td className="px-2 py-2 text-right text-teal-700 border border-[#e5e7eb] border-t-2 border-t-[#0f766e]">{pln(totalPaid)}</td>
                <td className="px-2 py-2 text-right text-[#111827] border border-[#e5e7eb] border-t-2 border-t-[#0f766e]">{pln(totalRenovation)}</td>
                <td className="px-2 py-2 text-right text-[#111827] border border-[#e5e7eb] border-t-2 border-t-[#0f766e]">{pln(totalOperating)}</td>
                <td className="px-2 py-2 text-right text-[#111827] border border-[#e5e7eb] border-t-2 border-t-[#0f766e]">{pln(totalManager)}</td>
                <td className="px-2 py-2 text-right text-[#111827] border border-[#e5e7eb] border-t-2 border-t-[#0f766e]">{pln(totalWater)}</td>
                <td className="px-2 py-2 text-right text-[#111827] border border-[#e5e7eb] border-t-2 border-t-[#0f766e]">{pln(totalGarbage)}</td>
                <td className="px-2 py-2 text-right text-amber-600 border border-[#e5e7eb] border-t-2 border-t-[#0f766e]">{totalCorrection !== 0 ? pln(totalCorrection) : '—'}</td>
                <td className="px-2 py-2 text-right text-[#111827] border border-[#e5e7eb] border-t-2 border-t-[#0f766e]">{pln(totalDue)}</td>
                <td className={`px-2 py-2 text-right border border-[#e5e7eb] border-t-2 border-t-[#0f766e] ${finalBalance >= 0 ? 'text-teal-700' : 'text-red-600'}`}>{pln(finalBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Podsumowanie końcowe */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-[#f8fafb] rounded-xl border border-[#e5e7eb]">
          <div>
            <p className="text-xs text-[#6b7280]">Łącznie naliczono</p>
            <p className="text-lg font-bold text-[#111827] mt-0.5">{pln(totalDue)}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">Łącznie wpłacono</p>
            <p className="text-lg font-bold text-teal-700 mt-0.5">{pln(totalPaid)}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">{finalBalance >= 0 ? 'Nadpłata' : 'Niedopłata'}</p>
            <p className={`text-lg font-bold mt-0.5 ${finalBalance >= 0 ? 'text-teal-700' : 'text-red-600'}`}>
              {pln(Math.abs(finalBalance))}
            </p>
          </div>
        </div>

        <DocumentFooter generatedAt={generatedAt} />
      </DocumentPaper>
    </div>
  )
}

import { redirect, notFound } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import {
  buildYearlyTable, pln, shareStr,
  type SettlementApartment, type SettlementRate, type SettlementEntry
} from '@/lib/settlementCalc'
import PrintClient from './PrintClient'

const MONTH_NAMES = [
  'Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
  'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'
]

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
    admin.from('communities').select('name').eq('id', apartment.community_id).single(),
    admin.from('settlement_rates').select('*')
      .eq('community_id', apartment.community_id)
      .order('effective_from', { ascending: false }),
    admin.from('settlement_entries').select('*')
      .eq('apartment_id', apartmentId).eq('year', year),
  ])

  const communityName = communityRes.data?.name ?? 'Wspólnota Mieszkaniowa'
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

  const generatedAt = new Date().toLocaleDateString('pl-PL', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 15mm; }
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          nav, aside, header { display: none !important; }
          .no-print { display: none !important; }
        }
        body { font-family: 'Segoe UI', Arial, sans-serif; }
      `}</style>

      <div className="max-w-5xl mx-auto p-6 print:p-0">
        <PrintClient />

        {/* Nagłówek dokumentu */}
        <div className="mb-6 border-b-2 border-[#3a2e1e] print:border-[#4a3c28] pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#f0ebe0] print:text-black">
                Rozliczenie lokalu — {year}
              </h1>
              <p className="text-[#7a6a58] print:text-[#6a5a48] mt-1">{communityName}</p>
            </div>
            <div className="text-right text-xs text-[#6a5a48] print:text-[#6a5a48]">
              <p>Wygenerowano: {generatedAt}</p>
            </div>
          </div>
        </div>

        {/* Dane lokalu */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 p-4 bg-[#241e14] print:bg-gray-50 rounded-xl border border-[#3a2e1e] print:border-gray-200">
          <div>
            <p className="text-xs text-[#6a5a48] print:text-[#6a5a48] uppercase tracking-wide">Lokal</p>
            <p className="font-bold text-[#f0ebe0] print:text-black text-lg mt-0.5">{apartment.number}</p>
          </div>
          <div>
            <p className="text-xs text-[#6a5a48] print:text-[#6a5a48] uppercase tracking-wide">Właściciel</p>
            <p className="font-semibold text-[#ddd5c5] print:text-black mt-0.5">{apartment.owner_name}</p>
          </div>
          <div>
            <p className="text-xs text-[#6a5a48] print:text-[#6a5a48] uppercase tracking-wide">Powierzchnia</p>
            <p className="font-semibold text-[#ddd5c5] print:text-black mt-0.5">{Number(apartment.area_m2).toFixed(4)} m²</p>
          </div>
          <div>
            <p className="text-xs text-[#6a5a48] print:text-[#6a5a48] uppercase tracking-wide">Udział / Osoby</p>
            <p className="font-semibold text-[#ddd5c5] print:text-black mt-0.5">
              {shareStr(apartment as SettlementApartment)} / {apartment.persons_count} os.
            </p>
          </div>
        </div>

        {/* Tabela rozliczenia */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#2a2218] print:bg-gray-100">
                {['Miesiąc','Saldo pocz.','Wpłacono','Fund. rem.','Fund. ekspl.','Zarządca','Ryczałt wody','Śmieci','Korekta','Razem','Saldo końc.'].map(h => (
                  <th key={h} className="px-2 py-2 text-right first:text-left text-[#b8a898] print:text-stone-300 font-semibold border border-[#3a2e1e] print:border-[#4a3c28] whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.month} className={i % 2 === 0 ? 'bg-[#241e14] print:bg-[#241e14]' : 'bg-[#241e14]/50 print:bg-gray-50'}>
                  <td className="px-2 py-1.5 font-medium text-[#ddd5c5] print:text-black border border-[#3a2e1e] print:border-gray-200">{row.monthName}</td>
                  <td className={`px-2 py-1.5 text-right border border-[#3a2e1e] print:border-gray-200 ${row.balance_start >= 0 ? 'text-amber-400 print:text-green-700' : 'text-red-400 print:text-red-600'}`}>{pln(row.balance_start)}</td>
                  <td className="px-2 py-1.5 text-right text-amber-300 print:text-green-700 border border-[#3a2e1e] print:border-gray-200 font-medium">{pln(row.paid)}</td>
                  <td className="px-2 py-1.5 text-right text-[#b8a898] print:text-stone-300 border border-[#3a2e1e] print:border-gray-200">{row.hasRates ? pln(row.renovation) : '—'}</td>
                  <td className="px-2 py-1.5 text-right text-[#b8a898] print:text-stone-300 border border-[#3a2e1e] print:border-gray-200">{row.hasRates ? pln(row.operating) : '—'}</td>
                  <td className="px-2 py-1.5 text-right text-[#b8a898] print:text-stone-300 border border-[#3a2e1e] print:border-gray-200">{row.hasRates ? pln(row.manager) : '—'}</td>
                  <td className="px-2 py-1.5 text-right text-[#b8a898] print:text-stone-300 border border-[#3a2e1e] print:border-gray-200">{row.hasRates ? pln(row.water) : '—'}</td>
                  <td className="px-2 py-1.5 text-right text-[#b8a898] print:text-stone-300 border border-[#3a2e1e] print:border-gray-200">{row.hasRates ? pln(row.garbage) : '—'}</td>
                  <td className={`px-2 py-1.5 text-right border border-[#3a2e1e] print:border-gray-200 ${row.correction !== 0 ? 'text-yellow-400 print:text-yellow-700' : 'text-[#6a5a48]'}`}>{row.correction !== 0 ? pln(row.correction) : '—'}</td>
                  <td className="px-2 py-1.5 text-right font-semibold text-[#f0ebe0] print:text-black border border-[#3a2e1e] print:border-gray-200">{row.hasRates ? pln(row.total_due) : '—'}</td>
                  <td className={`px-2 py-1.5 text-right font-bold border border-[#3a2e1e] print:border-gray-200 ${row.balance_end >= 0 ? 'text-amber-400 print:text-green-700' : 'text-red-400 print:text-red-600'}`}>{pln(row.balance_end)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#2a2218] print:bg-[#2a2218] font-bold">
                <td className="px-2 py-2 text-[#ddd5c5] print:text-black border border-[#3a2e1e] print:border-stone-400">RAZEM {year}</td>
                <td className="px-2 py-2 text-right text-[#6a5a48] border border-[#3a2e1e] print:border-stone-400">—</td>
                <td className="px-2 py-2 text-right text-amber-300 print:text-green-700 border border-[#3a2e1e] print:border-stone-400">{pln(totalPaid)}</td>
                <td className="px-2 py-2 text-right text-[#ddd5c5] print:text-black border border-[#3a2e1e] print:border-stone-400">{pln(totalRenovation)}</td>
                <td className="px-2 py-2 text-right text-[#ddd5c5] print:text-black border border-[#3a2e1e] print:border-stone-400">{pln(totalOperating)}</td>
                <td className="px-2 py-2 text-right text-[#ddd5c5] print:text-black border border-[#3a2e1e] print:border-stone-400">{pln(totalManager)}</td>
                <td className="px-2 py-2 text-right text-[#ddd5c5] print:text-black border border-[#3a2e1e] print:border-stone-400">{pln(totalWater)}</td>
                <td className="px-2 py-2 text-right text-[#ddd5c5] print:text-black border border-[#3a2e1e] print:border-stone-400">{pln(totalGarbage)}</td>
                <td className="px-2 py-2 text-right text-yellow-400 print:text-yellow-700 border border-[#3a2e1e] print:border-stone-400">{totalCorrection !== 0 ? pln(totalCorrection) : '—'}</td>
                <td className="px-2 py-2 text-right text-[#f0ebe0] print:text-black border border-[#3a2e1e] print:border-stone-400">{pln(totalDue)}</td>
                <td className={`px-2 py-2 text-right border border-[#3a2e1e] print:border-stone-400 ${finalBalance >= 0 ? 'text-amber-400 print:text-green-700' : 'text-red-400 print:text-red-600'}`}>{pln(finalBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Podsumowanie końcowe */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-[#241e14] print:bg-gray-50 rounded-xl border border-[#3a2e1e] print:border-gray-200">
          <div>
            <p className="text-xs text-[#6a5a48] print:text-[#6a5a48]">Łącznie naliczono</p>
            <p className="text-lg font-bold text-[#f0ebe0] print:text-black mt-0.5">{pln(totalDue)}</p>
          </div>
          <div>
            <p className="text-xs text-[#6a5a48] print:text-[#6a5a48]">Łącznie wpłacono</p>
            <p className="text-lg font-bold text-amber-400 print:text-green-700 mt-0.5">{pln(totalPaid)}</p>
          </div>
          <div>
            <p className="text-xs text-[#6a5a48] print:text-[#6a5a48]">{finalBalance >= 0 ? 'Nadpłata' : 'Niedopłata'}</p>
            <p className={`text-lg font-bold mt-0.5 ${finalBalance >= 0 ? 'text-amber-400 print:text-green-700' : 'text-red-400 print:text-red-600'}`}>
              {pln(Math.abs(finalBalance))}
            </p>
          </div>
        </div>

        <p className="text-xs text-[#6a5a48] print:text-[#7a6a58] mt-6 text-center print:text-center">
          Dokument wygenerowany automatycznie przez system Panel Wspólnoty · {generatedAt}
        </p>
      </div>
    </>
  )
}

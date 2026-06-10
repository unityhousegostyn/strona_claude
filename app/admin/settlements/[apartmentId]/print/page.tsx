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
        <div className="mb-6 border-b-2 border-gray-800 print:border-gray-300 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-100 print:text-black">
                Rozliczenie lokalu — {year}
              </h1>
              <p className="text-gray-400 print:text-gray-600 mt-1">{communityName}</p>
            </div>
            <div className="text-right text-xs text-gray-500 print:text-gray-500">
              <p>Wygenerowano: {generatedAt}</p>
            </div>
          </div>
        </div>

        {/* Dane lokalu */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 p-4 bg-gray-900 print:bg-gray-50 rounded-xl border border-gray-800 print:border-gray-200">
          <div>
            <p className="text-xs text-gray-500 print:text-gray-500 uppercase tracking-wide">Lokal</p>
            <p className="font-bold text-gray-100 print:text-black text-lg mt-0.5">{apartment.number}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 print:text-gray-500 uppercase tracking-wide">Właściciel</p>
            <p className="font-semibold text-gray-200 print:text-black mt-0.5">{apartment.owner_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 print:text-gray-500 uppercase tracking-wide">Powierzchnia</p>
            <p className="font-semibold text-gray-200 print:text-black mt-0.5">{Number(apartment.area_m2).toFixed(4)} m²</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 print:text-gray-500 uppercase tracking-wide">Udział / Osoby</p>
            <p className="font-semibold text-gray-200 print:text-black mt-0.5">
              {shareStr(apartment as SettlementApartment)} / {apartment.persons_count} os.
            </p>
          </div>
        </div>

        {/* Tabela rozliczenia */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-800 print:bg-gray-100">
                {['Miesiąc','Saldo pocz.','Wpłacono','Fund. rem.','Fund. ekspl.','Zarządca','Ryczałt wody','Śmieci','Korekta','Razem','Saldo końc.'].map(h => (
                  <th key={h} className="px-2 py-2 text-right first:text-left text-gray-300 print:text-gray-700 font-semibold border border-gray-700 print:border-gray-300 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.month} className={i % 2 === 0 ? 'bg-gray-900 print:bg-white' : 'bg-gray-900/50 print:bg-gray-50'}>
                  <td className="px-2 py-1.5 font-medium text-gray-200 print:text-black border border-gray-800 print:border-gray-200">{row.monthName}</td>
                  <td className={`px-2 py-1.5 text-right border border-gray-800 print:border-gray-200 ${row.balance_start >= 0 ? 'text-green-400 print:text-green-700' : 'text-red-400 print:text-red-600'}`}>{pln(row.balance_start)}</td>
                  <td className="px-2 py-1.5 text-right text-green-300 print:text-green-700 border border-gray-800 print:border-gray-200 font-medium">{pln(row.paid)}</td>
                  <td className="px-2 py-1.5 text-right text-gray-300 print:text-gray-700 border border-gray-800 print:border-gray-200">{row.hasRates ? pln(row.renovation) : '—'}</td>
                  <td className="px-2 py-1.5 text-right text-gray-300 print:text-gray-700 border border-gray-800 print:border-gray-200">{row.hasRates ? pln(row.operating) : '—'}</td>
                  <td className="px-2 py-1.5 text-right text-gray-300 print:text-gray-700 border border-gray-800 print:border-gray-200">{row.hasRates ? pln(row.manager) : '—'}</td>
                  <td className="px-2 py-1.5 text-right text-gray-300 print:text-gray-700 border border-gray-800 print:border-gray-200">{row.hasRates ? pln(row.water) : '—'}</td>
                  <td className="px-2 py-1.5 text-right text-gray-300 print:text-gray-700 border border-gray-800 print:border-gray-200">{row.hasRates ? pln(row.garbage) : '—'}</td>
                  <td className={`px-2 py-1.5 text-right border border-gray-800 print:border-gray-200 ${row.correction !== 0 ? 'text-yellow-400 print:text-yellow-700' : 'text-gray-600'}`}>{row.correction !== 0 ? pln(row.correction) : '—'}</td>
                  <td className="px-2 py-1.5 text-right font-semibold text-gray-100 print:text-black border border-gray-800 print:border-gray-200">{row.hasRates ? pln(row.total_due) : '—'}</td>
                  <td className={`px-2 py-1.5 text-right font-bold border border-gray-800 print:border-gray-200 ${row.balance_end >= 0 ? 'text-green-400 print:text-green-700' : 'text-red-400 print:text-red-600'}`}>{pln(row.balance_end)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-800 print:bg-gray-200 font-bold">
                <td className="px-2 py-2 text-gray-200 print:text-black border border-gray-700 print:border-gray-400">RAZEM {year}</td>
                <td className="px-2 py-2 text-right text-gray-500 border border-gray-700 print:border-gray-400">—</td>
                <td className="px-2 py-2 text-right text-green-300 print:text-green-700 border border-gray-700 print:border-gray-400">{pln(totalPaid)}</td>
                <td className="px-2 py-2 text-right text-gray-200 print:text-black border border-gray-700 print:border-gray-400">{pln(totalRenovation)}</td>
                <td className="px-2 py-2 text-right text-gray-200 print:text-black border border-gray-700 print:border-gray-400">{pln(totalOperating)}</td>
                <td className="px-2 py-2 text-right text-gray-200 print:text-black border border-gray-700 print:border-gray-400">{pln(totalManager)}</td>
                <td className="px-2 py-2 text-right text-gray-200 print:text-black border border-gray-700 print:border-gray-400">{pln(totalWater)}</td>
                <td className="px-2 py-2 text-right text-gray-200 print:text-black border border-gray-700 print:border-gray-400">{pln(totalGarbage)}</td>
                <td className="px-2 py-2 text-right text-yellow-400 print:text-yellow-700 border border-gray-700 print:border-gray-400">{totalCorrection !== 0 ? pln(totalCorrection) : '—'}</td>
                <td className="px-2 py-2 text-right text-gray-100 print:text-black border border-gray-700 print:border-gray-400">{pln(totalDue)}</td>
                <td className={`px-2 py-2 text-right border border-gray-700 print:border-gray-400 ${finalBalance >= 0 ? 'text-green-400 print:text-green-700' : 'text-red-400 print:text-red-600'}`}>{pln(finalBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Podsumowanie końcowe */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-900 print:bg-gray-50 rounded-xl border border-gray-800 print:border-gray-200">
          <div>
            <p className="text-xs text-gray-500 print:text-gray-500">Łącznie naliczono</p>
            <p className="text-lg font-bold text-gray-100 print:text-black mt-0.5">{pln(totalDue)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 print:text-gray-500">Łącznie wpłacono</p>
            <p className="text-lg font-bold text-green-400 print:text-green-700 mt-0.5">{pln(totalPaid)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 print:text-gray-500">{finalBalance >= 0 ? 'Nadpłata' : 'Niedopłata'}</p>
            <p className={`text-lg font-bold mt-0.5 ${finalBalance >= 0 ? 'text-green-400 print:text-green-700' : 'text-red-400 print:text-red-600'}`}>
              {pln(Math.abs(finalBalance))}
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-600 print:text-gray-400 mt-6 text-center print:text-center">
          Dokument wygenerowany automatycznie przez system Panel Wspólnoty · {generatedAt}
        </p>
      </div>
    </>
  )
}

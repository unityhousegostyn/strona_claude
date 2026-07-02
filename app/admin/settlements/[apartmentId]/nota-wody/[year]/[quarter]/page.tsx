import { redirect, notFound } from 'next/navigation'
import { getAuthProfile, canAccessApartment } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { getRatesForMonth, type SettlementRate } from '@/lib/settlementCalc'
import type { Community } from '@/types'
import { formatDocDate } from '@/lib/documentBranding'
import DocumentPaper from '@/components/print/DocumentPaper'
import DocumentHeader from '@/components/print/DocumentHeader'
import DocumentFooter from '@/components/print/DocumentFooter'
import PrintClient from '../../../print/PrintClient'

const MONTHS_SHORT = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru']
const MONTHS_FULL  = ['styczeń','luty','marzec','kwiecień','maj','czerwiec','lipiec','sierpień','wrzesień','październik','listopad','grudzień']
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']

function getPeriodTag(q: number, months: number): string {
  const startM = (q - 1) * months + 1
  const endM = startM + months - 1
  return months === 1
    ? `${ROMAN[q - 1]} (${MONTHS_FULL[startM - 1]})`
    : `${ROMAN[q - 1]} (${MONTHS_FULL[startM - 1]}–${MONTHS_FULL[endM - 1]})`
}

function getPeriodShort(q: number, months: number): string {
  const startM = (q - 1) * months + 1
  const endM = startM + months - 1
  return months === 1
    ? MONTHS_FULL[startM - 1]
    : `${MONTHS_SHORT[startM - 1]}–${MONTHS_SHORT[endM - 1]}`
}

function pln(v: number): string {
  return v.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
}
function fmtM3(v: number): string {
  return Math.round(v).toLocaleString('pl-PL')
}

export default async function NotaWodyPage({
  params,
}: {
  params: Promise<{ apartmentId: string; year: string; quarter: string }>
}) {
  const { user, profile } = await getAuthProfile()
  const { apartmentId, year: yearStr, quarter: quarterStr } = await params
  const year = parseInt(yearStr, 10)
  const quarter = parseInt(quarterStr, 10)
  // Wstępna walidacja zakresu (maks. 12 okresów przy rozliczeniu miesięcznym)
  if (!year || quarter < 1 || quarter > 12) notFound()

  const admin = getSupabaseAdminClient()

  const aptRes = await admin.from('settlement_apartments').select('*').eq('id', apartmentId).single()
  if (!aptRes.data) notFound()
  const apartment = aptRes.data

  if (!canAccessApartment(profile, user, apartment)) redirect('/admin/settlements')

  const [communityRes, ratesRes, recRes] = await Promise.all([
    admin.from('communities').select('*').eq('id', apartment.community_id).single(),
    admin.from('settlement_rates').select('*').eq('community_id', apartment.community_id),
    admin.from('settlement_water_reconciliation').select('*')
      .eq('apartment_id', apartmentId).eq('year', year).eq('quarter', quarter).maybeSingle(),
  ])

  if (!communityRes.data) notFound()
  if (!recRes.data) notFound()

  const community = communityRes.data as Community
  const rec = recRes.data
  const rates: SettlementRate[] = ratesRes.data ?? []

  // Okresy rozliczenia — dynamiczne na podstawie stawek
  const sortedRates = [...rates].sort((a, b) => b.effective_from.localeCompare(a.effective_from))
  const reconMonths = sortedRates[0]?.water_reconciliation_months ?? 3
  const numPeriods = Math.floor(12 / reconMonths)
  if (quarter > numPeriods) notFound()

  const startMonth = (quarter - 1) * reconMonths + 1
  const rate = getRatesForMonth(rates, year, startMonth) ?? rates[0] ?? null
  const waterPrice = rate?.water_price_m3 ?? 0

  const periodTag = getPeriodTag(quarter, reconMonths)
  const periodShort = getPeriodShort(quarter, reconMonths)

  const actualCost = Math.round(rec.actual_m3 * waterPrice * 100) / 100
  const paidForWater = Math.round(rec.ryczalt_m3 * waterPrice * 100) / 100
  const correction = rec.correction_amount as number
  const isDopłata = correction >= 0

  const generatedAt = formatDocDate()
  const isZaliczka = rate?.water_billing_type === 'zaliczka'

  return (
    <div className="max-w-2xl mx-auto">
      <PrintClient />

      <DocumentPaper size="a4-portrait">
        <DocumentHeader
          title="Nota rozliczenia wody"
          communityName={community.name}
          communityAddress={community.address}
          meta={[{ label: 'Dnia', value: generatedAt }]}
          tag={periodTag}
        />

        <div className="text-right mb-8">
          <p className="text-[#6b7280] text-sm">Państwo</p>
          <p className="font-bold text-[#111827]">{apartment.owner_name}</p>
          <p className="font-bold text-[#111827]">{community.address}{apartment.number ? ` / ${apartment.number}` : ''}</p>
        </div>

        <p className="mb-6 leading-relaxed text-[#374151]">
          Informujemy o wyniku rozliczenia rzeczywistego zużycia wody na podstawie zdalnego odczytu licznika
          za <strong>{periodShort} {year} r.</strong>
        </p>

        <table className="w-full text-sm border-collapse mb-6">
          <tbody>
            <tr>
              <td className="px-3 py-2 border border-[#e5e7eb] text-[#374151]">Odczyt na początek okresu</td>
              <td className="px-3 py-2 text-right border border-[#e5e7eb] text-[#111827] font-medium">{fmtM3(rec.meter_reading_start)} m³</td>
            </tr>
            <tr>
              <td className="px-3 py-2 border border-[#e5e7eb] text-[#374151]">Odczyt na koniec okresu</td>
              <td className="px-3 py-2 text-right border border-[#e5e7eb] text-[#111827] font-medium">{fmtM3(rec.meter_reading_end)} m³</td>
            </tr>
            <tr className="bg-[#f8fafb]">
              <td className="px-3 py-2 border border-[#e5e7eb] text-[#374151] font-semibold">Rzeczywiste zużycie</td>
              <td className="px-3 py-2 text-right border border-[#e5e7eb] text-[#111827] font-bold">{fmtM3(rec.actual_m3)} m³</td>
            </tr>
            <tr>
              <td className="px-3 py-2 border border-[#e5e7eb] text-[#374151]">Cena wody</td>
              <td className="px-3 py-2 text-right border border-[#e5e7eb] text-[#111827]">{pln(waterPrice)} / m³</td>
            </tr>
            <tr className="bg-[#f8fafb]">
              <td className="px-3 py-2 border border-[#e5e7eb] text-[#374151] font-semibold">Rzeczywisty koszt zużytej wody</td>
              <td className="px-3 py-2 text-right border border-[#e5e7eb] text-[#111827] font-bold">{pln(actualCost)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 border border-[#e5e7eb] text-[#374151]">
                {isZaliczka ? 'Wpłacono za wodę w tym okresie (z zaliczek)' : 'Naliczono w ramach ryczałtu w tym okresie'}
              </td>
              <td className="px-3 py-2 text-right border border-[#e5e7eb] text-[#111827]">{pln(paidForWater)}</td>
            </tr>
          </tbody>
        </table>

        <div className={`rounded-xl border p-4 mb-6 ${isDopłata ? 'bg-red-50 border-red-200' : 'bg-teal-50 border-teal-200'}`}>
          <p className={`font-bold text-lg ${isDopłata ? 'text-red-700' : 'text-teal-700'}`}>
            {isDopłata ? 'Do dopłaty' : 'Nadpłata do zwrotu / odliczenia'}: {pln(Math.abs(correction))}
          </p>
          <p className="text-sm mt-1 text-[#374151]">
            {isDopłata
              ? 'Rzeczywiste zużycie wody w tym okresie było wyższe niż wynikało to z dotychczasowych wpłat. Prosimy o dopłatę różnicy.'
              : 'Rzeczywiste zużycie wody w tym okresie było niższe niż wynikało to z dotychczasowych wpłat. Nadpłata zostanie odliczona od najbliższej należności lub zwrócona.'}
          </p>
        </div>

        {isDopłata && community.bank_account && (
          <p className="leading-relaxed text-[#374151]">
            Prosimy o dokonanie wpłaty na konto: <strong className="text-[#111827]">{community.bank_account}</strong>,
            w tytule podając numer lokalu i okres rozliczenia.
          </p>
        )}

        {rec.notes && (
          <p className="text-sm text-[#6b7280] mt-4">Uwagi: {rec.notes}</p>
        )}

        <DocumentFooter generatedAt={generatedAt} note="Nota rozliczeniowa wygenerowana automatycznie" />
      </DocumentPaper>
    </div>
  )
}

import { redirect, notFound } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { getRatesForMonth, type SettlementRate } from '@/lib/settlementCalc'
import type { Community } from '@/types'
import { formatDocDate } from '@/lib/documentBranding'
import DocumentPaper from '@/components/print/DocumentPaper'
import DocumentHeader from '@/components/print/DocumentHeader'
import DocumentFooter from '@/components/print/DocumentFooter'
import PrintClient from '../../../print/PrintClient'

const QUARTER_LABELS = ['I kwartał (styczeń–marzec)', 'II kwartał (kwiecień–czerwiec)', 'III kwartał (lipiec–wrzesień)', 'IV kwartał (październik–grudzień)']

function pln(v: number): string {
  return v.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
}
function fmtM3(v: number): string {
  return v.toLocaleString('pl-PL', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
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
  if (!year || quarter < 1 || quarter > 4) notFound()

  const admin = getSupabaseAdminClient()

  const aptRes = await admin.from('settlement_apartments').select('*').eq('id', apartmentId).single()
  if (!aptRes.data) notFound()
  const apartment = aptRes.data

  if (profile.role === 'user' && apartment.owner_id !== user.id) redirect('/admin/settlements')
  if (profile.role === 'admin' && apartment.community_id !== profile.community_id) redirect('/admin/settlements')
  if (profile.role !== 'super_admin' && profile.role !== 'admin' && profile.role !== 'user') redirect('/admin/dashboard')

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

  const startMonth = (quarter - 1) * 3 + 1
  const rate = getRatesForMonth(rates, year, startMonth) ?? rates[0] ?? null
  const waterPrice = rate?.water_price_m3 ?? 0

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
          tag={QUARTER_LABELS[quarter - 1]}
        />

        <div className="text-right mb-8">
          <p className="text-[#6b7280] text-sm">Państwo</p>
          <p className="font-bold text-[#111827]">{apartment.owner_name}</p>
          <p className="font-bold text-[#111827]">{community.address}{apartment.number ? ` / ${apartment.number}` : ''}</p>
        </div>

        <p className="mb-6 leading-relaxed text-[#374151]">
          Informujemy o wyniku rozliczenia rzeczywistego zużycia wody na podstawie zdalnego odczytu licznika
          za <strong>{QUARTER_LABELS[quarter - 1].toLowerCase()} {year} r.</strong>
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

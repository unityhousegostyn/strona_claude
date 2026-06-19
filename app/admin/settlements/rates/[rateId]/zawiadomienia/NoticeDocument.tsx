import {
  calcMonthCharges,
  pln,
  type SettlementApartment,
  type SettlementRate,
} from '@/lib/settlementCalc'
import type { Community } from '@/types'
import DocumentPaper from '@/components/print/DocumentPaper'
import DocumentHeader from '@/components/print/DocumentHeader'
import DocumentFooter from '@/components/print/DocumentFooter'

/** Formatuje liczbę ze stałą liczbą miejsc po przecinku (notacja PL) */
function fmtNum(v: number): string {
  return v.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Próbuje wyciągnąć nazwę miasta z adresu wspólnoty (wzorzec: kod pocztowy + miasto na końcu) */
function extractCity(address: string): string | null {
  const m = address.match(/\d{2}-\d{3}\s+(.+)$/)
  return m ? m[1].trim() : null
}

interface NoticeDocumentProps {
  apartment: SettlementApartment
  community: Community
  rate: SettlementRate
  generatedAt: string
  pageBreakAfter?: boolean
}

export default function NoticeDocument({ apartment, community, rate, generatedAt, pageBreakAfter = false }: NoticeDocumentProps) {
  const charges = calcMonthCharges(apartment, rate, null)
  const isMeter = rate.water_billing_type === 'meter'
  const isZaliczka = rate.water_billing_type === 'zaliczka'
  const waterVariable = isMeter || isZaliczka
  const city = extractCity(community.address)
  const legalBasis = community.legal_basis?.trim()
    || 'ustawy o własności lokali z dnia 24 czerwca 1994 r.'

  const managerIsFixed = rate.manager_fee_type === 'fixed'

  return (
    <DocumentPaper size="a4-portrait" className={`notice-doc mb-8 last:mb-0 print:mb-0 ${pageBreakAfter ? 'print-break-after' : ''}`}>
      <DocumentHeader
        title="Zawiadomienie o opłatach"
        communityName={community.name}
        communityAddress={community.address}
        meta={[{ label: city ? `${city}, dnia` : 'Dnia', value: generatedAt }]}
      />

      <div className="text-right mb-8">
        <p className="text-[#6b7280] text-sm">Państwo</p>
        <p className="font-bold text-[#111827]">{apartment.owner_name}</p>
        <p className="font-bold text-[#111827]">{community.address}{apartment.number ? ` / ${apartment.number}` : ''}</p>
      </div>

      <p className="mb-6 leading-relaxed text-[#374151]">
        W nawiązaniu do {legalBasis} podajemy wysokość opłat nieruchomości wspólnej:
      </p>

      <div className="text-right mb-1 font-bold text-[#111827]">
        Powierzchnia lokalu wraz z pomieszczeniami przynależnymi: {fmtNum(apartment.area_m2)} m²
      </div>
      <div className="text-right mb-6 font-bold text-[#111827]">
        Ilość mieszkańców: {apartment.persons_count} {apartment.persons_count === 1 ? 'osoba' : 'osoby'}
      </div>

      <table className="w-full text-sm border-collapse mb-6">
        <thead>
          <tr className="bg-[#f1f5f4]">
            <th className="px-2 py-2 text-left border border-[#e5e7eb] font-semibold text-[#374151]">Lp.</th>
            <th className="px-2 py-2 text-left border border-[#e5e7eb] font-semibold text-[#374151]">Rodzaj opłaty</th>
            <th className="px-2 py-2 text-right border border-[#e5e7eb] font-semibold text-[#374151]">Stawka</th>
            <th className="px-2 py-2 text-right border border-[#e5e7eb] font-semibold text-[#374151]">Stawka × powierzchnia lokalu</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-2 py-1.5 border border-[#e5e7eb] text-[#374151]">1</td>
            <td className="px-2 py-1.5 border border-[#e5e7eb] text-[#374151]">Wynagrodzenie zarządcy</td>
            <td className="px-2 py-1.5 text-right border border-[#e5e7eb] text-[#374151]">
              {managerIsFixed ? `${fmtNum(rate.manager_fee_value)} zł` : `${fmtNum(rate.manager_fee_value)} zł/m²`}
            </td>
            <td className="px-2 py-1.5 text-right border border-[#e5e7eb] text-[#111827]">
              {managerIsFixed ? '—' : pln(charges.manager)}
            </td>
          </tr>
          <tr>
            <td className="px-2 py-1.5 border border-[#e5e7eb] text-[#374151]">2</td>
            <td className="px-2 py-1.5 border border-[#e5e7eb] text-[#374151]" colSpan={3}>Zaliczki:</td>
          </tr>
          <tr>
            <td className="px-2 py-1.5 border border-[#e5e7eb] text-[#374151]">a.</td>
            <td className="px-2 py-1.5 border border-[#e5e7eb] text-[#374151]">fundusz eksploatacyjny</td>
            <td className="px-2 py-1.5 text-right border border-[#e5e7eb] text-[#374151]">{fmtNum(rate.operating_rate_m2)} zł/m²</td>
            <td className="px-2 py-1.5 text-right border border-[#e5e7eb] text-[#111827]">{pln(charges.operating)}</td>
          </tr>
          <tr>
            <td className="px-2 py-1.5 border border-[#e5e7eb] text-[#374151]">b.</td>
            <td className="px-2 py-1.5 border border-[#e5e7eb] text-[#374151]">fundusz remontowy</td>
            <td className="px-2 py-1.5 text-right border border-[#e5e7eb] text-[#374151]">{fmtNum(rate.renovation_rate_m2)} zł/m²</td>
            <td className="px-2 py-1.5 text-right border border-[#e5e7eb] text-[#111827]">{pln(charges.renovation)}</td>
          </tr>
          <tr>
            <td className="px-2 py-1.5 border border-[#e5e7eb] text-[#374151]">3</td>
            <td className="px-2 py-1.5 border border-[#e5e7eb] text-[#374151]" colSpan={3}>Zaliczka na pokrycie świadczeń dotyczących właścicieli:</td>
          </tr>
          <tr>
            <td className="px-2 py-1.5 border border-[#e5e7eb] text-[#374151]">a.</td>
            <td className="px-2 py-1.5 border border-[#e5e7eb] text-[#374151]">zimna woda oraz ścieki</td>
            <td className="px-2 py-1.5 text-right border border-[#e5e7eb] text-[#374151]">{fmtNum(rate.water_price_m3)} zł/m³</td>
            <td className="px-2 py-1.5 text-right border border-[#e5e7eb] text-[#111827]">{isMeter ? 'x' : isZaliczka ? 'wg wpłaty' : pln(charges.water)}</td>
          </tr>
          <tr>
            <td className="px-2 py-1.5 border border-[#e5e7eb] text-[#374151]">b.</td>
            <td className="px-2 py-1.5 border border-[#e5e7eb] text-[#374151]">wywóz śmieci</td>
            <td className="px-2 py-1.5 text-right border border-[#e5e7eb] text-[#374151]">{fmtNum(rate.garbage_per_person)} zł/osoba</td>
            <td className="px-2 py-1.5 text-right border border-[#e5e7eb] text-[#111827]">{pln(charges.garbage)}</td>
          </tr>
        </tbody>
      </table>

      <p className="font-bold mb-4 text-[#111827]">
        Razem do zapłaty: <span className="text-teal-700">{pln(charges.total_due)}{waterVariable ? ' + woda' : ''}</span>
      </p>

      {community.bank_account && (
        <p className="leading-relaxed text-[#374151]">
          Prosimy o dokonywanie wpłat na konto: <strong className="text-[#111827]">{community.bank_account}</strong> do 10 dnia
          każdego miesiąca{isMeter ? ', podając w tytule przelewu zużycie wody w m3' : ''}.
        </p>
      )}

      {isZaliczka && (
        <p className="leading-relaxed text-[#374151] mt-2">
          Opłata za wodę nie jest stawką stałą — mieszkaniec samodzielnie wylicza wysokość zaliczki na wodę
          ponad pozostałe opłaty wymienione powyżej i uwzględnia ją w łącznej wpłacie.
        </p>
      )}

      <DocumentFooter generatedAt={generatedAt} />
    </DocumentPaper>
  )
}

import {
  calcMonthCharges,
  pln,
  type SettlementApartment,
  type SettlementRate,
} from '@/lib/settlementCalc'
import type { Community } from '@/types'

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
  const city = extractCity(community.address)
  const legalBasis = community.legal_basis?.trim()
    || 'ustawy o własności lokali z dnia 24 czerwca 1994 r.'

  const managerIsFixed = rate.manager_fee_type === 'fixed'

  return (
    <div
      className={`notice-doc max-w-2xl mx-auto p-8 print:p-0 mb-8 print:mb-0 last:mb-0 bg-[#081918] print:bg-white text-[#ccfbf1] print:text-black rounded-xl print:rounded-none border border-[#0f2d2a] print:border-none ${pageBreakAfter ? 'print-break-after' : ''}`}
    >
      <div className="text-right mb-8">
        {city ? `${city}, ${generatedAt}` : generatedAt}
      </div>

      <div className="text-right mb-8">
        <p>Państwo</p>
        <p className="font-bold">{apartment.owner_name}</p>
        <p className="font-bold">{community.address}{apartment.number ? ` / ${apartment.number}` : ''}</p>
      </div>

      <p className="mb-6 leading-relaxed">
        W nawiązaniu do {legalBasis} podajemy wysokość opłat nieruchomości wspólnej:
      </p>

      <div className="text-right mb-1 font-bold">
        Powierzchnia lokalu wraz z pomieszczeniami przynależnymi: {fmtNum(apartment.area_m2)} m²
      </div>
      <div className="text-right mb-6 font-bold">
        Ilość mieszkańców: {apartment.persons_count} {apartment.persons_count === 1 ? 'osoba' : 'osoby'}
      </div>

      <table className="w-full text-sm border-collapse mb-6">
        <thead>
          <tr className="bg-[#0c2220] print:bg-gray-100">
            <th className="px-2 py-2 text-left border border-[#0f2d2a] print:border-gray-300 font-semibold">Lp.</th>
            <th className="px-2 py-2 text-left border border-[#0f2d2a] print:border-gray-300 font-semibold">Rodzaj opłaty</th>
            <th className="px-2 py-2 text-right border border-[#0f2d2a] print:border-gray-300 font-semibold">Stawka</th>
            <th className="px-2 py-2 text-right border border-[#0f2d2a] print:border-gray-300 font-semibold">Stawka × powierzchnia lokalu</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-2 py-1.5 border border-[#0f2d2a] print:border-gray-200">1</td>
            <td className="px-2 py-1.5 border border-[#0f2d2a] print:border-gray-200">Wynagrodzenie zarządcy</td>
            <td className="px-2 py-1.5 text-right border border-[#0f2d2a] print:border-gray-200">
              {managerIsFixed ? `${fmtNum(rate.manager_fee_value)} zł` : `${fmtNum(rate.manager_fee_value)} zł/m²`}
            </td>
            <td className="px-2 py-1.5 text-right border border-[#0f2d2a] print:border-gray-200">
              {managerIsFixed ? '—' : pln(charges.manager)}
            </td>
          </tr>
          <tr>
            <td className="px-2 py-1.5 border border-[#0f2d2a] print:border-gray-200">2</td>
            <td className="px-2 py-1.5 border border-[#0f2d2a] print:border-gray-200" colSpan={3}>Zaliczki:</td>
          </tr>
          <tr>
            <td className="px-2 py-1.5 border border-[#0f2d2a] print:border-gray-200">a.</td>
            <td className="px-2 py-1.5 border border-[#0f2d2a] print:border-gray-200">fundusz eksploatacyjny</td>
            <td className="px-2 py-1.5 text-right border border-[#0f2d2a] print:border-gray-200">{fmtNum(rate.operating_rate_m2)} zł/m²</td>
            <td className="px-2 py-1.5 text-right border border-[#0f2d2a] print:border-gray-200">{pln(charges.operating)}</td>
          </tr>
          <tr>
            <td className="px-2 py-1.5 border border-[#0f2d2a] print:border-gray-200">b.</td>
            <td className="px-2 py-1.5 border border-[#0f2d2a] print:border-gray-200">fundusz remontowy</td>
            <td className="px-2 py-1.5 text-right border border-[#0f2d2a] print:border-gray-200">{fmtNum(rate.renovation_rate_m2)} zł/m²</td>
            <td className="px-2 py-1.5 text-right border border-[#0f2d2a] print:border-gray-200">{pln(charges.renovation)}</td>
          </tr>
          <tr>
            <td className="px-2 py-1.5 border border-[#0f2d2a] print:border-gray-200">3</td>
            <td className="px-2 py-1.5 border border-[#0f2d2a] print:border-gray-200" colSpan={3}>Zaliczka na pokrycie świadczeń dotyczących właścicieli:</td>
          </tr>
          <tr>
            <td className="px-2 py-1.5 border border-[#0f2d2a] print:border-gray-200">a.</td>
            <td className="px-2 py-1.5 border border-[#0f2d2a] print:border-gray-200">zimna woda oraz ścieki</td>
            <td className="px-2 py-1.5 text-right border border-[#0f2d2a] print:border-gray-200">{fmtNum(rate.water_price_m3)} zł/m³</td>
            <td className="px-2 py-1.5 text-right border border-[#0f2d2a] print:border-gray-200">{isMeter ? 'x' : pln(charges.water)}</td>
          </tr>
          <tr>
            <td className="px-2 py-1.5 border border-[#0f2d2a] print:border-gray-200">b.</td>
            <td className="px-2 py-1.5 border border-[#0f2d2a] print:border-gray-200">wywóz śmieci</td>
            <td className="px-2 py-1.5 text-right border border-[#0f2d2a] print:border-gray-200">{fmtNum(rate.garbage_per_person)} zł/osoba</td>
            <td className="px-2 py-1.5 text-right border border-[#0f2d2a] print:border-gray-200">{pln(charges.garbage)}</td>
          </tr>
        </tbody>
      </table>

      <p className="font-bold mb-4">
        Razem do zapłaty: {pln(charges.total_due)}{isMeter ? ' + woda' : ''}
      </p>

      {community.bank_account && (
        <p className="leading-relaxed">
          Prosimy o dokonywanie wpłat na konto: <strong>{community.bank_account}</strong> do 10 dnia
          każdego miesiąca{isMeter ? ', podając w tytule przelewu zużycie wody w m3' : ''}.
        </p>
      )}
    </div>
  )
}

import { redirect, notFound } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { buildYearlyTable, type SettlementApartment, type SettlementRate, type SettlementEntry } from '@/lib/settlementCalc'
import { formatDocDate } from '@/lib/documentBranding'
import DocumentPaper from '@/components/print/DocumentPaper'
import DocumentHeader from '@/components/print/DocumentHeader'
import DocumentFooter from '@/components/print/DocumentFooter'
import PrintClient from '../../[apartmentId]/print/PrintClient'
import type { Community } from '@/types'

function pln(v: number) {
  return v.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
}

interface AptDebt {
  id: string; number: string; owner_name: string
  totalPaid: number; totalDue: number; balance: number
  openingBalance: number
}

async function getDebtors(
  communityId: string,
  year: number,
  minDebt: number,
  apartmentId?: string
): Promise<AptDebt[]> {
  const admin = getSupabaseAdminClient()
  let aptsQ = admin.from('settlement_apartments').select('*').eq('community_id', communityId).eq('active', true).order('number')
  if (apartmentId) aptsQ = aptsQ.eq('id', apartmentId)

  const [aptsRes, ratesRes] = await Promise.all([
    aptsQ,
    admin.from('settlement_rates').select('*').eq('community_id', communityId).order('effective_from', { ascending: false }),
  ])

  const apts: SettlementApartment[] = (aptsRes.data ?? []) as SettlementApartment[]
  const rates: SettlementRate[] = (ratesRes.data ?? []) as SettlementRate[]

  if (!apts.length) return []

  const [entriesRes, obRes] = await Promise.all([
    admin.from('settlement_entries').select('*').eq('year', year).in('apartment_id', apts.map(a => a.id)),
    admin.from('settlement_opening_balances').select('apartment_id, balance').eq('year', year).in('apartment_id', apts.map(a => a.id)),
  ])

  const entries: SettlementEntry[] = (entriesRes.data ?? []) as SettlementEntry[]
  const obMap: Record<string, number> = {}
  for (const ob of obRes.data ?? []) obMap[ob.apartment_id] = Number(ob.balance)

  const debtors: AptDebt[] = []
  for (const apt of apts) {
    const aptEntries = entries.filter(e => e.apartment_id === apt.id)
    const rows = buildYearlyTable(apt, rates, aptEntries, year)
    const totalPaid = rows.reduce((s, r) => s + r.paid, 0)
    const totalDue  = rows.reduce((s, r) => s + r.total_due, 0)
    const openingBalance = obMap[apt.id] ?? 0
    const balance = openingBalance + totalPaid - totalDue

    if (balance < -minDebt) {
      debtors.push({
        id: apt.id, number: apt.number, owner_name: apt.owner_name,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalDue:  Math.round(totalDue  * 100) / 100,
        balance:   Math.round(balance   * 100) / 100,
        openingBalance: Math.round(openingBalance * 100) / 100,
      })
    }
  }
  debtors.sort((a, b) => a.balance - b.balance)
  return debtors
}

export default async function WezwaniaPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ communityId?: string; year?: string; minDebt?: string; apartmentId?: string }>
}) {
  const { profile } = await getAuthProfile()
  if (profile.role !== 'super_admin' && profile.role !== 'admin') redirect('/admin/settlements')

  const sp = await searchParams
  const communityId = sp.communityId
  if (!communityId) notFound()
  if (profile.role === 'admin' && profile.community_id !== communityId) redirect('/admin/settlements')

  const year = parseInt(sp.year ?? '') || new Date().getFullYear()
  const minDebt = parseFloat(sp.minDebt ?? '0') || 0
  const apartmentId = sp.apartmentId

  const admin = getSupabaseAdminClient()
  const { data: communityData } = await admin.from('communities').select('*').eq('id', communityId).single()
  if (!communityData) notFound()
  const community = communityData as Community

  const debtors = await getDebtors(communityId, year, minDebt, apartmentId)
  if (!debtors.length) notFound()

  const generatedAt = formatDocDate()
  const today = new Date()
  const dueDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
  const dueDateStr = dueDate.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="max-w-2xl mx-auto">
      <style>{`
        @media print { .print-break-after { page-break-after: always; } }
      `}</style>
      <PrintClient />

      {debtors.map((d, idx) => (
        <div key={d.id} className={idx < debtors.length - 1 ? 'print-break-after' : ''}>
          <DocumentPaper size="a4-portrait">
            <DocumentHeader
              title="Wezwanie do zapłaty"
              communityName={community.name}
              communityAddress={community.address}
              meta={[{ label: 'Dnia', value: generatedAt }]}
              tag={String(year)}
            />

            <div className="text-right mb-8">
              <p className="text-[#6b7280] text-sm">Państwo</p>
              <p className="font-bold text-[#111827]">{d.owner_name}</p>
              <p className="text-[#374151] text-sm">{community.address}{d.number ? ` / ${d.number}` : ''}</p>
            </div>

            <p className="mb-6 leading-relaxed text-[#374151]">
              Zarząd Wspólnoty Mieszkaniowej <strong>{community.name}</strong> wzywa Państwa
              do uregulowania zaległości z tytułu opłat za lokal nr <strong>{d.number}</strong>
              za rok <strong>{year}</strong>.
            </p>

            <table className="w-full text-sm border-collapse mb-6">
              <tbody>
                {d.openingBalance !== 0 && (
                  <tr>
                    <td className="px-3 py-2 border border-[#e5e7eb] text-[#374151]">Saldo z poprzedniego okresu</td>
                    <td className={`px-3 py-2 text-right border border-[#e5e7eb] font-medium ${d.openingBalance >= 0 ? 'text-teal-700' : 'text-red-700'}`}>
                      {d.openingBalance >= 0 ? '+' : ''}{pln(d.openingBalance)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="px-3 py-2 border border-[#e5e7eb] text-[#374151]">Naliczone opłaty za {year} r.</td>
                  <td className="px-3 py-2 text-right border border-[#e5e7eb] text-[#111827] font-medium">{pln(d.totalDue)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border border-[#e5e7eb] text-[#374151]">Wpłacono w {year} r.</td>
                  <td className="px-3 py-2 text-right border border-[#e5e7eb] text-teal-700 font-medium">{pln(d.totalPaid)}</td>
                </tr>
                <tr className="bg-red-50">
                  <td className="px-3 py-2 border border-[#e5e7eb] text-red-800 font-bold">Kwota zaległości do uregulowania</td>
                  <td className="px-3 py-2 text-right border border-[#e5e7eb] text-red-700 font-bold text-base">{pln(Math.abs(d.balance))}</td>
                </tr>
              </tbody>
            </table>

            <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-6">
              <p className="font-bold text-red-700 text-base">
                Do zapłaty: {pln(Math.abs(d.balance))}
              </p>
              <p className="text-sm text-[#374151] mt-1">
                Termin zapłaty: <strong>{dueDateStr}</strong>
              </p>
            </div>

            {community.bank_account && (
              <p className="leading-relaxed text-[#374151] mb-4">
                Prosimy o dokonanie wpłaty na konto Wspólnoty:{' '}
                <strong className="text-[#111827]">{community.bank_account}</strong>,
                w tytule podając numer lokalu i rok rozliczeniowy.
              </p>
            )}

            <p className="text-sm leading-relaxed text-[#374151] mb-4">
              W przypadku braku zapłaty w wyznaczonym terminie Wspólnota zastrzega sobie prawo
              do naliczenia odsetek ustawowych za opóźnienie oraz skierowania sprawy na drogę postępowania
              sądowego.
            </p>

            <p className="text-sm text-[#374151]">
              W przypadku pytań prosimy o kontakt z Zarządem Wspólnoty.
            </p>

            <DocumentFooter generatedAt={generatedAt} note="Wezwanie do zapłaty wygenerowane automatycznie" />
          </DocumentPaper>
        </div>
      ))}
    </div>
  )
}

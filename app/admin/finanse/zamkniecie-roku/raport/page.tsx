import { redirect, notFound } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { previewYearClose } from '../actions'
import { formatDocDate } from '@/lib/documentBranding'
import DocumentPaper from '@/components/print/DocumentPaper'
import DocumentHeader from '@/components/print/DocumentHeader'
import DocumentFooter from '@/components/print/DocumentFooter'
import PrintClient from '../../../settlements/[apartmentId]/print/PrintClient'
import type { Community } from '@/types'

function pln(v: number) {
  return v.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
}

export default async function ZamkniecieRaportPage({
  searchParams,
}: {
  searchParams: Promise<{ communityId?: string; year?: string }>
}) {
  const { profile } = await getAuthProfile()
  if (!['super_admin', 'admin'].includes(profile.role)) redirect('/admin/finanse')

  const sp = await searchParams
  const communityId = sp.communityId
  if (!communityId) notFound()

  if (profile.role === 'admin' && profile.community_id !== communityId) redirect('/admin/finanse')

  const year = parseInt(sp.year ?? '') || new Date().getFullYear() - 1
  const admin = getSupabaseAdminClient()

  const [communityRes, closureRes, expensesRes, incomeRes] = await Promise.all([
    admin.from('communities').select('*').eq('id', communityId).single(),
    admin.from('year_closures').select('*').eq('community_id', communityId).eq('year', year).maybeSingle(),
    admin.from('community_expenses').select('category, amount')
      .eq('community_id', communityId)
      .gte('expense_date', `${year}-01-01`)
      .lte('expense_date', `${year}-12-31`),
    admin.from('community_income').select('category, amount')
      .eq('community_id', communityId)
      .gte('income_date', `${year}-01-01`)
      .lte('income_date', `${year}-12-31`),
  ])

  if (!communityRes.data) notFound()
  const community = communityRes.data as Community
  const closure = closureRes.data

  const preview = await previewYearClose(communityId, year)

  // Agregaty
  const totalExpenses = (expensesRes.data ?? []).reduce((s, e) => s + Number(e.amount), 0)
  const totalIncome   = (incomeRes.data  ?? []).reduce((s, e) => s + Number(e.amount), 0)

  const expByCategory: Record<string, number> = {}
  for (const e of expensesRes.data ?? []) {
    expByCategory[e.category] = (expByCategory[e.category] ?? 0) + Number(e.amount)
  }

  const generatedAt = formatDocDate()

  return (
    <div className="max-w-2xl mx-auto">
      <PrintClient />

      <DocumentPaper size="a4-portrait">
        <DocumentHeader
          title={`Sprawozdanie finansowe ${year}`}
          communityName={community.name}
          communityAddress={community.address}
          meta={[
            { label: 'Dnia', value: generatedAt },
            ...(closure ? [{ label: 'Zamknięto', value: new Date(closure.closed_at).toLocaleDateString('pl-PL') }] : []),
          ]}
          tag={String(year)}
        />

        {/* Status zamknięcia */}
        <div className={`rounded-xl border px-4 py-3 mb-6 text-sm ${closure ? 'bg-teal-50 border-teal-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className={`font-semibold ${closure ? 'text-teal-700' : 'text-amber-700'}`}>
            {closure ? `✅ Rok ${year} zamknięty` : `⏳ Rok ${year} — raport wstępny (rok niezamknięty)`}
          </p>
        </div>

        {/* Sekcja 1: Podsumowanie finansowe */}
        <h2 className="font-bold text-[#111827] text-base mb-3">1. Podsumowanie finansowe</h2>
        <table className="w-full text-sm border-collapse mb-6">
          <tbody>
            <tr>
              <td className="px-3 py-2 border border-[#e5e7eb] text-[#374151]">Przychody (wpłaty od mieszkańców)</td>
              <td className="px-3 py-2 text-right border border-[#e5e7eb] font-medium text-[#111827]">{pln(preview.totalPaid)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 border border-[#e5e7eb] text-[#374151]">Przychody inne (odsetki, zwroty)</td>
              <td className="px-3 py-2 text-right border border-[#e5e7eb] font-medium text-[#111827]">{pln(totalIncome)}</td>
            </tr>
            <tr className="bg-[#f8fafb]">
              <td className="px-3 py-2 border border-[#e5e7eb] text-[#374151] font-semibold">Przychody razem</td>
              <td className="px-3 py-2 text-right border border-[#e5e7eb] font-bold text-[#111827]">{pln(preview.totalPaid + totalIncome)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 border border-[#e5e7eb] text-[#374151]">Koszty (faktury / wydatki)</td>
              <td className="px-3 py-2 text-right border border-[#e5e7eb] font-medium text-red-600">{pln(totalExpenses)}</td>
            </tr>
            <tr className="bg-[#f8fafb]">
              <td className="px-3 py-2 border border-[#e5e7eb] text-[#374151] font-semibold">Wynik finansowy (przychody − koszty)</td>
              <td className={`px-3 py-2 text-right border border-[#e5e7eb] font-bold ${preview.totalPaid + totalIncome - totalExpenses >= 0 ? 'text-teal-700' : 'text-red-700'}`}>
                {pln(preview.totalPaid + totalIncome - totalExpenses)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Sekcja 2: Koszty per kategoria */}
        {Object.keys(expByCategory).length > 0 && (
          <>
            <h2 className="font-bold text-[#111827] text-base mb-3">2. Koszty per kategoria</h2>
            <table className="w-full text-sm border-collapse mb-6">
              <thead>
                <tr className="bg-[#f3f4f6]">
                  <th className="px-3 py-2 text-left border border-[#e5e7eb] text-[#374151]">Kategoria</th>
                  <th className="px-3 py-2 text-right border border-[#e5e7eb] text-[#374151]">Kwota</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(expByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
                  <tr key={cat}>
                    <td className="px-3 py-1.5 border border-[#e5e7eb] text-[#374151] capitalize">{cat.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-1.5 text-right border border-[#e5e7eb] text-[#111827]">{pln(amount)}</td>
                  </tr>
                ))}
                <tr className="bg-[#f8fafb]">
                  <td className="px-3 py-2 border border-[#e5e7eb] font-bold text-[#111827]">RAZEM</td>
                  <td className="px-3 py-2 text-right border border-[#e5e7eb] font-bold text-[#111827]">{pln(totalExpenses)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {/* Sekcja 3: Salda per lokal */}
        <h2 className="font-bold text-[#111827] text-base mb-3">3. Rozliczenie per lokal</h2>
        <table className="w-full text-sm border-collapse mb-6">
          <thead>
            <tr className="bg-[#f3f4f6]">
              <th className="px-3 py-2 text-left border border-[#e5e7eb] text-[#374151]">Lokal</th>
              <th className="px-3 py-2 text-left border border-[#e5e7eb] text-[#374151]">Właściciel</th>
              <th className="px-3 py-2 text-right border border-[#e5e7eb] text-[#374151]">Naliczono</th>
              <th className="px-3 py-2 text-right border border-[#e5e7eb] text-[#374151]">Wpłacono</th>
              <th className="px-3 py-2 text-right border border-[#e5e7eb] text-[#374151]">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {preview.apartments.map(apt => (
              <tr key={apt.id} className={apt.balance < 0 ? 'bg-red-50' : ''}>
                <td className="px-3 py-1.5 border border-[#e5e7eb] font-medium text-[#111827]">{apt.number}</td>
                <td className="px-3 py-1.5 border border-[#e5e7eb] text-[#374151] text-xs">{apt.owner_name}</td>
                <td className="px-3 py-1.5 text-right border border-[#e5e7eb] text-[#374151]">{pln(apt.total_due)}</td>
                <td className="px-3 py-1.5 text-right border border-[#e5e7eb] text-[#374151]">{pln(apt.total_paid)}</td>
                <td className={`px-3 py-1.5 text-right border border-[#e5e7eb] font-semibold ${apt.balance >= 0 ? 'text-teal-700' : 'text-red-700'}`}>
                  {apt.balance >= 0 ? '+' : ''}{pln(apt.balance)}
                </td>
              </tr>
            ))}
            <tr className="bg-[#f8fafb]">
              <td colSpan={2} className="px-3 py-2 border border-[#e5e7eb] font-bold text-[#111827]">RAZEM</td>
              <td className="px-3 py-2 text-right border border-[#e5e7eb] font-bold text-[#111827]">{pln(preview.totalDue)}</td>
              <td className="px-3 py-2 text-right border border-[#e5e7eb] font-bold text-[#111827]">{pln(preview.totalPaid)}</td>
              <td className={`px-3 py-2 text-right border border-[#e5e7eb] font-bold ${preview.totalBalance >= 0 ? 'text-teal-700' : 'text-red-700'}`}>
                {preview.totalBalance >= 0 ? '+' : ''}{pln(preview.totalBalance)}
              </td>
            </tr>
          </tbody>
        </table>

        {closure?.notes && (
          <p className="text-xs text-[#6b7280] mb-4">Uwagi: {closure.notes}</p>
        )}

        <DocumentFooter generatedAt={generatedAt} note="Sprawozdanie finansowe wygenerowane automatycznie z systemu Zarządzania Wspólnotą" />
      </DocumentPaper>
    </div>
  )
}

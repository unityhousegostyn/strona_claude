import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function CommunitiesPage() {
  const { user, profile } = await getAuthProfile()
  if (profile.role !== 'super_admin') redirect('/admin/dashboard')

  const admin = getSupabaseAdminClient()
  const { data: communities } = await admin
    .from('communities')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#fef9ee]">Wspólnoty</h2>
        <Link
          href="/admin/communities/add"
          className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          + Dodaj wspólnotę
        </Link>
      </div>

      <div className="bg-[#1e1409] border border-[#33200d] rounded-xl overflow-hidden overflow-x-auto">
        {!communities || communities.length === 0 ? (
          <p className="text-center text-sm text-[#b45309] py-8">Brak wspólnot.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#18110a] border-b border-[#33200d]">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-[#b45309]">Nazwa</th>
                <th className="text-left px-4 py-3 font-medium text-[#b45309]">Adres</th>
                <th className="text-left px-4 py-3 font-medium text-[#b45309]">Dodano</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {communities.map((c: any) => (
                <tr key={c.id} className="hover:bg-[#18110a] transition">
                  <td className="px-4 py-3 font-medium text-[#fef9ee]">{c.name}</td>
                  <td className="px-4 py-3 text-[#a16207]">{c.address}</td>
                  <td className="px-4 py-3 text-[#b45309]">
                    {new Date(c.created_at).toLocaleDateString('pl-PL')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/communities/${c.id}`}
                      className="text-sm text-amber-500 hover:underline"
                    >
                      Edytuj
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
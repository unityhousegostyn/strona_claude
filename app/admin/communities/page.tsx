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
        <h2 className="text-2xl font-bold text-[#f0fdfa]">Wspólnoty</h2>
        <Link
          href="/admin/communities/add"
          className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          + Dodaj wspólnotę
        </Link>
      </div>

      <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl overflow-hidden overflow-x-auto">
        {!communities || communities.length === 0 ? (
          <p className="text-center text-sm text-[#0f766e] py-8">Brak wspólnot.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#051210] border-b border-[#0f2d2a]">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-[#0f766e]">Nazwa</th>
                <th className="text-left px-4 py-3 font-medium text-[#0f766e]">Adres</th>
                <th className="text-left px-4 py-3 font-medium text-[#0f766e]">Dodano</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {communities.map((c: any) => (
                <tr key={c.id} className="hover:bg-[#051210] transition">
                  <td className="px-4 py-3 font-medium text-[#f0fdfa]">{c.name}</td>
                  <td className="px-4 py-3 text-[#115e59]">{c.address}</td>
                  <td className="px-4 py-3 text-[#0f766e]">
                    {new Date(c.created_at).toLocaleDateString('pl-PL')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/communities/${c.id}`}
                      className="text-sm text-teal-500 hover:underline"
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
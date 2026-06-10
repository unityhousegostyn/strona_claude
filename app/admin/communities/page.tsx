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
        <h2 className="text-2xl font-bold text-gray-100">Wspólnoty</h2>
        <Link
          href="/admin/communities/add"
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          + Dodaj wspólnotę
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
        {!communities || communities.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">Brak wspólnot.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-950 border-b border-gray-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Nazwa</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Adres</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">Dodano</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {communities.map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-950 transition">
                  <td className="px-4 py-3 font-medium text-gray-100">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.address}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(c.created_at).toLocaleDateString('pl-PL')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/communities/${c.id}`}
                      className="text-sm text-green-600 hover:underline"
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
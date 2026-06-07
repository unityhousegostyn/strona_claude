import { getSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PendingUsers from './PendingUsers'

export default async function UsersPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role === 'user') redirect('/admin/dashboard')

  const isSuperAdmin = profile.role === 'super_admin'

  // Zapytania równoległe
  const pendingQuery = supabase
    .from('profiles')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (!isSuperAdmin) pendingQuery.eq('community_id', profile.community_id)

  const activeQuery = supabase
    .from('profiles')
    .select('*, community:communities(name)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (!isSuperAdmin) activeQuery.eq('community_id', profile.community_id)

  const [{ data: pendingUsers }, { data: activeUsers }, { data: communities }] = await Promise.all([
    pendingQuery,
    activeQuery,
    isSuperAdmin
      ? supabase.from('communities').select('*').order('name')
      : Promise.resolve({ data: [] }),
  ])

  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Administrator',
    user: 'Mieszkaniec',
  }

  const roleBadge: Record<string, string> = {
    super_admin: 'bg-purple-100 text-purple-700',
    admin: 'bg-blue-100 text-blue-700',
    user: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Użytkownicy</h2>

      <PendingUsers
        users={pendingUsers ?? []}
        communities={communities ?? []}
        isSuperAdmin={isSuperAdmin}
        adminCommunityId={profile.community_id}
      />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Imię i nazwisko</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Rola</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Wspólnota</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Dołączył</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(activeUsers ?? []).map((u: any) => (
              <tr key={u.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {u.full_name ?? <span className="text-gray-400 italic">Brak nazwy</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${roleBadge[u.role]}`}>
                    {roleLabel[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">{u.community?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-400">
                  {new Date(u.created_at).toLocaleDateString('pl-PL')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!activeUsers || activeUsers.length === 0) && (
          <p className="text-center text-sm text-gray-400 py-8">Brak aktywnych użytkowników.</p>
        )}
      </div>
    </div>
  )
}

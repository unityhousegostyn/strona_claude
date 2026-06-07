import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import UserEditForm from './UserEditForm'

export default async function UserEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await getSupabaseServerClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) redirect('/login')

  const { data: currentProfile } = await supabase.from('profiles').select('role').eq('id', currentUser.id).single()
  if (!currentProfile || currentProfile.role !== 'super_admin') redirect('/admin/users')

  const admin = getSupabaseAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (!profile) redirect('/admin/users')

  const { data: communities } = await admin
    .from('communities')
    .select('id, name')
    .order('name')

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className="text-sm text-gray-400 hover:text-gray-400">← Użytkownicy</Link>
      </div>

      <h2 className="text-2xl font-bold text-gray-100">Edytuj użytkownika</h2>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Informacje o koncie</h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-gray-500">Email</span>
          <span className="text-gray-100 font-medium">{profile.email}</span>
          <span className="text-gray-500">Status</span>
          <span className={`font-medium ${profile.status === 'active' ? 'text-green-600' : 'text-yellow-400'}`}>
            {profile.status === 'active' ? 'Aktywny' : 'Oczekujący'}
          </span>
          <span className="text-gray-500">Dołączył</span>
          <span className="text-gray-400">{new Date(profile.created_at).toLocaleDateString('pl-PL')}</span>
        </div>
      </div>

      <UserEditForm
        userId={id}
        currentUserId={currentUser.id}
        initialFullName={profile.full_name ?? ''}
        initialRole={profile.role}
        initialCommunityId={profile.community_id ?? null}
        communities={communities ?? []}
        isSelf={id === currentUser.id}
      />
    </div>
  )
}

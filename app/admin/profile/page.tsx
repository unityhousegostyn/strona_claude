import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileForm from './ProfileForm'

export default async function ProfilePage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getSupabaseAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('*, community:communities(name)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const roleLabel: Record<string, string> = {
    super_admin: 'Super Administrator',
    admin: 'Administrator',
    user: 'Mieszkaniec',
  }

  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-2xl font-bold text-gray-100">Mój profil</h2>

      {/* Informacje o koncie */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Informacje o koncie</h3>
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <span className="text-gray-500">Email</span>
          <span className="text-gray-100 font-medium">{user.email}</span>
          <span className="text-gray-500">Rola</span>
          <span className="text-gray-100 font-medium">{roleLabel[profile.role] ?? profile.role}</span>
          <span className="text-gray-500">Wspólnota</span>
          <span className="text-gray-100 font-medium">{(profile.community as any)?.name ?? '—'}</span>
          <span className="text-gray-500">Status</span>
          <span className={`font-medium ${profile.status === 'active' ? 'text-green-600' : 'text-yellow-400'}`}>
            {profile.status === 'active' ? 'Aktywny' : 'Oczekujący'}
          </span>
        </div>
      </div>

      <ProfileForm fullName={profile.full_name ?? ''} />
    </div>
  )
}

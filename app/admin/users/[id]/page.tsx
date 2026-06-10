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

  // Pobierz mieszkania (wszystkie aktywne) + aktualnie przypisane do tego użytkownika
  const { data: apartments } = await admin
    .from('settlement_apartments')
    .select('id, number, community_id, owner_id')
    .eq('active', true)
    .order('number')

  const currentApartment = (apartments ?? []).find(a => a.owner_id === id) ?? null

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className="text-sm text-[#7a6a58] hover:text-[#7a6a58]">← Użytkownicy</Link>
      </div>

      <h2 className="text-2xl font-bold text-[#f0ebe0]">Edytuj użytkownika</h2>

      <div className="bg-[#241e14] border border-[#3a2e1e] rounded-xl p-5 space-y-2">
        <h3 className="text-xs font-semibold text-[#7a6a58] uppercase tracking-wide mb-3">Informacje o koncie</h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-[#6a5a48]">Email</span>
          <span className="text-[#f0ebe0] font-medium">{profile.email}</span>
          <span className="text-[#6a5a48]">Status</span>
          <span className={`font-medium ${profile.status === 'active' ? 'text-amber-500' : 'text-yellow-400'}`}>
            {profile.status === 'active' ? 'Aktywny' : 'Oczekujący'}
          </span>
          <span className="text-[#6a5a48]">Dołączył</span>
          <span className="text-[#7a6a58]">{new Date(profile.created_at).toLocaleDateString('pl-PL')}</span>
        </div>
      </div>

      <UserEditForm
        userId={id}
        currentUserId={currentUser.id}
        initialFullName={profile.full_name ?? ''}
        initialRole={profile.role}
        initialCommunityId={profile.community_id ?? null}
        communities={communities ?? []}
        apartments={apartments ?? []}
        currentApartmentId={currentApartment?.id ?? null}
        isSelf={id === currentUser.id}
      />
    </div>
  )
}

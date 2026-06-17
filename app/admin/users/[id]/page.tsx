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

  // Pobierz mieszkania (wszystkie aktywne)
  const { data: apartments } = await admin
    .from('settlement_apartments')
    .select('id, number, community_id, owner_id')
    .eq('active', true)
    .order('number')

  // Aktualny lokal z profiles.apartment_id (obsługuje wielu mieszkańców na lokal)
  const currentApartmentId: string | null = (profile as any).apartment_id ?? null

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className="text-sm text-[#b45309] hover:text-[#b45309]">← Użytkownicy</Link>
      </div>

      <h2 className="text-2xl font-bold text-[#fef9ee]">Edytuj użytkownika</h2>

      <div className="bg-[#1e1409] border border-[#33200d] rounded-xl p-5 space-y-2">
        <h3 className="text-xs font-semibold text-[#b45309] uppercase tracking-wide mb-3">Informacje o koncie</h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-[#a16207]">Email</span>
          <span className="text-[#fef9ee] font-medium">{profile.email}</span>
          <span className="text-[#a16207]">Status</span>
          <span className={`font-medium ${profile.status === 'active' ? 'text-amber-500' : 'text-yellow-400'}`}>
            {profile.status === 'active' ? 'Aktywny' : 'Oczekujący'}
          </span>
          <span className="text-[#a16207]">Dołączył</span>
          <span className="text-[#b45309]">{new Date(profile.created_at).toLocaleDateString('pl-PL')}</span>
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
        currentApartmentId={currentApartmentId}
        isSelf={id === currentUser.id}
      />
    </div>
  )
}

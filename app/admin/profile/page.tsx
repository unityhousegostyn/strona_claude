import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileForm from './ProfileForm'
import MFASetup from './MFASetup'
import PushSubscribe from '@/components/PushSubscribe'
import LanguageSwitcher from '@/components/LanguageSwitcher'

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
      <h2 className="text-2xl font-bold text-[#f0ebe0]">Mój profil</h2>

      {/* Informacje o koncie */}
      <div className="bg-[#241e14] border border-[#3a2e1e] rounded-xl p-6 space-y-3">
        <h3 className="text-sm font-semibold text-[#6a5a48] uppercase tracking-wide">Informacje o koncie</h3>
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <span className="text-[#6a5a48]">Email</span>
          <span className="text-[#f0ebe0] font-medium">{user.email}</span>
          <span className="text-[#6a5a48]">Rola</span>
          <span className="text-[#f0ebe0] font-medium">{roleLabel[profile.role] ?? profile.role}</span>
          <span className="text-[#6a5a48]">Wspólnota</span>
          <span className="text-[#f0ebe0] font-medium">{(profile.community as any)?.name ?? '—'}</span>
          <span className="text-[#6a5a48]">Status</span>
          <span className={`font-medium ${profile.status === 'active' ? 'text-amber-500' : 'text-yellow-400'}`}>
            {profile.status === 'active' ? 'Aktywny' : 'Oczekujący'}
          </span>
        </div>
      </div>

      <ProfileForm fullName={profile.full_name ?? ''} hasPin={!!profile.voting_pin_hash} />

      <MFASetup />

      <PushSubscribe />

      {/* Język interfejsu */}
      <div className="bg-[#241e14] border border-[#3a2e1e] rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-[#6a5a48] uppercase tracking-wide">Język interfejsu</h3>
        <p className="text-xs text-[#6a5a48]">Wybierz język wyświetlania panelu. Ustawienie jest zapisywane w przeglądarce.</p>
        <LanguageSwitcher />
      </div>
    </div>
  )
}

import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { markAsRead } from './actions'

export default async function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const admin = getSupabaseAdminClient()
  const { data: announcement } = await admin
    .from('announcements')
    .select('*')
    .eq('id', id)
    .single()

  if (!announcement) redirect('/admin/announcements')

  // Oznacz jako przeczytane
  await admin
    .from('read_announcements')
    .upsert({ user_id: user.id, announcement_id: id }, { onConflict: 'user_id,announcement_id' })

  const canEdit = profile.role === 'super_admin' || profile.role === 'admin'

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/announcements" className="text-sm text-[#0f766e] hover:text-[#0f766e]">← Ogłoszenia</Link>
      </div>

      <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-[#f0fdfa]">{announcement.title}</h2>
          {canEdit && (
            <Link href={`/admin/announcements/edit/${id}`} className="text-sm text-teal-500 hover:underline flex-shrink-0">
              Edytuj
            </Link>
          )}
        </div>
        <p className="text-sm text-[#115e59]">{new Date(announcement.created_at).toLocaleDateString('pl-PL')}</p>
        <div className="text-sm text-[#99f6e4] whitespace-pre-wrap leading-relaxed">
          {announcement.content}
        </div>
      </div>
    </div>
  )
}

import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const ACTION_LABELS: Record<string, string> = {
  approve_user: '✅ Zaakceptowano użytkownika',
  reject_user: '❌ Odrzucono użytkownika',
  create_announcement: '📢 Dodano ogłoszenie',
  upload_document: '📄 Przesłano dokument',
  delete_document: '🗑️ Usunięto dokument',
  add_community: '🏢 Dodano wspólnotę',
  update_community: '✏️ Zaktualizowano wspólnotę',
  delete_community: '🗑️ Usunięto wspólnotę',
}

export default async function AuditPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'super_admin') redirect('/admin/dashboard')

  const admin = getSupabaseAdminClient()
  const { data: logs } = await admin
    .from('activity_logs')
    .select('*, actor:profiles!user_id(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-100">Audit Log</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
        {!logs || logs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Brak wpisów.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {logs.map((log: any) => (
              <li key={log.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-950 transition">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-100">{ACTION_LABELS[log.action] ?? log.action}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {log.actor?.full_name ?? log.actor?.email ?? 'system'}
                    {log.meta?.title ? ` — "${log.meta.title}"` : ''}
                    {log.meta?.name ? ` — "${log.meta.name}"` : ''}
                  </p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {new Date(log.created_at).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

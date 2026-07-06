import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import Link from 'next/link'

const PAGE_SIZE = 20

const ACTION_LABELS: Record<string, string> = {
  login: '🔐 Zalogowano się',
  approve_user: '✅ Zaakceptowano użytkownika',
  reject_user: '❌ Odrzucono użytkownika',
  create_announcement: '📢 Dodano ogłoszenie',
  upload_document: '📄 Przesłano dokument',
  delete_document: '🗑️ Usunięto dokument',
  add_community: '🏢 Dodano wspólnotę',
  update_community: '✏️ Zaktualizowano wspólnotę',
  delete_community: '🗑️ Usunięto wspólnotę',
  create_ticket: '🎫 Dodano zgłoszenie',
  toggle_ticket_status: '🔄 Zmieniono status zgłoszenia',
  edit_ticket: '✏️ Edytowano zgłoszenie',
  add_comment: '💬 Dodano komentarz',
  add_expense: '💸 Dodano koszt',
  update_expense: '✏️ Zaktualizowano koszt',
  delete_expense: '🗑️ Usunięto koszt',
  add_income: '💰 Dodano przychód',
  update_income: '✏️ Zaktualizowano przychód',
  delete_income: '🗑️ Usunięto przychód',
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { profile } = await getAuthProfile()
  if (profile.role !== 'super_admin') redirect('/admin/dashboard')

  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const admin = getSupabaseAdminClient()
  const { data: logs, count, error } = await admin
    .from('activity_logs')
    .select('*, actor:profiles!user_id(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return (
      <div className="text-red-400 text-sm bg-red-950/30 border border-red-900 rounded-xl p-4">
        Błąd ładowania logów: {error.message}
      </div>
    )
  }

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#f0fdfa]">Audit Log</h2>
        <span className="text-sm text-[#115e59]">{count ?? 0} wpisów</span>
      </div>

      <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl overflow-hidden">
        {!logs || logs.length === 0 ? (
          <p className="text-sm text-[#0f766e] text-center py-8">Brak wpisów.</p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {logs.map((log: any) => (
              <li key={log.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[#051210] transition">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#f0fdfa]">{ACTION_LABELS[log.action] ?? log.action}</p>
                  <p className="text-xs text-[#0f766e] mt-0.5">
                    {log.actor?.full_name ?? log.actor?.email ?? 'system'}
                    {log.meta?.title ? ` — "${log.meta.title}"` : ''}
                    {log.meta?.name ? ` — "${log.meta.name}"` : ''}
                    {log.meta?.to ? ` → ${log.meta.to === 'open' ? 'Otwarte' : 'Zamknięte'}` : ''}
                    {log.action === 'login' && log.meta?.ip ? ` · IP: ${log.meta.ip}` : ''}
                  </p>
                </div>
                <span className="text-xs text-[#115e59] flex-shrink-0">
                  {new Date(log.created_at).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Warsaw' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          {page > 1 && (
            <Link href={`/admin/audit?page=${page - 1}`} className="px-3 py-1.5 rounded-lg text-sm text-[#0f766e] hover:text-[#f0fdfa] hover:bg-[#0c2220] transition">←</Link>
          )}
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i
            return (
              <Link
                key={p}
                href={`/admin/audit?page=${p}`}
                className={`min-w-[36px] px-3 py-1.5 rounded-lg text-sm font-medium transition text-center ${
                  p === page ? 'bg-teal-600 text-white' : 'text-[#0f766e] hover:text-[#f0fdfa] hover:bg-[#0c2220]'
                }`}
              >
                {p}
              </Link>
            )
          })}
          {page < totalPages && (
            <Link href={`/admin/audit?page=${page + 1}`} className="px-3 py-1.5 rounded-lg text-sm text-[#0f766e] hover:text-[#f0fdfa] hover:bg-[#0c2220] transition">→</Link>
          )}
        </div>
      )}
    </div>
  )
}

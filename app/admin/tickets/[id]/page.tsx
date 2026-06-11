import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TicketComments from './TicketComments'
import TicketEditForm from './TicketEditForm'

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const admin = getSupabaseAdminClient()

  const { data: ticket, error: ticketError } = await admin.from('tickets').select('*').eq('id', id).single()
  if (!ticket || ticketError) redirect('/admin/tickets')

  if (
    profile.role !== 'super_admin' &&
    ticket.community_id !== profile.community_id &&
    ticket.created_by !== user.id
  ) {
    redirect('/admin/tickets')
  }

  let attachmentUrl: string | null = null
  let attachmentName: string | null = null
  if (ticket.attachment_path) {
    const { data: signedData } = await admin.storage
      .from('ticket-attachments')
      .createSignedUrl(ticket.attachment_path, 3600)
    attachmentUrl = signedData?.signedUrl ?? null
    attachmentName = ticket.attachment_path.split('/').pop() ?? 'załącznik'
  }

  const [{ data: author }, { data: community }, { data: rawComments }, { data: rawHistory }] = await Promise.all([
    admin.from('profiles').select('full_name, email').eq('id', ticket.created_by).single(),
    ticket.community_id
      ? admin.from('communities').select('name').eq('id', ticket.community_id).single()
      : Promise.resolve({ data: null }),
    admin.from('ticket_comments').select('*').eq('ticket_id', id).order('created_at', { ascending: true }),
    admin.from('activity_logs')
      .select('action, created_at, user_id, meta')
      .eq('target_type', 'ticket')
      .eq('target_id', id)
      .order('created_at', { ascending: true }),
  ])

  // Autorzy komentarzy
  const commentAuthorIds = [...new Set((rawComments ?? []).map((c: any) => c.author_id))]
  const historyUserIds = [...new Set((rawHistory ?? []).map((h: any) => h.user_id))]
  const allUserIds = [...new Set([...commentAuthorIds, ...historyUserIds])]

  const { data: allAuthors } = allUserIds.length > 0
    ? await admin.from('profiles').select('id, full_name, email').in('id', allUserIds)
    : { data: [] }

  const authorMap: Record<string, { full_name: string | null; email: string }> = {}
  for (const a of allAuthors ?? []) authorMap[a.id] = { full_name: a.full_name, email: a.email }

  const comments = (rawComments ?? []).map((c: any) => ({ ...c, author: authorMap[c.author_id] ?? null }))

  const history = (rawHistory ?? []).map((h: any) => ({
    action: h.action,
    created_at: h.created_at,
    user: authorMap[h.user_id] ?? null,
    meta: h.meta,
  }))

  const canEdit = profile.role === 'admin' || profile.role === 'super_admin'

  const actionLabel: Record<string, string> = {
    create_ticket: 'Zgłoszenie utworzone',
    toggle_ticket_status: 'Status zmieniony',
    edit_ticket: 'Zgłoszenie edytowane',
    add_comment: 'Dodano komentarz',
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/tickets" className="text-sm text-[#6b9478] hover:text-[#a7f3d0]">← Zgłoszenia</Link>
      </div>

      <div className="bg-[#121c15] border border-[#1e3324] rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[#ecfdf5]">{ticket.title}</h2>
            <p className="text-sm text-[#6b9478] mt-1">
              {author?.full_name ?? author?.email ?? '—'} · {community?.name ?? '—'} · {new Date(ticket.created_at).toLocaleDateString('pl-PL')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              ticket.status === 'open' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-emerald-900/40 text-emerald-400'
            }`}>
              {ticket.status === 'open' ? 'Otwarte' : 'Zamknięte'}
            </span>
          </div>
        </div>

        <p className="text-sm text-[#a7f3d0] whitespace-pre-wrap">{ticket.description}</p>

        {attachmentUrl && (
          <a
            href={attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:underline bg-emerald-950/40 px-3 py-1.5 rounded-lg"
          >
            📎 {attachmentName}
          </a>
        )}

        {canEdit && (
          <TicketEditForm
            ticketId={ticket.id}
            initialTitle={ticket.title}
            initialDescription={ticket.description ?? ''}
          />
        )}
      </div>

      {/* Historia */}
      {history.length > 0 && (
        <div className="bg-[#121c15] border border-[#1e3324] rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[#4d7a5f] uppercase tracking-wide">Historia</h3>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-[#2a4a2a] mt-2 flex-shrink-0" />
                <div>
                  <span className="text-[#a7f3d0]">{actionLabel[h.action] ?? h.action}</span>
                  {h.action === 'toggle_ticket_status' && h.meta?.to && (
                    <span className="text-[#4d7a5f]"> → <span className={h.meta.to === 'open' ? 'text-yellow-400' : 'text-emerald-400'}>
                      {h.meta.to === 'open' ? 'Otwarte' : 'Zamknięte'}
                    </span></span>
                  )}
                  <p className="text-xs text-[#4d7a5f] mt-0.5">
                    {h.user?.full_name ?? h.user?.email ?? '—'} · {new Date(h.created_at).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <TicketComments
        ticketId={ticket.id}
        comments={comments}
        currentUserId={user.id}
        canChangeStatus={canEdit}
        ticketStatus={ticket.status}
      />
    </div>
  )
}

import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TicketComments from './TicketComments'

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const admin = getSupabaseAdminClient()

  const { data: ticket } = await admin
    .from('tickets')
    .select('*, community:communities(name), author:profiles!created_by(full_name, email)')
    .eq('id', id)
    .single()

  if (!ticket) redirect('/admin/tickets')

  // Sprawdź dostęp: user/admin widzi tylko swoją wspólnotę
  if (profile.role !== 'super_admin' && ticket.community_id !== profile.community_id) {
    redirect('/admin/tickets')
  }

  const { data: comments } = await admin
    .from('ticket_comments')
    .select('*, author:profiles!author_id(full_name, email)')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/tickets" className="text-sm text-gray-400 hover:text-gray-600">← Zgłoszenia</Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{ticket.title}</h2>
            <p className="text-sm text-gray-400 mt-1">
              {(ticket.author as any)?.full_name ?? (ticket.author as any)?.email ?? '—'} ·{' '}
              {(ticket.community as any)?.name ?? '—'} ·{' '}
              {new Date(ticket.created_at).toLocaleDateString('pl-PL')}
            </p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${
            ticket.status === 'open' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
          }`}>
            {ticket.status === 'open' ? 'Otwarte' : 'Zamknięte'}
          </span>
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
      </div>

      <TicketComments
        ticketId={ticket.id}
        comments={comments ?? []}
        currentUserId={user.id}
        canChangeStatus={profile.role === 'admin' || profile.role === 'super_admin'}
        ticketStatus={ticket.status}
      />
    </div>
  )
}

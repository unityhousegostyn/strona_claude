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

  // Bez nested joinów — pobieramy ticket czysto
  const { data: ticket } = await admin
    .from('tickets')
    .select('*')
    .eq('id', id)
    .single()

  if (!ticket) redirect('/admin/tickets')

  // Sprawdź dostęp: user/admin widzi tylko swoją wspólnotę LUB własne zgłoszenie
  if (
    profile.role !== 'super_admin' &&
    ticket.community_id !== profile.community_id &&
    ticket.created_by !== user.id
  ) {
    redirect('/admin/tickets')
  }

  // Pobierz dane autora i wspólnoty osobno
  const [{ data: author }, { data: community }, { data: rawComments }] = await Promise.all([
    admin.from('profiles').select('full_name, email').eq('id', ticket.created_by).single(),
    ticket.community_id
      ? admin.from('communities').select('name').eq('id', ticket.community_id).single()
      : Promise.resolve({ data: null }),
    admin
      .from('ticket_comments')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true }),
  ])

  // Pobierz autorów komentarzy osobno
  const authorIds = [...new Set((rawComments ?? []).map((c: any) => c.author_id))]
  const { data: commentAuthors } = authorIds.length > 0
    ? await admin.from('profiles').select('id, full_name, email').in('id', authorIds)
    : { data: [] }

  const authorMap: Record<string, { full_name: string | null; email: string }> = {}
  for (const a of commentAuthors ?? []) {
    authorMap[a.id] = { full_name: a.full_name, email: a.email }
  }

  const comments = (rawComments ?? []).map((c: any) => ({
    ...c,
    author: authorMap[c.author_id] ?? null,
  }))

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
              {author?.full_name ?? author?.email ?? '—'} ·{' '}
              {community?.name ?? '—'} ·{' '}
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
        comments={comments}
        currentUserId={user.id}
        canChangeStatus={profile.role === 'admin' || profile.role === 'super_admin'}
        ticketStatus={ticket.status}
      />
    </div>
  )
}

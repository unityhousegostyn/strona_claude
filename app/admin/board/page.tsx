import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import BoardClient from './BoardClient'

export default async function BoardPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')
  const isSuperAdmin = profile.role === 'super_admin'

  if (!isSuperAdmin && !profile.community_id) {
    return (
      <div className="max-w-2xl">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Tablica</h2>
        <p className="text-sm text-gray-400">Nie jesteś przypisany do żadnej wspólnoty.</p>
      </div>
    )
  }

  const admin = getSupabaseAdminClient()

  // super_admin widzi wszystkie posty, pozostali tylko swoją wspólnotę
  const postsQuery = admin
    .from('board_posts')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (!isSuperAdmin) {
    postsQuery.eq('community_id', profile.community_id)
  }

  const { data: rawPosts } = await postsQuery

  const posts = rawPosts ?? []

  // Zbierz unikalne author_id z postów
  const postAuthorIds = [...new Set(posts.map((p: any) => p.author_id))]

  // Pobierz odpowiedzi dla wszystkich postów
  const postIds = posts.map((p: any) => p.id)
  const { data: rawReplies } = postIds.length > 0
    ? await admin
        .from('board_replies')
        .select('*')
        .in('post_id', postIds)
        .order('created_at', { ascending: true })
    : { data: [] }

  const replies = rawReplies ?? []

  // Zbierz unikalne author_id z odpowiedzi
  const replyAuthorIds = [...new Set(replies.map((r: any) => r.author_id))]
  const allAuthorIds = [...new Set([...postAuthorIds, ...replyAuthorIds])]

  // Pobierz profile autorów
  const { data: authors } = allAuthorIds.length > 0
    ? await admin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', allAuthorIds)
    : { data: [] }

  // Mapa autorów
  const authorMap: Record<string, { full_name: string | null; email: string }> = {}
  for (const a of authors ?? []) {
    authorMap[a.id] = { full_name: a.full_name, email: a.email }
  }

  // Pobierz nazwy wspólnot (dla super_admin)
  let communityMap: Record<string, string> = {}
  let communitiesList: { id: string; name: string }[] = []
  if (isSuperAdmin) {
    const { data: allCommunities } = await admin
      .from('communities')
      .select('id, name')
      .order('name')
    communitiesList = allCommunities ?? []
    for (const c of communitiesList) {
      communityMap[c.id] = c.name
    }
  }

  // Mapa odpowiedzi per post
  const repliesMap: Record<string, any[]> = {}
  for (const r of replies) {
    if (!repliesMap[r.post_id]) repliesMap[r.post_id] = []
    repliesMap[r.post_id].push({ ...r, author: authorMap[r.author_id] ?? null })
  }

  // Złóż posty
  const enrichedPosts = posts.map((p: any) => ({
    ...p,
    author: authorMap[p.author_id] ?? null,
    communityName: communityMap[p.community_id] ?? null,
    replies: repliesMap[p.id] ?? [],
  }))

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold text-gray-100">Tablica</h2>
      <BoardClient
        initialPosts={enrichedPosts}
        currentUserId={user.id}
        currentRole={profile.role}
        communities={communitiesList}
      />
    </div>
  )
}

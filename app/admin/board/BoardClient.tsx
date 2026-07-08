'use client'

import { useState, useTransition } from 'react'
import { createPost, deletePost, togglePin, createReply, deleteReply } from './actions'
import BackButton from '@/components/BackButton'

interface Reply {
  id: string
  content: string
  created_at: string
  author_id: string
  author: { full_name: string | null; email: string } | null
}

interface Post {
  id: string
  content: string
  pinned: boolean
  created_at: string
  author_id: string
  author: { full_name: string | null; email: string } | null
  communityName: string | null
  replies: Reply[]
}

interface Community {
  id: string
  name: string
}

interface Props {
  initialPosts: Post[]
  currentUserId: string
  currentRole: string
  communities?: Community[]
}

export default function BoardClient({ initialPosts, currentUserId, currentRole, communities = [] }: Props) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [newContent, setNewContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [replyError, setReplyError] = useState<Record<string, string>>({})
  const [filterCommunity, setFilterCommunity] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const isAdminOrAbove = currentRole === 'admin' || currentRole === 'super_admin'
  const isSuperAdmin = currentRole === 'super_admin'

  const handlePost = () => {
    setError(null)
    if (isSuperAdmin && filterCommunity === 'all') {
      setError('Wybierz wspólnotę przed publikacją')
      return
    }
    startTransition(async () => {
      const communityId = isSuperAdmin ? filterCommunity : undefined
      const result = await createPost(newContent, communityId)
      if (result.error) { setError(result.error); return }
      setNewContent('')
      // Odśwież przez router zamiast lokalnego state — Server Component przeładuje dane
      window.location.reload()
    })
  }

  const handleDelete = (postId: string) => {
    startTransition(async () => {
      await deletePost(postId)
      setPosts((prev) => prev.filter((p) => p.id !== postId))
    })
  }

  const handlePin = (postId: string, pinned: boolean) => {
    startTransition(async () => {
      await togglePin(postId, pinned)
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, pinned: !pinned } : p))
    })
  }

  const handleReply = (postId: string) => {
    setReplyError((prev) => ({ ...prev, [postId]: '' }))
    startTransition(async () => {
      const result = await createReply(postId, replyText[postId] ?? '')
      if (result.error) { setReplyError((prev) => ({ ...prev, [postId]: result.error! })); return }
      setReplyText((prev) => ({ ...prev, [postId]: '' }))
      window.location.reload()
    })
  }

  const handleDeleteReply = (replyId: string, postId: string) => {
    startTransition(async () => {
      await deleteReply(replyId)
      setPosts((prev) => prev.map((p) =>
        p.id === postId
          ? { ...p, replies: p.replies.filter((r) => r.id !== replyId) }
          : p
      ))
    })
  }

  const toggleReplies = (postId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev)
      next.has(postId) ? next.delete(postId) : next.add(postId)
      return next
    })
  }

  const authorName = (a: Post['author']) => a?.full_name ?? a?.email ?? 'Użytkownik'

  const communityPosts = isSuperAdmin && filterCommunity !== 'all'
    ? posts.filter((p) => (p as any).community_id === filterCommunity)
    : posts

  const filteredPosts = searchQuery.trim()
    ? communityPosts.filter(p =>
        p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.author?.full_name ?? p.author?.email ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : communityPosts

  const pinned = filteredPosts.filter((p) => p.pinned)
  const regular = filteredPosts.filter((p) => !p.pinned)

  return (
    <div className="space-y-6">
      <BackButton />
      {/* Filtr wspólnoty dla super_admin */}
      {isSuperAdmin && communities.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-[#0f766e] whitespace-nowrap">Wspólnota:</label>
          <select
            value={filterCommunity}
            onChange={(e) => setFilterCommunity(e.target.value)}
            className="input text-sm py-1.5 pr-8"
          >
            <option value="all">Wszystkie wspólnoty</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Wyszukiwarka */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#115e59]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="input w-full pl-9 text-sm"
          placeholder="Szukaj wiadomości lub autora…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Formularz nowego posta */}
      <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-4 space-y-3">
        <textarea
          className="input w-full min-h-[80px] resize-none"
          placeholder="Napisz wiadomość do sąsiadów..."
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          maxLength={1000}
        />
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#0f766e]">{newContent.length}/1000</span>
          <button
            onClick={handlePost}
            disabled={isPending || !newContent.trim()}
            className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition"
          >
            {isPending ? 'Wysyłanie...' : 'Opublikuj'}
          </button>
        </div>
      </div>

      {/* Przypięte */}
      {pinned.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#0f766e] uppercase tracking-wider">📌 Przypięte</p>
          {pinned.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              isAdminOrAbove={isAdminOrAbove}
              isPending={isPending}
              expanded={expandedReplies.has(post.id)}
              replyText={replyText[post.id] ?? ''}
              replyErr={replyError[post.id] ?? ''}
              onDelete={handleDelete}
              onPin={handlePin}
              onToggleReplies={toggleReplies}
              onReplyChange={(text) => setReplyText((p) => ({ ...p, [post.id]: text }))}
              onReplySubmit={handleReply}
              onDeleteReply={handleDeleteReply}
              authorName={authorName}
            />
          ))}
        </div>
      )}

      {/* Pozostałe */}
      <div className="space-y-3">
        {pinned.length > 0 && regular.length > 0 && (
          <p className="text-xs font-semibold text-[#0f766e] uppercase tracking-wider">Wiadomości</p>
        )}
        {regular.length === 0 && pinned.length === 0 && (
          <p className="text-sm text-[#0f766e]">Tablica jest pusta. Napisz pierwszą wiadomość!</p>
        )}
        {regular.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            isAdminOrAbove={isAdminOrAbove}
            isPending={isPending}
            expanded={expandedReplies.has(post.id)}
            replyText={replyText[post.id] ?? ''}
            replyErr={replyError[post.id] ?? ''}
            onDelete={handleDelete}
            onPin={handlePin}
            onToggleReplies={toggleReplies}
            onReplyChange={(text) => setReplyText((p) => ({ ...p, [post.id]: text }))}
            onReplySubmit={handleReply}
            onDeleteReply={handleDeleteReply}
            authorName={authorName}
          />
        ))}
      </div>
    </div>
  )
}

function PostCard({
  post, currentUserId, isAdminOrAbove, isPending, expanded,
  replyText, replyErr, onDelete, onPin, onToggleReplies,
  onReplyChange, onReplySubmit, onDeleteReply, authorName,
}: {
  post: Post
  currentUserId: string
  isAdminOrAbove: boolean
  isPending: boolean
  expanded: boolean
  replyText: string
  replyErr: string
  onDelete: (id: string) => void
  onPin: (id: string, pinned: boolean) => void
  onToggleReplies: (id: string) => void
  onReplyChange: (text: string) => void
  onReplySubmit: (id: string) => void
  onDeleteReply: (replyId: string, postId: string) => void
  authorName: (a: Post['author']) => string
}) {
  const canDelete = post.author_id === currentUserId || isAdminOrAbove
  const initials = authorName(post.author).charAt(0).toUpperCase()

  return (
    <div className={`bg-[#081918] border rounded-xl p-4 space-y-3 ${post.pinned ? 'border-teal-700 bg-teal-950/40/30' : 'border-[#0f2d2a]'}`}>
      {/* Nagłówek */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-teal-900/40 text-teal-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-[#f0fdfa]">{authorName(post.author)}</p>
            <p className="text-xs text-[#0f766e]">
              {new Date(post.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {post.communityName && (
                <span className="ml-1.5 bg-[#081918] text-[#115e59] px-1.5 py-0.5 rounded-md font-medium">
                  {post.communityName}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isAdminOrAbove && (
            <button
              onClick={() => onPin(post.id, post.pinned)}
              disabled={isPending}
              title={post.pinned ? 'Odepnij' : 'Przypnij'}
              className={`text-xs px-2 py-1 rounded-lg transition disabled:opacity-50 ${
                post.pinned
                  ? 'bg-teal-900/40 text-teal-400 hover:bg-green-200'
                  : 'text-[#0f766e] hover:bg-[#081918]'
              }`}
            >
              📌
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(post.id)}
              disabled={isPending}
              className="text-xs text-red-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-950/30 transition disabled:opacity-50"
            >
              Usuń
            </button>
          )}
        </div>
      </div>

      {/* Treść */}
      <p className="text-sm text-[#ccfbf1] whitespace-pre-wrap leading-relaxed">{post.content}</p>

      {/* Odpowiedzi toggle */}
      <div className="pt-1 border-t border-[#0f2d2a]">
        <button
          onClick={() => onToggleReplies(post.id)}
          className="text-xs text-teal-500 hover:underline"
        >
          {expanded
            ? 'Ukryj odpowiedzi'
            : `Odpowiedzi (${post.replies.length})`}
        </button>

        {expanded && (
          <div className="mt-3 space-y-3 pl-3 border-l-2 border-[#0f2d2a]">
            {post.replies.map((r) => (
              <div key={r.id} className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-[#081918] text-[#0f766e] text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {authorName(r.author).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-[#f0fdfa]">{authorName(r.author)}</span>
                    <span className="text-xs text-[#0f766e]">
                      {new Date(r.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-[#99f6e4] mt-0.5">{r.content}</p>
                </div>
                {(r.author_id === currentUserId || isAdminOrAbove) && (
                  <button
                    onClick={() => onDeleteReply(r.id, post.id)}
                    disabled={isPending}
                    className="text-xs text-red-400 hover:text-red-400 flex-shrink-0 disabled:opacity-50"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            {/* Formularz odpowiedzi */}
            <div className="flex gap-2 mt-2">
              <input
                className="input flex-1 text-sm py-1.5"
                placeholder="Napisz odpowiedź..."
                value={replyText}
                onChange={(e) => onReplyChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onReplySubmit(post.id) } }}
                maxLength={500}
              />
              <button
                onClick={() => onReplySubmit(post.id)}
                disabled={isPending || !replyText.trim()}
                className="bg-teal-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition"
              >
                Wyślij
              </button>
            </div>
            {replyErr && <p className="text-xs text-red-400">{replyErr}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

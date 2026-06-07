'use client'

import { useState, useTransition } from 'react'
import { createPost, deletePost, togglePin, createReply, deleteReply } from './actions'

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

interface Props {
  initialPosts: Post[]
  currentUserId: string
  currentRole: string
}

export default function BoardClient({ initialPosts, currentUserId, currentRole }: Props) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [newContent, setNewContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [replyError, setReplyError] = useState<Record<string, string>>({})

  const isAdminOrAbove = currentRole === 'admin' || currentRole === 'super_admin'

  const handlePost = () => {
    setError(null)
    startTransition(async () => {
      const result = await createPost(newContent)
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

  const pinned = posts.filter((p) => p.pinned)
  const regular = posts.filter((p) => !p.pinned)

  return (
    <div className="space-y-6">
      {/* Formularz nowego posta */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <textarea
          className="input w-full min-h-[80px] resize-none"
          placeholder="Napisz wiadomość do sąsiadów..."
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          maxLength={1000}
        />
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{newContent.length}/1000</span>
          <button
            onClick={handlePost}
            disabled={isPending || !newContent.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition"
          >
            {isPending ? 'Wysyłanie...' : 'Opublikuj'}
          </button>
        </div>
      </div>

      {/* Przypięte */}
      {pinned.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">📌 Przypięte</p>
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
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Wiadomości</p>
        )}
        {regular.length === 0 && pinned.length === 0 && (
          <p className="text-sm text-gray-400">Tablica jest pusta. Napisz pierwszą wiadomość!</p>
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
    <div className={`bg-white border rounded-xl p-4 space-y-3 ${post.pinned ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'}`}>
      {/* Nagłówek */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{authorName(post.author)}</p>
            <p className="text-xs text-gray-400">
              {new Date(post.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {post.communityName && (
                <span className="ml-1.5 bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md font-medium">
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
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'text-gray-400 hover:bg-gray-100'
              }`}
            >
              📌
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(post.id)}
              disabled={isPending}
              className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
            >
              Usuń
            </button>
          )}
        </div>
      </div>

      {/* Treść */}
      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{post.content}</p>

      {/* Odpowiedzi toggle */}
      <div className="pt-1 border-t border-gray-100">
        <button
          onClick={() => onToggleReplies(post.id)}
          className="text-xs text-blue-600 hover:underline"
        >
          {expanded
            ? 'Ukryj odpowiedzi'
            : `Odpowiedzi (${post.replies.length})`}
        </button>

        {expanded && (
          <div className="mt-3 space-y-3 pl-3 border-l-2 border-gray-100">
            {post.replies.map((r) => (
              <div key={r.id} className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {authorName(r.author).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-gray-900">{authorName(r.author)}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(r.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5">{r.content}</p>
                </div>
                {(r.author_id === currentUserId || isAdminOrAbove) && (
                  <button
                    onClick={() => onDeleteReply(r.id, post.id)}
                    disabled={isPending}
                    className="text-xs text-red-400 hover:text-red-600 flex-shrink-0 disabled:opacity-50"
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
                className="bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition"
              >
                Wyślij
              </button>
            </div>
            {replyErr && <p className="text-xs text-red-600">{replyErr}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

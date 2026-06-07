'use client'

import { useState, useMemo, ReactNode } from 'react'

interface Props<T> {
  items: T[]
  searchKey: (item: T) => string
  pageSize?: number
  renderItem: (item: T) => ReactNode
  placeholder?: string
  emptyText?: string
}

export default function SearchAndPaginate<T extends { id: string }>({
  items,
  searchKey,
  pageSize = 20,
  renderItem,
  placeholder = 'Szukaj...',
  emptyText = 'Brak wyników.',
}: Props<T>) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(
    () => items.filter((i) => searchKey(i).toLowerCase().includes(search.toLowerCase())),
    [items, search]
  )

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const handleSearch = (v: string) => {
    setSearch(v)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <input
        className="input max-w-sm"
        placeholder={placeholder}
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
      />

      {paged.length === 0 ? (
        <p className="text-sm text-gray-400">{search ? 'Brak wyników dla podanej frazy.' : emptyText}</p>
      ) : (
        <div className="space-y-3">{paged.map(renderItem)}</div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
          >
            ← Poprzednia
          </button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
          >
            Następna →
          </button>
        </div>
      )}
    </div>
  )
}

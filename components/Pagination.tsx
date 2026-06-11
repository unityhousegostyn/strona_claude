'use client'

interface Props {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
}

export default function Pagination({ page, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-center gap-1 pt-2">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="px-3 py-1.5 rounded-lg text-sm text-[#6b9478] hover:text-[#ecfdf5] hover:bg-[#162418] disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        ←
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-[#4d7a5f] text-sm select-none">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p as number)}
            className={`min-w-[36px] px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              p === page
                ? 'bg-emerald-600 text-white'
                : 'text-[#6b9478] hover:text-[#ecfdf5] hover:bg-[#162418]'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="px-3 py-1.5 rounded-lg text-sm text-[#6b9478] hover:text-[#ecfdf5] hover:bg-[#162418] disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        →
      </button>
    </div>
  )
}

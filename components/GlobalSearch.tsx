'use client'

import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { searchApartments, type ApartmentResult } from '@/app/admin/search-action'

export interface SearchNavItem {
  href: string
  label: string
  icon: string
  category: string
  keywords?: string
}

interface Props {
  navItems: SearchNavItem[]
  role: string
}

export default function GlobalSearch({ navItems, role }: Props) {
  const [open, setOpen]         = useState(false)
  const [query, setQuery]       = useState('')
  const [selected, setSelected] = useState(0)
  const [apartments, setApartments] = useState<ApartmentResult[]>([])
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()
  const canSearchApts = ['admin', 'super_admin'].includes(role)

  // Cmd+K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        openSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const openSearch = () => {
    setOpen(true)
    setQuery('')
    setApartments([])
    setSelected(0)
    setTimeout(() => inputRef.current?.focus(), 40)
  }

  const closeSearch = () => {
    setOpen(false)
    setQuery('')
    setApartments([])
  }

  // Filtruj moduły
  const filteredNav = query.trim()
    ? navItems.filter(i => {
        const q = query.toLowerCase()
        return (
          i.label.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          (i.keywords ?? '').toLowerCase().includes(q)
        )
      }).slice(0, 6)
    : navItems.slice(0, 7)

  // Szukaj lokali (debounced)
  useEffect(() => {
    if (!canSearchApts || query.trim().length < 2) {
      setApartments([])
      return
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const results = await searchApartments(query.trim())
        setApartments(results)
      })
    }, 280)
    return () => clearTimeout(timer)
  }, [query, canSearchApts])

  // Reset selection on query change
  useEffect(() => setSelected(0), [query])

  // Łączna lista wyników (moduły + lokale)
  type ResultItem =
    | { type: 'nav'; href: string; label: string; icon: string; category: string }
    | { type: 'apt'; id: string; number: string; owner_name: string; communityName: string }

  const results: ResultItem[] = [
    ...filteredNav.map(i => ({ type: 'nav' as const, ...i })),
    ...apartments.map(a => ({ type: 'apt' as const, ...a })),
  ]

  const navigate = (href: string) => {
    router.push(href)
    closeSearch()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Escape') closeSearch()
    if (e.key === 'Enter') {
      const r = results[selected]
      if (!r) return
      if (r.type === 'nav') navigate(r.href)
      if (r.type === 'apt') navigate(`/admin/settlements/${r.id}`)
    }
  }

  return (
    <div className="relative flex-1 max-w-sm">
      {/* Placeholder button */}
      <button
        onClick={openSearch}
        className="w-full flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-400 border border-gray-100 hover:border-gray-200 hover:bg-white transition cursor-text text-left"
        aria-label="Otwórz wyszukiwarkę"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span>Szukaj modułu, lokalu…</span>
        <span className="ml-auto text-[11px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-mono hidden xl:inline-block">⌘K</span>
      </button>

      {/* Overlay */}
      {open && (
        <>
          {/* Ciemne tło */}
          <div
            className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-[1px]"
            onClick={closeSearch}
          />

          {/* Panel wyszukiwarki */}
          <div className="fixed top-[72px] left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-lg z-[70] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">

            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Szukaj modułu, lokalu, funkcji…"
                className="flex-1 text-sm text-gray-900 outline-none placeholder:text-gray-400 bg-transparent"
              />
              {isPending && (
                <svg className="animate-spin text-teal-500 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              )}
              {query && (
                <button onClick={() => setQuery('')} className="text-gray-300 hover:text-gray-500 transition shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
              <kbd className="text-[11px] text-gray-300 border border-gray-200 rounded px-1.5 py-0.5 shrink-0">Esc</kbd>
            </div>

            {/* Wyniki */}
            <div className="max-h-[340px] overflow-y-auto">

              {/* Brak wyników */}
              {query.trim() && results.length === 0 && !isPending && (
                <p className="text-sm text-gray-400 text-center py-10">
                  Brak wyników dla „{query}"
                </p>
              )}

              {/* Nagłówek sekcji modułów */}
              {filteredNav.length > 0 && (
                <>
                  {query.trim() && apartments.length > 0 && (
                    <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Moduły</p>
                  )}
                  {!query.trim() && (
                    <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Szybka nawigacja</p>
                  )}
                  {filteredNav.map((item, i) => {
                    const isSelected = i === selected
                    return (
                      <button
                        key={item.href}
                        onClick={() => navigate(item.href)}
                        onMouseEnter={() => setSelected(i)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition ${
                          isSelected ? 'bg-teal-50 text-teal-700' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="w-6 text-center text-base leading-none">{item.icon}</span>
                        <span className="flex-1 text-left font-medium">{item.label}</span>
                        <span className={`text-xs ${isSelected ? 'text-teal-500' : 'text-gray-400'}`}>{item.category}</span>
                      </button>
                    )
                  })}
                </>
              )}

              {/* Sekcja lokali */}
              {apartments.length > 0 && (
                <>
                  <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-t border-gray-50 mt-1">Lokale</p>
                  {apartments.map((apt, i) => {
                    const idx = filteredNav.length + i
                    const isSelected = idx === selected
                    return (
                      <button
                        key={apt.id}
                        onClick={() => navigate(`/admin/settlements/${apt.id}`)}
                        onMouseEnter={() => setSelected(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition ${
                          isSelected ? 'bg-teal-50 text-teal-700' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="w-6 text-center text-base leading-none">🏠</span>
                        <span className="flex-1 text-left">
                          <span className="font-semibold">Lokal {apt.number}</span>
                          <span className={`ml-2 text-xs ${isSelected ? 'text-teal-600' : 'text-gray-400'}`}>{apt.owner_name}</span>
                        </span>
                        {apt.communityName && (
                          <span className={`text-xs ${isSelected ? 'text-teal-500' : 'text-gray-400'}`}>{apt.communityName}</span>
                        )}
                      </button>
                    )
                  })}
                </>
              )}
            </div>

            {/* Skróty klawiszowe */}
            <div className="border-t border-gray-100 px-4 py-2 flex gap-4 text-[11px] text-gray-400 bg-gray-50">
              <span>↑↓ nawigacja</span>
              <span>↵ otwórz</span>
              <span>Esc zamknij</span>
              <span className="ml-auto">⌘K aby otworzyć</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

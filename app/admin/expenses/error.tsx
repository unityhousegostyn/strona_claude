'use client'

import { useEffect } from 'react'

export default function ExpensesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Expenses page error]', error)
  }, [error])

  return (
    <div className="max-w-xl mx-auto mt-16 text-center space-y-4">
      <p className="text-4xl">⚠️</p>
      <h2 className="text-xl font-bold text-gray-100">Błąd ładowania modułu Koszty</h2>
      <p className="text-sm text-gray-400 font-mono bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-left break-all">
        {error.message || 'Nieznany błąd serwera'}
        {error.digest && <span className="block text-gray-600 mt-1">digest: {error.digest}</span>}
      </p>
      <button
        onClick={reset}
        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
      >
        Spróbuj ponownie
      </button>
    </div>
  )
}

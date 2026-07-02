'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export default function RefreshButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      className="text-xs bg-[#0c2220] hover:bg-[#0a1f1d] text-[#99f6e4] hover:text-white border border-[#0f2d2a] px-3 py-1.5 rounded-lg transition font-medium disabled:opacity-50"
    >
      {isPending ? '⏳ Przeliczam…' : '🔄 Przelicz'}
    </button>
  )
}

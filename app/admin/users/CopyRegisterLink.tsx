'use client'

import { useState } from 'react'

interface Props {
  communityId?: string | null
  communities?: { id: string; name: string }[]
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://strona-claude.vercel.app'

export default function CopyRegisterLink({ communityId, communities }: Props) {
  const [copied, setCopied] = useState(false)
  const [selectedId, setSelectedId] = useState(communityId ?? '')

  const isSuperAdmin = !communityId && !!communities?.length
  const activeId = communityId ?? selectedId

  async function handleCopy() {
    if (!activeId) return
    const link = `${APP_URL}/register?community_id=${activeId}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      prompt('Skopiuj link rejestracyjny:', link)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {isSuperAdmin && (
        <select
          value={selectedId}
          onChange={e => { setSelectedId(e.target.value); setCopied(false) }}
          className="text-sm border border-[#0f2d2a] bg-[#051210] text-[#99f6e4] rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-teal-700 max-w-[200px]"
        >
          <option value="">Wybierz wspólnotę…</option>
          {communities!.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}
      <button
        onClick={handleCopy}
        disabled={!activeId}
        title="Link rejestracyjny dla mieszkańców"
        className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border transition disabled:opacity-40 ${
          copied
            ? 'bg-teal-950/40 border-teal-700/60 text-teal-400'
            : 'border-[#0f2d2a] text-[#0f766e] hover:text-[#f0fdfa] hover:border-[#133835] hover:bg-[#051210]'
        }`}
      >
        {copied ? (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
            </svg>
            Skopiowano!
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
            </svg>
            Link rejestracyjny
          </>
        )}
      </button>
    </div>
  )
}

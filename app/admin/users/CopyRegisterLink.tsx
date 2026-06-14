'use client'

import { useState } from 'react'

interface Props {
  communityId: string
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://strona-claude.vercel.app'

export default function CopyRegisterLink({ communityId }: Props) {
  const [copied, setCopied] = useState(false)

  const link = `${APP_URL}/register?community_id=${communityId}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      prompt('Skopiuj link rejestracyjny:', link)
    }
  }

  return (
    <button
      onClick={handleCopy}
      title="Link rejestracyjny dla mieszkańców"
      className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border transition ${
        copied
          ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-400'
          : 'border-[#1e3324] text-[#6b9478] hover:text-[#ecfdf5] hover:border-[#2a4a2a] hover:bg-[#0d1410]'
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
  )
}

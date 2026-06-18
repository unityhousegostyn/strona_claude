'use client'

import { useRouter } from 'next/navigation'

interface Props {
  label?: string
  href?: string
}

export default function BackButton({ label = 'Wstecz', href }: Props) {
  const router = useRouter()

  const handleClick = () => {
    if (href) {
      router.push(href)
    } else {
      router.back()
    }
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 text-sm text-[#4d9e94] hover:text-[#f0fdfa] transition mb-2"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 5l-7 7 7 7" />
      </svg>
      {label}
    </button>
  )
}

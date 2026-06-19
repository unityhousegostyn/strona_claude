import { DOC_BRAND } from '@/lib/documentBranding'

interface MetaItem {
  label: string
  value: string
}

interface DocumentHeaderProps {
  title: string
  communityName: string
  communityAddress?: string | null
  meta?: MetaItem[]
  tag?: string
}

/**
 * Wspólny nagłówek-letterhead dla wszystkich dokumentów systemu:
 * wordmark + linia akcentu + tytuł dokumentu + dane wspólnoty + metadane.
 */
export default function DocumentHeader({ title, communityName, communityAddress, meta = [], tag }: DocumentHeaderProps) {
  return (
    <header className="mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-base leading-none">{DOC_BRAND.wordmarkIcon}</span>
          <span className="text-[11px] font-bold tracking-[0.18em] text-[#0f766e] uppercase">
            {DOC_BRAND.wordmark}
          </span>
        </div>
        <span className="text-[10px] font-semibold tracking-[0.12em] text-[#9ca3af] uppercase">
          {tag ?? DOC_BRAND.tagline}
        </span>
      </div>

      <div className="mt-2 h-[3px] w-full rounded-full bg-gradient-to-r from-[#0f766e] via-[#14b8a6] to-transparent" />

      <div className="mt-4 flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] leading-tight">{title}</h1>
          <p className="text-sm text-[#6b7280] mt-1">
            {communityName}{communityAddress ? ` · ${communityAddress}` : ''}
          </p>
        </div>
        {meta.length > 0 && (
          <dl className="text-right text-xs text-[#6b7280] space-y-0.5 whitespace-nowrap shrink-0">
            {meta.map(m => (
              <div key={m.label}>
                <dt className="inline text-[#9ca3af]">{m.label}: </dt>
                <dd className="inline font-semibold text-[#374151]">{m.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </header>
  )
}

import { DOC_BRAND, formatDocDate } from '@/lib/documentBranding'

interface DocumentFooterProps {
  generatedAt?: string
  note?: string
}

/** Wspólna stopka dokumentu — pojawia się identycznie na wszystkich wydrukach. */
export default function DocumentFooter({ generatedAt, note }: DocumentFooterProps) {
  return (
    <footer className="mt-8 pt-3 border-t border-[#e5e7eb] text-center">
      <p className="text-[10px] text-[#9ca3af]">
        {DOC_BRAND.wordmarkIcon} {DOC_BRAND.tagline} · {note ?? 'Dokument wygenerowany automatycznie'} · {generatedAt ?? formatDocDate()}
      </p>
    </footer>
  )
}

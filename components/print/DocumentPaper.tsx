interface DocumentPaperProps {
  children: React.ReactNode
  size?: 'a4-portrait' | 'a4-landscape'
  className?: string
}

const PAGE_RULE: Record<NonNullable<DocumentPaperProps['size']>, string> = {
  'a4-portrait': '@page { size: A4 portrait; margin: 18mm 16mm; }',
  'a4-landscape': '@page { size: A4 landscape; margin: 10mm; }',
}

/**
 * Wspólna „kartka" dla wszystkich dokumentów systemu — biały papier z cieniem
 * na ekranie, bez cienia w wydruku. Razem z DocumentHeader/DocumentFooter
 * tworzy jeden, premium wzór dla każdego generowanego dokumentu.
 */
export default function DocumentPaper({ children, size = 'a4-portrait', className = '' }: DocumentPaperProps) {
  return (
    <>
      <style>{`
        @media print {
          ${PAGE_RULE[size]}
          html, body { background: #fff !important; }
          nav, aside, header.app-header { display: none !important; }
          .print\\:hidden, .no-print { display: none !important; }
          .doc-paper { box-shadow: none !important; border-radius: 0 !important; }
        }
      `}</style>
      <div className="flex justify-center print:block">
        <div
          className={`doc-paper bg-white text-[#111827] rounded-2xl shadow-2xl shadow-black/40 w-full max-w-[210mm] p-8 sm:p-10 print:p-0 print:max-w-none print:shadow-none ${className}`}
          style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}
        >
          {children}
        </div>
      </div>
    </>
  )
}

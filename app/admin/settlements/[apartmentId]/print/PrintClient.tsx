'use client'

export default function PrintClient() {
  return (
    <div className="flex gap-3 items-center print:hidden mb-6">
      <button
        onClick={() => window.print()}
        className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition flex items-center gap-2"
      >
        🖨️ Drukuj / Pobierz PDF
      </button>
      <button
        onClick={() => window.history.back()}
        className="text-sm text-[#7a6a58] hover:text-[#ddd5c5] transition"
      >
        ← Wróć
      </button>
    </div>
  )
}

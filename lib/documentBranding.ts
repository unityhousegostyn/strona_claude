// Wspólne stałe wizualne dla wszystkich generowanych w systemie dokumentów
// (rozliczenia, zawiadomienia, raporty, wnioski, protokoły głosowań),
// żeby każdy dokument miał ten sam, premium wygląd niezależnie od miejsca w kodzie.

export const DOC_BRAND = {
  wordmarkIcon: '🏢',
  wordmark: 'WSPÓLNOTY',
  tagline: 'Panel Wspólnoty',
  fontFamily: "'Segoe UI', Arial, sans-serif",
  colors: {
    accentDark: '#0f766e', // teal-700 — główny akcent marki
    accent: '#14b8a6',     // teal-500 — jaśniejszy koniec linii akcentu
    accentSoft: '#ccfbf1', // teal-100
    heading: '#111827',    // gray-900 — tytuły
    body: '#374151',       // gray-700 — treść
    subtext: '#6b7280',    // gray-500 — podpisy, etykiety
    faint: '#9ca3af',      // gray-400 — drugoplanowe napisy
    border: '#e5e7eb',     // gray-200 — linie/obramowania
    pageBg: '#f1f5f4',     // tło wokół „papieru” na ekranie
  },
} as const

/** Data w formacie „19 czerwca 2026” — jednolicie używana w stopkach dokumentów. */
export function formatDocDate(d: Date = new Date()): string {
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' })
}

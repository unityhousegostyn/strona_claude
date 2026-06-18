'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { markOnboarded } from '@/app/admin/actions/markOnboarded'

interface Step {
  selector?: string
  title: string
  body: string
  side?: 'right' | 'bottom' | 'top' | 'left'
}

const STEPS_USER: Step[] = [
  {
    title: 'Witaj w panelu Unity House! 🏠',
    body: 'Przeprowadzimy Cię przez najważniejsze funkcje. Zajmie to niecałą minutę.',
  },
  {
    selector: '[data-tour="nav-announcements"]',
    title: 'Ogłoszenia zarządu',
    body: 'Tu znajdziesz wszystkie komunikaty od administracji — terminy zebrań, prace, ważne informacje.',
    side: 'right',
  },
  {
    selector: '[data-tour="nav-tickets"]',
    title: 'Zgłoszenia usterek',
    body: 'Awaria windy? Nieszczelne okno? Zgłoś to tutaj z opisem i zdjęciem. Możesz śledzić status naprawy.',
    side: 'right',
  },
  {
    selector: '[data-tour="nav-board"]',
    title: 'Tablica sąsiedzka',
    body: 'Ogłoszenia mieszkańców, pytania, dyskusje. Twoja przestrzeń sąsiedzka.',
    side: 'right',
  },
  {
    selector: '[data-tour="nav-documents"]',
    title: 'Dokumenty',
    body: 'Regulaminy, uchwały, protokoły zebrań — wszystkie dokumenty wspólnoty w jednym miejscu.',
    side: 'right',
  },
  {
    selector: '[data-tour="nav-settlements"]',
    title: 'Twoje rozliczenia',
    body: 'Sprawdź saldo swojego lokalu, historię opłat i bieżące należności.',
    side: 'right',
  },
  {
    selector: '[data-tour="nav-wnioski"]',
    title: 'Wnioski',
    body: 'Złóż wniosek do zarządu — remont, zmiana danych, inne sprawy. Otrzymasz odpowiedź w systemie.',
    side: 'right',
  },
  {
    title: 'Gotowe! Możesz zaczynać 🎉',
    body: 'Znasz już panel. W razie pytań skontaktuj się z zarządem przez zakładkę Kontakty.',
  },
]

const STEPS_ADMIN: Step[] = [
  {
    title: 'Witaj w panelu administracyjnym! 🏢',
    body: 'Krótki przegląd najważniejszych funkcji dla administratora wspólnoty.',
  },
  {
    selector: '[data-tour="nav-announcements"]',
    title: 'Ogłoszenia',
    body: 'Publikuj ogłoszenia dla mieszkańców swojej wspólnoty lub wszystkich.',
    side: 'right',
  },
  {
    selector: '[data-tour="nav-tickets"]',
    title: 'Zgłoszenia usterek',
    body: 'Zarządzaj zgłoszeniami mieszkańców — zmieniaj statusy, dodawaj komentarze.',
    side: 'right',
  },
  {
    selector: '[data-tour="nav-users"]',
    title: 'Użytkownicy',
    body: 'Akceptuj nowych mieszkańców, zarządzaj kontami, wysyłaj zaproszenia.',
    side: 'right',
  },
  {
    selector: '[data-tour="nav-settlements"]',
    title: 'Rozliczenia',
    body: 'Przeglądaj i edytuj rozliczenia lokali. Eksportuj raporty do PDF i Excel.',
    side: 'right',
  },
  {
    selector: '[data-tour="nav-votes"]',
    title: 'Głosowania',
    body: 'Twórz uchwały i głosowania elektroniczne. Generuj protokoły i raporty.',
    side: 'right',
  },
  {
    title: 'Panel gotowy do pracy! 🎉',
    body: 'Masz pełną kontrolę nad wspólnotą. W razie pytań — skontaktuj się z pomocą techniczną.',
  },
]

interface TargetRect {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

interface TooltipPos {
  top: number
  left: number
}

function getTooltipPos(rect: TargetRect, side: string, tooltipW = 300, tooltipH = 160): TooltipPos {
  const pad = 16
  const vw = window.innerWidth
  const vh = window.innerHeight

  let top = rect.top
  let left = rect.right + pad

  if (side === 'right') {
    top = Math.min(rect.top, vh - tooltipH - pad)
    left = rect.right + pad
    if (left + tooltipW > vw) left = rect.left - tooltipW - pad
  } else if (side === 'left') {
    top = Math.min(rect.top, vh - tooltipH - pad)
    left = rect.left - tooltipW - pad
    if (left < pad) left = rect.right + pad
  } else if (side === 'bottom') {
    top = rect.bottom + pad
    left = Math.min(rect.left, vw - tooltipW - pad)
    if (top + tooltipH > vh) top = rect.top - tooltipH - pad
  } else if (side === 'top') {
    top = rect.top - tooltipH - pad
    left = Math.min(rect.left, vw - tooltipW - pad)
    if (top < pad) top = rect.bottom + pad
  }

  top = Math.max(pad, Math.min(top, vh - tooltipH - pad))
  left = Math.max(pad, Math.min(left, vw - tooltipW - pad))

  return { top, left }
}

interface Props {
  role: string
}

export default function OnboardingTour({ role }: Props) {
  const steps = role === 'user' ? STEPS_USER : STEPS_ADMIN
  const [step, setStep] = useState(0)
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const [tooltipPos, setTooltipPos] = useState<TooltipPos>({ top: 0, left: 0 })
  const [visible, setVisible] = useState(true)
  const rafRef = useRef<number | null>(null)

  const current = steps[step]
  const isLast = step === steps.length - 1
  const isCentered = !current.selector

  const updateRect = useCallback(() => {
    if (!current.selector) {
      setTargetRect(null)
      return
    }
    const el = document.querySelector(current.selector)
    if (!el) {
      setTargetRect(null)
      return
    }
    const r = el.getBoundingClientRect()
    const rect = { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
    setTargetRect(rect)
    const pos = getTooltipPos(rect, current.side ?? 'right')
    setTooltipPos(pos)
  }, [current])

  useEffect(() => {
    updateRect()
    const onResize = () => updateRect()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [updateRect])

  const handleNext = async () => {
    if (isLast) {
      setVisible(false)
      await markOnboarded()
    } else {
      setStep(s => s + 1)
    }
  }

  const handleSkip = async () => {
    setVisible(false)
    await markOnboarded()
  }

  if (!visible) return null

  const PAD = 10

  return (
    <>
      {/* Overlay */}
      {!isCentered && targetRect ? (
        <>
          {/* top */}
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: Math.max(0, targetRect.top - PAD), background: 'rgba(5,18,16,0.82)', zIndex: 9998, pointerEvents: 'none' }} />
          {/* bottom */}
          <div style={{ position: 'fixed', top: targetRect.bottom + PAD, left: 0, right: 0, bottom: 0, background: 'rgba(5,18,16,0.82)', zIndex: 9998, pointerEvents: 'none' }} />
          {/* left */}
          <div style={{ position: 'fixed', top: targetRect.top - PAD, left: 0, width: Math.max(0, targetRect.left - PAD), height: targetRect.height + PAD * 2, background: 'rgba(5,18,16,0.82)', zIndex: 9998, pointerEvents: 'none' }} />
          {/* right */}
          <div style={{ position: 'fixed', top: targetRect.top - PAD, left: targetRect.right + PAD, right: 0, height: targetRect.height + PAD * 2, background: 'rgba(5,18,16,0.82)', zIndex: 9998, pointerEvents: 'none' }} />
          {/* spotlight border */}
          <div style={{ position: 'fixed', top: targetRect.top - PAD, left: targetRect.left - PAD, width: targetRect.width + PAD * 2, height: targetRect.height + PAD * 2, border: '2px solid #0d9488', borderRadius: 8, boxShadow: '0 0 0 4px rgba(13,148,136,0.2)', zIndex: 9999, pointerEvents: 'none' }} />
          {/* click blocker */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 9997, cursor: 'default' }} onClick={e => e.stopPropagation()} />
        </>
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,18,16,0.82)', zIndex: 9998, pointerEvents: 'all' }} />
      )}

      {/* Tooltip / Modal */}
      <div
        style={{
          position: 'fixed',
          zIndex: 10000,
          width: 300,
          ...(isCentered
            ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
            : { top: tooltipPos.top, left: tooltipPos.left }),
          background: '#081918',
          border: '1px solid #0d9488',
          borderRadius: 12,
          padding: '20px 20px 16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 3, background: i === step ? '#0d9488' : '#0f2d2a', transition: 'all 0.2s' }} />
          ))}
        </div>

        <p style={{ fontSize: 15, fontWeight: 600, color: '#ccfbf1', margin: '0 0 8px' }}>{current.title}</p>
        <p style={{ fontSize: 13, color: '#5eead4', lineHeight: 1.6, margin: '0 0 18px' }}>{current.body}</p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={handleSkip}
            style={{ background: 'none', border: 'none', color: '#4d9e94', fontSize: 12, cursor: 'pointer', padding: '4px 0' }}
          >
            {isLast ? '' : 'Pomiń tour'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{ background: 'none', border: '1px solid #0f2d2a', color: '#4d9e94', fontSize: 13, borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}
              >
                Wstecz
              </button>
            )}
            <button
              onClick={handleNext}
              style={{ background: '#0d9488', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, borderRadius: 6, padding: '6px 18px', cursor: 'pointer' }}
            >
              {isLast ? 'Zacznij!' : 'Dalej →'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

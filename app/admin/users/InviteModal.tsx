'use client'

import { useState, useRef } from 'react'
import { sendInvitation } from './actions'

interface Props {
  communities: { id: string; name: string }[]
  isSuperAdmin: boolean
  adminCommunityId: string | null
}

export default function InviteModal({ communities, isSuperAdmin, adminCommunityId }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    const fd = new FormData(e.currentTarget)
    const res = await sendInvitation({
      email: fd.get('email') as string,
      full_name: fd.get('full_name') as string,
      apartment_number: fd.get('apartment_number') as string,
      community_id: (fd.get('community_id') as string) || adminCommunityId || '',
    })

    setLoading(false)
    if (res.error) {
      setResult({ error: res.error })
    } else {
      setResult({ success: true })
      formRef.current?.reset()
    }
  }

  function close() {
    setOpen(false)
    setResult(null)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
        Zaproś mieszkańca
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />

          <div className="relative w-full max-w-md bg-[#1e1810] border border-[#3a2e1e] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a2e1e] bg-[#18140e]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-700/30 border border-amber-700/50 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#f0ebe0]">Zaproś mieszkańca</h2>
                  <p className="text-xs text-[#6a5a48]">Wyślij link rejestracyjny na email</p>
                </div>
              </div>
              <button onClick={close} className="text-[#6a5a48] hover:text-[#f0ebe0] transition p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Sukces */}
            {result?.success ? (
              <div className="px-6 py-10 text-center">
                <div className="w-16 h-16 bg-amber-950/40 border border-amber-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-[#f0ebe0] mb-2">Zaproszenie wysłane!</h3>
                <p className="text-sm text-[#7a6a58] leading-relaxed mb-6">
                  Link rejestracyjny ważny przez 7 dni został wysłany na podany adres email.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setResult(null)}
                    className="text-sm text-amber-400 hover:text-amber-300 transition font-medium"
                  >
                    Zaproś kolejną osobę
                  </button>
                  <button
                    onClick={close}
                    className="text-sm bg-[#2a2218] border border-[#3a2e1e] text-[#b8a898] px-4 py-2 rounded-lg hover:border-[#4a3c28] transition"
                  >
                    Zamknij
                  </button>
                </div>
              </div>
            ) : (
              <form ref={formRef} onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#b8a898] mb-1.5 uppercase tracking-wide">
                    Adres email <span className="text-red-400">*</span>
                  </label>
                  <input
                    name="email"
                    type="email"
                    placeholder="jan.kowalski@email.com"
                    required
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#b8a898] mb-1.5 uppercase tracking-wide">
                    Imię i nazwisko <span className="text-[#4a3c28]">(opcjonalnie)</span>
                  </label>
                  <input
                    name="full_name"
                    type="text"
                    placeholder="Jan Kowalski"
                    className="input w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#b8a898] mb-1.5 uppercase tracking-wide">
                      Numer lokalu <span className="text-[#4a3c28]">(opcjon.)</span>
                    </label>
                    <input
                      name="apartment_number"
                      type="text"
                      placeholder="np. 12A"
                      className="input w-full"
                    />
                  </div>

                  {isSuperAdmin && (
                    <div>
                      <label className="block text-xs font-semibold text-[#b8a898] mb-1.5 uppercase tracking-wide">
                        Wspólnota <span className="text-red-400">*</span>
                      </label>
                      <select name="community_id" required className="input w-full">
                        <option value="">Wybierz...</option>
                        {communities.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Info o flow */}
                <div className="bg-[#18140e] border border-[#2a2218] rounded-xl px-4 py-3 text-xs text-[#6a5a48] space-y-1">
                  <p className="font-semibold text-[#7a6a58] mb-1">Jak to działa:</p>
                  <p>1. Mieszkaniec otrzyma spersonalizowany email z linkiem</p>
                  <p>2. Klika → formularz rejestracji z wypełnionym emailem</p>
                  <p>3. Po rejestracji konto od razu aktywne (bez czekania)</p>
                  <p className="text-[#4a3c28]">Link wygasa po 7 dniach.</p>
                </div>

                {result?.error && (
                  <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
                    {result.error}
                  </p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={close}
                    className="flex-1 text-sm border border-[#3a2e1e] text-[#7a6a58] px-4 py-2.5 rounded-lg hover:border-[#4a3c28] transition"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 text-sm bg-amber-700 hover:bg-amber-600 text-white font-semibold px-4 py-2.5 rounded-lg transition disabled:opacity-50"
                  >
                    {loading ? (
                      <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Wysyłam...</>
                    ) : (
                      <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>Wyślij zaproszenie</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

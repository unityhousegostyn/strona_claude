'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  text: string
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'Cześć! 👋 Jestem asystentem Twojej wspólnoty. Zapytaj mnie o regulamin, procedury, kontakty lub zasady — odpowiem na podstawie dokumentów wgranych przez zarząd.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const send = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.answer ?? data.error ?? 'Przepraszam, wystąpił błąd.'
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Błąd połączenia. Spróbuj ponownie.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-[340px] sm:w-[380px] bg-[#121c15] border border-[#1e3324] rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden"
          style={{ height: '480px' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e3324] bg-[#121c15]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm">🤖</div>
              <div>
                <p className="text-sm font-semibold text-[#ecfdf5]">Asystent wspólnoty</p>
                <p className="text-xs text-emerald-400">● Online</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-[#4d7a5f] hover:text-[#a7f3d0] transition text-lg leading-none"
            >✕</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-sm'
                    : 'bg-[#162418] text-[#d1fae5] rounded-bl-sm'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#162418] text-[#6b9478] px-3 py-2 rounded-xl rounded-bl-sm text-sm">
                  <span className="animate-pulse">Szukam w dokumentach...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[#1e3324] p-3 flex gap-2">
            <input
              className="flex-1 bg-[#162418] border border-[#1e3324] text-[#ecfdf5] placeholder-stone-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Zadaj pytanie..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-sm font-semibold transition"
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 z-50 w-13 h-13 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-2xl shadow-green-900/50 transition-all hover:scale-105 flex items-center justify-center"
        style={{ width: 52, height: 52 }}
        title="Asystent AI wspólnoty"
      >
        {open ? <span className="text-lg">✕</span> : <span className="text-2xl">🤖</span>}
      </button>
    </>
  )
}

'use client'

import { useState, useEffect } from 'react'

export default function PushSubscribe() {
  const [status, setStatus] = useState<'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    navigator.serviceWorker.register('/sw.js')
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setStatus(sub ? 'subscribed' : 'unsubscribed'))
      .catch(() => setStatus('unsubscribed'))

    if (Notification.permission === 'denied') setStatus('denied')
  }, [])

  const handleSubscribe = async () => {
    setWorking(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setStatus('denied'); setWorking(false); return }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) throw new Error('Brak klucza VAPID — skonfiguruj NEXT_PUBLIC_VAPID_PUBLIC_KEY')

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const res = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })
      if (!res.ok) throw new Error('Błąd zapisu subskrypcji')
      setStatus('subscribed')
    } catch (err: any) {
      setError(err.message ?? 'Błąd')
    } finally {
      setWorking(false)
    }
  }

  const handleUnsubscribe = async () => {
    setWorking(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push-subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setStatus('unsubscribed')
    } catch (err: any) {
      setError(err.message ?? 'Błąd')
    } finally {
      setWorking(false)
    }
  }

  if (status === 'loading') return null
  if (status === 'unsupported') return null // Niewidoczne na niezgodnych przeglądarkach

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Powiadomienia push</h3>
          <p className="text-xs text-gray-600 mt-1">Nowe ogłoszenia i zgłoszenia w czasie rzeczywistym</p>
        </div>
        {status === 'subscribed'
          ? <span className="text-xs bg-green-900/30 text-green-400 border border-green-800 px-2 py-0.5 rounded-full">✓ Włączone</span>
          : status === 'denied'
          ? <span className="text-xs bg-red-900/30 text-red-400 border border-red-800 px-2 py-0.5 rounded-full">Zablokowane</span>
          : <span className="text-xs bg-orange-900/30 text-orange-400 border border-orange-800 px-2 py-0.5 rounded-full">Wyłączone</span>
        }
      </div>

      {error && <p className="text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">{error}</p>}

      {status === 'denied' && (
        <p className="text-sm text-gray-400">
          Powiadomienia zostały zablokowane w przeglądarce. Aby je włączyć, przejdź do ustawień strony w przeglądarce i pozwól na powiadomienia.
        </p>
      )}

      {status === 'unsubscribed' && (
        <div className="space-y-2">
          <p className="text-sm text-gray-400">Włącz powiadomienia, aby otrzymywać alerty o nowych ogłoszeniach i odpowiedziach na zgłoszenia.</p>
          <button
            onClick={handleSubscribe}
            disabled={working}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {working ? 'Włączanie...' : '🔔 Włącz powiadomienia'}
          </button>
        </div>
      )}

      {status === 'subscribed' && (
        <div className="space-y-2">
          <p className="text-sm text-gray-400">Otrzymujesz powiadomienia push na tym urządzeniu.</p>
          <button
            onClick={handleUnsubscribe}
            disabled={working}
            className="text-sm text-gray-400 hover:text-gray-300 border border-gray-700 px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            {working ? 'Wyłączanie...' : 'Wyłącz powiadomienia'}
          </button>
        </div>
      )}
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output.buffer as ArrayBuffer
}

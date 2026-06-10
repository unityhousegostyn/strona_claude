'use client'

import { useState, useEffect } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import Image from 'next/image'

export default function MFASetup() {
  const supabase = getSupabaseBrowserClient()
  const [status, setStatus] = useState<'loading' | 'enrolled' | 'not_enrolled'>('loading')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [newFactorId, setNewFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [unenrolling, setUnenrolling] = useState(false)

  useEffect(() => {
    checkMFAStatus()
  }, [])

  const checkMFAStatus = async () => {
    const { data } = await supabase.auth.mfa.listFactors()
    const totpFactors = data?.totp ?? []
    const verified = totpFactors.find(f => f.status === 'verified')
    if (verified) {
      setStatus('enrolled')
      setFactorId(verified.id)
    } else {
      setStatus('not_enrolled')
    }
  }

  const handleStartEnroll = async () => {
    setEnrolling(true)
    setError(null)
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Aplikacja Authenticator',
    })
    if (error || !data) {
      setError('Błąd podczas konfiguracji 2FA: ' + (error?.message ?? ''))
      setEnrolling(false)
      return
    }
    setQrCode(data.totp.qr_code)
    setSecret(data.totp.secret)
    setNewFactorId(data.id)

    // Create challenge
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: data.id })
    if (challengeError || !challengeData) {
      setError('Błąd tworzenia wyzwania: ' + (challengeError?.message ?? ''))
      setEnrolling(false)
      return
    }
    setChallengeId(challengeData.id)
    setEnrolling(false)
  }

  const handleVerifyEnroll = async () => {
    if (!newFactorId || !challengeId || code.length !== 6) return
    setError(null)
    const { error } = await supabase.auth.mfa.verify({
      factorId: newFactorId,
      challengeId,
      code,
    })
    if (error) {
      setError('Nieprawidłowy kod. Sprawdź aplikację authenticator i spróbuj ponownie.')
      return
    }
    setSuccess('2FA zostało włączone ✓')
    setQrCode(null)
    setSecret(null)
    setCode('')
    await checkMFAStatus()
  }

  const handleUnenroll = async () => {
    if (!factorId) return
    if (!confirm('Czy na pewno chcesz wyłączyć weryfikację dwuetapową? Twoje konto będzie mniej bezpieczne.')) return
    setUnenrolling(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    if (error) {
      setError('Błąd podczas wyłączania 2FA: ' + error.message)
    } else {
      setSuccess('2FA zostało wyłączone')
      setFactorId(null)
      await checkMFAStatus()
    }
    setUnenrolling(false)
  }

  if (status === 'loading') return null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Weryfikacja dwuetapowa (2FA)</h3>
          <p className="text-xs text-gray-600 mt-1">Aplikacja Google Authenticator, Authy lub podobna</p>
        </div>
        {status === 'enrolled'
          ? <span className="text-xs bg-green-900/30 text-green-400 border border-green-800 px-2 py-0.5 rounded-full">✓ Włączone</span>
          : <span className="text-xs bg-orange-900/30 text-orange-400 border border-orange-800 px-2 py-0.5 rounded-full">Wyłączone</span>
        }
      </div>

      {error && <p className="text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">{error}</p>}
      {success && <p className="text-sm text-green-400 bg-green-950/30 border border-green-900 rounded-lg px-3 py-2">{success}</p>}

      {status === 'not_enrolled' && !qrCode && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Włącz 2FA, aby wymagać kodu z aplikacji mobilnej przy każdym logowaniu. Zalecane dla kont administratorów.
          </p>
          <button
            onClick={handleStartEnroll}
            disabled={enrolling}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {enrolling ? 'Konfigurowanie...' : 'Włącz 2FA'}
          </button>
        </div>
      )}

      {qrCode && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Zeskanuj poniższy kod QR w aplikacji <strong className="text-gray-200">Google Authenticator</strong>, <strong className="text-gray-200">Authy</strong> lub innej aplikacji TOTP.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="bg-white p-3 rounded-xl">
              <img src={qrCode} alt="QR kod 2FA" width={160} height={160} />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Nie możesz zeskanować? Wpisz ręcznie ten kod:</p>
              <code className="block text-xs bg-gray-800 text-green-400 px-3 py-2 rounded-lg font-mono break-all">{secret}</code>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-300">Po dodaniu konta w aplikacji wpisz 6-cyfrowy kod:</p>
            <div className="flex gap-3 items-center">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                className="input w-36 tracking-widest text-center text-lg"
                placeholder="000000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && handleVerifyEnroll()}
              />
              <button
                onClick={handleVerifyEnroll}
                disabled={code.length !== 6}
                className="bg-green-700 hover:bg-green-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50"
              >
                Potwierdź
              </button>
              <button onClick={() => { setQrCode(null); setSecret(null); setCode('') }} className="text-sm text-gray-500 hover:text-gray-300">
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {status === 'enrolled' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Przy każdym logowaniu będziesz musiał podać 6-cyfrowy kod z aplikacji authenticator.
          </p>
          <button
            onClick={handleUnenroll}
            disabled={unenrolling}
            className="text-sm text-red-400 hover:text-red-300 border border-red-900/50 px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            {unenrolling ? 'Wyłączanie...' : 'Wyłącz 2FA'}
          </button>
        </div>
      )}
    </div>
  )
}

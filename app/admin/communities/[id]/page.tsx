'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import { updateCommunity, deleteCommunity, lookupNIP } from '../actions'

export default function EditCommunityPage() {
  const router = useRouter()
  const { id } = useParams()
  const supabase = getSupabaseBrowserClient()

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [nip, setNip] = useState('')
  const [waterMeterEnabled, setWaterMeterEnabled] = useState(false)
  const [bankAccount, setBankAccount] = useState('')
  const [legalBasis, setLegalBasis] = useState('')
  const [openingBalanceEksploatacyjny, setOpeningBalanceEksploatacyjny] = useState('0')
  const [openingBalanceRemont, setOpeningBalanceRemont] = useState('0')
  const [openingBalanceDate, setOpeningBalanceDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [gusLoading, setGusLoading] = useState(false)
  const [gusMsg, setGusMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('communities')
        .select('*')
        .eq('id', id)
        .single()
      if (data) {
        setName(data.name)
        setAddress(data.address)
        setNip(data.nip ?? '')
        setWaterMeterEnabled(data.water_meter_enabled ?? false)
        setBankAccount(data.bank_account ?? '')
        setLegalBasis(data.legal_basis ?? '')
        setOpeningBalanceEksploatacyjny(String(data.opening_balance_eksploatacyjny ?? 0))
        setOpeningBalanceRemont(String(data.opening_balance_remont ?? 0))
        setOpeningBalanceDate(data.opening_balance_date ?? '')
      }
    }
    load()
  }, [id])

  const handleUpdate = async () => {
    if (!name || !address) {
      setError('Wypełnij wszystkie pola.')
      return
    }
    setLoading(true)
    setError(null)
    setGusMsg(null)

    try {
      await updateCommunity(id as string, {
        name, address, nip,
        water_meter_enabled: waterMeterEnabled,
        bank_account: bankAccount,
        legal_basis: legalBasis,
        opening_balance_eksploatacyjny: parseFloat(openingBalanceEksploatacyjny.replace(',', '.')) || 0,
        opening_balance_remont: parseFloat(openingBalanceRemont.replace(',', '.')) || 0,
        opening_balance_date: openingBalanceDate,
      })
      router.push('/admin/communities')
    } catch (e: any) {
      setError(e.message ?? 'Błąd podczas zapisywania.')
      setLoading(false)
    }
  }

  const handleGUS = async () => {
    setGusLoading(true)
    setGusMsg(null)
    const result = await lookupNIP(nip)
    setGusLoading(false)
    if (result.error) {
      setGusMsg({ text: result.error, ok: false })
    } else {
      if (result.name) setName(result.name)
      if (result.address) setAddress(result.address)
      setGusMsg({ text: `Pobrano: ${result.name ?? ''}`, ok: true })
    }
  }

  const handleDelete = async () => {
    if (!confirm('Czy na pewno chcesz usunąć tę wspólnotę? Tej operacji nie można cofnąć.')) return
    setDeleting(true)

    try {
      await deleteCommunity(id as string)
      router.push('/admin/communities')
    } catch (e: any) {
      setError(e.message ?? 'Błąd podczas usuwania.')
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-2xl font-bold text-[#f0fdfa]">Edytuj wspólnotę</h2>

      {error && (
        <div className="bg-red-950/30 border border-red-900 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-6 space-y-4">

        {/* NIP + GUS */}
        <div>
          <label className="block text-sm font-medium text-[#99f6e4] mb-1">NIP wspólnoty</label>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="np. 7812345678"
              value={nip}
              onChange={(e) => { setNip(e.target.value); setGusMsg(null) }}
              maxLength={13}
            />
            <button
              type="button"
              onClick={handleGUS}
              disabled={gusLoading || nip.replace(/[\s-]/g, '').length !== 10}
              className="px-4 py-2 text-xs font-semibold bg-teal-700 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center gap-1.5 whitespace-nowrap"
            >
              {gusLoading
                ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Pobieranie…</>
                : '🏛️ Pobierz z GUS'}
            </button>
          </div>
          {gusMsg && (
            <p className={`text-xs mt-1.5 ${gusMsg.ok ? 'text-teal-400' : 'text-red-400'}`}>
              {gusMsg.ok ? '✓' : '✕'} {gusMsg.text}
            </p>
          )}
          <p className="text-xs text-[#115e59] mt-1">Uzupełnij NIP i kliknij "Pobierz z GUS" — system automatycznie wypełni nazwę i adres z Białej Listy MF</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#99f6e4] mb-1">Nazwa wspólnoty</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#99f6e4] mb-1">Adres</label>
          <input
            className="input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-[#99f6e4]">Moduł liczników wody</p>
            <p className="text-xs text-[#115e59] mt-0.5">Mieszkańcy tej wspólnoty mogą zgłaszać odczyty wodomierzy</p>
          </div>
          <button
            type="button"
            onClick={() => setWaterMeterEnabled(v => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${waterMeterEnabled ? 'bg-blue-600' : 'bg-[#0f2d2a]'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${waterMeterEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#99f6e4] mb-1">Numer konta bankowego</label>
          <input
            className="input"
            placeholder="np. 97 1020 3121 0000 6702 0003 8968"
            value={bankAccount}
            onChange={(e) => setBankAccount(e.target.value)}
          />
          <p className="text-xs text-[#115e59] mt-1">Wyświetlany na zawiadomieniach o wysokości opłat dla tej wspólnoty</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#99f6e4] mb-1">Podstawa prawna</label>
          <input
            className="input"
            placeholder="np. ustawa z dnia 24.06.1994 oraz uchwała nr 2/2017"
            value={legalBasis}
            onChange={(e) => setLegalBasis(e.target.value)}
          />
          <p className="text-xs text-[#115e59] mt-1">Treść powołania prawnego na zawiadomieniach (ustawa, nr uchwały itp.)</p>
        </div>
        <div className="pt-2 border-t border-[#0f2d2a]">
          <p className="text-sm font-medium text-[#99f6e4] mb-1">Saldo początkowe</p>
          <p className="text-xs text-[#115e59] mb-3">Stan funduszy wspólnoty w dniu, od którego zaczęliście wprowadzać dane do panelu — np. jeśli na koncie już było 20 000 zł, zanim zaczęliście korzystać z systemu. Rozbite na fundusz eksploatacyjny i remontowy, bo to dwa odrębne fundusze (nigdy nie mieszane). Bez tego &bdquo;Stan konta&rdquo; na dashboardzie i saldo skumulowane funduszu remontowego liczą się tylko z wpłat i kosztów wpisanych w panelu.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#115e59] mb-1">Fundusz eksploatacyjny (zł)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={openingBalanceEksploatacyjny}
                onChange={(e) => setOpeningBalanceEksploatacyjny(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-[#115e59] mb-1">Fundusz remontowy (zł)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={openingBalanceRemont}
                onChange={(e) => setOpeningBalanceRemont(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-[#115e59] mb-1">Stan na dzień</label>
              <input
                className="input"
                type="date"
                value={openingBalanceDate}
                onChange={(e) => setOpeningBalanceDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={handleUpdate}
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Zapisywanie...' : 'Zapisz zmiany'}
          </button>
          <button
            onClick={() => router.back()}
            className="text-sm text-[#0f766e] hover:text-[#f0fdfa] px-5 py-2.5 rounded-lg border border-[#0f2d2a] hover:bg-[#051210] transition"
          >
            Anuluj
          </button>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-sm text-red-400 hover:text-red-400 font-medium px-5 py-2.5 rounded-lg border border-red-900 hover:bg-red-950/30 transition disabled:opacity-50"
        >
          {deleting ? 'Usuwanie...' : 'Usuń wspólnotę'}
        </button>
      </div>
    </div>
  )
}

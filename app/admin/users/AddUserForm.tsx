'use client'

import { useState, useTransition } from 'react'
import { addUser } from './actions'
import { Community } from '@/types'

interface Props {
  communities: Community[]
  isSuperAdmin: boolean
  adminCommunityId: string | null
}

export default function AddUserForm({ communities, isSuperAdmin, adminCommunityId }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'user' as 'user' | 'admin',
    community_id: adminCommunityId ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.community_id) { setError('Wybierz wspólnotę'); return }
    startTransition(async () => {
      const result = await addUser(form)
      if (result.error) { setError(result.error); return }
      setSuccess(true)
      setTimeout(() => {
        setOpen(false)
        setSuccess(false)
        setForm({ email: '', full_name: '', password: '', role: 'user', community_id: adminCommunityId ?? '' })
      }, 1200)
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2"
      >
        + Dodaj użytkownika
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-base font-semibold text-gray-100">Dodaj użytkownika</h3>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 text-xl leading-none">×</button>
            </div>

            {success ? (
              <div className="px-6 py-10 text-center">
                <p className="text-green-400 text-lg font-semibold">✓ Użytkownik dodany</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Imię i nazwisko</label>
                  <input
                    type="text"
                    required
                    className="input w-full"
                    placeholder="Jan Kowalski"
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Adres e-mail</label>
                  <input
                    type="email"
                    required
                    className="input w-full"
                    placeholder="jan@example.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Hasło tymczasowe</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    className="input w-full"
                    placeholder="Min. 8 znaków"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Rola</label>
                    <select
                      className="input w-full"
                      value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'user' | 'admin' }))}
                    >
                      <option value="user">Mieszkaniec</option>
                      {isSuperAdmin && <option value="admin">Administrator</option>}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Wspólnota</label>
                    {isSuperAdmin ? (
                      <select
                        className="input w-full"
                        value={form.community_id}
                        onChange={(e) => setForm((f) => ({ ...f, community_id: e.target.value }))}
                      >
                        <option value="">Wybierz…</option>
                        {communities.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="input w-full text-gray-400 text-sm py-2">
                        {communities.find((c) => c.id === adminCommunityId)?.name ?? '—'}
                      </p>
                    )}
                  </div>
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-sm text-gray-400 hover:text-gray-200 transition px-3 py-2"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition disabled:opacity-50"
                  >
                    {isPending ? 'Tworzenie...' : 'Utwórz konto'}
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

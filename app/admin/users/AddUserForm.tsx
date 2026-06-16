'use client'

import { useState, useTransition } from 'react'
import { addUser } from './actions'
import { Community } from '@/types'

interface Apartment { id: string; number: string; community_id: string }

interface Props {
  communities: Community[]
  isSuperAdmin: boolean
  adminCommunityId: string | null
  apartments: Apartment[]
}

export default function AddUserForm({ communities, isSuperAdmin, adminCommunityId, apartments }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'user' as 'user' | 'admin' | 'super_admin',
    community_id: adminCommunityId ?? '',
    apartment_id: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.community_id && form.role !== 'super_admin') { setError('Wybierz wspólnotę'); return }
    startTransition(async () => {
      const result = await addUser({ ...form, apartment_id: form.apartment_id || null })
      if (result.error) { setError(result.error); return }
      setSuccess(true)
      setTimeout(() => {
        setOpen(false)
        setSuccess(false)
        setForm({ email: '', full_name: '', password: '', role: 'user', community_id: adminCommunityId ?? '', apartment_id: '' })
      }, 1200)
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2"
      >
        + Dodaj użytkownika
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-[#0d1410] border border-[#1e3324] rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl max-h-[92dvh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e3324]">
              <h3 className="text-base font-semibold text-[#ecfdf5]">Dodaj użytkownika</h3>
              <button onClick={() => setOpen(false)} className="text-[#4d7a5f] hover:text-[#a7f3d0] text-xl leading-none">×</button>
            </div>

            {success ? (
              <div className="px-6 py-10 text-center">
                <p className="text-emerald-400 text-lg font-semibold">✓ Użytkownik dodany</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs text-[#6b9478] mb-1">Imię i nazwisko</label>
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
                  <label className="block text-xs text-[#6b9478] mb-1">Adres e-mail</label>
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
                  <label className="block text-xs text-[#6b9478] mb-1">Hasło tymczasowe</label>
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
                    <label className="block text-xs text-[#6b9478] mb-1">Rola</label>
                    <select
                      className="input w-full"
                      value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'user' | 'admin' | 'super_admin' }))}
                    >
                      <option value="user">Mieszkaniec</option>
                      {isSuperAdmin && <option value="admin">Administrator</option>}
                      {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#6b9478] mb-1">Wspólnota</label>
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
                      <p className="input w-full text-[#6b9478] text-sm py-2">
                        {communities.find((c) => c.id === adminCommunityId)?.name ?? '—'}
                      </p>
                    )}
                  </div>
                </div>

                {form.role === 'user' && (
                  <div>
                    <label className="block text-xs text-[#6b9478] mb-1">Lokal (opcjonalnie)</label>
                    <select
                      className="input w-full"
                      value={form.apartment_id}
                      onChange={(e) => setForm((f) => ({ ...f, apartment_id: e.target.value }))}
                    >
                      <option value="">— brak przypisania —</option>
                      {apartments
                        .filter(a => !form.community_id || a.community_id === form.community_id)
                        .map((a) => (
                          <option key={a.id} value={a.id}>{a.number}</option>
                        ))}
                    </select>
                  </div>
                )}

                {error && <p className="text-sm text-red-400">{error}</p>}

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-sm text-[#6b9478] hover:text-[#d1fae5] transition px-3 py-2"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition disabled:opacity-50"
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

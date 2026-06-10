'use client'

import { useState } from 'react'
import Link from 'next/link'

interface User {
  id: string
  full_name: string | null
  role: string
  created_at: string
  community: { name: string } | null
}

interface Props {
  users: User[]
  isSuperAdmin: boolean
}

const roleLabel: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrator',
  user: 'Mieszkaniec',
}

const roleBadge: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-400',
  admin: 'bg-green-900/40 text-green-400',
  user: 'bg-stone-100 text-stone-500',
}

export default function UsersClient({ users, isSuperAdmin }: Props) {
  const [search, setSearch] = useState('')

  const filtered = users.filter(u => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return (
      (u.full_name ?? '').toLowerCase().includes(q) ||
      (u.community?.name ?? '').toLowerCase().includes(q) ||
      (roleLabel[u.role] ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-3">
      {/* Wyszukiwarka */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">🔍</span>
        <input
          className="input w-full pl-8 text-sm"
          placeholder="Szukaj po nazwie, wspólnocie lub roli..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs">✕</button>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-stone-100 border border-stone-200 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-stone-500">Imię i nazwisko</th>
              <th className="text-left px-4 py-3 font-medium text-stone-500">Rola</th>
              <th className="text-left px-4 py-3 font-medium text-stone-500">Wspólnota</th>
              <th className="text-left px-4 py-3 font-medium text-stone-500">Dołączył</th>
              {isSuperAdmin && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-stone-50 transition">
                <td className="px-4 py-3 font-medium text-stone-900">
                  {u.full_name ?? <span className="text-stone-500 italic">Brak nazwy</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${roleBadge[u.role] ?? roleBadge.user}`}>
                    {roleLabel[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-stone-700">{u.community?.name ?? '—'}</td>
                <td className="px-4 py-3 text-stone-500">
                  {new Date(u.created_at).toLocaleDateString('pl-PL')}
                </td>
                {isSuperAdmin && (
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/users/${u.id}`} className="text-sm text-green-600 hover:underline">
                      Edytuj
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-stone-500 py-8">
            {search ? `Brak wyników dla "${search}".` : 'Brak aktywnych użytkowników.'}
          </p>
        )}
        {filtered.length > 0 && search && (
          <p className="text-xs text-stone-400 px-4 py-2 border-t border-stone-200">
            {filtered.length} z {users.length} użytkowników
          </p>
        )}
      </div>
    </div>
  )
}

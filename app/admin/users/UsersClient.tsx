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
  admin: 'bg-amber-900/40 text-amber-400',
  user: 'bg-[#1e1409] text-[#b45309]',
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
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a16207] text-sm">🔍</span>
        <input
          className="input w-full pl-8 text-sm"
          placeholder="Szukaj po nazwie, wspólnocie lub roli..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a16207] hover:text-[#fde68a] text-xs">✕</button>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-[#1e1409] border border-[#33200d] rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#18110a] border-b border-[#33200d]">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-[#b45309]">Imię i nazwisko</th>
              <th className="text-left px-4 py-3 font-medium text-[#b45309]">Rola</th>
              <th className="text-left px-4 py-3 font-medium text-[#b45309]">Wspólnota</th>
              <th className="text-left px-4 py-3 font-medium text-[#b45309]">Dołączył</th>
              {isSuperAdmin && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-[#18110a] transition">
                <td className="px-4 py-3 font-medium text-[#fef9ee]">
                  {u.full_name ?? <span className="text-[#b45309] italic">Brak nazwy</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${roleBadge[u.role] ?? roleBadge.user}`}>
                    {roleLabel[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#fde68a]">{u.community?.name ?? '—'}</td>
                <td className="px-4 py-3 text-[#b45309]">
                  {new Date(u.created_at).toLocaleDateString('pl-PL')}
                </td>
                {isSuperAdmin && (
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/users/${u.id}`} className="text-sm text-amber-500 hover:underline">
                      Edytuj
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-[#b45309] py-8">
            {search ? `Brak wyników dla "${search}".` : 'Brak aktywnych użytkowników.'}
          </p>
        )}
        {filtered.length > 0 && search && (
          <p className="text-xs text-[#a16207] px-4 py-2 border-t border-[#33200d]">
            {filtered.length} z {users.length} użytkowników
          </p>
        )}
      </div>
    </div>
  )
}

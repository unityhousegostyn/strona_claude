'use client'

import { useState, useTransition } from 'react'
import { createContact, deleteContact } from './actions'

interface Contact {
  id: string
  name: string
  role: string
  category: string
  phone: string | null
  email: string | null
  description: string | null
  community_id: string | null
  communityName?: string | null
}

interface Community { id: string; name: string }

interface Props {
  contacts: Contact[]
  canEdit: boolean
  isSuperAdmin: boolean
  defaultCommunityId: string | null
  communities: Community[]
}

const CATEGORIES = [
  { value: 'manager', label: 'Zarządca', icon: '🏢', color: 'bg-emerald-900/40 text-emerald-400 border-emerald-700' },
  { value: 'emergency', label: 'Awaryjny', icon: '🚨', color: 'bg-red-900/40 text-red-400 border-red-800' },
  { value: 'service', label: 'Serwis', icon: '🔧', color: 'bg-yellow-900/40 text-yellow-400 border-yellow-800' },
  { value: 'security', label: 'Ochrona', icon: '🔒', color: 'bg-purple-900/40 text-purple-400 border-purple-800' },
  { value: 'other', label: 'Inny', icon: '📋', color: 'bg-[#162418] text-[#6b9478] border-[#1e3324]' },
]

function getCategoryStyle(category: string) {
  return CATEGORIES.find(c => c.value === category) ?? CATEGORIES[4]
}

export default function ContactsClient({ contacts, canEdit, isSuperAdmin, defaultCommunityId, communities }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterCommunity, setFilterCommunity] = useState('all')
  const [form, setForm] = useState({
    name: '', role: '', category: 'manager',
    phone: '', email: '', description: '',
    communityId: defaultCommunityId ?? '',
  })
  const [formError, setFormError] = useState<string | null>(null)

  // Sync form communityId when filter changes
  const handleFilterCommunity = (val: string) => {
    setFilterCommunity(val)
    if (isSuperAdmin && val !== 'all') {
      setForm(p => ({ ...p, communityId: val }))
    }
  }
  const [localContacts, setLocalContacts] = useState<Contact[]>(contacts)

  const handleSubmit = () => {
    setFormError(null)
    startTransition(async () => {
      const result = await createContact({
        name: form.name,
        role: form.role,
        category: form.category,
        phone: form.phone || undefined,
        email: form.email || undefined,
        description: form.description || undefined,
        communityId: isSuperAdmin ? (form.communityId || null) : defaultCommunityId,
      })
      if (result.error) { setFormError(result.error); return }
      setForm({ name: '', role: '', category: 'manager', phone: '', email: '', description: '', communityId: defaultCommunityId ?? '' })
      setShowForm(false)
      window.location.reload()
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteContact(id)
      setLocalContacts(prev => prev.filter(c => c.id !== id))
    })
  }

  const communityFiltered = isSuperAdmin && filterCommunity !== 'all'
    ? localContacts.filter(c => c.community_id === filterCommunity)
    : localContacts

  const filtered = filterCategory === 'all'
    ? communityFiltered
    : communityFiltered.filter(c => c.category === filterCategory)

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(c => c.category === cat.value)
    if (items.length > 0) acc.push({ ...cat, items })
    return acc
  }, [] as (typeof CATEGORIES[0] & { items: Contact[] })[])

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#ecfdf5]">Kontakty</h2>
        {canEdit && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            + Dodaj kontakt
          </button>
        )}
      </div>

      {/* Formularz */}
      {showForm && (
        <div className="bg-[#121c15] border border-[#1e3324] rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-[#d1fae5]">Nowy kontakt</h3>
          {formError && (
            <div className="bg-red-950/30 border border-red-900 text-red-400 text-sm rounded-lg px-3 py-2">{formError}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#6b9478] mb-1">Imię i nazwisko / Nazwa *</label>
              <input className="input w-full" placeholder="np. Jan Kowalski" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6b9478] mb-1">Stanowisko / Funkcja *</label>
              <input className="input w-full" placeholder="np. Zarządca budynku" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6b9478] mb-1">Kategoria</label>
              <select className="input w-full" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6b9478] mb-1">Telefon</label>
              <input className="input w-full" placeholder="+48 123 456 789" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6b9478] mb-1">Email</label>
              <input className="input w-full" type="email" placeholder="kontakt@wspolnota.pl" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            {isSuperAdmin && communities.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[#6b9478] mb-1">Wspólnota</label>
                <select className="input w-full" value={form.communityId} onChange={e => setForm(p => ({ ...p, communityId: e.target.value }))}>
                  <option value="">Globalne (wszystkie)</option>
                  {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#6b9478] mb-1">Opis / Godziny pracy</label>
              <input className="input w-full" placeholder="np. Dostępny pon–pt 8–16" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={handleSubmit} disabled={isPending} className="bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
              {isPending ? 'Zapisywanie...' : 'Zapisz'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-[#4d7a5f] hover:text-[#a7f3d0]">Anuluj</button>
          </div>
        </div>
      )}

      {/* Filtr wspólnoty (super_admin) */}
      {isSuperAdmin && communities.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-[#6b9478] whitespace-nowrap">Wspólnota:</label>
          <select
            value={filterCommunity}
            onChange={(e) => handleFilterCommunity(e.target.value)}
            className="input text-sm py-1.5"
          >
            <option value="all">Wszystkie wspólnoty</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Filtr kategorii */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
            filterCategory === 'all' ? 'bg-emerald-700 text-white border-emerald-600' : 'bg-[#121c15] text-[#4d7a5f] border-[#1e3324] hover:border-[#1e3324]'
          }`}
        >
          Wszystkie
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setFilterCategory(cat.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
              filterCategory === cat.value ? cat.color : 'bg-[#121c15] text-[#4d7a5f] border-[#1e3324] hover:border-[#1e3324]'
            }`}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {grouped.length === 0 && (
        <p className="text-sm text-[#4d7a5f]">
          {filterCategory === 'all' ? 'Brak kontaktów. Dodaj pierwszy kontakt.' : 'Brak kontaktów w tej kategorii.'}
        </p>
      )}

      {grouped.map(group => (
        <div key={group.value} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base">{group.icon}</span>
            <h3 className="text-sm font-semibold text-[#6b9478] uppercase tracking-wider">{group.label}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {group.items.map(contact => (
              <div key={contact.id} className={`bg-[#121c15] border rounded-xl p-4 space-y-2 ${group.color.includes('border') ? `border-${group.color.split('border-')[1]}` : 'border-[#1e3324]'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#ecfdf5]">{contact.name}</p>
                    <p className="text-xs text-[#4d7a5f] mt-0.5">{contact.role}</p>
                    {isSuperAdmin && contact.communityName && (
                      <span className="text-xs bg-[#162418] text-[#6b9478] px-1.5 py-0.5 rounded mt-1 inline-block">{contact.communityName}</span>
                    )}
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => handleDelete(contact.id)}
                      disabled={isPending}
                      className="text-xs text-[#4d7a5f] hover:text-red-400 transition disabled:opacity-50 flex-shrink-0"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition">
                      <span>📞</span> {contact.phone}
                    </a>
                  )}
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition">
                      <span>✉️</span> {contact.email}
                    </a>
                  )}
                  {contact.description && (
                    <p className="text-xs text-[#4d7a5f] pt-1">{contact.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

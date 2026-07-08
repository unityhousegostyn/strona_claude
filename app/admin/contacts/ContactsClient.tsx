'use client'

import { useState, useTransition } from 'react'
import { createContact, updateContact, deleteContact } from './actions'
import BackButton from '@/components/BackButton'

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
  { value: 'manager', label: 'Zarządca', icon: '🏢', color: 'bg-teal-900/40 text-teal-400 border-teal-700' },
  { value: 'emergency', label: 'Awaryjny', icon: '🚨', color: 'bg-red-900/40 text-red-400 border-red-800' },
  { value: 'service', label: 'Serwis', icon: '🔧', color: 'bg-yellow-900/40 text-yellow-400 border-yellow-800' },
  { value: 'security', label: 'Ochrona', icon: '🔒', color: 'bg-purple-900/40 text-purple-400 border-purple-800' },
  { value: 'other', label: 'Inny', icon: '📋', color: 'bg-[#0c2220] text-[#0f766e] border-[#0f2d2a]' },
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
  const [editContactId, setEditContactId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: '', role: '', category: 'other',
    phone: '', email: '', description: '',
    communityId: defaultCommunityId ?? '',
  })
  const [editError, setEditError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const handleEditOpen = (c: Contact) => {
    setEditContactId(c.id)
    setEditForm({
      name: c.name,
      role: c.role,
      category: c.category,
      phone: c.phone ?? '',
      email: c.email ?? '',
      description: c.description ?? '',
      communityId: c.community_id ?? defaultCommunityId ?? '',
    })
    setEditError(null)
    setShowForm(false)
  }

  const handleUpdate = () => {
    if (!editContactId) return
    setEditError(null)
    startTransition(async () => {
      const result = await updateContact(editContactId, {
        name: editForm.name,
        role: editForm.role,
        category: editForm.category,
        phone: editForm.phone || undefined,
        email: editForm.email || undefined,
        description: editForm.description || undefined,
        communityId: isSuperAdmin ? (editForm.communityId || null) : defaultCommunityId,
      })
      if (result.error) { setEditError(result.error); return }
      setLocalContacts(prev => prev.map(c => c.id === editContactId ? {
        ...c,
        name: editForm.name,
        role: editForm.role,
        category: editForm.category,
        phone: editForm.phone || null,
        email: editForm.email || null,
        description: editForm.description || null,
      } : c))
      setEditContactId(null)
    })
  }

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

  const searchFiltered = searchQuery.trim()
    ? communityFiltered.filter(c => {
        const q = searchQuery.toLowerCase()
        return c.name.toLowerCase().includes(q)
          || c.role.toLowerCase().includes(q)
          || (c.description ?? '').toLowerCase().includes(q)
          || (c.phone ?? '').includes(q)
          || (c.email ?? '').toLowerCase().includes(q)
      })
    : communityFiltered

  const filtered = filterCategory === 'all'
    ? searchFiltered
    : searchFiltered.filter(c => c.category === filterCategory)

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(c => c.category === cat.value)
    if (items.length > 0) acc.push({ ...cat, items })
    return acc
  }, [] as (typeof CATEGORIES[0] & { items: Contact[] })[])

  return (
    <div className="space-y-6">
      <BackButton />
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#f0fdfa]">Kontakty</h2>
        {canEdit && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            + Dodaj kontakt
          </button>
        )}
      </div>

      {/* Wyszukiwarka */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#115e59]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="input w-full pl-9 text-sm"
          placeholder="Szukaj kontaktu…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Formularz */}
      {showForm && (
        <div className="bg-[#081918] border border-[#0f2d2a] rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-[#ccfbf1]">Nowy kontakt</h3>
          {formError && (
            <div className="bg-red-950/30 border border-red-900 text-red-400 text-sm rounded-lg px-3 py-2">{formError}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#0f766e] mb-1">Imię i nazwisko / Nazwa *</label>
              <input className="input w-full" placeholder="np. Jan Kowalski" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0f766e] mb-1">Stanowisko / Funkcja *</label>
              <input className="input w-full" placeholder="np. Zarządca budynku" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0f766e] mb-1">Kategoria</label>
              <select className="input w-full" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0f766e] mb-1">Telefon</label>
              <input className="input w-full" placeholder="+48 123 456 789" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0f766e] mb-1">Email</label>
              <input className="input w-full" type="email" placeholder="kontakt@wspolnota.pl" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            {isSuperAdmin && communities.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[#0f766e] mb-1">Wspólnota</label>
                <select className="input w-full" value={form.communityId} onChange={e => setForm(p => ({ ...p, communityId: e.target.value }))}>
                  <option value="">Globalne (wszystkie)</option>
                  {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#0f766e] mb-1">Opis / Godziny pracy</label>
              <input className="input w-full" placeholder="np. Dostępny pon–pt 8–16" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={handleSubmit} disabled={isPending} className="bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
              {isPending ? 'Zapisywanie...' : 'Zapisz'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-[#115e59] hover:text-[#99f6e4]">Anuluj</button>
          </div>
        </div>
      )}

      {/* Formularz edycji */}
      {editContactId && (
        <div className="bg-[#081918] border border-teal-700 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-[#ccfbf1]">Edytuj kontakt</h3>
          {editError && (
            <div className="bg-red-950/30 border border-red-900 text-red-400 text-sm rounded-lg px-3 py-2">{editError}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#0f766e] mb-1">Imię i nazwisko / Nazwa *</label>
              <input className="input w-full" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0f766e] mb-1">Stanowisko / Funkcja *</label>
              <input className="input w-full" value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0f766e] mb-1">Kategoria</label>
              <select className="input w-full" value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0f766e] mb-1">Telefon</label>
              <input className="input w-full" placeholder="+48 123 456 789" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0f766e] mb-1">Email</label>
              <input className="input w-full" type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            {isSuperAdmin && communities.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[#0f766e] mb-1">Wspólnota</label>
                <select className="input w-full" value={editForm.communityId} onChange={e => setEditForm(p => ({ ...p, communityId: e.target.value }))}>
                  <option value="">Globalne (wszystkie)</option>
                  {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#0f766e] mb-1">Opis / Godziny pracy</label>
              <input className="input w-full" value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={handleUpdate} disabled={isPending} className="bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
              {isPending ? 'Zapisywanie...' : 'Zapisz zmiany'}
            </button>
            <button onClick={() => setEditContactId(null)} className="text-sm text-[#115e59] hover:text-[#99f6e4]">Anuluj</button>
          </div>
        </div>
      )}

      {/* Filtr wspólnoty (super_admin) */}
      {isSuperAdmin && communities.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-[#0f766e] whitespace-nowrap">Wspólnota:</label>
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
            filterCategory === 'all' ? 'bg-teal-700 text-white border-teal-600' : 'bg-[#081918] text-[#115e59] border-[#0f2d2a] hover:border-[#0f2d2a]'
          }`}
        >
          Wszystkie
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setFilterCategory(cat.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
              filterCategory === cat.value ? cat.color : 'bg-[#081918] text-[#115e59] border-[#0f2d2a] hover:border-[#0f2d2a]'
            }`}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {grouped.length === 0 && (
        <p className="text-sm text-[#115e59]">
          {filterCategory === 'all' ? 'Brak kontaktów. Dodaj pierwszy kontakt.' : 'Brak kontaktów w tej kategorii.'}
        </p>
      )}

      {grouped.map(group => (
        <div key={group.value} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base">{group.icon}</span>
            <h3 className="text-sm font-semibold text-[#0f766e] uppercase tracking-wider">{group.label}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {group.items.map(contact => (
              <div key={contact.id} className={`bg-[#081918] border rounded-xl p-4 space-y-2 ${group.color.includes('border') ? `border-${group.color.split('border-')[1]}` : 'border-[#0f2d2a]'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#f0fdfa]">{contact.name}</p>
                    <p className="text-xs text-[#115e59] mt-0.5">{contact.role}</p>
                    {isSuperAdmin && contact.communityName && (
                      <span className="text-xs bg-[#0c2220] text-[#0f766e] px-1.5 py-0.5 rounded mt-1 inline-block">{contact.communityName}</span>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => editContactId === contact.id ? setEditContactId(null) : handleEditOpen(contact)}
                        disabled={isPending}
                        title="Edytuj kontakt"
                        className={`text-xs transition disabled:opacity-50 ${editContactId === contact.id ? 'text-teal-300' : 'text-[#0f766e] hover:text-[#99f6e4]'}`}
                      >✏️</button>
                      <button
                        onClick={() => handleDelete(contact.id)}
                        disabled={isPending}
                        className="text-xs text-[#115e59] hover:text-red-400 transition disabled:opacity-50"
                      >✕</button>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300 transition">
                      <span>📞</span> {contact.phone}
                    </a>
                  )}
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300 transition">
                      <span>✉️</span> {contact.email}
                    </a>
                  )}
                  {contact.description && (
                    <p className="text-xs text-[#115e59] pt-1">{contact.description}</p>
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

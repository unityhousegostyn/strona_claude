/**
 * Wspólne helpery autoryzacji dla server components i server actions.
 *
 * Użycie w server component:
 *   const { user, profile } = await getAuthProfile()
 *
 * Użycie w server action:
 *   const auth = await getAuthProfileAction()
 *   if (auth.error) return { error: auth.error }
 */

import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from './supabase/server'

export type UserRole = 'super_admin' | 'admin' | 'user' | 'najemca'

export interface AuthProfile {
  id: string
  role: UserRole
  community_id: string | null
  full_name: string | null
  apartment_id: string | null
}

export interface AuthUser {
  id: string
  email?: string
}

// ── SERVER COMPONENTS ────────────────────────────────────────────────────────
// Redirectuje do /login jeśli brak sesji lub profilu.

export async function getAuthProfile(): Promise<{
  user: AuthUser
  profile: AuthProfile
}> {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, community_id, full_name, apartment_id')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  return { user: { id: user.id, email: user.email }, profile }
}

// ── SERVER ACTIONS ───────────────────────────────────────────────────────────
// Zwraca error zamiast redirectować (actions nie mogą redirectować w środku).

type ActionAuthSuccess = { error: null; user: AuthUser; profile: AuthProfile }
type ActionAuthFailure = { error: string; user: null; profile: null }
export type ActionAuth = ActionAuthSuccess | ActionAuthFailure

export async function getAuthProfileAction(): Promise<ActionAuth> {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Brak autoryzacji', user: null, profile: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, community_id, full_name, apartment_id')
    .eq('id', user.id)
    .single()
  if (!profile) return { error: 'Brak profilu', user: null, profile: null }

  return { error: null, user: { id: user.id, email: user.email }, profile }
}

// ── GUARD HELPERS ────────────────────────────────────────────────────────────

/** Rzuca redirect jeśli rola jest niższa niż wymagana */
export function requireRole(profile: AuthProfile, minRole: UserRole, redirectTo = '/admin/dashboard') {
  const order: UserRole[] = ['najemca', 'user', 'admin', 'super_admin']
  if (order.indexOf(profile.role) < order.indexOf(minRole)) redirect(redirectTo)
}

/** Sprawdza, czy admin ma dostęp do danej wspólnoty (super_admin zawsze ma) */
export function canAccessCommunity(profile: AuthProfile, communityId: string): boolean {
  if (profile.role === 'super_admin') return true
  return profile.community_id === communityId
}

/** Zwraca community_id do filtrowania:
 *  - super_admin: null (brak filtra, pobierz wszystko)
 *  - admin/user: profile.community_id
 */
export function getCommunityFilter(profile: AuthProfile): string | null {
  if (profile.role === 'super_admin') return null
  return profile.community_id
}

/** Sprawdza czy użytkownik ma dostęp do konkretnego lokalu.
 *  super_admin: zawsze tak
 *  admin: tylko lokale swojej wspólnoty
 *  user/najemca: tylko swój lokal (przez owner_id LUB profiles.apartment_id)
 */
export function canAccessApartment(
  profile: AuthProfile,
  user: AuthUser,
  apartment: { id: string; community_id: string; owner_id?: string | null },
): boolean {
  if (profile.role === 'super_admin') return true
  if (profile.role === 'admin') return apartment.community_id === profile.community_id
  // user / najemca — oba źródła przypisania
  return apartment.owner_id === user.id || profile.apartment_id === apartment.id
}

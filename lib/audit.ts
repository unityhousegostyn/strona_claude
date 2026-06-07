import { getSupabaseAdminClient } from './supabase/server'

export async function logActivity(params: {
  userId: string
  action: string
  targetType?: string
  targetId?: string
  meta?: Record<string, any>
}) {
  try {
    const admin = getSupabaseAdminClient()
    await admin.from('activity_logs').insert({
      user_id: params.userId,
      action: params.action,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      meta: params.meta ?? null,
    })
  } catch {
    // Nie przerywaj głównej operacji jeśli log się nie zapisze
  }
}

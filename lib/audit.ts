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
    const { error } = await admin.from('activity_logs').insert({
      user_id: params.userId,
      action: params.action,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      meta: params.meta ?? null,
    })
    if (error) {
      console.error('[audit] logActivity DB error:', error.message, { userId: params.userId, action: params.action })
    }
  } catch (e) {
    console.error('[audit] logActivity exception:', e)
  }
}

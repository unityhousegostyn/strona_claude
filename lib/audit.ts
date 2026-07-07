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
      // FK violation (23503): user_id istnieje w auth.users ale nie w profiles
      // → retry z user_id = NULL, prawdziwe ID zachowane w meta._user_id
      if ((error as any).code === '23503') {
        console.warn('[audit] FK violation dla user:', params.userId, '— retry z user_id=null')
        const { error: e2 } = await admin.from('activity_logs').insert({
          user_id: null,
          action: params.action,
          target_type: params.targetType ?? null,
          target_id: params.targetId ?? null,
          meta: { ...(params.meta ?? {}), _user_id: params.userId },
        })
        if (e2) console.error('[audit] retry failed:', e2.message)
      } else {
        console.error('[audit] logActivity DB error:', error.message, { userId: params.userId, action: params.action })
      }
    }
  } catch (e) {
    console.error('[audit] logActivity exception:', e)
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { subscription } = await req.json()
    // Walidacja endpoint — brak limitu długości pozwala na zapis bardzo długiego stringa (DoS/DB bloat)
    if (!subscription?.endpoint || typeof subscription.endpoint !== 'string') {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }
    if (subscription.endpoint.length > 2048) {
      return NextResponse.json({ error: 'Endpoint too long' }, { status: 400 })
    }

    const admin = getSupabaseAdminClient()
    // Upsert — jeden endpoint = jeden rekord
    const { error } = await admin
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys?.p256dh ?? null,
        auth: subscription.keys?.auth ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { endpoint } = await req.json()
    if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })

    const admin = getSupabaseAdminClient()
    await admin.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

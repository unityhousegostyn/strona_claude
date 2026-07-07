import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('role, community_id')
      .eq('id', user.id)
      .single()

    if (!senderProfile || !['admin', 'super_admin'].includes(senderProfile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { title, body, url, communityId: requestedCommunityId } = await req.json()
    if (!title || !body) {
      return NextResponse.json({ error: 'title and body required' }, { status: 400 })
    }
    if (typeof title !== 'string' || title.trim().length > 200)
      return NextResponse.json({ error: 'title max 200 znaków' }, { status: 400 })
    if (typeof body !== 'string' || body.trim().length > 1000)
      return NextResponse.json({ error: 'body max 1000 znaków' }, { status: 400 })
    if (url !== undefined && url !== null && (typeof url !== 'string' || url.length > 500))
      return NextResponse.json({ error: 'url max 500 znaków' }, { status: 400 })

    // Admin (zarządca) może wysłać push WYŁĄCZNIE do swojej wspólnoty — bez tego
    // mógłby podać communityId innej wspólnoty (albo nic nie podać, co wysyłało
    // powiadomienie do WSZYSTKICH subskrybentów wszystkich wspólnot).
    const communityId = senderProfile.role === 'admin' ? senderProfile.community_id : requestedCommunityId
    if (senderProfile.role === 'admin' && !communityId) {
      return NextResponse.json({ error: 'Brak przypisanej wspólnoty' }, { status: 403 })
    }

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    const vapidEmail = process.env.VAPID_EMAIL ?? 'mailto:admin@wspolnota.pl'

    if (!vapidPublic || !vapidPrivate) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
    }

    const admin = getSupabaseAdminClient()

    // Pobierz subskrypcje dla wspólnoty lub wszystkich
    let query = admin.from('push_subscriptions').select('*, profile:profiles!user_id(community_id)')
    if (communityId) {
      // Filtrujemy przez join
      const { data: commUsers } = await admin
        .from('profiles')
        .select('id')
        .eq('community_id', communityId)
      if (commUsers && commUsers.length > 0) {
        const ids = commUsers.map(u => u.id)
        query = query.in('user_id', ids)
      }
    }

    const { data: subscriptions } = await query

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No subscriptions found' })
    }

    // Dynamic import web-push (server-side only)
    const webpush = await import('web-push')
    webpush.default.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate)

    const payload = JSON.stringify({
      title,
      body,
      url: url ?? '/admin/dashboard',
      tag: `notification-${Date.now()}`,
    })

    let sent = 0
    const toDelete: string[] = []

    for (const sub of subscriptions) {
      try {
        await webpush.default.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        )
        sent++
      } catch (err: any) {
        // 410 Gone = subskrypcja wygasła, usuń ją
        if (err.statusCode === 410 || err.statusCode === 404) {
          toDelete.push(sub.endpoint)
        }
      }
    }

    // Wyczyść wygasłe subskrypcje
    if (toDelete.length > 0) {
      await admin.from('push_subscriptions').delete().in('endpoint', toDelete)
    }

    return NextResponse.json({ sent, total: subscriptions.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

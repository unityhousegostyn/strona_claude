import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { checkChatRateLimit } from '@/lib/chat-rate-limit'

export async function POST(req: NextRequest) {
  try {
    // Autoryzacja
    const supabase = await getSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

    // Rate limiting — 20 zapytań / godzinę per użytkownik
    if (!checkChatRateLimit(user.id)) {
      return NextResponse.json(
        { error: 'Zbyt wiele zapytań. Poczekaj chwilę i spróbuj ponownie.' },
        { status: 429 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('community_id, role')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Brak profilu' }, { status: 401 })

    const { question } = await req.json()
    if (!question?.trim()) return NextResponse.json({ error: 'Brak pytania' }, { status: 400 })

    const admin = getSupabaseAdminClient()
    const communityId = profile.community_id

    // Szukaj pasujących fragmentów dokumentów (FTS)
    let chunks: { content: string }[] = []

    const words = question.trim().split(/\s+/).slice(0, 6).join(' & ')

    if (communityId) {
      // Szukaj FTS dla danej wspólnoty
      const { data: ftsResults } = await admin
        .from('document_chunks')
        .select('content')
        .eq('community_id', communityId)
        .textSearch('content', words, { config: 'simple' })
        .limit(6)

      chunks = ftsResults ?? []

      // Fallback: jeśli FTS nic nie znalazł, bierz losowe chunki z tej wspólnoty
      if (chunks.length === 0) {
        const { data: fallback } = await admin
          .from('document_chunks')
          .select('content')
          .eq('community_id', communityId)
          .limit(6)
        chunks = fallback ?? []
      }
    } else {
      // super_admin bez wspólnoty — szukaj globalnie
      const { data: ftsResults } = await admin
        .from('document_chunks')
        .select('content')
        .textSearch('content', words, { config: 'simple' })
        .limit(6)
      chunks = ftsResults ?? []
    }

    if (chunks.length === 0) {
      return NextResponse.json({
        answer: 'Nie mam jeszcze żadnych dokumentów do przeszukania. Poproś administratora o wgranie regulaminów i procedur do panelu.'
      })
    }

    const context = chunks.map((c, i) => `[Fragment ${i + 1}]\n${c.content}`).join('\n\n')

    // Wywołanie Claude API
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Brak klucza API — skontaktuj się z administratorem.' }, { status: 500 })
    }

    const prompt = `Jesteś pomocnym asystentem wspólnoty mieszkaniowej. Odpowiadasz mieszkańcom na pytania dotyczące regulaminów, procedur i zasad wspólnoty.

Zasady:
- Odpowiadaj WYŁĄCZNIE na podstawie poniższych fragmentów dokumentów
- Jeśli odpowiedź nie wynika z dokumentów, napisz: "Nie mam tej informacji w dokumentach. Skontaktuj się z zarządcą."
- Odpowiadaj po polsku, konkretnie i zwięźle (max 3-4 zdania)
- Nie wymyślaj ani nie zgaduj informacji

Fragmenty dokumentów:
${context}

Pytanie mieszkańca: ${question}

Odpowiedź:`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) {
      console.error('[chat] Anthropic API error:', await response.text())
      return NextResponse.json({ error: 'Błąd serwisu AI. Spróbuj ponownie.' }, { status: 500 })
    }

    const data = await response.json()
    const answer = data.content?.[0]?.text ?? 'Przepraszam, nie mogę teraz odpowiedzieć.'

    return NextResponse.json({ answer })
  } catch (e: any) {
    console.error('[chat] error:', e)
    return NextResponse.json({ error: 'Nieznany błąd.' }, { status: 500 })
  }
}

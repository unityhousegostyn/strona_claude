/**
 * Klient KSeF API 2.0 — Krajowy System e-Faktur
 *
 * Dokumentacja oficjalna MF:
 *   https://api.ksef.mf.gov.pl/docs/v2          (produkcja)
 *   https://api-test.ksef.mf.gov.pl/docs/v2     (testy)
 *   https://github.com/CIRFMF/ksef-docs          (przewodnik + scenariusze)
 *
 * Flow uwierzytelniania tokenem KSeF:
 *   1. POST /auth/challenge              → challengeKey
 *   2. POST /auth/ksef-token             → authCode
 *   3. POST /auth/token/redeem           → accessToken + refreshToken
 *
 * UWAGA: ksef_token to token generowany przez użytkownika w portalu KSeF
 * (Ustawienia → Tokeny). Jest to ciąg znaków, nie certyfikat.
 */

export type KsefEnvironment = 'prod' | 'test'

/**
 * KSeF API 2.0 base URLs (MF).
 * Jeśli API odpowiada 404 na /auth/challenge, sprawdź aktualne URL w Swaggerze:
 *   prod: https://api.ksef.mf.gov.pl/api/v2/docs
 *   test: https://api-test.ksef.mf.gov.pl/api/v2/docs
 */
const BASE: Record<KsefEnvironment, string> = {
  prod: 'https://api.ksef.mf.gov.pl/api/v2',
  test: 'https://api-test.ksef.mf.gov.pl/api/v2',
}

/** Fallback URLs jeśli powyższe nie odpowiadają (starsza v1 KSeF) */
const BASE_V1: Record<KsefEnvironment, string> = {
  prod: 'https://ksef.mf.gov.pl/api',
  test: 'https://ksef-test.mf.gov.pl/api',
}

// ── Typy ─────────────────────────────────────────────────────────────────────

export interface KsefInvoiceHeader {
  invoiceId: string
  kseNumber: string       // np. "KSeF/2026/07/01/0000001"
  issueDate: string       // ISO date
  invoiceDate: string     // ISO date (data wystawienia na fakturze)
  sellerName: string
  sellerNip: string
  buyerNip: string
  netAmount: number
  vatAmount: number
  grossAmount: number
}

export interface KsefAuthResult {
  accessToken: string
  refreshToken: string
  expiresAt: string
}

// ── Auth ─────────────────────────────────────────────────────────────────────

async function kfetch(url: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(opts.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`KSeF HTTP ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

/**
 * Wyciąga wartość pola z obiektu próbując wielu wariantów nazw.
 * Przydatne gdy nie znamy dokładnej struktury odpowiedzi API.
 */
function pick(obj: any, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const val = obj?.[k] ?? obj?.data?.[k]
    if (val !== undefined && val !== null && val !== '') return String(val)
  }
  return undefined
}

/**
 * Uwierzytelnianie tokenem KSeF (bez certyfikatu kwalifikowanego).
 * Token generowany w portalu KSeF → Ustawienia → Tokeny API.
 *
 * Flow (v2):
 *   POST /auth/challenge        → challengeKey / challenge / referenceNumber
 *   POST /auth/ksef-token       → authCode / referenceNumber
 *   POST /auth/token/redeem     → accessToken
 *
 * Przy błędzie "Brak X w odpowiedzi", sprawdź raw response w komunikacie
 * błędu i zaktualizuj nazwy pól wg aktualnego Swaggera:
 *   https://api.ksef.mf.gov.pl/api/v2/docs
 */
export async function ksefAuth(
  nip: string,
  token: string,
  env: KsefEnvironment,
): Promise<KsefAuthResult> {
  const base = BASE[env]

  // ── Krok 1: challenge ─────────────────────────────────────────────────────
  let challengeData: any
  try {
    challengeData = await kfetch(`${base}/auth/challenge`, {
      method: 'POST',
      body: JSON.stringify({ contextIdentifier: { type: 'onip', identifier: nip } }),
    })
  } catch (e: any) {
    // Jeśli v2 niedostępne, próbuj v1
    if (e?.message?.includes('404') || e?.message?.includes('502') || e?.message?.includes('503')) {
      const baseV1 = BASE_V1[env]
      challengeData = await kfetch(`${baseV1}/online/Session/AuthorisationChallenge`, {
        method: 'POST',
        body: JSON.stringify({ contextIdentifier: { type: 'onip', identifier: nip } }),
      })
    } else throw e
  }

  // Próbujemy wielu możliwych nazw pól (v2 i v1 KSeF używają różnych)
  const challengeKey = pick(challengeData,
    'challengeKey', 'challenge', 'referenceNumber',
    'Challenge', 'ChallengeKey', 'ReferenceNumber',
  )

  if (!challengeKey) {
    throw new Error(
      `Brak challenge w odpowiedzi KSeF /auth/challenge. ` +
      `Odpowiedź API: ${JSON.stringify(challengeData).slice(0, 500)}`,
    )
  }

  // ── Krok 2: uwierzytelnianie tokenem ─────────────────────────────────────
  const authData = await kfetch(`${base}/auth/ksef-token`, {
    method: 'POST',
    body: JSON.stringify({
      contextIdentifier: { type: 'onip', identifier: nip },
      authorisationToken: token,
      challenge: challengeKey,
      // v1 KSeF używa innej struktury:
      token: { challenge: challengeKey, value: token },
    }),
  })

  const authCode = pick(authData,
    'authCode', 'referenceNumber', 'ReferenceNumber',
    'AuthCode', 'sessionToken', 'token',
  )

  if (!authCode) {
    throw new Error(
      `Brak authCode w odpowiedzi KSeF /auth/ksef-token. ` +
      `Odpowiedź API: ${JSON.stringify(authData).slice(0, 500)}`,
    )
  }

  // ── Krok 3: wymiana na accessToken ────────────────────────────────────────
  const tokenData = await kfetch(`${base}/auth/token/redeem`, {
    method: 'POST',
    body: JSON.stringify({ authCode }),
  })

  const d = tokenData?.data ?? tokenData
  const accessToken =
    d?.accessToken ??
    d?.sessionToken?.token ??
    d?.token ??
    d?.access_token ??
    // v1 KSeF: status endpoint zamiast redeem
    d?.sessionToken

  const refreshToken: string = d?.refreshToken ?? d?.refresh_token ?? ''
  const expiresAt: string = d?.tokenExpiresAt ?? d?.expiresAt ?? d?.expires_at ?? ''

  if (!accessToken) {
    throw new Error(
      `Brak accessToken w odpowiedzi KSeF /auth/token/redeem. ` +
      `Odpowiedź API: ${JSON.stringify(tokenData).slice(0, 500)}`,
    )
  }

  return { accessToken: String(accessToken), refreshToken, expiresAt }
}

// ── Pobieranie faktur ─────────────────────────────────────────────────────────

/**
 * Zapytanie o listę faktur (stronicowanie).
 * subjectType: 'buyer' — faktury, na których jesteśmy nabywcą
 *
 * Dokumentacja: POST /api/v2/invoices/query
 */
export async function ksefQueryInvoices(
  accessToken: string,
  env: KsefEnvironment,
  dateFrom: Date,
  dateTo: Date,
): Promise<KsefInvoiceHeader[]> {
  const base = BASE[env]
  const results: KsefInvoiceHeader[] = []

  let pageToken: string | null = null
  let page = 0

  do {
    const body: Record<string, any> = {
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
      subjectType: 'buyer',
      pageSize: 100,
    }
    if (pageToken) body.pageToken = pageToken

    const res = await kfetch(`${base}/invoices/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    })

    const data = res?.data ?? res
    const invoices: any[] = data?.invoices ?? []
    pageToken = data?.nextPageToken ?? null

    for (const inv of invoices) {
      results.push(mapInvoiceHeader(inv))
    }

    page++
    if (page > 50) break // zabezpieczenie przed nieskończoną pętlą
  } while (pageToken)

  return results
}

/**
 * Mapowanie pól z API do naszego interfejsu.
 * Nazwy pól mogą się różnić — porównaj ze Swaggerem i dostosuj.
 */
function mapInvoiceHeader(inv: any): KsefInvoiceHeader {
  const seller = inv.seller ?? inv.sellerIdentifier ?? {}
  const buyer  = inv.buyer  ?? inv.buyerIdentifier  ?? {}

  return {
    invoiceId:   inv.invoiceId   ?? inv.id ?? '',
    kseNumber:   inv.kseNumber   ?? inv.ksefNumber ?? inv.referenceNumber ?? '',
    issueDate:   inv.issueDate   ?? inv.issueDateTime?.slice(0, 10) ?? '',
    invoiceDate: inv.invoiceDate ?? inv.issuedAt?.slice(0, 10) ?? '',
    sellerName:  inv.sellerName  ?? seller.name ?? '',
    sellerNip:   inv.sellerNip   ?? seller.identifier ?? seller.nip ?? '',
    buyerNip:    inv.buyerNip    ?? buyer.identifier  ?? buyer.nip  ?? '',
    netAmount:   parseAmt(inv.netAmount   ?? inv.net   ?? inv.totalNet),
    vatAmount:   parseAmt(inv.vatAmount   ?? inv.vat   ?? inv.totalVat),
    grossAmount: parseAmt(inv.grossAmount ?? inv.gross ?? inv.totalGross),
  }
}

function parseAmt(v: any): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v) || 0
  return 0
}

/**
 * Pełny XML faktury (FA 3.0).
 * Używaj do debugowania lub archiwizacji — nie jest wymagany do importu.
 */
export async function ksefGetInvoiceXml(
  accessToken: string,
  env: KsefEnvironment,
  invoiceId: string,
): Promise<string> {
  const base = BASE[env]
  const res = await fetch(`${base}/invoices/${encodeURIComponent(invoiceId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/xml',
    },
  })
  if (!res.ok) throw new Error(`KSeF HTTP ${res.status} przy pobieraniu XML`)
  return res.text()
}

// ── Heurystyczne dopasowanie kategorii z nazwy sprzedawcy/opisu ─────────────

const CATEGORY_HINTS: [RegExp, string][] = [
  [/woda|wodociąg|oczyszczal/i,       'woda'],
  [/śmiec|odpad|komunaln/i,            'śmieci'],
  [/gaz|pgnig/i,                       'gaz'],
  [/prąd|energi|elektr|tauron|pge/i,  'energia_elektryczna'],
  [/remontow|moderniz|renow|budow/i,   'fundusz_remontowy'],
  [/zarząd|zarządz|obsług/i,           'wynagrodzenie_zarządcy'],
  [/ubezpiecz|polisa/i,                'ubezpieczenie'],
  [/ochrona|monitoring/i,              'ochrona'],
  [/sprzątani|cleaning/i,              'sprzątanie'],
  [/winduk|dźwig|winda/i,              'winda'],
]

export function guessCategory(sellerName: string, description?: string): string {
  const text = `${sellerName} ${description ?? ''}`.toLowerCase()
  for (const [re, cat] of CATEGORY_HINTS) {
    if (re.test(text)) return cat
  }
  return 'pozostałe'
}

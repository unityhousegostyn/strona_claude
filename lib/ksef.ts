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
  // KSeF v2 używa integer enum dla contextIdentifier.type:
  //   1 = NIP organizacji (dawniej "onip" w v1)
  //   2 = PESEL
  // Próbujemy kolejno do pierwszego sukcesu.
  let challengeData: any
  const challengeAttempts = [
    // v2 z integer type
    { url: `${base}/auth/challenge`,
      body: { contextIdentifier: { type: 1, identifier: nip } } },
    // v2 z "nip" string
    { url: `${base}/auth/challenge`,
      body: { contextIdentifier: { type: 'nip', identifier: nip } } },
    // v2 bez contextIdentifier
    { url: `${base}/auth/challenge`,
      body: { nip } },
    // v1 fallback
    { url: `${BASE_V1[env]}/online/Session/AuthorisationChallenge`,
      body: { contextIdentifier: { type: 'onip', identifier: nip } } },
  ]

  let lastChallengeError = ''
  for (const attempt of challengeAttempts) {
    try {
      challengeData = await kfetch(attempt.url, {
        method: 'POST',
        body: JSON.stringify(attempt.body),
      })
      break // sukces
    } catch (e: any) {
      lastChallengeError = e?.message ?? String(e)
      // Kontynuuj tylko przy błędach walidacji/składni, nie przy auth
      if (!lastChallengeError.includes('400') && !lastChallengeError.includes('404') &&
          !lastChallengeError.includes('422') && !lastChallengeError.includes('502')) {
        throw e
      }
    }
  }
  if (!challengeData) throw new Error(`KSeF /auth/challenge wszystkie próby nieudane. Ostatni błąd: ${lastChallengeError}`)

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
  // Próbujemy różnych struktur body (v2 integer type, v2 string, v1)
  let authData: any
  const authAttempts = [
    // v2 — integer type + authorisationToken
    { url: `${base}/auth/ksef-token`,
      body: { contextIdentifier: { type: 1, identifier: nip }, authorisationToken: token, challenge: challengeKey } },
    // v2 — bez contextIdentifier
    { url: `${base}/auth/ksef-token`,
      body: { nip, token, challenge: challengeKey } },
    // v1 — onip string
    { url: `${BASE_V1[env]}/online/Session/InitToken`,
      body: { contextIdentifier: { type: 'onip', identifier: nip }, token: { challenge: challengeKey, value: token } } },
  ]

  let lastAuthError = ''
  for (const attempt of authAttempts) {
    try {
      authData = await kfetch(attempt.url, {
        method: 'POST',
        body: JSON.stringify(attempt.body),
      })
      break
    } catch (e: any) {
      lastAuthError = e?.message ?? String(e)
      if (!lastAuthError.includes('400') && !lastAuthError.includes('404') &&
          !lastAuthError.includes('422') && !lastAuthError.includes('502')) {
        throw e
      }
    }
  }
  if (!authData) throw new Error(`KSeF /auth/ksef-token wszystkie próby nieudane. Ostatni błąd: ${lastAuthError}`)

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

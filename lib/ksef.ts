/**
 * Klient KSeF API 2.0 — Krajowy System e-Faktur
 *
 * Dokumentacja oficjalna MF:
 *   https://github.com/CIRFMF/ksef-docs          (przewodnik + scenariusze)
 *   https://api-test.ksef.mf.gov.pl/docs/v2      (Swagger test)
 *
 * Flow uwierzytelniania tokenem KSeF v2 (ZWERYFIKOWANY z oficjalną dokumentacją):
 *   1. POST /auth/challenge
 *        → {challenge, timestampMs}
 *   2. GET /security/public-key-certificates
 *        → certyfikat X.509 (usage: KsefTokenEncryption)
 *   3. Szyfrowanie: RSA-OAEP SHA-256( "{ksefToken}|{timestampMs}", klucz_publiczny_KSeF )
 *        → Base64(encryptedToken)
 *   4. POST /auth/ksef-token
 *        body: {challenge, contextIdentifier: {type:"Nip", value: nip}, encryptedToken, publicKeyId}
 *        → {authenticationToken: {token: "JWT"}, referenceNumber}
 *   5. GET /auth/{referenceNumber}
 *        header: Authorization: Bearer {authenticationToken.token}
 *        → poll aż status ≠ Processing
 *   6. POST /auth/token/redeem
 *        header: Authorization: Bearer {authenticationToken.token}
 *        → {accessToken: "JWT", refreshToken}
 *
 * UWAGA: ksef_token to token generowany przez użytkownika w portalu KSeF
 * (Ustawienia → Tokeny). Jest to ciąg znaków (tajny klucz), nie certyfikat X.509.
 * Przed wysłaniem musi być zaszyfrowany kluczem publicznym KSeF.
 */

export type KsefEnvironment = 'prod' | 'test'

/**
 * KSeF API 2.0 base URLs — zweryfikowane z OpenAPI spec (openapi.json):
 *   "servers": [{ "url": "https://api-test.ksef.mf.gov.pl/v2" }]
 *
 * WAŻNE: ścieżka to /v2 (NIE /api/v2) — /api/v2 zwraca 404!
 */
const BASE: Record<KsefEnvironment, string> = {
  prod: 'https://api.ksef.mf.gov.pl/v2',
  test: 'https://api-test.ksef.mf.gov.pl/v2',
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

async function kfetch(url: string, opts: RequestInit & { headers?: Record<string, string> } = {}): Promise<any> {
  const isGet = !opts.method || opts.method === 'GET'
  const hasBody = opts.body !== undefined && opts.body !== null
  const res = await fetch(url, {
    ...opts,
    headers: {
      // Dodaj Content-Type tylko gdy wysyłamy body (nie dla GET, nie dla POST bez body)
      ...(!isGet && hasBody ? { 'Content-Type': 'application/json' } : {}),
      'Accept': 'application/json',
      ...(opts.headers ?? {}),
    },
  })
  const body = await res.text()
  if (!res.ok) {
    throw new Error(`KSeF HTTP ${res.status} [${url}]: ${body.slice(0, 400)}`)
  }
  // Jeśli zwróciło HTML zamiast JSON (strona błędu portalu)
  if (body.trimStart().startsWith('<')) {
    throw new Error(`KSeF zwrócił HTML zamiast JSON (${res.status}) — prawdopodobnie zły URL`)
  }
  if (!body.trim()) return {}
  return JSON.parse(body)
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
 * Uwierzytelnianie tokenem KSeF — ZWERYFIKOWANY flow z oficjalnej dokumentacji MF.
 * Źródło: https://github.com/CIRFMF/ksef-docs/blob/main/uwierzytelnianie.md
 *
 * KRYTYCZNE: ksef_token MUSI być zaszyfrowany kluczem publicznym KSeF
 * algorytmem RSA-OAEP SHA-256 PRZED wysłaniem do API!
 * Format przed szyfrowaniem: "{ksefToken}|{timestampMs}"
 */
export async function ksefAuth(
  nip: string,
  token: string,
  env: KsefEnvironment,
): Promise<KsefAuthResult> {
  const base = BASE[env]

  // ── Krok 1: POST /auth/challenge → {challenge, timestamp} ───────────────
  // Oficjalne docs (C#/Java): GetAuthChallengeAsync() — brak body, brak NIP.
  // NIP przekazywany jest dopiero w kroku 4 (/auth/ksef-token → contextIdentifier).
  const challengeData = await kfetch(`${base}/auth/challenge`, {
    method: 'POST',
  })

  const challenge: string = challengeData?.challenge ?? challengeData?.Challenge
  // Oficjalne docs: pole to `timestamp` (ISO datetime), przeliczamy na ms
  // C#: `long timestampMs = challenge.Timestamp.ToUnixTimeMilliseconds()`
  const rawTs = challengeData?.timestamp ?? challengeData?.Timestamp
                ?? challengeData?.timestampMs ?? challengeData?.TimestampMs
  const timestampMs: number = typeof rawTs === 'number' ? rawTs : new Date(rawTs ?? Date.now()).getTime()

  if (!challenge) {
    throw new Error(
      `Brak pola 'challenge' w odpowiedzi KSeF /auth/challenge. ` +
      `Odpowiedź: ${JSON.stringify(challengeData).slice(0, 400)}`,
    )
  }

  // ── Krok 2: GET /security/public-key-certificates → klucz publiczny KSeF ─
  // Wybierz certyfikat usage=KsefTokenEncryption z najpóźniejszym validFrom
  const certsRes = await kfetch(`${base}/security/public-key-certificates`, { method: 'GET' })
  const certs: any[] = Array.isArray(certsRes)
    ? certsRes
    : (certsRes?.certificates ?? certsRes?.data ?? certsRes?.items ?? [])

  const encCert = certs
    .filter((c: any) => {
      const u = c?.usage
      return Array.isArray(u) ? u.includes('KsefTokenEncryption') : u === 'KsefTokenEncryption'
    })
    .sort((a: any, b: any) =>
      new Date(b.validFrom ?? 0).getTime() - new Date(a.validFrom ?? 0).getTime(),
    )[0]

  if (!encCert) {
    throw new Error(
      `Brak certyfikatu KsefTokenEncryption w /security/public-key-certificates. ` +
      `Odpowiedź: ${JSON.stringify(certsRes).slice(0, 400)}`,
    )
  }

  // ── Krok 3: szyfrowanie tokena RSA-OAEP SHA-256 ───────────────────────────
  // Format: "{ksefToken}|{timestampMs}" → szyfrowanie → Base64
  const { X509Certificate, publicEncrypt, constants: C } = await import('crypto')

  const certDer = Buffer.from(encCert.certificate, 'base64')
  const x509 = new X509Certificate(certDer)
  const encryptedBuf = publicEncrypt(
    {
      key: x509.publicKey,
      padding: C.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(`${token}|${timestampMs}`, 'utf8'),
  )
  const encryptedToken = encryptedBuf.toString('base64')

  // ── Krok 4: POST /auth/ksef-token ─────────────────────────────────────────
  // Wysyłamy zaszyfrowany token + NIP + challenge + publicKeyId
  // contextIdentifier.type: "Nip" (string enum, nie integer!)
  const ksefTokenRes = await kfetch(`${base}/auth/ksef-token`, {
    method: 'POST',
    body: JSON.stringify({
      challenge,
      contextIdentifier: { type: 'Nip', value: nip },
      encryptedToken,
      publicKeyId: encCert.publicKeyId,
    }),
  })

  // Odpowiedź: {authenticationToken: {token: "JWT"}, referenceNumber: "..."}
  const authJwt: string =
    ksefTokenRes?.authenticationToken?.token ??
    ksefTokenRes?.authentication_token?.token ??
    ksefTokenRes?.authToken?.token

  const refNum: string =
    ksefTokenRes?.referenceNumber ??
    ksefTokenRes?.sessionToken?.referenceNumber

  if (!authJwt) {
    throw new Error(
      `Brak authenticationToken w odpowiedzi /auth/ksef-token. ` +
      `Odpowiedź: ${JSON.stringify(ksefTokenRes).slice(0, 500)}`,
    )
  }

  // ── Krok 5: poll GET /auth/{referenceNumber} ──────────────────────────────
  // Uwierzytelnianie jest asynchroniczne — odpytujemy do skutku.
  // Endpoint: GET /auth/{referenceNumber} + Authorization: Bearer {authenticationToken}
  if (refNum) {
    for (let i = 0; i < 15; i++) {
      try {
        const statusRes = await kfetch(`${base}/auth/${encodeURIComponent(refNum)}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${authJwt}` },
        })
        const code = String(statusRes?.processingCode ?? statusRes?.status ?? statusRes?.code ?? '')
        const codeLower = code.toLowerCase()
        // Zakończ poll gdy status wskazuje sukces lub nieznany (nie Processing/Pending)
        if (codeLower !== 'processing' && codeLower !== 'pending' && code !== '202') break
      } catch {
        // Poll może na początku zwrócić błąd — kontynuuj
        if (i >= 5) break
      }
      await new Promise(r => setTimeout(r, 1500))
    }
  }

  // ── Krok 6: POST /auth/token/redeem → {accessToken, refreshToken} ─────────
  // Wymień jednorazowo authenticationToken na docelowy accessToken JWT.
  // Authorization: Bearer {authenticationToken.token}
  const redeemRes = await kfetch(`${base}/auth/token/redeem`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authJwt}` },
    // brak body — autentykacja przez header
  })

  // accessToken może być obiektem {token:"JWT", expirationTime:"..."} — jak authenticationToken w kroku 4
  const rawAccess = redeemRes?.accessToken ?? redeemRes?.access_token ?? redeemRes?.token
  const accessToken: string =
    (typeof rawAccess === 'object' ? rawAccess?.token : rawAccess) ??
    redeemRes?.sessionToken?.token ?? ''

  const rawRefresh = redeemRes?.refreshToken ?? redeemRes?.refresh_token
  const refreshToken: string =
    (typeof rawRefresh === 'object' ? rawRefresh?.token : rawRefresh) ?? ''

  const expiresAt: string =
    (typeof rawAccess === 'object' ? rawAccess?.expirationTime : null) ??
    redeemRes?.expiresAt ?? redeemRes?.tokenExpiresAt ?? ''

  if (!accessToken) {
    throw new Error(
      `Brak accessToken w odpowiedzi POST /auth/token/redeem. ` +
      `Odpowiedź: ${JSON.stringify(redeemRes).slice(0, 500)}`,
    )
  }

  return { accessToken, refreshToken, expiresAt }
}

// ── Pobieranie faktur ─────────────────────────────────────────────────────────

/**
 * Pobieranie metadanych faktur (stronicowanie).
 *
 * Dokumentacja oficjalna MF: POST /invoices/query/metadata
 *   - subjectType: "Subject2" = nabywca (my jesteśmy odbiorcą faktury)
 *   - dateRange.dateType: "Issue" = data wystawienia
 *   - pageOffset / pageSize = query params (nie body!)
 *
 * Nie używamy /invoices/exports (wymaga szyfrowania AES + ZIP).
 */
export async function ksefQueryInvoices(
  accessToken: string,
  env: KsefEnvironment,
  dateFrom: Date,
  dateTo: Date,
): Promise<KsefInvoiceHeader[]> {
  const base = BASE[env]
  const results: KsefInvoiceHeader[] = []
  const PAGE_SIZE = 100

  // KSeF v2 — struktura potwierdzona: dateRange na poziomie głównym (nie w filters)
  // Format daty: YYYY-MM-DD (nie ISO datetime)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const body = {
    subjectType: 'Subject2',   // Subject2 = nabywca (odbiorca faktury)
    dateRange: {
      from: fmt(dateFrom),
      to:   fmt(dateTo),
      dateType: 'Issue',       // data wystawienia faktury
    },
  }

  let pageOffset = 0
  let totalCount: number | null = null

  do {
    const res = await kfetch(
      `${base}/invoices/query/metadata?pageOffset=${pageOffset}&pageSize=${PAGE_SIZE}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      },
    )

    // Odpowiedź: {hasMore, isTruncated, invoices: [...]}
    const invoices: any[] = res?.invoices ?? res?.data?.invoices ?? res?.data?.items ?? res?.items ?? []
    const total: number = res?.totalCount ?? res?.data?.totalCount ?? res?.total ?? invoices.length

    if (totalCount === null) totalCount = total

    for (const inv of invoices) {
      results.push(mapInvoiceHeader(inv))
    }

    pageOffset += PAGE_SIZE
    // API zwraca hasMore:true jeśli jest kolejna strona
    if (!res?.hasMore) break
    if (invoices.length < PAGE_SIZE) break  // ostatnia strona
    if (pageOffset > 5000) break            // bezpiecznik anty-loop
  } while (true)

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

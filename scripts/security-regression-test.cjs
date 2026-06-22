// Regression test harness for the security audit fixes (commit b9aeb69 and earlier).
// Loads the REAL production server-action files (TypeScript, transpiled on the fly
// with the `typescript` package already in node_modules — no extra dependencies,
// no network access needed) and calls them with a mocked auth/DB layer, so we
// actually exercise the real guard logic instead of re-implementing it.
//
// Run: node scripts/security-regression-test.cjs

const path = require('path')
const Module = require('module')
const ts = require('typescript')

const ROOT = path.resolve(__dirname, '..')

// ── Mutable mock state — tests reconfigure this between calls ──────────────
const mockState = {
  authError: null,
  user: { id: 'caller-id', email: 'caller@example.com' },
  profile: { id: 'caller-id', role: 'najemca', community_id: 'comm-A', full_name: 'Test Caller' },
  // Per-table canned response for the NEXT terminal call (.single()/.maybeSingle()/await on builder)
  dbResponses: {}, // { tableName: { data, error } }
  dbCalls: [], // [{table, calls: [['eq', ['community_id', 'x']], ...]}]
}

function resetMock({ profile, dbResponses } = {}) {
  mockState.profile = profile ?? mockState.profile
  mockState.dbResponses = dbResponses ?? {}
  mockState.dbCalls = []
}

// Generic chainable query-builder mock. Every chained method records the call
// and returns `this`; awaiting/`.then`-ing it (or calling `.single()`/`.maybeSingle()`)
// resolves to the canned response configured for that table.
function makeQueryBuilder(table) {
  const record = { table, calls: [] }
  mockState.dbCalls.push(record)
  const resolveValue = () => mockState.dbResponses[table] ?? { data: null, error: null }
  const builder = {
    select: (...a) => { record.calls.push(['select', a]); return builder },
    eq: (...a) => { record.calls.push(['eq', a]); return builder },
    in: (...a) => { record.calls.push(['in', a]); return builder },
    not: (...a) => { record.calls.push(['not', a]); return builder },
    order: (...a) => { record.calls.push(['order', a]); return builder },
    limit: (...a) => { record.calls.push(['limit', a]); return builder },
    insert: (...a) => { record.calls.push(['insert', a]); return builder },
    update: (...a) => { record.calls.push(['update', a]); return builder },
    delete: (...a) => { record.calls.push(['delete', a]); return builder },
    single: async () => resolveValue(),
    maybeSingle: async () => resolveValue(),
    then: (resolve) => resolve(resolveValue()),
  }
  return builder
}

const fakeAdminClient = {
  from: (table) => makeQueryBuilder(table),
  storage: { from: () => ({ upload: async () => ({ data: { path: 'x' }, error: null }) }) },
}

// ── Virtual modules (replace real side-effecting imports) ──────────────────
const virtualModules = {
  '@/lib/getAuthProfile': {
    getAuthProfileAction: async () => ({
      error: mockState.authError,
      user: mockState.user,
      profile: mockState.profile,
    }),
  },
  '@/lib/supabase/server': {
    getSupabaseAdminClient: () => fakeAdminClient,
    getSupabaseServerClient: async () => ({
      auth: { getUser: async () => ({ data: { user: mockState.user } }) },
      from: (table) => makeQueryBuilder(table),
    }),
  },
  'next/cache': { revalidatePath: () => {} },
  '@/lib/audit': { logActivity: async () => {} },
  '@/lib/email': {
    sendAccountApprovedEmail: async () => {},
    sendInvitationEmail: async () => {},
    sendCustomEmail: async () => {},
    sendNewVoteEmail: async () => {},
    sendVoteClosedEmail: async () => {},
    sendVoteReminderEmail: async () => {},
  },
  '@/lib/pin': { verifyPin: async () => true },
}

// ── require() hooks: resolve "@/..." to repo root, intercept virtual modules,
//    transpile .ts on the fly via the TypeScript compiler API ────────────────
const origResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...rest) {
  if (virtualModules[request]) return request
  if (request.startsWith('@/')) {
    const resolved = path.join(ROOT, request.slice(2))
    return origResolve.call(this, resolved, ...rest)
  }
  return origResolve.call(this, request, ...rest)
}

const origLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (virtualModules[request]) return virtualModules[request]
  return origLoad.call(this, request, parent, isMain)
}

require.extensions['.ts'] = function (module, filename) {
  const source = require('fs').readFileSync(filename, 'utf8')
  const out = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  })
  module._compile(out.outputText, filename)
}

function loadAction(relPath) {
  const full = path.join(ROOT, relPath)
  delete require.cache[require.resolve(full)]
  return require(full)
}

// ── Test runner ───────────────────────────────────────────────────────────
let pass = 0, fail = 0
async function check(name, fn) {
  try {
    await fn()
    pass++
    console.log(`  \x1b[32m✓\x1b[0m ${name}`)
  } catch (e) {
    fail++
    console.log(`  \x1b[31m✗ ${name}\x1b[0m`)
    console.log(`    ${e.message}`)
  }
}
function assertBlocked(result, label) {
  const blocked = result && (result.error || result.errors)
  if (!blocked) throw new Error(`${label} — oczekiwano odmowy, dostałem: ${JSON.stringify(result)}`)
}
function assertOk(result, label) {
  if (result && result.error) throw new Error(`${label} — oczekiwano sukcesu, dostałem błąd: ${result.error}`)
}

async function main() {
  console.log('\n=== 1. Systemowy błąd: rola "najemca" miała uprawnienia admina ===\n')

  resetMock({ profile: { id: 'u1', role: 'najemca', community_id: 'comm-A', full_name: 'Tenant' } })
  await check('koszty/addExpense — najemca blokowany', async () => {
    const { addExpense } = loadAction('app/admin/finanse/koszty/actions.ts')
    const res = await addExpense({ community_id: 'comm-A', category: 'inne', description: 'x', amount: 10, expense_date: '2026-01-01' })
    assertBlocked(res, 'addExpense')
  })

  resetMock({ profile: { id: 'u1', role: 'najemca', community_id: 'comm-A', full_name: 'Tenant' } })
  await check('koszty/bulkDeleteExpenses — najemca blokowany', async () => {
    const { bulkDeleteExpenses } = loadAction('app/admin/finanse/koszty/actions.ts')
    const res = await bulkDeleteExpenses(['e1', 'e2'])
    assertBlocked(res, 'bulkDeleteExpenses')
  })

  resetMock({ profile: { id: 'u1', role: 'najemca', community_id: 'comm-A', full_name: 'Tenant' } })
  await check('votes/createVote — najemca blokowany (nie może tworzyć uchwał)', async () => {
    const { createVote } = loadAction('app/admin/votes/actions.ts')
    const res = await createVote({ title: 'x', voting_method: 'by_share', community_id: 'comm-A' })
    assertBlocked(res, 'createVote')
  })

  resetMock({
    profile: { id: 'u1', role: 'najemca', community_id: 'comm-A', full_name: 'Tenant' },
    dbResponses: { profiles: { data: { voting_pin_hash: 'hash' }, error: null } },
  })
  await check('votes/castVote — najemca nie ma prawa głosu (UoWL: głos = właściciel)', async () => {
    const { castVote } = loadAction('app/admin/votes/actions.ts')
    const res = await castVote({ vote_id: 'v1', choice: 'yes', pin: '1234' })
    assertBlocked(res, 'castVote')
  })

  resetMock({ profile: { id: 'u1', role: 'najemca', community_id: 'comm-A', full_name: 'Tenant' } })
  await check('users/approveUser — najemca nie może zarządzać użytkownikami', async () => {
    const { approveUser } = loadAction('app/admin/users/actions.ts')
    const res = await approveUser('target-user', 'comm-A', null)
    assertBlocked(res, 'approveUser')
  })

  resetMock({ profile: { id: 'u1', role: 'najemca', community_id: 'comm-A', full_name: 'Tenant' } })
  await check('documents/uploadDocument — najemca blokowany', async () => {
    const { uploadDocument } = loadAction('app/admin/documents/actions.ts')
    const fd = new FormData()
    fd.set('file', new Blob(['x']), 'x.pdf')
    await uploadDocument(fd).then(() => { throw new Error('nie powinno się udać') }, () => {})
  })

  resetMock({ profile: { id: 'u1', role: 'najemca', community_id: 'comm-A', full_name: 'Tenant' } })
  await check('board/togglePin — najemca blokowany', async () => {
    const { togglePin } = loadAction('app/admin/board/actions.ts')
    const res = await togglePin('post1', false)
    assertBlocked(res, 'togglePin')
  })

  resetMock({ profile: { id: 'u1', role: 'najemca', community_id: 'comm-A', full_name: 'Tenant' } })
  await check('wnioski/deleteRequest — najemca blokowany', async () => {
    const { deleteRequest } = loadAction('app/admin/wnioski/actions.ts')
    const res = await deleteRequest('req1')
    assertBlocked(res, 'deleteRequest')
  })

  resetMock({ profile: { id: 'u1', role: 'najemca', community_id: 'comm-A', full_name: 'Tenant' } })
  await check('przychody/addIncome — najemca blokowany', async () => {
    const { addIncome } = loadAction('app/admin/finanse/przychody/actions.ts')
    const res = await addIncome({ community_id: 'comm-A', category: 'inne', description: 'x', amount: 10, income_date: '2026-01-01' })
    assertBlocked(res, 'addIncome')
  })

  resetMock({ profile: { id: 'u1', role: 'najemca', community_id: 'comm-A', full_name: 'Tenant' } })
  await check('przychody/getIncomeList — najemca dostaje pustą listę (wcześniej: brak autoryzacji w ogóle)', async () => {
    const { getIncomeList } = loadAction('app/admin/finanse/przychody/actions.ts')
    const res = await getIncomeList('comm-B')
    if (!Array.isArray(res) || res.length !== 0) throw new Error(`oczekiwano [], dostałem ${JSON.stringify(res)}`)
  })

  console.log('\n=== 2. IDOR — dostęp do danych innej wspólnoty ===\n')

  // createReply: admin z comm-A próbuje odpowiedzieć na post z comm-B
  resetMock({
    profile: { id: 'u2', role: 'admin', community_id: 'comm-A', full_name: 'Admin A' },
    dbResponses: { board_posts: { data: { community_id: 'comm-B' }, error: null } },
  })
  await check('board/createReply — admin nie może odpowiadać na posty innej wspólnoty', async () => {
    const { createReply } = loadAction('app/admin/board/actions.ts')
    const res = await createReply('post-in-comm-B', 'treść odpowiedzi')
    assertBlocked(res, 'createReply')
  })

  // createPost: admin z comm-A podaje communityId = comm-B
  resetMock({ profile: { id: 'u2', role: 'admin', community_id: 'comm-A', full_name: 'Admin A' } })
  await check('board/createPost — admin nie może pisać na tablicę innej wspólnoty (ignorujemy podany communityId)', async () => {
    const { createPost } = loadAction('app/admin/board/actions.ts')
    await createPost('treść posta testowego', 'comm-B')
    const insertCall = mockState.dbCalls.find(c => c.table === 'board_posts')
    const insertArgs = insertCall.calls.find(c => c[0] === 'insert')
    const inserted = insertArgs[1][0]
    if (inserted.community_id !== 'comm-A') throw new Error(`post zapisany do ${inserted.community_id}, oczekiwano comm-A (własnej wspólnoty admina)`)
  })

  // approveUser: admin przypisuje mieszkanie z INNEJ wspólnoty
  resetMock({
    profile: { id: 'u2', role: 'admin', community_id: 'comm-A', full_name: 'Admin A' },
    dbResponses: { settlement_apartments: { data: { community_id: 'comm-B' }, error: null } },
  })
  await check('users/approveUser — admin nie może przypisać mieszkania z innej wspólnoty', async () => {
    const { approveUser } = loadAction('app/admin/users/actions.ts')
    const res = await approveUser('target-user', 'comm-A', 'apt-in-comm-B')
    assertBlocked(res, 'approveUser (apartment IDOR)')
  })

  // getResidentsForMessage: admin z comm-A podaje communityId = comm-B
  resetMock({ profile: { id: 'u2', role: 'admin', community_id: 'comm-A', full_name: 'Admin A' } })
  await check('messages/getResidentsForMessage — admin dostaje listę swojej wspólnoty, nie podanej cudzej', async () => {
    const { getResidentsForMessage } = loadAction('app/admin/messages/actions.ts')
    await getResidentsForMessage('comm-B')
    const queryCall = mockState.dbCalls.find(c => c.table === 'profiles')
    const eqCommunity = queryCall.calls.find(c => c[0] === 'eq' && c[1][0] === 'community_id')
    if (eqCommunity[1][1] !== 'comm-A') throw new Error(`zapytanie filtrowało po ${eqCommunity[1][1]}, oczekiwano comm-A`)
  })

  console.log(`\n${pass} przeszło, ${fail} nie przeszło.\n`)
  if (fail > 0) process.exit(1)
}

main()

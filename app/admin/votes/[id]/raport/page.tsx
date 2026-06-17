import { notFound } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'

interface Props { params: Promise<{ id: string }> }

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateTime(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function RaportPage({ params }: Props) {
  const { id } = await params
  const { profile } = await getAuthProfile()
  const admin = getSupabaseAdminClient()

  const { data: vote } = await admin
    .from('votes')
    .select(`
      id, title, description, status, voting_method, created_at, closed_at, deadline,
      resolution_number, community_id,
      community:communities(name, address),
      choices:vote_choices(
        id, choice, share_value, created_at,
        apartment_id,
        user_id,
        profile:profiles(full_name, email)
      )
    `)
    .eq('id', id)
    .single()

  if (!vote) notFound()

  // Sprawdź dostęp
  if (profile.role === 'admin' && profile.community_id !== vote.community_id) notFound()
  if (profile.role === 'user') notFound()

  // Pobierz wszystkie aktywne lokale wspólnoty
  const { data: apartments } = await admin
    .from('settlement_apartments')
    .select('id, apartment_number, share_numerator, share_denominator')
    .eq('community_id', vote.community_id)
    .eq('active', true)
    .order('apartment_number')

  const communityName = (vote.community as any)?.name ?? 'Wspólnota'
  const communityAddress = (vote.community as any)?.address ?? ''
  const year = new Date(vote.created_at).getFullYear()
  const resolutionNumber = vote.resolution_number ? `${vote.resolution_number}/${year}` : '—'

  // Oblicz wyniki
  const byShare = vote.voting_method === 'by_share'
  const choices = (vote.choices ?? []) as any[]

  const yes = choices.filter(c => c.choice === 'yes').reduce((s: number, c: any) => s + (byShare ? c.share_value : 1), 0)
  const no  = choices.filter(c => c.choice === 'no').reduce((s: number, c: any) => s + (byShare ? c.share_value : 1), 0)
  const ab  = choices.filter(c => c.choice === 'abstain').reduce((s: number, c: any) => s + (byShare ? c.share_value : 1), 0)
  const total = yes + no + ab
  const pct = (v: number) => total > 0 ? (v / total * 100).toFixed(2) : '0.00'
  const passed = yes > total / 2

  // Mapuj głosy per lokal
  const choiceByApt: Record<string, any> = {}
  for (const c of choices) {
    if (c.apartment_id) choiceByApt[c.apartment_id] = c
  }

  const totalApts = apartments?.length ?? 0
  const votedApts = new Set(choices.map((c: any) => c.apartment_id).filter(Boolean)).size
  const frekwencja = totalApts > 0 ? (votedApts / totalApts * 100).toFixed(1) : '0.0'

  const choiceLabel: Record<string, string> = { yes: 'ZA', no: 'PRZECIW', abstain: 'WSTRZYMUJĘ SIĘ' }

  return (
    <html lang="pl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Protokół głosowania — {vote.title}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Georgia', serif; font-size: 11pt; color: #1a1a1a; background: white; }
          .page { max-width: 210mm; margin: 0 auto; padding: 20mm 20mm 25mm; }
          h1 { font-size: 16pt; font-weight: bold; margin-bottom: 4pt; }
          h2 { font-size: 12pt; font-weight: bold; margin: 16pt 0 6pt; border-bottom: 1px solid #aaa; padding-bottom: 3pt; }
          h3 { font-size: 11pt; font-weight: bold; margin: 12pt 0 4pt; }
          p { margin-bottom: 4pt; line-height: 1.5; }
          .header { border-bottom: 2px solid #1a1a1a; padding-bottom: 12pt; margin-bottom: 14pt; }
          .community { font-size: 10pt; color: #555; }
          .resolution-num { font-size: 14pt; font-weight: bold; color: #166534; margin-bottom: 4pt; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6pt; font-size: 10pt; margin-bottom: 12pt; }
          .meta-grid dt { color: #555; }
          .meta-grid dd { font-weight: 600; }
          .results-box { border: 1px solid #ccc; border-radius: 4pt; padding: 10pt 14pt; margin: 10pt 0; }
          .result-row { display: flex; align-items: center; gap: 8pt; margin-bottom: 6pt; }
          .result-label { width: 140pt; font-size: 10pt; }
          .bar-bg { flex: 1; height: 8pt; background: #e5e7eb; border-radius: 4pt; }
          .bar-fill { height: 8pt; border-radius: 4pt; }
          .bar-yes { background: #16a34a; }
          .bar-no  { background: #dc2626; }
          .bar-ab  { background: #9ca3af; }
          .result-pct { width: 50pt; text-align: right; font-weight: bold; font-size: 10pt; }
          .verdict { font-size: 13pt; font-weight: bold; margin-top: 8pt; padding: 6pt 10pt; border-radius: 4pt; display: inline-block; }
          .verdict-pass { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
          .verdict-fail { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
          table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 6pt; }
          th { background: #f3f4f6; border: 1px solid #d1d5db; padding: 4pt 6pt; text-align: left; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.3pt; }
          td { border: 1px solid #e5e7eb; padding: 4pt 6pt; vertical-align: top; }
          tr:nth-child(even) td { background: #fafafa; }
          .badge-yes { background: #dcfce7; color: #166534; font-weight: bold; padding: 1pt 4pt; border-radius: 2pt; }
          .badge-no  { background: #fee2e2; color: #991b1b; font-weight: bold; padding: 1pt 4pt; border-radius: 2pt; }
          .badge-ab  { background: #f3f4f6; color: #6b7280; font-weight: bold; padding: 1pt 4pt; border-radius: 2pt; }
          .badge-none { color: #9ca3af; font-style: italic; }
          .stats { display: flex; gap: 12pt; margin-bottom: 10pt; font-size: 10pt; }
          .stat { border: 1px solid #e5e7eb; border-radius: 4pt; padding: 5pt 10pt; }
          .stat-val { font-size: 14pt; font-weight: bold; color: #166534; }
          .stat-lbl { color: #6b7280; font-size: 9pt; }
          .signatures { margin-top: 40pt; display: grid; grid-template-columns: 1fr 1fr; gap: 40pt; }
          .sig-line { border-top: 1px solid #333; margin-top: 30pt; padding-top: 4pt; font-size: 9pt; color: #555; text-align: center; }
          .footer { margin-top: 20pt; font-size: 8pt; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 6pt; }
          .description-box { background: #f9fafb; border-left: 3pt solid #e5e7eb; padding: 6pt 10pt; font-size: 10pt; margin: 8pt 0; line-height: 1.6; }
          @media print {
            .no-print { display: none !important; }
            body { font-size: 10pt; }
            .page { padding: 10mm 15mm 15mm; max-width: none; }
            a { color: inherit; text-decoration: none; }
          }
          @media screen {
            body { background: #f3f4f6; }
            .page { box-shadow: 0 2px 12px rgba(0,0,0,.12); background: white; margin: 24pt auto; }
          }
        `}</style>
      </head>
      <body>
        {/* Toolbar (tylko ekran) */}
        <div className="no-print" style={{ background: '#166534', color: 'white', padding: '10pt 20pt', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
          <span style={{ fontFamily: 'sans-serif', fontSize: '11pt', fontWeight: 600 }}>📄 Protokół głosowania</span>
          <div style={{ display: 'flex', gap: '10pt' }}>
            <button
              onClick={() => window.print()}
              style={{ background: 'white', color: '#166534', border: 'none', padding: '5pt 14pt', borderRadius: '4pt', fontWeight: 700, cursor: 'pointer', fontFamily: 'sans-serif', fontSize: '10pt' }}
            >
              🖨 Drukuj / Zapisz PDF
            </button>
            <a href={`/admin/votes`} style={{ color: 'white', fontFamily: 'sans-serif', fontSize: '10pt', padding: '5pt 0', textDecoration: 'none' }}>
              ← Wróć
            </a>
          </div>
        </div>

        <div className="page">
          {/* Nagłówek */}
          <div className="header">
            <div className="community">{communityName}{communityAddress ? ` · ${communityAddress}` : ''}</div>
            <div className="resolution-num" style={{ marginTop: '6pt' }}>Uchwała nr {resolutionNumber}</div>
            <h1>{vote.title}</h1>
          </div>

          {/* Metadane */}
          <dl className="meta-grid">
            <dt>Data podjęcia:</dt>
            <dd>{fmtDate(vote.created_at)}</dd>
            <dt>Termin głosowania:</dt>
            <dd>{vote.deadline ? fmtDateTime(vote.deadline) : 'bez terminu'}</dd>
            <dt>Data zamknięcia:</dt>
            <dd>{vote.closed_at ? fmtDate(vote.closed_at) : (vote.status === 'open' ? 'otwarte' : '—')}</dd>
            <dt>Metoda głosowania:</dt>
            <dd>{vote.voting_method === 'by_share' ? 'Według udziałów (art. 23 UWL)' : '1 lokal = 1 głos'}</dd>
          </dl>

          {/* Opis uchwały */}
          {vote.description && (
            <>
              <h2>Treść uchwały</h2>
              <div className="description-box">{vote.description}</div>
            </>
          )}

          {/* Wyniki */}
          <h2>Wyniki głosowania</h2>
          <div className="stats">
            <div className="stat">
              <div className="stat-val">{votedApts}</div>
              <div className="stat-lbl">lokali zagłosowało</div>
            </div>
            <div className="stat">
              <div className="stat-val">{totalApts}</div>
              <div className="stat-lbl">lokali łącznie</div>
            </div>
            <div className="stat">
              <div className="stat-val">{frekwencja}%</div>
              <div className="stat-lbl">frekwencja</div>
            </div>
            <div className="stat">
              <div className="stat-val">{byShare ? `${(total * 100).toFixed(2)}%` : total}</div>
              <div className="stat-lbl">{byShare ? 'udział w głosowaniu' : 'głosów'}</div>
            </div>
          </div>

          <div className="results-box">
            {[
              { label: 'ZA', value: yes, cls: 'bar-yes' },
              { label: 'PRZECIW', value: no, cls: 'bar-no' },
              { label: 'WSTRZYMAŁO SIĘ', value: ab, cls: 'bar-ab' },
            ].map(r => (
              <div key={r.label} className="result-row">
                <div className="result-label">{r.label}</div>
                <div className="bar-bg">
                  <div className={`bar-fill ${r.cls}`} style={{ width: `${pct(r.value)}%` }} />
                </div>
                <div className="result-pct">
                  {pct(r.value)}%
                  {byShare && <span style={{ fontSize: '8pt', fontWeight: 'normal', marginLeft: '3pt', color: '#6b7280' }}>({(r.value * 100).toFixed(2)}%)</span>}
                </div>
              </div>
            ))}
          </div>

          {vote.status === 'closed' && (
            <div>
              <span className={`verdict ${passed ? 'verdict-pass' : 'verdict-fail'}`}>
                {passed ? '✓ Uchwała PRZYJĘTA' : '✗ Uchwała ODRZUCONA'}
              </span>
            </div>
          )}

          {/* Tabela głosowania */}
          <h2>Szczegóły głosowania według lokali</h2>
          <table>
            <thead>
              <tr>
                <th>Lokal</th>
                <th>Udział (%)</th>
                <th>Głos</th>
                <th>Data głosowania</th>
                <th>Głosujący</th>
              </tr>
            </thead>
            <tbody>
              {apartments?.map(apt => {
                const c = choiceByApt[apt.id]
                const share = apt.share_numerator && apt.share_denominator
                  ? `${(apt.share_numerator / apt.share_denominator * 100).toFixed(4)}%`
                  : '—'
                const voterName = c?.profile?.full_name ?? c?.profile?.email ?? '—'
                return (
                  <tr key={apt.id}>
                    <td><strong>{apt.apartment_number}</strong></td>
                    <td style={{ fontFamily: 'monospace' }}>{share}</td>
                    <td>
                      {c ? (
                        <span className={`badge-${c.choice}`}>{choiceLabel[c.choice]}</span>
                      ) : (
                        <span className="badge-none">brak głosu</span>
                      )}
                    </td>
                    <td style={{ fontSize: '8.5pt', color: '#6b7280' }}>{c ? fmtDateTime(c.created_at) : '—'}</td>
                    <td style={{ fontSize: '8.5pt' }}>{c ? voterName : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Podpisy */}
          <div className="signatures">
            <div>
              <p style={{ fontSize: '10pt' }}>Zarząd Wspólnoty Mieszkaniowej</p>
              <div className="sig-line">Podpis i pieczątka</div>
            </div>
            <div>
              <p style={{ fontSize: '10pt' }}>Osoba sporządzająca protokół</p>
              <div className="sig-line">Podpis i data</div>
            </div>
          </div>

          <div className="footer">
            Dokument wygenerowany automatycznie przez System Zarządzania Wspólnotą · {communityName} · {new Date().toLocaleDateString('pl-PL')}
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: `
          // Auto-print opcjonalnie — zakomentowane, użytkownik klika przycisk
          // window.onload = () => window.print();
        ` }} />
      </body>
    </html>
  )
}

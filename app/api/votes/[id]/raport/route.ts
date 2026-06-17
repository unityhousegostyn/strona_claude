import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthProfileAction } from '@/lib/getAuthProfile'

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtDateTime(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const auth = await getAuthProfileAction()
  if (auth.error !== null) return NextResponse.redirect(new URL('/login', request.url))
  const { profile } = auth

  if (profile.role === 'user') return new NextResponse('Brak uprawnień', { status: 403 })

  const admin = getSupabaseAdminClient()

  const { data: vote, error: voteErr } = await admin
    .from('votes')
    .select(`
      id, title, description, status, voting_method, created_at, closed_at, deadline,
      resolution_number, community_id,
      community:communities(name, address),
      choices:vote_choices(id, choice, share_value, apartment_id, user_id)
    `)
    .eq('id', id)
    .single()

  if (!vote) return new NextResponse(`Nie znaleziono uchwały (${voteErr?.message ?? ''})`, { status: 404 })
  if (profile.role === 'admin' && profile.community_id !== vote.community_id)
    return new NextResponse('Brak uprawnień', { status: 403 })

  // Pobierz profile głosujących osobno (embedded join profile:profiles psuje zapytanie)
  const choices = (vote.choices ?? []) as any[]
  const voterIds = [...new Set(choices.map((c: any) => c.user_id).filter(Boolean))]
  let profileMap: Record<string, { full_name: string | null; email: string | null }> = {}
  if (voterIds.length > 0) {
    const { data: profilesData } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', voterIds)
    for (const p of profilesData ?? []) { profileMap[p.id] = p }
  }

  // Pobierz lokale — najpierw przez community_id, fallback przez IDs z głosów
  let { data: apartments, error: aptErr } = await admin
    .from('settlement_apartments')
    .select('id, number, share_numerator, share_denominator, active')
    .eq('community_id', vote.community_id)
    .order('number')

  // Fallback: jeśli brak lokali per community, pobierz przez apartment_id z głosów
  const aptIdsFromChoices = [...new Set(choices.map((c: any) => c.apartment_id).filter(Boolean))] as string[]
  if ((!apartments || apartments.length === 0) && aptIdsFromChoices.length > 0) {
    const { data: aptByIds } = await admin
      .from('settlement_apartments')
      .select('id, number, share_numerator, share_denominator, active, community_id')
      .in('id', aptIdsFromChoices)
      .order('number')
    apartments = aptByIds
  }

  const communityRaw = vote.community as any
  const community = Array.isArray(communityRaw) ? communityRaw[0] : communityRaw
  const communityName = community?.name ?? 'Wspólnota'
  const communityAddress = community?.address ?? ''
  const year = new Date(vote.created_at).getFullYear()
  const resolutionNumber = vote.resolution_number ? `${vote.resolution_number}/${year}` : '—'

  const byShare = vote.voting_method === 'by_share'
  const yes = choices.filter(c => c.choice === 'yes').reduce((s: number, c: any) => s + (byShare ? c.share_value : 1), 0)
  const no  = choices.filter(c => c.choice === 'no').reduce((s: number, c: any) => s + (byShare ? c.share_value : 1), 0)
  const ab  = choices.filter(c => c.choice === 'abstain').reduce((s: number, c: any) => s + (byShare ? c.share_value : 1), 0)
  const total = yes + no + ab
  const pct = (v: number) => total > 0 ? (v / total * 100).toFixed(2) : '0.00'
  const passed = yes > total / 2

  const choiceByApt: Record<string, any> = {}
  for (const c of choices) {
    if (c.apartment_id) choiceByApt[c.apartment_id] = c
  }

  const totalApts = apartments?.length ?? 0
  const votedApts = new Set(choices.map((c: any) => c.apartment_id).filter(Boolean)).size
  const frekwencja = totalApts > 0 ? (votedApts / totalApts * 100).toFixed(1) : '0.0'
  const choiceLabel: Record<string, string> = { yes: 'ZA', no: 'PRZECIW', abstain: 'WSTRZYMUJĘ SIĘ' }

  const aptRows = (apartments ?? []).map(apt => {
    const c = choiceByApt[apt.id]
    const share = apt.share_numerator && apt.share_denominator
      ? `${(apt.share_numerator / apt.share_denominator * 100).toFixed(4)}%`
      : '—'
    const p = c ? profileMap[c.user_id] : null
    const voterName = p?.full_name ?? p?.email ?? '—'
    const badgeStyle = c
      ? c.choice === 'yes'
        ? 'background:#dcfce7;color:#166534;font-weight:bold;padding:1pt 5pt;border-radius:3pt'
        : c.choice === 'no'
        ? 'background:#fee2e2;color:#991b1b;font-weight:bold;padding:1pt 5pt;border-radius:3pt'
        : 'background:#f3f4f6;color:#6b7280;font-weight:bold;padding:1pt 5pt;border-radius:3pt'
      : ''
    const badgeText = c ? choiceLabel[c.choice] : '<span style="color:#9ca3af;font-style:italic">brak głosu</span>'
    const inactive = !(apt as any).active
    return `<tr style="${inactive ? 'opacity:0.5' : ''}">
      <td><strong>${apt.number}</strong>${inactive ? ' <span style="font-size:8pt;color:#9ca3af">(nieaktywny)</span>' : ''}</td>
      <td style="font-family:monospace">${share}</td>
      <td>${c ? `<span style="${badgeStyle}">${choiceLabel[c.choice]}</span>` : '<span style="color:#9ca3af;font-style:italic">brak głosu</span>'}</td>
      <td style="font-size:8.5pt;color:#6b7280">—</td>
      <td style="font-size:8.5pt">${c ? voterName : '—'}</td>
    </tr>`
  }).join('')

  const barYes = `<div style="height:8pt;background:#16a34a;border-radius:4pt;width:${pct(yes)}%"></div>`
  const barNo  = `<div style="height:8pt;background:#dc2626;border-radius:4pt;width:${pct(no)}%"></div>`
  const barAb  = `<div style="height:8pt;background:#9ca3af;border-radius:4pt;width:${pct(ab)}%"></div>`

  const verdictStyle = passed
    ? 'background:#dcfce7;color:#166534;border:1px solid #86efac'
    : 'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5'
  const verdictText = passed ? '✓ Uchwała PRZYJĘTA' : '✗ Uchwała ODRZUCONA'

  // DEBUG — tymczasowe
  const debugInfo = JSON.stringify({
    voteId: vote.id,
    communityId: vote.community_id,
    apartmentsCount: apartments?.length ?? 0,
    choicesCount: choices.length,
    aptIdsFromChoices,
    aptErr: aptErr?.message,
    apartments: apartments?.slice(0, 3),
  }, null, 2)

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Protokół — ${vote.title}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Georgia,serif;font-size:11pt;color:#1a1a1a;background:#f3f4f6}
    .page{max-width:210mm;margin:0 auto;padding:20mm 20mm 25mm;background:white;box-shadow:0 2px 12px rgba(0,0,0,.12)}
    h1{font-size:16pt;font-weight:bold;margin-bottom:4pt}
    h2{font-size:12pt;font-weight:bold;margin:16pt 0 6pt;border-bottom:1px solid #aaa;padding-bottom:3pt}
    p{margin-bottom:4pt;line-height:1.5}
    .header{border-bottom:2px solid #1a1a1a;padding-bottom:12pt;margin-bottom:14pt}
    .community{font-size:10pt;color:#555}
    .res-num{font-size:14pt;font-weight:bold;color:#166534;margin-bottom:4pt}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:6pt;font-size:10pt;margin-bottom:12pt}
    .meta dt{color:#555} .meta dd{font-weight:600}
    .results{border:1px solid #ccc;border-radius:4pt;padding:10pt 14pt;margin:10pt 0}
    .rrow{display:flex;align-items:center;gap:8pt;margin-bottom:6pt}
    .rlabel{width:140pt;font-size:10pt}
    .rbg{flex:1;height:8pt;background:#e5e7eb;border-radius:4pt}
    .rpct{width:50pt;text-align:right;font-weight:bold;font-size:10pt}
    .verdict{font-size:13pt;font-weight:bold;margin-top:8pt;padding:6pt 10pt;border-radius:4pt;display:inline-block}
    .stats{display:flex;gap:12pt;margin-bottom:10pt;font-size:10pt;flex-wrap:wrap}
    .stat{border:1px solid #e5e7eb;border-radius:4pt;padding:5pt 10pt}
    .stat-val{font-size:14pt;font-weight:bold;color:#166534}
    .stat-lbl{color:#6b7280;font-size:9pt}
    table{width:100%;border-collapse:collapse;font-size:9.5pt;margin-top:6pt}
    th{background:#f3f4f6;border:1px solid #d1d5db;padding:4pt 6pt;text-align:left;font-size:9pt;text-transform:uppercase;letter-spacing:.3pt}
    td{border:1px solid #e5e7eb;padding:4pt 6pt;vertical-align:top}
    tr:nth-child(even) td{background:#fafafa}
    .desc-box{background:#f9fafb;border-left:3pt solid #e5e7eb;padding:6pt 10pt;font-size:10pt;margin:8pt 0;line-height:1.6}
    .sigs{margin-top:40pt;display:grid;grid-template-columns:1fr 1fr;gap:40pt}
    .sig-line{border-top:1px solid #333;margin-top:30pt;padding-top:4pt;font-size:9pt;color:#555;text-align:center}
    .footer{margin-top:20pt;font-size:8pt;color:#999;text-align:center;border-top:1px solid #eee;padding-top:6pt}
    .toolbar{background:#166534;color:white;padding:10pt 20pt;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10;font-family:sans-serif}
    @media print{.toolbar{display:none!important}.page{box-shadow:none;padding:10mm 15mm;max-width:none}body{background:white}}
  </style>
</head>
<body>
  <div class="toolbar">
    <span style="font-size:11pt;font-weight:600">📄 Protokół głosowania</span>
    <div style="display:flex;gap:12pt;align-items:center">
      <button onclick="window.print()" style="background:white;color:#166534;border:none;padding:5pt 14pt;border-radius:4pt;font-weight:700;cursor:pointer;font-size:10pt">
        🖨 Drukuj / Zapisz PDF
      </button>
      <a href="/admin/votes" style="color:white;text-decoration:none;font-size:10pt">← Wróć</a>
    </div>
  </div>

  <div class="page">
    <div class="header">
      <div class="community">${communityName}${communityAddress ? ' · ' + communityAddress : ''}</div>
      <div class="res-num">Uchwała nr ${resolutionNumber}</div>
      <h1>${vote.title}</h1>
    </div>

    <dl class="meta">
      <dt>Data podjęcia:</dt><dd>${fmtDate(vote.created_at)}</dd>
      <dt>Termin głosowania:</dt><dd>${vote.deadline ? fmtDateTime(vote.deadline) : 'bez terminu'}</dd>
      <dt>Data zamknięcia:</dt><dd>${vote.closed_at ? fmtDate(vote.closed_at) : vote.status === 'open' ? 'otwarte' : '—'}</dd>
      <dt>Metoda głosowania:</dt><dd>${vote.voting_method === 'by_share' ? 'Według udziałów (art. 23 UWL)' : '1 lokal = 1 głos'}</dd>
    </dl>

    ${vote.description ? `<h2>Treść uchwały</h2><div class="desc-box">${vote.description}</div>` : ''}

    <h2>Wyniki głosowania</h2>
    <div class="stats">
      <div class="stat"><div class="stat-val">${votedApts}</div><div class="stat-lbl">lokali zagłosowało</div></div>
      <div class="stat"><div class="stat-val">${totalApts}</div><div class="stat-lbl">lokali łącznie</div></div>
      <div class="stat"><div class="stat-val">${frekwencja}%</div><div class="stat-lbl">frekwencja</div></div>
      <div class="stat"><div class="stat-val">${byShare ? (total * 100).toFixed(2) + '%' : total}</div><div class="stat-lbl">${byShare ? 'udział w głosowaniu' : 'głosów'}</div></div>
    </div>

    <div class="results">
      <div class="rrow"><div class="rlabel">ZA</div><div class="rbg">${barYes}</div><div class="rpct">${pct(yes)}%${byShare ? `<span style="font-size:8pt;font-weight:normal;color:#6b7280"> (${(yes*100).toFixed(2)}%)</span>` : ''}</div></div>
      <div class="rrow"><div class="rlabel">PRZECIW</div><div class="rbg">${barNo}</div><div class="rpct">${pct(no)}%${byShare ? `<span style="font-size:8pt;font-weight:normal;color:#6b7280"> (${(no*100).toFixed(2)}%)</span>` : ''}</div></div>
      <div class="rrow"><div class="rlabel">WSTRZYMAŁO SIĘ</div><div class="rbg">${barAb}</div><div class="rpct">${pct(ab)}%${byShare ? `<span style="font-size:8pt;font-weight:normal;color:#6b7280"> (${(ab*100).toFixed(2)}%)</span>` : ''}</div></div>
    </div>

    ${vote.status === 'closed' ? `<div><span class="verdict" style="${verdictStyle}">${verdictText}</span></div>` : ''}

    <pre style="background:#f3f4f6;padding:8pt;font-size:8pt;border-radius:4pt;margin-bottom:10pt">${debugInfo}</pre>
    <h2>Szczegóły głosowania według lokali</h2>
    <table>
      <thead><tr><th>Lokal</th><th>Udział (%)</th><th>Głos</th><th>Data głosowania</th><th>Głosujący</th></tr></thead>
      <tbody>${aptRows}</tbody>
    </table>

    <div class="sigs">
      <div><p style="font-size:10pt">Zarząd Wspólnoty Mieszkaniowej</p><div class="sig-line">Podpis i pieczątka</div></div>
      <div><p style="font-size:10pt">Osoba sporządzająca protokół</p><div class="sig-line">Podpis i data</div></div>
    </div>

    <div class="footer">Dokument wygenerowany automatycznie · ${communityName} · ${new Date().toLocaleDateString('pl-PL')}</div>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

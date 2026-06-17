import { notFound, redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/getAuthProfile'
import { getSupabaseAdminClient } from '@/lib/supabase/server'

const TYPE_LABELS: Record<string, string> = {
  zaswiadczenie_zamieszkania:  'Zaświadczenie o zamieszkaniu',
  zaswiadczenie_niezalegania:  'Zaświadczenie o niezaleganiu z opłatami',
  zmiana_danych:               'Zmiana danych osobowych / kontaktowych',
  naprawa:                     'Wniosek o naprawę / interwencję',
  dokumenty:                   'Udostępnienie dokumentów wspólnoty',
  inne:                        'Wniosek do administracji',
}

export default async function PrintRequestPage({ params }: { params: { id: string } }) {
  const { user, profile } = await getAuthProfile()
  const admin = getSupabaseAdminClient()

  const { data: req } = await admin
    .from('community_requests')
    .select('*, community:communities(name)')
    .eq('id', params.id)
    .single()

  if (!req) notFound()

  // Sprawdź dostęp
  if (profile.role === 'user' && req.user_id !== user.id) redirect('/admin/wnioski')
  if (profile.role === 'admin' && req.community_id !== profile.community_id) redirect('/admin/wnioski')

  // Pobierz dane wnioskodawcy osobno (FK do auth.users, nie profiles)
  const { data: applicantProfile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', req.user_id)
    .single()

  const applicantName = applicantProfile?.full_name ?? applicantProfile?.email ?? 'Wnioskodawca'
  const communityName = req.community?.name ?? 'Wspólnota Mieszkaniowa'
  const communityAddress = ''
  const submittedDate = new Date(req.created_at).toLocaleDateString('pl-PL', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const typeLabel = TYPE_LABELS[req.type] ?? req.type

  return (
    <html lang="pl">
      <head>
        <meta charSet="utf-8" />
        <title>Wniosek — {typeLabel}</title>
        <style dangerouslySetInnerHTML={{ __html: `
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12pt;
            color: #111;
            background: #fff;
            padding: 0;
          }
          .page {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 25mm 20mm 25mm 30mm;
          }
          .header-grid {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 20px;
          }
          .sender-block { flex: 1; }
          .receiver-block { text-align: right; flex: 1; }
          .field-row { margin-bottom: 6px; font-size: 10pt; }
          .field-label { font-weight: bold; }
          .divider { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
          h1 {
            font-size: 15pt;
            font-weight: bold;
            text-align: center;
            margin: 18px 0 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .subtitle {
            text-align: center;
            font-size: 11pt;
            color: #555;
            margin-bottom: 20px;
            font-style: italic;
          }
          .body-text { line-height: 1.7; margin-bottom: 16px; text-align: justify; }
          .description-block {
            background: #f8f8f8;
            border: 1px solid #ddd;
            padding: 12px 16px;
            border-radius: 4px;
            margin: 12px 0;
            min-height: 80px;
            white-space: pre-wrap;
            line-height: 1.6;
            font-size: 11pt;
          }
          .admin-note-block {
            background: #f0f4f0;
            border: 1px solid #bcd;
            padding: 12px 16px;
            border-radius: 4px;
            margin: 12px 0;
          }
          .admin-note-label { font-size: 9pt; color: #666; margin-bottom: 4px; font-weight: bold; }
          .meta-row { font-size: 9pt; color: #666; margin-bottom: 4px; }
          .status-badge {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 10px;
            font-size: 9pt;
            font-weight: bold;
          }
          .status-new         { background: #dbeafe; color: #1d4ed8; }
          .status-in_progress { background: #fef3c7; color: #92400e; }
          .status-done        { background: #fef3c7; color: #065f46; }
          .status-rejected    { background: #fee2e2; color: #991b1b; }
          .signature-area {
            margin-top: 50px;
            display: flex;
            justify-content: flex-end;
          }
          .signature-line {
            width: 220px;
            text-align: center;
          }
          .signature-underline {
            border-top: 1px solid #333;
            margin-bottom: 6px;
            padding-top: 40px;
          }
          .signature-desc { font-size: 9pt; color: #555; }
          .footer-note {
            margin-top: 30px;
            font-size: 8pt;
            color: #999;
            border-top: 1px solid #eee;
            padding-top: 8px;
            text-align: center;
          }
          @media print {
            body { padding: 0; }
            .page { width: 100%; padding: 15mm 15mm 20mm 25mm; }
            .no-print { display: none !important; }
          }
          .print-btn {
            position: fixed;
            top: 16px;
            right: 16px;
            padding: 10px 20px;
            background: #1a56db;
            color: #fff;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
            font-family: Arial, sans-serif;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            z-index: 999;
          }
          .print-btn:hover { background: #1e429f; }
        `}} />
      </head>
      <body>
        <button className="print-btn no-print" onClick={() => window.print()}>
          🖨 Drukuj / Zapisz PDF
        </button>

        <div className="page">
          {/* Nagłówek */}
          <div className="header-grid">
            <div className="sender-block">
              <div className="field-row"><span className="field-label">Wnioskodawca:</span> {applicantName}</div>
              <div className="field-row"><span className="field-label">Lokal / adres:</span> ___________________________</div>
              <div className="field-row"><span className="field-label">Telefon / e-mail:</span> ___________________________</div>
            </div>
            <div className="receiver-block">
              <div className="field-row">{communityName}</div>
              {communityAddress && <div className="field-row">{communityAddress}</div>}
              <div className="field-row" style={{ marginTop: 8, color: '#555', fontSize: '10pt' }}>
                Data złożenia: {submittedDate}
              </div>
            </div>
          </div>

          <hr className="divider" />

          {/* Tytuł */}
          <h1>Wniosek</h1>
          <div className="subtitle">{typeLabel}</div>

          {/* Treść */}
          <div className="body-text">
            Zwracam się z uprzejmą prośbą do Zarządu Wspólnoty Mieszkaniowej
            w sprawie: <strong>{req.title}</strong>.
          </div>

          {req.description && (
            <>
              <div style={{ fontWeight: 'bold', fontSize: '10pt', marginBottom: 6 }}>Szczegóły wniosku:</div>
              <div className="description-block">{req.description}</div>
            </>
          )}

          {/* Odpowiedź administracji (jeśli jest) */}
          {req.admin_note && (
            <div className="admin-note-block">
              <div className="admin-note-label">Odpowiedź administracji:</div>
              <div>{req.admin_note}</div>
            </div>
          )}

          {/* Metadane */}
          <div style={{ marginTop: 20 }}>
            <div className="meta-row">
              Nr wniosku: <strong>{req.id.slice(0, 8).toUpperCase()}</strong>
              &nbsp;&nbsp;·&nbsp;&nbsp;
              Status: <span className={`status-badge status-${req.status}`}>
                {req.status === 'new' ? 'Nowy'
                  : req.status === 'in_progress' ? 'W trakcie'
                  : req.status === 'done' ? 'Zakończony'
                  : 'Odrzucony'}
              </span>
            </div>
          </div>

          {/* Podpis */}
          <div className="signature-area">
            <div className="signature-line">
              <div className="signature-underline" />
              <div className="signature-desc">Czytelny podpis wnioskodawcy</div>
            </div>
          </div>

          <div className="footer-note">
            Dokument wygenerowany automatycznie z systemu zarządzania Wspólnotą Mieszkaniową.
            Wniosek złożony dnia {submittedDate}.
          </div>
        </div>
      </body>
    </html>
  )
}

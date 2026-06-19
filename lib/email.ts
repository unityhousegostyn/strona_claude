import nodemailer from 'nodemailer'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST ?? 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT ?? '587'),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })
}

function isConfigured() {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
}

const FROM = () => process.env.EMAIL_FROM ?? `Zarząd Wspólnoty <${process.env.EMAIL_USER}>`

async function sendMail(options: { to: string | string[]; subject: string; html: string }) {
  if (!isConfigured()) return
  const transport = createTransport()
  await transport.sendMail({
    from: FROM(),
    to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
    subject: options.subject,
    html: options.html,
  })
}

// ── Wspólny layout ────────────────────────────────────────────────────────────

function layout(content: string) {
  const communityName = process.env.EMAIL_COMMUNITY_NAME ?? 'Zarząd Wspólnoty'
  const address      = process.env.EMAIL_FOOTER_ADDRESS ?? ''
  const phone        = process.env.EMAIL_FOOTER_PHONE ?? ''
  const website      = APP_URL

  const footerLines = [
    address && `<span>${address}</span>`,
    phone   && `<span>Tel.: ${phone}</span>`,
    `<span><a href="${website}" style="color:#94a3b8;text-decoration:none;">${website.replace(/^https?:\/\//, '')}</a></span>`,
  ].filter(Boolean).join('<br>')

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${communityName}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- NAGŁÓWEK -->
        <tr>
          <td style="background:#d97706;border-radius:12px 12px 0 0;padding:28px 40px;">
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#d4a017;">PANEL ZARZĄDZANIA</p>
            <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#ffffff;">${communityName}</p>
          </td>
        </tr>

        <!-- TREŚĆ -->
        <tr>
          <td style="background:#ffffff;padding:40px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            ${content}
          </td>
        </tr>

        <!-- STOPKA -->
        <tr>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#64748b;line-height:1.8;">
              ${footerLines}
            </p>
            <p style="margin:12px 0 0;font-size:11px;color:#94a3b8;">
              Wiadomość wygenerowana automatycznie przez system zarządzania wspólnotą.<br>
              Prosimy nie odpowiadać na tę wiadomość.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Komponent: przycisk ───────────────────────────────────────────────────────

function btn(url: string, label: string) {
  return `<a href="${url}" style="display:inline-block;background:#d97706;color:#ffffff;font-size:14px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;margin-top:8px;">${label}</a>`
}

// ── Komponent: cytat / wyróżniony blok ────────────────────────────────────────

function quote(text: string) {
  return `<div style="background:#f8fafc;border-left:4px solid #d97706;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;font-size:14px;color:#334155;line-height:1.7;">${text}</div>`
}

// ── Komponent: info box ───────────────────────────────────────────────────────

function infoBox(label: string, value: string) {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;width:40%;">${label}</td>
    <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;font-weight:500;">${value}</td>
  </tr>`
}

// ── SZABLONY ──────────────────────────────────────────────────────────────────

export async function sendEmailVerification(params: {
  to: string
  confirmUrl: string
  fullName: string
}) {
  await sendMail({
    to: params.to,
    subject: 'Potwierdź adres e-mail — aktywacja konta',
    html: layout(`
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#d97706;">Witamy w systemie</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;">Rejestracja konta mieszkańca</p>

      <p style="font-size:15px;color:#334155;line-height:1.7;">
        Szanowny/a <strong>${params.fullName}</strong>,
      </p>
      <p style="font-size:15px;color:#334155;line-height:1.7;margin-top:0;">
        Dziękujemy za rejestrację w Panelu Zarządzania Wspólnotą. W celu potwierdzenia adresu e-mail
        i przejścia do kolejnego etapu aktywacji konta, prosimy o kliknięcie poniższego przycisku.
      </p>

      ${quote('Link aktywacyjny jest ważny przez <strong>24 godziny</strong>. Po jego wygaśnięciu konieczna będzie ponowna rejestracja.')}

      <div style="text-align:center;margin:32px 0;">
        ${btn(params.confirmUrl, 'Potwierdź adres e-mail')}
      </div>

      <p style="font-size:13px;color:#94a3b8;margin-top:32px;border-top:1px solid #f1f5f9;padding-top:16px;">
        Jeżeli nie zakładali Państwo konta w naszym systemie, prosimy zignorować tę wiadomość.
      </p>
    `),
  })
}

export async function sendAccountApprovedEmail(params: {
  to: string
  communityName: string
}) {
  await sendMail({
    to: params.to,
    subject: 'Konto aktywowane — możesz się zalogować',
    html: layout(`
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#d97706;">Konto zostało aktywowane</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;">Dostęp do panelu mieszkańca</p>

      <p style="font-size:15px;color:#334155;line-height:1.7;">
        Zarząd Wspólnoty zatwierdził Państwa konto w systemie zarządzania.
        Mogą Państwo teraz zalogować się i korzystać z wszystkich funkcji panelu mieszkańca.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        ${infoBox('Wspólnota', params.communityName)}
        ${infoBox('Status konta', 'Aktywne')}
        ${infoBox('Dostęp', 'Panel mieszkańca')}
      </table>

      <div style="text-align:center;margin:32px 0;">
        ${btn(`${APP_URL}/login`, 'Zaloguj się do panelu')}
      </div>

      <p style="font-size:13px;color:#64748b;line-height:1.6;margin-top:24px;">
        W panelu znajdą Państwo m.in. rozliczenia lokalu, ogłoszenia zarządu,
        tablicę sąsiedzką, dokumenty wspólnoty oraz możliwość składania zgłoszeń i udziału w głosowaniach.
      </p>
    `),
  })
}

export async function sendPasswordResetEmail(params: {
  to: string
  resetUrl: string
}) {
  await sendMail({
    to: params.to,
    subject: 'Resetowanie hasła — Panel Zarządzania Wspólnotą',
    html: layout(`
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#d97706;">Resetowanie hasła</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;">Zmiana hasła do konta</p>

      <p style="font-size:15px;color:#334155;line-height:1.7;">
        Otrzymujemy tę wiadomość, ponieważ administrator systemu zainicjował procedurę
        resetowania hasła do Państwa konta.
      </p>

      <p style="font-size:15px;color:#334155;line-height:1.7;margin-top:0;">
        Aby ustawić nowe hasło, prosimy kliknąć poniższy przycisk.
      </p>

      ${quote('Link do resetowania hasła jest ważny przez <strong>24 godziny</strong>. Po jego wygaśnięciu konieczne będzie wygenerowanie nowego linku przez administratora.')}

      <div style="text-align:center;margin:32px 0;">
        ${btn(params.resetUrl, 'Ustaw nowe hasło')}
      </div>

      <p style="font-size:13px;color:#94a3b8;margin-top:32px;border-top:1px solid #f1f5f9;padding-top:16px;">
        Jeżeli nie wnioskowali Państwo o reset hasła, prosimy o kontakt z zarządem wspólnoty.
      </p>
    `),
  })
}

export async function sendCustomEmail(params: {
  to: string[]
  subject: string
  body: string
  senderName?: string
}) {
  if (params.to.length === 0) return
  const sender = params.senderName ?? 'Zarząd Wspólnoty'
  await sendMail({
    to: params.to,
    subject: params.subject,
    html: layout(`
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#64748b;">WIADOMOŚĆ OD ZARZĄDU</p>
      <h1 style="margin:0 0 32px;font-size:22px;font-weight:700;color:#d97706;">${params.subject}</h1>

      <div style="font-size:15px;color:#334155;line-height:1.8;white-space:pre-line;">
        ${params.body.replace(/\n/g, '<br>')}
      </div>

      <p style="margin:40px 0 0;font-size:13px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:16px;">
        Wiadomość wysłana przez: <strong>${sender}</strong>
      </p>
    `),
  })
}

export async function sendAnnouncementEmail(params: {
  to: string[]
  title: string
  content: string
}) {
  if (params.to.length === 0) return
  await sendMail({
    to: params.to,
    subject: `Ogłoszenie zarządu: ${params.title}`,
    html: layout(`
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#64748b;">OGŁOSZENIE ZARZĄDU</p>
      <h1 style="margin:0 0 32px;font-size:22px;font-weight:700;color:#d97706;">${params.title}</h1>

      <div style="font-size:15px;color:#334155;line-height:1.8;">
        ${params.content.replace(/\n/g, '<br>')}
      </div>

      <div style="text-align:center;margin:40px 0 16px;">
        ${btn(`${APP_URL}/admin/announcements`, 'Przejdź do ogłoszeń')}
      </div>
    `),
  })
}

export async function sendNewUserPendingEmail(params: {
  to: string | string[]
  userName: string
  userEmail: string
}) {
  await sendMail({
    to: params.to,
    subject: 'Nowy użytkownik oczekuje na akceptację',
    html: layout(`
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#d97706;">Nowe zgłoszenie rejestracji</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;">Użytkownik oczekuje na zatwierdzenie konta</p>

      <p style="font-size:15px;color:#334155;line-height:1.7;">
        W systemie pojawił się nowy użytkownik, który potwierdził adres e-mail i oczekuje na akceptację przez administratora.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        ${infoBox('Imię i nazwisko', params.userName)}
        ${infoBox('Adres e-mail', params.userEmail)}
        ${infoBox('Status', 'Oczekuje na akceptację')}
      </table>

      <div style="text-align:center;margin:32px 0;">
        ${btn(`${APP_URL}/admin/users`, 'Przejdź do zarządzania użytkownikami')}
      </div>

      <p style="font-size:13px;color:#94a3b8;margin-top:24px;border-top:1px solid #f1f5f9;padding-top:16px;">
        Wiadomość wysłana automatycznie po potwierdzeniu adresu e-mail przez nowego użytkownika.
      </p>
    `),
  })
}

export async function sendNewTicketEmail(params: {
  to: string | string[]
  ticketTitle: string
  ticketDescription: string
  authorName: string
  communityName: string
  ticketId: string
}) {
  await sendMail({
    to: params.to,
    subject: `Nowe zgłoszenie: ${params.ticketTitle}`,
    html: layout(`
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#d97706;">Nowe zgłoszenie</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;">Mieszkaniec złożył nowe zgłoszenie</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        ${infoBox('Zgłoszenie', params.ticketTitle)}
        ${infoBox('Zgłaszający', params.authorName)}
        ${infoBox('Wspólnota', params.communityName)}
        ${infoBox('Status', 'Otwarte')}
      </table>

      <p style="font-size:13px;font-weight:600;color:#64748b;margin:0 0 4px;">Opis zgłoszenia:</p>
      ${quote(params.ticketDescription.replace(/\n/g, '<br>'))}

      <div style="text-align:center;margin:32px 0;">
        ${btn(`${APP_URL}/admin/tickets/${params.ticketId}`, 'Zobacz zgłoszenie')}
      </div>
    `),
  })
}

export async function sendNewCommentEmail(params: {
  to: string
  ticketTitle: string
  authorName: string
  comment: string
  ticketId: string
}) {
  await sendMail({
    to: params.to,
    subject: `Nowa odpowiedź na zgłoszenie: ${params.ticketTitle}`,
    html: layout(`
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#d97706;">Nowa odpowiedź na zgłoszenie</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;">Ktoś skomentował Państwa zgłoszenie</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        ${infoBox('Zgłoszenie', params.ticketTitle)}
        ${infoBox('Odpowiedział/a', params.authorName)}
      </table>

      <p style="font-size:13px;font-weight:600;color:#64748b;margin:0 0 4px;">Treść odpowiedzi:</p>
      ${quote(params.comment.replace(/\n/g, '<br>'))}

      <div style="text-align:center;margin:32px 0;">
        ${btn(`${APP_URL}/admin/tickets/${params.ticketId}`, 'Zobacz zgłoszenie')}
      </div>
    `),
  })
}

// ── ZAPROSZENIE DO WSPÓLNOTY ──────────────────────────────────────────────────

export async function sendInvitationEmail(params: {
  to: string
  communityName: string
  inviteUrl: string
  fullName?: string
  expiresAt: Date
}) {
  const greeting = params.fullName ? `Szanowny/a <strong>${params.fullName}</strong>,` : 'Szanowny/a Mieszkańcu,'
  const expiryStr = params.expiresAt.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })

  await sendMail({
    to: params.to,
    subject: `Zaproszenie do panelu wspólnoty — ${params.communityName}`,
    html: invitationLayout(params.communityName, `
      <p style="font-size:15px;color:#c8b89a;line-height:1.8;margin:0 0 8px;">
        ${greeting}
      </p>
      <p style="font-size:15px;color:#c8b89a;line-height:1.8;margin:0 0 28px;">
        Zarząd Państwa wspólnoty zaprasza do korzystania z <strong style="color:#ecfdf5;">cyfrowego panelu mieszkańca</strong>.
        W jednym miejscu znajdą Państwo rozliczenia, dokumenty i bieżące informacje ze wspólnoty.
      </p>

      <!-- Kafelki funkcji -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
        <tr>
          <td width="50%" style="padding:0 8px 12px 0;vertical-align:top;">
            ${featureTile('💰', 'Rozliczenia', 'Podgląd opłat, saldo lokalu i historia wpłat online')}
          </td>
          <td width="50%" style="padding:0 0 12px 8px;vertical-align:top;">
            ${featureTile('📢', 'Ogłoszenia', 'Aktualności od zarządu bez czekania na tablicę')}
          </td>
        </tr>
        <tr>
          <td width="50%" style="padding:0 8px 0 0;vertical-align:top;">
            ${featureTile('🎫', 'Zgłoszenia', 'Zgłoś usterkę lub wniosek — śledź jego status')}
          </td>
          <td width="50%" style="padding:0 0 0 8px;vertical-align:top;">
            ${featureTile('🗳️', 'Głosowania', 'Uchwały wspólnoty — głosuj elektronicznie')}
          </td>
        </tr>
      </table>

      <!-- CTA -->
      <div style="text-align:center;margin:0 0 28px;">
        <a href="${params.inviteUrl}"
          style="display:inline-block;background:linear-gradient(135deg,#d97706,#b45309);color:#ffffff;font-size:15px;font-weight:700;padding:16px 40px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;box-shadow:0 4px 16px rgba(217,119,6,0.35);">
          Dołącz do panelu wspólnoty →
        </a>
      </div>

      <!-- Wygasanie -->
      <div style="background:#162418;border:1px solid #1e3324;border-radius:8px;padding:14px 18px;text-align:center;margin:0 0 8px;">
        <p style="margin:0;font-size:12px;color:#4d7a5f;">
          ⏳&nbsp; Link jest ważny do <strong style="color:#a7f3d0;">${expiryStr}</strong>.
          Po tym terminie prosimy skontaktować się z zarządem.
        </p>
      </div>

      <p style="font-size:12px;color:#2a4a2a;text-align:center;margin:16px 0 0;">
        Jeżeli nie spodziewali się Państwo tego zaproszenia, prosimy zignorować tę wiadomość.
      </p>
    `),
  })
}

// ── Layout zaproszenia — ciemny, premium ──────────────────────────────────────

function invitationLayout(communityName: string, content: string) {
  const address = process.env.EMAIL_FOOTER_ADDRESS ?? ''
  const phone   = process.env.EMAIL_FOOTER_PHONE ?? ''
  const website = APP_URL

  const footerLines = [
    address && `<span>${address}</span>`,
    phone   && `<span>Tel.: ${phone}</span>`,
    `<span><a href="${website}" style="color:#2a4a2a;text-decoration:none;">${website.replace(/^https?:\/\//, '')}</a></span>`,
  ].filter(Boolean).join(' &nbsp;·&nbsp; ')

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Zaproszenie — ${communityName}</title>
</head>
<body style="margin:0;padding:0;background:#0e0b07;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0b07;padding:40px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

        <!-- LOGO HEADER -->
        <tr>
          <td style="padding:0 0 24px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background:#d97706;border-radius:10px;padding:10px 14px;line-height:1;">
                  <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">&#127968;</span>
                </td>
                <td style="padding-left:12px;">
                  <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:#4d7a5f;">Panel Zarządzania</p>
                  <p style="margin:2px 0 0;font-size:16px;font-weight:700;color:#ecfdf5;">${communityName}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- HERO BANNER -->
        <tr>
          <td style="background:linear-gradient(145deg,#1e1810,#162418);border-radius:16px 16px 0 0;border:1px solid #1e3324;border-bottom:none;padding:40px 40px 32px;text-align:center;">
            <div style="display:inline-block;background:#d97706;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:26px;margin:0 0 20px;">🏠</div>
            <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#ecfdf5;letter-spacing:-0.5px;">Zaproszenie do wspólnoty</h1>
            <p style="margin:0;font-size:15px;color:#6b9478;">Otrzymali Państwo dostęp do cyfrowego panelu mieszkańca</p>
          </td>
        </tr>

        <!-- TREŚĆ -->
        <tr>
          <td style="background:#0d1410;border:1px solid #1e3324;border-top:none;border-bottom:none;padding:32px 40px;">
            ${content}
          </td>
        </tr>

        <!-- STOPKA -->
        <tr>
          <td style="background:#0e0b07;border:1px solid #1e3324;border-top:1px solid #162418;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#1e3324;line-height:1.8;">${footerLines}</p>
            <p style="margin:10px 0 0;font-size:11px;color:#162418;">
              Wiadomość wygenerowana automatycznie. Prosimy nie odpowiadać na ten email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendNewVoteEmail(params: {
  to: string[]
  voteTitle: string
  voteDescription?: string | null
  deadline?: string | null
  communityName: string
  voteId: string
}) {
  if (params.to.length === 0) return
  const deadlineStr = params.deadline
    ? new Date(params.deadline).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  await sendMail({
    to: params.to,
    subject: `Nowe głosowanie: ${params.voteTitle}`,
    html: layout(`
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#64748b;">NOWE GŁOSOWANIE</p>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#d97706;">${params.voteTitle}</h1>
      <p style="margin:0 0 28px;font-size:13px;color:#64748b;">${params.communityName}</p>

      ${params.voteDescription
        ? `<div style="font-size:15px;color:#334155;line-height:1.8;margin-bottom:24px;">${params.voteDescription.replace(/\n/g, '<br>')}</div>`
        : ''}

      ${deadlineStr
        ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
            ${infoBox('Termin głosowania', deadlineStr)}
           </table>`
        : ''}

      <p style="font-size:14px;color:#334155;line-height:1.7;margin:0 0 32px;">
        Zaloguj się do panelu, aby oddać swój głos. Twój głos jest ważny dla wspólnoty.
      </p>

      <div style="text-align:center;margin:8px 0 16px;">
        ${btn(`${APP_URL}/admin/votes`, 'Przejdź do głosowania')}
      </div>
    `),
  })
}

// ── ZAMKNIĘCIE GŁOSOWANIA ─────────────────────────────────────────────────────

export async function sendVoteClosedEmail(params: {
  to: string[]
  voteTitle: string
  communityName: string
  voteId: string
  resolutionNumber: string
  yes: number
  no: number
  abstain: number
  totalApts: number
  votedApts: number
  passed: boolean | null
  byShare: boolean
}) {
  if (params.to.length === 0) return

  const pct = (v: number) => {
    const total = params.yes + params.no + params.abstain
    return total > 0 ? (v / total * 100).toFixed(1) : '0.0'
  }
  const frekwencja = params.totalApts > 0
    ? (params.votedApts / params.totalApts * 100).toFixed(0)
    : '0'
  const verdictColor = params.passed === true ? '#16a34a' : params.passed === false ? '#dc2626' : '#d97706'
  const verdictText  = params.passed === true ? '✅ Uchwała PRZYJĘTA' : params.passed === false ? '❌ Uchwała ODRZUCONA' : '⚠️ Uchwała NIEROZSTRZYGNIĘTA (brak quorum 50%)'
  const methodLabel  = params.byShare ? 'według udziałów' : '1 lokal = 1 głos'

  await sendMail({
    to: params.to,
    subject: `Zakończono głosowanie: ${params.voteTitle}`,
    html: layout(`
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#64748b;">WYNIKI GŁOSOWANIA</p>
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#d97706;">${params.voteTitle}</h1>
      <p style="margin:0 0 24px;font-size:13px;color:#64748b;">${params.communityName}${params.resolutionNumber !== '—' ? ` &nbsp;·&nbsp; Uchwała nr ${params.resolutionNumber}` : ''}</p>

      <!-- Werdykt -->
      <div style="background:#f8fafc;border-left:4px solid ${verdictColor};border-radius:0 8px 8px 0;padding:14px 20px;margin:0 0 24px;">
        <p style="margin:0;font-size:16px;font-weight:700;color:${verdictColor};">${verdictText}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Metoda: ${methodLabel}</p>
      </div>

      <!-- Tabela wyników -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        ${infoBox('ZA', `${pct(params.yes)}%${params.byShare ? ` &nbsp;<span style="color:#94a3b8;font-size:11px;">(udział: ${(params.yes * 100).toFixed(2)}%)</span>` : ''}`)}
        ${infoBox('PRZECIW', `${pct(params.no)}%${params.byShare ? ` &nbsp;<span style="color:#94a3b8;font-size:11px;">(udział: ${(params.no * 100).toFixed(2)}%)</span>` : ''}`)}
        ${infoBox('WSTRZYMAŁO SIĘ', `${pct(params.abstain)}%`)}
        ${infoBox('Frekwencja', `${params.votedApts} z ${params.totalApts} lokali (${frekwencja}%)`)}
      </table>

      <div style="text-align:center;margin:32px 0 16px;">
        ${btn(`${APP_URL}/api/votes/${params.voteId}/raport`, '📄 Pobierz raport PDF')}
      </div>
      <p style="text-align:center;font-size:12px;color:#94a3b8;margin:0;">
        Link otwiera protokół głosowania — możesz go wydrukować lub zapisać jako PDF.
      </p>
    `),
  })
}

// ── PRZYPOMNIENIE O GŁOSOWANIU (24h) ─────────────────────────────────────────

export async function sendVoteReminderEmail(params: {
  to: string[]
  voteTitle: string
  communityName: string
  voteId: string
  deadline?: string | null
  resolutionNumber?: string | null
}) {
  if (params.to.length === 0) return

  const deadlineStr = params.deadline
    ? new Date(params.deadline).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  const resNum = params.resolutionNumber ? ` (Uchwała nr ${params.resolutionNumber})` : ''

  await sendMail({
    to: params.to,
    subject: `⏰ Przypomnienie: trwa głosowanie — ${params.voteTitle}`,
    html: layout(`
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#64748b;">PRZYPOMNIENIE O GŁOSOWANIU</p>
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0d9488;">${params.voteTitle}${resNum}</h1>
      <p style="margin:0 0 28px;font-size:13px;color:#64748b;">${params.communityName}</p>

      <div style="background:#f0fdfa;border-left:4px solid #0d9488;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 24px;">
        <p style="margin:0;font-size:15px;color:#134e4a;line-height:1.7;">
          Trwa głosowanie nad uchwałą, w którym jeszcze <strong>nie oddali Państwo głosu</strong>.<br>
          Przypominamy, że każdy głos jest ważny dla wspólnoty.
        </p>
      </div>

      ${deadlineStr
        ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
            ${infoBox('Termin głosowania', `<strong style="color:#0d9488;">${deadlineStr}</strong>`)}
           </table>`
        : ''}

      <p style="font-size:14px;color:#334155;line-height:1.7;margin:0 0 32px;">
        Zaloguj się do panelu i oddaj swój głos — zajmie to tylko chwilę.
      </p>

      <div style="text-align:center;margin:8px 0 16px;">
        <a href="${APP_URL}/admin/votes" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:14px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">
          Przejdź do głosowania →
        </a>
      </div>
    `),
  })
}

// ── Kafelek funkcji (używany w zaproszeniu) ───────────────────────────────────

function featureTile(icon: string, title: string, desc: string) {
  return `<div style="background:#1e1810;border:1px solid #1e3324;border-radius:10px;padding:16px;">
    <p style="margin:0 0 6px;font-size:20px;line-height:1;">${icon}</p>
    <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#ecfdf5;">${title}</p>
    <p style="margin:0;font-size:12px;color:#4d7a5f;line-height:1.5;">${desc}</p>
  </div>`
}

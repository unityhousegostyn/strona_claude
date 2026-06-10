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
          <td style="background:#1a4731;border-radius:12px 12px 0 0;padding:28px 40px;">
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
  return `<a href="${url}" style="display:inline-block;background:#1a4731;color:#ffffff;font-size:14px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;margin-top:8px;">${label}</a>`
}

// ── Komponent: cytat / wyróżniony blok ────────────────────────────────────────

function quote(text: string) {
  return `<div style="background:#f8fafc;border-left:4px solid #1a4731;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;font-size:14px;color:#334155;line-height:1.7;">${text}</div>`
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
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1a4731;">Witamy w systemie</h1>
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
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1a4731;">Konto zostało aktywowane</h1>
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
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1a4731;">Resetowanie hasła</h1>
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
      <h1 style="margin:0 0 32px;font-size:22px;font-weight:700;color:#1a4731;">${params.title}</h1>

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
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1a4731;">Nowe zgłoszenie rejestracji</h1>
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
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1a4731;">Nowe zgłoszenie</h1>
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
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1a4731;">Nowa odpowiedź na zgłoszenie</h1>
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

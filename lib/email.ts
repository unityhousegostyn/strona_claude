import nodemailer from 'nodemailer'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST ?? 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT ?? '587'),
    secure: false, // STARTTLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })
}

function isConfigured() {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
}

const FROM = () => process.env.EMAIL_FROM ?? `Panel Wspólnoty <${process.env.EMAIL_USER}>`

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

export async function sendEmailVerification(params: {
  to: string
  confirmUrl: string
  fullName: string
}) {
  await sendMail({
    to: params.to,
    subject: 'Potwierdź adres email — Panel Wspólnoty',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1d4ed8;">Witaj, ${params.fullName}!</h2>
        <p style="color: #374151;">Aby aktywować konto, potwierdź swój adres email klikając poniższy przycisk.</p>
        <a href="${params.confirmUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
          Potwierdź email
        </a>
        <p style="color:#6b7280;font-size:13px;">Link wygaśnie za 24 godziny.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
        <p style="color:#9ca3af;font-size:12px;">Panel Zarządzania Wspólnotą</p>
      </div>`,
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
    subject: `📢 Nowe ogłoszenie: ${params.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color:#1d4ed8;">📢 ${params.title}</h2>
        <p style="color:#374151;line-height:1.6;">${params.content.replace(/\n/g, '<br>')}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
        <p style="color:#9ca3af;font-size:12px;">Panel Zarządzania Wspólnotą · <a href="${APP_URL}/admin/announcements">Zobacz ogłoszenia</a></p>
      </div>`,
  })
}

export async function sendAccountApprovedEmail(params: {
  to: string
  communityName: string
}) {
  await sendMail({
    to: params.to,
    subject: 'Twoje konto zostało zaakceptowane',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color:#059669;">✅ Konto aktywowane</h2>
        <p style="color:#374151;">Twoje konto w panelu wspólnoty <strong>${params.communityName}</strong> zostało zaakceptowane.</p>
        <a href="${APP_URL}/login" style="display:inline-block;background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px;">Zaloguj się</a>
      </div>`,
  })
}

export async function sendPasswordResetEmail(params: {
  to: string
  resetUrl: string
}) {
  await sendMail({
    to: params.to,
    subject: 'Reset hasła — Panel Wspólnoty',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color:#dc2626;">🔑 Reset hasła</h2>
        <p style="color:#374151;">Administrator zainicjował reset Twojego hasła.</p>
        <a href="${params.resetUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">Ustaw nowe hasło</a>
        <p style="color:#6b7280;font-size:13px;">Link wygaśnie za 24 godziny.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
        <p style="color:#9ca3af;font-size:12px;">Panel Zarządzania Wspólnotą</p>
      </div>`,
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
    subject: `Nowy komentarz w zgłoszeniu: ${params.ticketTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color:#374151;">💬 Nowy komentarz</h2>
        <p style="color:#374151;"><strong>${params.authorName}</strong> skomentował zgłoszenie <em>${params.ticketTitle}</em>:</p>
        <blockquote style="border-left:3px solid #d1d5db;margin:16px 0;padding:12px 16px;color:#6b7280;">${params.comment}</blockquote>
        <a href="${APP_URL}/admin/tickets/${params.ticketId}" style="display:inline-block;background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Zobacz zgłoszenie</a>
      </div>`,
  })
}

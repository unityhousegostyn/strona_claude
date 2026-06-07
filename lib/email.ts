import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'panel@twojadomena.pl'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function sendAnnouncementEmail(params: {
  to: string[]
  title: string
  content: string
}) {
  if (!process.env.RESEND_API_KEY || params.to.length === 0) return

  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `📢 Nowe ogłoszenie: ${params.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1d4ed8;">📢 ${params.title}</h2>
        <p style="color: #374151; line-height: 1.6;">${params.content.replace(/\n/g, '<br>')}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #9ca3af; font-size: 12px;">
          Panel Zarządzania Wspólnotą · <a href="${APP_URL}/admin/announcements">Zobacz ogłoszenia</a>
        </p>
      </div>
    `,
  })
}

export async function sendAccountApprovedEmail(params: {
  to: string
  communityName: string
}) {
  if (!process.env.RESEND_API_KEY) return

  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: 'Twoje konto zostało zaakceptowane',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">✅ Konto aktywowane</h2>
        <p style="color: #374151;">Twoje konto w panelu wspólnoty <strong>${params.communityName}</strong> zostało zaakceptowane przez administratora.</p>
        <a href="${APP_URL}/login" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
          Zaloguj się
        </a>
      </div>
    `,
  })
}

export async function sendNewCommentEmail(params: {
  to: string
  ticketTitle: string
  authorName: string
  comment: string
  ticketId: string
}) {
  if (!process.env.RESEND_API_KEY) return

  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Nowy komentarz w zgłoszeniu: ${params.ticketTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #374151;">💬 Nowy komentarz</h2>
        <p style="color: #374151;"><strong>${params.authorName}</strong> skomentował Twoje zgłoszenie <em>${params.ticketTitle}</em>:</p>
        <blockquote style="border-left: 3px solid #d1d5db; margin: 16px 0; padding: 12px 16px; color: #6b7280;">
          ${params.comment}
        </blockquote>
        <a href="${APP_URL}/admin/tickets/${params.ticketId}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Zobacz zgłoszenie
        </a>
      </div>
    `,
  })
}

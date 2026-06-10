import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function GET() {
  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS

  if (!user || !pass) {
    return NextResponse.json({ error: 'Brak EMAIL_USER lub EMAIL_PASS w zmiennych środowiskowych' }, { status: 500 })
  }

  try {
    const transport = nodemailer.createTransport({
      host: process.env.EMAIL_HOST ?? 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT ?? '587'),
      secure: false,
      auth: { user, pass },
    })

    await transport.sendMail({
      from: process.env.EMAIL_FROM ?? `Panel Wspólnoty <${user}>`,
      to: user,
      subject: 'Test e-mail — Panel Wspólnoty',
      html: '<p>Jeśli to widzisz, Gmail SMTP działa poprawnie. ✅</p>',
    })

    return NextResponse.json({ ok: true, sentTo: user })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

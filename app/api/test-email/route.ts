import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function GET() {
  const key = process.env.RESEND_API_KEY
  if (!key) return NextResponse.json({ error: 'Brak RESEND_API_KEY' }, { status: 500 })

  const resend = new Resend(key)

  try {
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? 'onboarding@resend.dev',
      to: 'unity.housegostyn@gmail.com',
      subject: 'Test Resend — Panel Wspólnoty',
      html: '<p>Jeśli to widzisz, Resend działa poprawnie.</p>',
    })
    return NextResponse.json({ ok: true, result })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, details: e }, { status: 500 })
  }
}

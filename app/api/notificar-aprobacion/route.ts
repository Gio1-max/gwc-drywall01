import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  const { email, nombre } = await req.json()

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: true, message: 'Email no configurado' })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  await resend.emails.send({
    from: 'GWC Drywall <noreply@gwcdrywall.ca>',
    to: email,
    subject: 'Tus horas han sido aprobadas ✓',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="background: #1e293b; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
          <span style="color: #fbbf24; font-size: 20px; font-weight: 900;">GWC Drywall Construction</span>
        </div>
        <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
          <p style="color: #334155; font-size: 16px;">Hola <strong>${nombre}</strong>,</p>
          <p style="color: #334155;">Tu solicitud de registro de horas ha sido <strong style="color: #10b981;">aprobada</strong> por el administrador.</p>
          <p style="color: #64748b; font-size: 14px;">Ya puedes ver el registro actualizado en tu panel.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #94a3b8; font-size: 12px;">GWC Drywall Construction Ltd. · Calgary, AB</p>
        </div>
      </div>
    `,
  })

  return NextResponse.json({ ok: true })
}

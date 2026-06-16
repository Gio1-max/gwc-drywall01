import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  const { nombre, fecha } = await req.json()

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: true, message: 'Email no configurado' })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const adminEmail = process.env.ADMIN_EMAIL!

  await resend.emails.send({
    from: 'GWC Drywall <noreply@gwcdrywall.ca>',
    to: adminEmail,
    subject: `⚠️ Solicitud de horas pendiente — ${nombre}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="background: #1e293b; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
          <span style="color: #fbbf24; font-size: 20px; font-weight: 900;">GWC Drywall Construction</span>
        </div>
        <div style="background: #fffbeb; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #fde68a;">
          <p style="color: #92400e; font-size: 16px;"><strong>⚠️ Solicitud pendiente de aprobación</strong></p>
          <p style="color: #78350f;"><strong>${nombre}</strong> registró horas del día <strong>${fecha}</strong> fuera de tiempo.</p>
          <p style="color: #78350f;">Entra al panel de administrador para aprobar o rechazar la solicitud.</p>
          <a href="${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'http://localhost:3000' : '#'}/admin/horas"
             style="display: inline-block; margin-top: 16px; background: #1e293b; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Ver Solicitudes
          </a>
          <hr style="border: none; border-top: 1px solid #fde68a; margin: 20px 0;">
          <p style="color: #92400e; font-size: 12px;">GWC Drywall Construction Ltd. · Calgary, AB</p>
        </div>
      </div>
    `,
  })

  return NextResponse.json({ ok: true })
}

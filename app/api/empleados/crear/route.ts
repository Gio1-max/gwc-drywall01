import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'Service key no configurada.' }, { status: 500 })
  }

  const { nombre, apellido, email, emailEtransfer, password, tarifaHora, tarifaSf, telefono, direccion, sinNumber } = await req.json()

  // Cliente con permisos de administrador (bypassa RLS)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Crear usuario en Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, apellido, role: 'empleado' },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Actualizar perfil con datos completos
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      nombre,
      apellido,
      email_etransfer: emailEtransfer || null,
      tarifa_hora: tarifaHora ? parseFloat(tarifaHora) : null,
      tarifa_sf: tarifaSf ? parseFloat(tarifaSf) : null,
      telefono: telefono || null,
      direccion: direccion || null,
      sin_number: sinNumber || null,
    })
    .eq('id', authData.user.id)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { empleadoId, nuevoEmail } = await req.json()
  if (!empleadoId || !nuevoEmail) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Actualizar email en Auth
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(empleadoId, {
    email: nuevoEmail,
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Actualizar email en profiles
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ email: nuevoEmail })
    .eq('id', empleadoId)
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

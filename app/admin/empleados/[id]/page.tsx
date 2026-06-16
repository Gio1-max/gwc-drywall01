'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Perfil {
  id: string
  nombre: string
  apellido: string
  email: string
  email_etransfer: string | null
  telefono: string | null
  direccion: string | null
  sin_number: string | null
  tarifa_hora: number | null
  tarifa_sf: number | null
  activo: boolean
  role: string
}

export default function DetalleEmpleadoPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const [form, setForm] = useState<Perfil | null>(null)

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', id).single().then(({ data }) => {
      setForm(data)
      setLoading(false)
    })
  }, [id])

  function set(field: string, value: string | boolean) {
    setForm(f => f ? { ...f, [field]: value } : f)
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setGuardando(true)

    await supabase.from('profiles').update({
      nombre: form.nombre,
      apellido: form.apellido,
      email_etransfer: form.email_etransfer || null,
      telefono: form.telefono || null,
      direccion: form.direccion || null,
      sin_number: form.sin_number || null,
      tarifa_hora: form.tarifa_hora,
      tarifa_sf: form.tarifa_sf,
      activo: form.activo,
    }).eq('id', id as string)

    setGuardando(false)
    setExito(true)
    setTimeout(() => setExito(false), 3000)
  }

  if (loading) return <div className="p-8 text-slate-500">Cargando...</div>
  if (!form) return <div className="p-8 text-slate-500">Empleado no encontrado.</div>

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700 mb-2">← Volver</button>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-amber-400 rounded-2xl flex items-center justify-center text-xl font-black text-slate-900">
            {form.nombre[0]}{form.apellido[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{form.nombre} {form.apellido}</h1>
            <p className="text-slate-500 text-sm">{form.email}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleGuardar} className="space-y-5">

        {/* Info personal */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
          <p className="font-semibold text-slate-700">Información Personal</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
              <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)} required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Apellido *</label>
              <input type="text" value={form.apellido} onChange={e => set('apellido', e.target.value)} required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
            <input type="tel" value={form.telefono ?? ''} onChange={e => set('telefono', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="+1 (403) 000-0000" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
            <input type="text" value={form.direccion ?? ''} onChange={e => set('direccion', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="123 Main St, Calgary, AB" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">SIN Number</label>
            <input type="text" value={form.sin_number ?? ''} onChange={e => set('sin_number', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="000-000-000" maxLength={11} />
          </div>
        </div>

        {/* Acceso */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
          <p className="font-semibold text-slate-700">Acceso y Pagos</p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
            <input type="email" value={form.email} disabled
              className="w-full px-3 py-2.5 rounded-lg border border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed" />
            <p className="text-xs text-slate-400 mt-1">El email no se puede cambiar desde aquí</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Correo para E-Transfer</label>
            <input type="email" value={form.email_etransfer ?? ''} onChange={e => set('email_etransfer', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="correo para recibir pagos" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
            <button type="button" onClick={() => set('activo', !form.activo)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${form.activo ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {form.activo ? 'Activo' : 'Inactivo'} — click para cambiar
            </button>
          </div>
        </div>

        {/* Tarifas */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
          <p className="font-semibold text-slate-700">Tarifas de Pago</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tarifa por Hora ($/hr)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input type="number" value={form.tarifa_hora ?? ''} onChange={e => set('tarifa_hora', e.target.value)} step="0.50" min="0"
                  className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="22.00" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tarifa por SF ($/sf)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input type="number" value={form.tarifa_sf ?? ''} onChange={e => set('tarifa_sf', e.target.value)} step="0.01" min="0"
                  className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="0.14" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button type="submit" disabled={guardando}
            className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:bg-amber-200 text-slate-900 font-semibold py-3 rounded-lg transition-colors">
            {guardando ? 'Guardando...' : 'Guardar Cambios'}
          </button>
          {exito && <p className="text-emerald-600 font-medium text-sm">✓ Guardado</p>}
        </div>
      </form>
    </div>
  )
}

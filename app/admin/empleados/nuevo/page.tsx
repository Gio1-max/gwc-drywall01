'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NuevoEmpleadoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    emailEtransfer: '',
    password: '',
    telefono: '',
    direccion: '',
    sinNumber: '',
    tarifaHora: '',
    tarifaSf: '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/empleados/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Error al crear el empleado.'); setLoading(false); return }
    router.push('/admin/empleados')
  }

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700 mb-2">← Volver</button>
        <h1 className="text-2xl font-bold text-slate-800">Agregar Empleado</h1>
        <p className="text-slate-500 mt-1">Se creará una cuenta de acceso para el empleado</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Info personal */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
          <p className="font-semibold text-slate-700">Información Personal</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
              <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)} required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="Juan" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Apellido *</label>
              <input type="text" value={form.apellido} onChange={e => set('apellido', e.target.value)} required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="Pérez" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
            <input type="tel" value={form.telefono} onChange={e => set('telefono', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="+1 (403) 000-0000" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
            <input type="text" value={form.direccion} onChange={e => set('direccion', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="123 Main St, Calgary, AB" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">SIN Number</label>
            <input type="text" value={form.sinNumber} onChange={e => set('sinNumber', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="000-000-000" maxLength={11} />
            <p className="text-xs text-slate-400 mt-1">Social Insurance Number — se guarda de forma segura</p>
          </div>
        </div>

        {/* Acceso */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
          <p className="font-semibold text-slate-700">Acceso al Sistema</p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico *</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="juan@correo.com" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Correo para E-Transfer</label>
            <input type="email" value={form.emailEtransfer} onChange={e => set('emailEtransfer', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="puede ser diferente" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña temporal *</label>
            <input type="text" value={form.password} onChange={e => set('password', e.target.value)} required minLength={6}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="Mínimo 6 caracteres" />
            <p className="text-xs text-slate-400 mt-1">El empleado usará esta contraseña para entrar por primera vez</p>
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
                <input type="number" value={form.tarifaHora} onChange={e => set('tarifaHora', e.target.value)} step="0.50" min="0"
                  className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="22.00" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tarifa por SF ($/sf)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input type="number" value={form.tarifaSf} onChange={e => set('tarifaSf', e.target.value)} step="0.01" min="0"
                  className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="0.14" />
              </div>
            </div>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3"><p className="text-sm text-red-600">{error}</p></div>}

        <button type="submit" disabled={loading}
          className="w-full bg-amber-400 hover:bg-amber-500 disabled:bg-amber-200 text-slate-900 font-semibold py-3 rounded-lg transition-colors">
          {loading ? 'Creando cuenta...' : 'Crear Empleado'}
        </button>
      </form>
    </div>
  )
}

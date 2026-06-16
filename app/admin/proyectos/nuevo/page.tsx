'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface TrabajoExtra {
  descripcion: string
  tipo: 'sf' | 'concepto'
  cantidad_sf: string
  tarifa_sf: string
  monto: string
}

interface Cliente {
  id: string
  nombre: string
}

export default function NuevoProyectoPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [nuevoCliente, setNuevoCliente] = useState('')
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false)

  const [form, setForm] = useState({
    nombre: '',
    direccion: '',
    cliente_id: '',
    total_sf: '',
    tarifa_sf: '0.28',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin_estimada: '',
    notas: '',
  })

  const [extras, setExtras] = useState<TrabajoExtra[]>([])

  useEffect(() => {
    supabase.from('clientes').select('id, nombre').order('nombre').then(({ data }) => {
      setClientes(data ?? [])
    })
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function addExtra() {
    setExtras(e => [...e, { descripcion: '', tipo: 'concepto', cantidad_sf: '', tarifa_sf: '0.28', monto: '' }])
  }

  function setExtra(index: number, field: keyof TrabajoExtra, value: string) {
    setExtras(prev => prev.map((e, i) => {
      if (i !== index) return e
      const updated = { ...e, [field]: value }
      // Auto-calcular monto si es por SF
      if (field === 'cantidad_sf' || field === 'tarifa_sf') {
        const sf = parseFloat(field === 'cantidad_sf' ? value : updated.cantidad_sf)
        const tarifa = parseFloat(field === 'tarifa_sf' ? value : updated.tarifa_sf)
        if (!isNaN(sf) && !isNaN(tarifa)) updated.monto = (sf * tarifa).toFixed(2)
      }
      return updated
    }))
  }

  function removeExtra(index: number) {
    setExtras(prev => prev.filter((_, i) => i !== index))
  }

  const ingreso_base = form.total_sf && form.tarifa_sf
    ? parseFloat(form.total_sf) * parseFloat(form.tarifa_sf)
    : 0

  const ingreso_extras = extras.reduce((sum, e) => sum + (parseFloat(e.monto) || 0), 0)
  const ingreso_total = ingreso_base + ingreso_extras

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    let cliente_id = form.cliente_id

    // Crear cliente nuevo si aplica
    if (mostrarNuevoCliente && nuevoCliente.trim()) {
      const { data: newCliente, error: cErr } = await supabase
        .from('clientes')
        .insert({ nombre: nuevoCliente.trim() })
        .select('id')
        .single()
      if (cErr) { setError(cErr.message); setLoading(false); return }
      cliente_id = newCliente.id
    }

    const { data: proyecto, error: err } = await supabase.from('proyectos').insert({
      nombre: form.nombre,
      direccion: form.direccion,
      cliente: mostrarNuevoCliente ? nuevoCliente.trim() : clientes.find(c => c.id === cliente_id)?.nombre || null,
      total_sf: form.total_sf ? parseFloat(form.total_sf) : null,
      tarifa_sf: parseFloat(form.tarifa_sf),
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin_estimada: form.fecha_fin_estimada || null,
      notas: form.notas || null,
    }).select('id').single()

    if (err) { setError(err.message); setLoading(false); return }

    // Guardar trabajos extras
    if (extras.length > 0 && proyecto) {
      const extrasData = extras
        .filter(ex => ex.descripcion && ex.monto)
        .map(ex => ({
          proyecto_id: proyecto.id,
          descripcion: ex.descripcion,
          tipo: ex.tipo,
          cantidad_sf: ex.tipo === 'sf' && ex.cantidad_sf ? parseFloat(ex.cantidad_sf) : null,
          tarifa_sf: ex.tipo === 'sf' && ex.tarifa_sf ? parseFloat(ex.tarifa_sf) : null,
          monto: parseFloat(ex.monto),
        }))
      if (extrasData.length > 0) {
        await supabase.from('trabajos_extras').insert(extrasData)
      }
    }

    router.push('/admin/proyectos')
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700 mb-2">← Volver</button>
        <h1 className="text-2xl font-bold text-slate-800">Nueva Casa / Proyecto</h1>
        <p className="text-slate-500 mt-1">Registra los datos del trabajo</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Info básica */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
          <p className="font-semibold text-slate-700">Información del Proyecto</p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del proyecto *</label>
            <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)} required
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Casa Smith — Lot 42" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dirección *</label>
            <input type="text" value={form.direccion} onChange={e => set('direccion', e.target.value)} required
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="123 Main St NE, Calgary, AB" />
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contratista / Cliente</label>
            {!mostrarNuevoCliente ? (
              <div className="flex gap-2">
                <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400">
                  <option value="">Seleccionar cliente existente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <button type="button" onClick={() => setMostrarNuevoCliente(true)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium whitespace-nowrap">
                  + Nuevo
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input type="text" value={nuevoCliente} onChange={e => setNuevoCliente(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-lg border border-amber-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Nombre del nuevo cliente" autoFocus />
                <button type="button" onClick={() => { setMostrarNuevoCliente(false); setNuevoCliente('') }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-sm">
                  Cancelar
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha estimada de fin</label>
              <input type="date" value={form.fecha_fin_estimada} onChange={e => set('fecha_fin_estimada', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              placeholder="Observaciones, detalles del trabajo..." />
          </div>
        </div>

        {/* Cálculo de ingreso */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
          <p className="font-semibold text-slate-700">Cálculo de Ingreso</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total Square Feet (SF)</label>
              <input type="number" value={form.total_sf} onChange={e => set('total_sf', e.target.value)}
                step="0.01" min="0"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="ej. 1850" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tarifa por SF ($)</label>
              <input type="number" value={form.tarifa_sf} onChange={e => set('tarifa_sf', e.target.value)}
                step="0.01" min="0"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="0.28" />
            </div>
          </div>

          {/* Trabajos extras */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700">Trabajos Extras</p>
              <button type="button" onClick={addExtra}
                className="text-sm text-amber-600 hover:text-amber-700 font-medium">
                + Agregar extra
              </button>
            </div>

            {extras.length === 0 && (
              <p className="text-xs text-slate-400 italic">Sin trabajos extras todavía</p>
            )}

            <div className="space-y-3">
              {extras.map((ex, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <div className="flex gap-2">
                    <input type="text" value={ex.descripcion} onChange={e => setExtra(i, 'descripcion', e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="Descripción del trabajo extra" />
                    <select value={ex.tipo} onChange={e => setExtra(i, 'tipo', e.target.value as 'sf' | 'concepto')}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                      <option value="concepto">Por concepto</option>
                      <option value="sf">Por SF</option>
                    </select>
                    <button type="button" onClick={() => removeExtra(i)}
                      className="px-2 text-red-400 hover:text-red-600 text-lg">×</button>
                  </div>

                  {ex.tipo === 'sf' ? (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Cantidad SF</label>
                        <input type="number" value={ex.cantidad_sf} onChange={e => setExtra(i, 'cantidad_sf', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="200" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Tarifa/SF</label>
                        <input type="number" value={ex.tarifa_sf} onChange={e => setExtra(i, 'tarifa_sf', e.target.value)}
                          step="0.01"
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="0.28" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Monto ($)</label>
                        <input type="number" value={ex.monto} onChange={e => setExtra(i, 'monto', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50"
                          placeholder="auto" />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Monto ($)</label>
                      <input type="number" value={ex.monto} onChange={e => setExtra(i, 'monto', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="ej. 150.00" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Resumen de ingreso */}
          {ingreso_total > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
              {ingreso_base > 0 && (
                <div className="flex justify-between text-sm text-amber-700">
                  <span>Boarding ({form.total_sf} SF × ${form.tarifa_sf})</span>
                  <span>${ingreso_base.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {extras.map((ex, i) => ex.monto ? (
                <div key={i} className="flex justify-between text-sm text-amber-700">
                  <span>{ex.descripcion || `Extra ${i + 1}`}</span>
                  <span>${parseFloat(ex.monto).toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
                </div>
              ) : null)}
              <div className="border-t border-amber-200 pt-2 flex justify-between font-bold text-amber-800">
                <span>Total estimado</span>
                <span>${ingreso_total.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full bg-amber-400 hover:bg-amber-500 disabled:bg-amber-200 text-slate-900 font-semibold py-3 rounded-lg transition-colors">
          {loading ? 'Guardando...' : 'Crear Proyecto'}
        </button>
      </form>
    </div>
  )
}

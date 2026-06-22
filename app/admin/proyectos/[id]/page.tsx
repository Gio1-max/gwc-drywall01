'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Proyecto {
  id: string
  nombre: string
  direccion: string
  cliente: string | null
  total_sf: number | null
  tarifa_sf: number
  ingreso_total: number | null
  fecha_inicio: string | null
  fecha_fin_estimada: string | null
  activo: boolean
  notas: string | null
}

interface TrabajoExtra {
  id?: string
  descripcion: string
  tipo: 'sf' | 'concepto'
  cantidad_sf: string
  tarifa_sf: string
  monto: string
  guardado?: boolean
}

interface RegistroHora {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  total_horas: number
  estado: string
  profiles: { nombre: string; apellido: string }
}

interface GastoProyecto {
  id: string
  descripcion: string
  categoria: string
  monto: number
  fecha: string
}

interface Cliente {
  id: string
  nombre: string
}

export default function DetalleProyectoPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [nuevoCliente, setNuevoCliente] = useState('')
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false)

  const [form, setForm] = useState({
    nombre: '',
    direccion: '',
    cliente: '',
    total_sf: '',
    tarifa_sf: '0.28',
    fecha_inicio: '',
    fecha_fin_estimada: '',
    notas: '',
    activo: true,
  })

  const [extras, setExtras] = useState<TrabajoExtra[]>([])
  const [horas, setHoras] = useState<RegistroHora[]>([])
  const [gastos, setGastos] = useState<GastoProyecto[]>([])
  const [nuevoGasto, setNuevoGasto] = useState({ descripcion: '', categoria: 'material', monto: '' })
  const [agregandoGasto, setAgregandoGasto] = useState(false)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const [proy, ext, hrs, gsts, cls] = await Promise.all([
      supabase.from('proyectos').select('*').eq('id', id).single(),
      supabase.from('trabajos_extras').select('*').eq('proyecto_id', id),
      supabase.from('registros_horas').select('*, profiles!registros_horas_empleado_id_fkey(nombre, apellido)').eq('proyecto_id', id).order('fecha', { ascending: false }),
      supabase.from('gastos_proyecto').select('*').eq('proyecto_id', id).order('fecha', { ascending: false }),
      supabase.from('clientes').select('id, nombre').order('nombre'),
    ])

    const p: Proyecto = proy.data
    if (p) {
      setForm({
        nombre: p.nombre,
        direccion: p.direccion,
        cliente: p.cliente ?? '',
        total_sf: p.total_sf?.toString() ?? '',
        tarifa_sf: p.tarifa_sf?.toString() ?? '0.28',
        fecha_inicio: p.fecha_inicio ?? '',
        fecha_fin_estimada: p.fecha_fin_estimada ?? '',
        notas: p.notas ?? '',
        activo: p.activo,
      })
    }

    setExtras((ext.data ?? []).map((e: TrabajoExtra & { id: string }) => ({
      id: e.id,
      descripcion: e.descripcion,
      tipo: e.tipo as 'sf' | 'concepto',
      cantidad_sf: e.cantidad_sf?.toString() ?? '',
      tarifa_sf: e.tarifa_sf?.toString() ?? '0.28',
      monto: e.monto?.toString() ?? '',
      guardado: true,
    })))
    setHoras((hrs.data as unknown as RegistroHora[]) ?? [])
    setGastos(gsts.data ?? [])
    setClientes(cls.data ?? [])
    setLoading(false)
  }

  function setF(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function addExtra() {
    setExtras(e => [...e, { descripcion: '', tipo: 'concepto', cantidad_sf: '', tarifa_sf: '0.28', monto: '', guardado: false }])
  }

  function setExtra(index: number, field: keyof TrabajoExtra, value: string) {
    setExtras(prev => prev.map((e, i) => {
      if (i !== index) return e
      const updated = { ...e, [field]: value }
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
  const ingreso_extras = extras.reduce((s, e) => s + (parseFloat(e.monto) || 0), 0)
  const ingreso_total = ingreso_base + ingreso_extras
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0)
  const totalHoras = horas.filter(h => h.estado === 'aprobado').reduce((s, h) => s + h.total_horas, 0)
  const utilidad = ingreso_total - totalGastos

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)

    let clienteNombre = form.cliente
    if (mostrarNuevoCliente && nuevoCliente.trim()) {
      const { data: nc } = await supabase.from('clientes').insert({ nombre: nuevoCliente.trim() }).select('id, nombre').single()
      if (nc) { clienteNombre = nc.nombre; setClientes(c => [...c, nc]) }
    }

    await supabase.from('proyectos').update({
      nombre: form.nombre,
      direccion: form.direccion,
      cliente: clienteNombre || null,
      total_sf: form.total_sf ? parseFloat(form.total_sf) : null,
      tarifa_sf: parseFloat(form.tarifa_sf),
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin_estimada: form.fecha_fin_estimada || null,
      notas: form.notas || null,
      activo: form.activo,
    }).eq('id', id as string)

    // Borrar todos los extras y reinsertar
    await supabase.from('trabajos_extras').delete().eq('proyecto_id', id as string)
    const extrasValidos = extras.filter(ex => ex.descripcion && ex.monto)
    if (extrasValidos.length > 0) {
      await supabase.from('trabajos_extras').insert(extrasValidos.map(ex => ({
        proyecto_id: id,
        descripcion: ex.descripcion,
        tipo: ex.tipo,
        cantidad_sf: ex.tipo === 'sf' && ex.cantidad_sf ? parseFloat(ex.cantidad_sf) : null,
        tarifa_sf: ex.tipo === 'sf' && ex.tarifa_sf ? parseFloat(ex.tarifa_sf) : null,
        monto: parseFloat(ex.monto),
      })))
    }

    setGuardando(false)
    setExito(true)
    setTimeout(() => setExito(false), 3000)
    loadData()
  }

  async function guardarGasto() {
    if (!nuevoGasto.descripcion || !nuevoGasto.monto) return
    await supabase.from('gastos_proyecto').insert({
      proyecto_id: id,
      descripcion: nuevoGasto.descripcion,
      categoria: nuevoGasto.categoria,
      monto: parseFloat(nuevoGasto.monto),
    })
    setNuevoGasto({ descripcion: '', categoria: 'material', monto: '' })
    setAgregandoGasto(false)
    loadData()
  }

  async function eliminarGasto(gastoId: string) {
    await supabase.from('gastos_proyecto').delete().eq('id', gastoId)
    loadData()
  }

  if (loading) return <div className="p-8 text-slate-500">Cargando...</div>

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700 mb-2">← Volver</button>
          <h1 className="text-2xl font-bold text-slate-800">{form.nombre || 'Proyecto'}</h1>
          <p className="text-slate-500 mt-0.5">{form.direccion}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <span className="text-slate-600">Estado:</span>
            <button type="button" onClick={() => setF('activo', !form.activo)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${form.activo ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {form.activo ? 'Activo' : 'Terminado'}
            </button>
          </label>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400">Ingreso Boarding</p>
          <p className="text-xl font-bold text-slate-800">${ingreso_base.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400">Extras</p>
          <p className="text-xl font-bold text-blue-600">${ingreso_extras.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400">Gastos</p>
          <p className="text-xl font-bold text-red-500">${totalGastos.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className={`rounded-xl p-4 border shadow-sm ${utilidad >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-slate-500">Utilidad · {totalHoras}h</p>
          <p className={`text-xl font-bold ${utilidad >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            ${utilidad.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <form onSubmit={handleGuardar} className="space-y-5">

        {/* Info del proyecto */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
          <p className="font-semibold text-slate-700">Información del Proyecto</p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
            <input type="text" value={form.nombre} onChange={e => setF('nombre', e.target.value)} required
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dirección *</label>
            <input type="text" value={form.direccion} onChange={e => setF('direccion', e.target.value)} required
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
            {!mostrarNuevoCliente ? (
              <div className="flex gap-2">
                <input type="text" value={form.cliente} onChange={e => setF('cliente', e.target.value)}
                  list="clientes-list"
                  className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Escribe o selecciona un cliente" />
                <datalist id="clientes-list">
                  {clientes.map(c => <option key={c.id} value={c.nombre} />)}
                </datalist>
                <button type="button" onClick={() => setMostrarNuevoCliente(true)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium whitespace-nowrap">
                  + Nuevo
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input type="text" value={nuevoCliente} onChange={e => setNuevoCliente(e.target.value)} autoFocus
                  className="flex-1 px-3 py-2.5 rounded-lg border border-amber-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Nombre del nuevo cliente" />
                <button type="button" onClick={() => { setMostrarNuevoCliente(false); setNuevoCliente('') }}
                  className="px-3 py-2 bg-slate-100 text-slate-500 rounded-lg text-sm">Cancelar</button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={e => setF('fecha_inicio', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Término</label>
              <input type="date" value={form.fecha_fin_estimada} onChange={e => setF('fecha_fin_estimada', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
            <textarea value={form.notas} onChange={e => setF('notas', e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
          </div>
        </div>

        {/* Cálculo de ingreso + extras */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
          <p className="font-semibold text-slate-700">Ingreso y Trabajos Extras</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total SF</label>
              <input type="number" value={form.total_sf} onChange={e => setF('total_sf', e.target.value)} step="0.01" min="0"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="1850" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tarifa por SF ($)</label>
              <input type="number" value={form.tarifa_sf} onChange={e => setF('tarifa_sf', e.target.value)} step="0.01" min="0"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>

          {/* Trabajos extras */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700">Trabajos Extras</p>
              <button type="button" onClick={addExtra} className="text-sm text-amber-600 hover:text-amber-700 font-medium">
                + Agregar extra
              </button>
            </div>

            {extras.length === 0 && (
              <p className="text-xs text-slate-400 italic">Sin trabajos extras</p>
            )}

            <div className="space-y-3">
              {extras.map((ex, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <div className="flex gap-2">
                    <input type="text" value={ex.descripcion} onChange={e => setExtra(i, 'descripcion', e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="Descripción del trabajo extra" />
                    <select value={ex.tipo} onChange={e => setExtra(i, 'tipo', e.target.value)}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                      <option value="concepto">Por concepto</option>
                      <option value="sf">Por SF</option>
                    </select>
                    <button type="button" onClick={() => removeExtra(i)} className="px-2 text-red-400 hover:text-red-600 text-xl">×</button>
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
                        <input type="number" value={ex.tarifa_sf} onChange={e => setExtra(i, 'tarifa_sf', e.target.value)} step="0.01"
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Monto ($)</label>
                        <input type="number" value={ex.monto} onChange={e => setExtra(i, 'monto', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50" />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Monto ($)</label>
                      <input type="number" value={ex.monto} onChange={e => setExtra(i, 'monto', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="150.00" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Resumen total */}
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
                <span>Total ingreso</span>
                <span>${ingreso_total.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
        </div>

        {/* Gastos */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-700">Gastos y Materiales</h2>
            <button type="button" onClick={() => setAgregandoGasto(true)} className="text-sm text-amber-600 hover:text-amber-700 font-medium">
              + Agregar
            </button>
          </div>

          {agregandoGasto && (
            <div className="bg-slate-50 rounded-xl p-3 mb-3 space-y-2">
              <input type="text" value={nuevoGasto.descripcion} onChange={e => setNuevoGasto(g => ({ ...g, descripcion: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Descripción" autoFocus />
              <div className="flex gap-2">
                <select value={nuevoGasto.categoria} onChange={e => setNuevoGasto(g => ({ ...g, categoria: e.target.value }))}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400">
                  <option value="material">Material</option>
                  <option value="herramienta">Herramienta</option>
                  <option value="transporte">Transporte</option>
                  <option value="otro">Otro</option>
                </select>
                <input type="number" value={nuevoGasto.monto} onChange={e => setNuevoGasto(g => ({ ...g, monto: e.target.value }))}
                  className="w-28 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="$0.00" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={guardarGasto} className="flex-1 bg-amber-400 hover:bg-amber-500 text-slate-900 text-sm font-medium py-1.5 rounded-lg">Guardar</button>
                <button type="button" onClick={() => setAgregandoGasto(false)} className="px-3 text-sm text-slate-500">Cancelar</button>
              </div>
            </div>
          )}

          {gastos.length === 0 && !agregandoGasto ? (
            <p className="text-sm text-slate-400 italic">Sin gastos registrados</p>
          ) : (
            <div className="space-y-1">
              {gastos.map(g => (
                <div key={g.id} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-50 group">
                  <div>
                    <span className="text-slate-700">{g.descripcion}</span>
                    <span className="ml-2 text-xs text-slate-400 capitalize">{g.categoria}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-red-500">${g.monto.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
                    <button type="button" onClick={() => eliminarGasto(g.id)} className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 text-xl leading-none">×</button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold pt-2">
                <span>Total gastos</span>
                <span className="text-red-500">${totalGastos.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
        </div>

        {/* Horas */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-3">Horas Registradas</h2>
          {horas.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Sin horas registradas en este proyecto</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-xs text-slate-400 font-medium">Empleado</th>
                  <th className="text-left py-2 text-xs text-slate-400 font-medium">Fecha</th>
                  <th className="text-left py-2 text-xs text-slate-400 font-medium">Horario</th>
                  <th className="text-right py-2 text-xs text-slate-400 font-medium">Horas</th>
                  <th className="text-right py-2 text-xs text-slate-400 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {horas.map(h => (
                  <tr key={h.id}>
                    <td className="py-2 text-slate-700">{h.profiles.nombre} {h.profiles.apellido}</td>
                    <td className="py-2 text-slate-500">{new Date(h.fecha + 'T00:00:00').toLocaleDateString('es-CA', { day: '2-digit', month: 'short' })}</td>
                    <td className="py-2 text-slate-500">{h.hora_inicio}–{h.hora_fin}</td>
                    <td className="py-2 text-right font-medium text-slate-700">{h.total_horas}h</td>
                    <td className="py-2 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${h.estado === 'aprobado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {h.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200">
                  <td colSpan={3} className="py-2 text-sm font-semibold text-slate-700">Total horas aprobadas</td>
                  <td className="py-2 text-right font-bold text-slate-800">{totalHoras}h</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Botón guardar */}
        <div className="flex items-center gap-4">
          <button type="submit" disabled={guardando}
            className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:bg-amber-200 text-slate-900 font-semibold py-3 rounded-lg transition-colors">
            {guardando ? 'Guardando...' : 'Guardar Cambios'}
          </button>
          {exito && <p className="text-emerald-600 font-medium text-sm">✓ Guardado correctamente</p>}
        </div>
      </form>
    </div>
  )
}

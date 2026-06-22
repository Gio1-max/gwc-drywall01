'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getQuincenaActual, formatFecha, type Quincena } from '@/lib/quincena'

interface Proyecto {
  id: string; nombre: string; direccion: string
  total_sf: number | null; tarifa_sf: number; activo: boolean
  fecha_inicio: string | null; fecha_fin_estimada: string | null
}

interface TrabajoExtra { proyecto_id: string; monto: number }
interface GastoProyecto { proyecto_id: string; monto: number }

interface RegistroHoraCosto {
  proyecto_id: string; tipo: string; total_horas: number
  cantidad_sf: number | null; notas: string | null; pago_ayudante: number | null
  profiles: { tarifa_hora: number | null; tarifa_sf: number | null } | null
}

interface ProyectoCalculado {
  id: string; nombre: string; direccion: string; activo: boolean
  ingreso: number; gastos: number; manoObra: number; utilidad: number; margen: number
}

function getMontoExtra(notas: string | null, pagoAyudante: number | null): number {
  if (!notas) return 0
  const match = notas.match(/SF:.*?=\s*\$?([\d.]+)/)
  const bruto = match ? parseFloat(match[1]) : 0
  return bruto - (pagoAyudante ?? 0)
}

function generarQuincenas(mesesAtras: number, mesesAdelante: number): Quincena[] {
  const lista: Quincena[] = []
  const hoy = new Date()
  for (let offset = -mesesAtras; offset <= mesesAdelante; offset++) {
    const base = new Date(hoy.getFullYear(), hoy.getMonth() + offset, 1)
    lista.push(getQuincenaActual(new Date(base.getFullYear(), base.getMonth(), 1)))
    lista.push(getQuincenaActual(new Date(base.getFullYear(), base.getMonth(), 16)))
  }
  return lista
}

export default function FinanzasPage() {
  const supabase = createClient()
  const quincenas = generarQuincenas(6, 3)
  const quincenaHoy = getQuincenaActual()

  const [loading, setLoading] = useState(true)
  const [quincenaKey, setQuincenaKey] = useState(`${quincenaHoy.inicio}_${quincenaHoy.fin}`)
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [extras, setExtras] = useState<TrabajoExtra[]>([])
  const [gastos, setGastos] = useState<GastoProyecto[]>([])
  const [registrosCosto, setRegistrosCosto] = useState<RegistroHoraCosto[]>([])
  const [meta, setMeta] = useState(0)
  const [metaInput, setMetaInput] = useState('')
  const [editandoMeta, setEditandoMeta] = useState(false)
  const [orden, setOrden] = useState<'utilidad' | 'ingreso' | 'gastos' | 'manoObra'>('utilidad')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [proy, ext, gst, hrs, conf] = await Promise.all([
      supabase.from('proyectos').select('id, nombre, direccion, total_sf, tarifa_sf, activo, fecha_inicio, fecha_fin_estimada'),
      supabase.from('trabajos_extras').select('proyecto_id, monto'),
      supabase.from('gastos_proyecto').select('proyecto_id, monto'),
      supabase.from('registros_horas')
        .select('proyecto_id, tipo, total_horas, cantidad_sf, notas, pago_ayudante, profiles!registros_horas_empleado_id_fkey(tarifa_hora, tarifa_sf)')
        .eq('estado', 'aprobado'),
      supabase.from('configuracion').select('meta_quincenal').eq('id', 1).single(),
    ])

    setProyectos(proy.data ?? [])
    setExtras(ext.data ?? [])
    setGastos(gst.data ?? [])
    setRegistrosCosto((hrs.data as unknown as RegistroHoraCosto[]) ?? [])
    setMeta(conf.data?.meta_quincenal ?? 0)
    setMetaInput((conf.data?.meta_quincenal ?? 0).toString())
    setLoading(false)
  }

  async function guardarMeta() {
    const valor = parseFloat(metaInput) || 0
    await supabase.from('configuracion').update({ meta_quincenal: valor }).eq('id', 1)
    setMeta(valor)
    setEditandoMeta(false)
  }

  const quincenaSel = quincenas.find(q => `${q.inicio}_${q.fin}` === quincenaKey) ?? quincenaHoy

  // Filtrar proyectos cuya fecha de término (o inicio si no hay término) cae en la quincena seleccionada
  const proyectosFiltrados = proyectos.filter(p => {
    const fechaClave = p.fecha_fin_estimada ?? p.fecha_inicio
    if (!fechaClave) return false
    return fechaClave >= quincenaSel.inicio && fechaClave <= quincenaSel.fin
  })

  const proyectosCalculados: ProyectoCalculado[] = proyectosFiltrados.map(p => {
    const ingresoBase = (p.total_sf ?? 0) * (p.tarifa_sf ?? 0)
    const ingresoExtras = extras.filter(e => e.proyecto_id === p.id).reduce((s, e) => s + e.monto, 0)
    const ingreso = ingresoBase + ingresoExtras
    const gastosProyecto = gastos.filter(g => g.proyecto_id === p.id).reduce((s, g) => s + g.monto, 0)
    const manoObra = registrosCosto.filter(r => r.proyecto_id === p.id).reduce((s, r) => {
      if (r.tipo === 'hora') return s + r.total_horas * (r.profiles?.tarifa_hora ?? 0)
      if (r.tipo === 'sf') return s + (r.cantidad_sf ?? 0) * (r.profiles?.tarifa_sf ?? 0)
      return s + getMontoExtra(r.notas, r.pago_ayudante)
    }, 0)
    const utilidad = ingreso - gastosProyecto - manoObra
    const margen = ingreso > 0 ? (utilidad / ingreso) * 100 : 0
    return { id: p.id, nombre: p.nombre, direccion: p.direccion, activo: p.activo, ingreso, gastos: gastosProyecto, manoObra, utilidad, margen }
  })

  const ingresoTotal = proyectosCalculados.reduce((s, p) => s + p.ingreso, 0)
  const gastosTotal = proyectosCalculados.reduce((s, p) => s + p.gastos, 0)
  const manoObraTotal = proyectosCalculados.reduce((s, p) => s + p.manoObra, 0)
  const utilidadTotal = ingresoTotal - gastosTotal - manoObraTotal
  const margenTotal = ingresoTotal > 0 ? (utilidadTotal / ingresoTotal) * 100 : 0

  const proyectosOrdenados = [...proyectosCalculados].sort((a, b) => b[orden] - a[orden])
  const progresoMeta = meta > 0 ? Math.min(100, (utilidadTotal / meta) * 100) : 0

  if (loading) return <div className="p-4 md:p-8 text-slate-500">Cargando...</div>

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Finanzas</h1>
          <p className="text-slate-500 mt-1">Rentabilidad por quincena, según fecha de término de cada proyecto</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Quincena a consultar</label>
          <select value={quincenaKey} onChange={e => setQuincenaKey(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 min-w-[240px]">
            {quincenas.map(q => (
              <option key={`${q.inicio}_${q.fin}`} value={`${q.inicio}_${q.fin}`}>{q.label}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-slate-400">{formatFecha(quincenaSel.inicio)} — {formatFecha(quincenaSel.fin)} · {proyectosFiltrados.length} proyecto{proyectosFiltrados.length !== 1 ? 's' : ''} con fecha de término en este período</p>

      {/* Resumen general */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400">Ingreso</p>
          <p className="text-xl font-bold text-slate-800">${ingresoTotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400">Gastos</p>
          <p className="text-xl font-bold text-red-500">${gastosTotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400">Mano de Obra</p>
          <p className="text-xl font-bold text-red-500">${manoObraTotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className={`rounded-2xl p-4 border shadow-sm ${utilidadTotal >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-slate-500">Utilidad</p>
          <p className={`text-xl font-bold ${utilidadTotal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            ${utilidadTotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400">Margen</p>
          <p className="text-xl font-bold text-slate-800">{margenTotal.toFixed(1)}%</p>
        </div>
      </div>

      {/* Meta */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-700">Meta de utilidad para {quincenaSel.label}</p>
          {!editandoMeta ? (
            <button onClick={() => setEditandoMeta(true)} className="text-xs text-amber-600 hover:text-amber-700 font-medium">
              Editar meta
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input type="number" value={metaInput} onChange={e => setMetaInput(e.target.value)}
                className="w-28 px-2 py-1 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="0.00" />
              <button onClick={guardarMeta} className="text-xs bg-amber-400 hover:bg-amber-500 text-slate-900 font-medium px-3 py-1 rounded-lg">
                Guardar
              </button>
            </div>
          )}
        </div>

        {meta > 0 ? (
          <>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-all ${progresoMeta >= 100 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                style={{ width: `${Math.max(0, progresoMeta)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1.5">
              <span>${utilidadTotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })} de ${meta.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
              <span className="font-medium">{progresoMeta.toFixed(0)}%</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400 italic">No has definido una meta todavía.</p>
        )}
      </div>

      {/* Rentabilidad por proyecto */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-700">Rentabilidad por Proyecto — {quincenaSel.label}</h2>
          <select value={orden} onChange={e => setOrden(e.target.value as typeof orden)}
            className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="utilidad">Ordenar por utilidad</option>
            <option value="ingreso">Ordenar por ingreso</option>
            <option value="gastos">Ordenar por gastos</option>
            <option value="manoObra">Ordenar por mano de obra</option>
          </select>
        </div>

        {proyectosOrdenados.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Ningún proyecto tiene fecha de término (o de inicio) dentro de esta quincena.</p>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-xs text-slate-400 font-medium">Proyecto</th>
                  <th className="text-right py-2 text-xs text-slate-400 font-medium">Ingreso</th>
                  <th className="text-right py-2 text-xs text-slate-400 font-medium">Gastos</th>
                  <th className="text-right py-2 text-xs text-slate-400 font-medium">Mano de Obra</th>
                  <th className="text-right py-2 text-xs text-slate-400 font-medium">Utilidad</th>
                  <th className="text-right py-2 text-xs text-slate-400 font-medium">Margen</th>
                  <th className="text-right py-2 text-xs text-slate-400 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {proyectosOrdenados.map(p => (
                  <tr key={p.id}>
                    <td className="py-2.5">
                      <Link href={`/admin/proyectos/${p.id}`} className="text-slate-700 hover:text-amber-600 font-medium">{p.nombre}</Link>
                      <p className="text-xs text-slate-400">{p.direccion}</p>
                    </td>
                    <td className="py-2.5 text-right text-slate-700">${p.ingreso.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 text-right text-red-500">${p.gastos.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 text-right text-red-500">${p.manoObra.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</td>
                    <td className={`py-2.5 text-right font-semibold ${p.utilidad >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      ${p.utilidad.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 text-right text-slate-500">{p.margen.toFixed(0)}%</td>
                    <td className="py-2.5 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {p.activo ? 'Activo' : 'Terminado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td className="py-2.5 font-semibold text-slate-700">Total</td>
                  <td className="py-2.5 text-right font-semibold text-slate-800">${ingresoTotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</td>
                  <td className="py-2.5 text-right font-semibold text-red-500">${gastosTotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</td>
                  <td className="py-2.5 text-right font-semibold text-red-500">${manoObraTotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</td>
                  <td className={`py-2.5 text-right font-bold ${utilidadTotal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    ${utilidadTotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-slate-600">{margenTotal.toFixed(0)}%</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

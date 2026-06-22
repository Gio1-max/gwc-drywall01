'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getQuincenaActual, formatFecha } from '@/lib/quincena'

interface Proyecto {
  id: string; nombre: string; direccion: string
  total_sf: number | null; tarifa_sf: number; activo: boolean
}

interface TrabajoExtra { proyecto_id: string; monto: number }
interface GastoProyecto { proyecto_id: string; monto: number }
interface Factura { total: number; quincena_inicio: string; quincena_fin: string }

interface ProyectoCalculado {
  id: string; nombre: string; direccion: string; activo: boolean
  ingreso: number; gastos: number; utilidad: number; margen: number
}

export default function FinanzasPage() {
  const supabase = createClient()
  const quincena = getQuincenaActual()

  const [loading, setLoading] = useState(true)
  const [proyectos, setProyectos] = useState<ProyectoCalculado[]>([])
  const [costoManoObraQuincena, setCostoManoObraQuincena] = useState(0)
  const [facturasQuincena, setFacturasQuincena] = useState(0)
  const [meta, setMeta] = useState(0)
  const [metaInput, setMetaInput] = useState('')
  const [editandoMeta, setEditandoMeta] = useState(false)
  const [orden, setOrden] = useState<'utilidad' | 'ingreso' | 'gastos'>('utilidad')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [proy, ext, gst, fact, conf] = await Promise.all([
      supabase.from('proyectos').select('id, nombre, direccion, total_sf, tarifa_sf, activo'),
      supabase.from('trabajos_extras').select('proyecto_id, monto'),
      supabase.from('gastos_proyecto').select('proyecto_id, monto'),
      supabase.from('facturas').select('total, quincena_inicio, quincena_fin')
        .eq('quincena_inicio', quincena.inicio).eq('quincena_fin', quincena.fin),
      supabase.from('configuracion').select('meta_quincenal').eq('id', 1).single(),
    ])

    const proyectosData: Proyecto[] = proy.data ?? []
    const extrasData: TrabajoExtra[] = ext.data ?? []
    const gastosData: GastoProyecto[] = gst.data ?? []
    const facturasData: Factura[] = fact.data ?? []

    const calculados: ProyectoCalculado[] = proyectosData.map(p => {
      const ingresoBase = (p.total_sf ?? 0) * (p.tarifa_sf ?? 0)
      const ingresoExtras = extrasData.filter(e => e.proyecto_id === p.id).reduce((s, e) => s + e.monto, 0)
      const ingreso = ingresoBase + ingresoExtras
      const gastos = gastosData.filter(g => g.proyecto_id === p.id).reduce((s, g) => s + g.monto, 0)
      const utilidad = ingreso - gastos
      const margen = ingreso > 0 ? (utilidad / ingreso) * 100 : 0
      return { id: p.id, nombre: p.nombre, direccion: p.direccion, activo: p.activo, ingreso, gastos, utilidad, margen }
    })

    setProyectos(calculados)
    setCostoManoObraQuincena(facturasData.reduce((s, f) => s + f.total, 0))
    setFacturasQuincena(facturasData.length)
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

  const ingresoTotal = proyectos.reduce((s, p) => s + p.ingreso, 0)
  const gastosTotal = proyectos.reduce((s, p) => s + p.gastos, 0)
  const utilidadTotal = ingresoTotal - gastosTotal
  const margenTotal = ingresoTotal > 0 ? (utilidadTotal / ingresoTotal) * 100 : 0

  const proyectosOrdenados = [...proyectos].sort((a, b) => b[orden] - a[orden])
  const utilidadNetaQuincena = utilidadTotal - costoManoObraQuincena
  const progresoMeta = meta > 0 ? Math.min(100, (utilidadNetaQuincena / meta) * 100) : 0

  if (loading) return <div className="p-4 md:p-8 text-slate-500">Cargando...</div>

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Finanzas</h1>
        <p className="text-slate-500 mt-1">Rentabilidad general y meta de la quincena actual</p>
      </div>

      {/* Resumen general */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400">Ingreso Total (proyectos)</p>
          <p className="text-xl font-bold text-slate-800">${ingresoTotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400">Gastos Total</p>
          <p className="text-xl font-bold text-red-500">${gastosTotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className={`rounded-2xl p-4 border shadow-sm ${utilidadTotal >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-slate-500">Utilidad Total</p>
          <p className={`text-xl font-bold ${utilidadTotal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            ${utilidadTotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400">Margen</p>
          <p className="text-xl font-bold text-slate-800">{margenTotal.toFixed(1)}%</p>
        </div>
      </div>

      {/* Quincena actual */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-slate-700">Quincena Actual</h2>
            <p className="text-xs text-amber-600 font-medium mt-0.5">{quincena.label}</p>
            <p className="text-xs text-slate-400">{formatFecha(quincena.inicio)} — {formatFecha(quincena.fin)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-400">Costo de mano de obra</p>
            <p className="text-lg font-bold text-red-500">${costoManoObraQuincena.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-slate-400 mt-0.5">{facturasQuincena} factura{facturasQuincena !== 1 ? 's' : ''} generada{facturasQuincena !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-400">Utilidad general (todos los proyectos)</p>
            <p className="text-lg font-bold text-slate-800">${utilidadTotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className={`rounded-xl p-4 ${utilidadNetaQuincena >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <p className="text-xs text-slate-500">Utilidad neta (− mano de obra de la quincena)</p>
            <p className={`text-lg font-bold ${utilidadNetaQuincena >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              ${utilidadNetaQuincena.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Meta de ingresos */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">Meta de utilidad para esta quincena</p>
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
                <span>${utilidadNetaQuincena.toLocaleString('en-CA', { minimumFractionDigits: 2 })} de ${meta.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
                <span className="font-medium">{progresoMeta.toFixed(0)}%</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 italic">No has definido una meta todavía.</p>
          )}
        </div>
      </div>

      {/* Rentabilidad por proyecto */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-700">Rentabilidad por Proyecto</h2>
          <select value={orden} onChange={e => setOrden(e.target.value as typeof orden)}
            className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="utilidad">Ordenar por utilidad</option>
            <option value="ingreso">Ordenar por ingreso</option>
            <option value="gastos">Ordenar por gastos</option>
          </select>
        </div>

        {proyectosOrdenados.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No hay proyectos registrados.</p>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-xs text-slate-400 font-medium">Proyecto</th>
                  <th className="text-right py-2 text-xs text-slate-400 font-medium">Ingreso</th>
                  <th className="text-right py-2 text-xs text-slate-400 font-medium">Gastos</th>
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

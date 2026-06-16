'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

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

export default function ProyectosPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'activos' | 'todos'>('activos')
  const supabase = createClient()

  useEffect(() => { loadProyectos() }, [filtro])

  async function loadProyectos() {
    let query = supabase.from('proyectos').select('*').order('created_at', { ascending: false })
    if (filtro === 'activos') query = query.eq('activo', true)
    const { data } = await query
    setProyectos(data ?? [])
    setLoading(false)
  }

  async function toggleActivo(id: string, activo: boolean) {
    await supabase.from('proyectos').update({ activo: !activo }).eq('id', id)
    loadProyectos()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Proyectos</h1>
          <p className="text-slate-500 mt-1">Casas y trabajos activos</p>
        </div>
        <Link
          href="/admin/proyectos/nuevo"
          className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold rounded-lg transition-colors"
        >
          + Nueva Casa
        </Link>
      </div>

      <div className="flex gap-2 mb-6">
        {(['activos', 'todos'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtro === f ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f === 'activos' ? 'Activos' : 'Todos'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-500">Cargando...</p>
      ) : proyectos.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <p className="text-4xl mb-3">🏠</p>
          <p className="text-slate-500">No hay proyectos registrados todavía.</p>
          <Link href="/admin/proyectos/nuevo" className="mt-4 inline-block text-amber-600 font-medium hover:underline">
            Crear el primero
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {proyectos.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-800">{p.nombre}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{p.direccion}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {p.activo ? 'Activo' : 'Terminado'}
                </span>
              </div>

              {p.cliente && (
                <p className="text-xs text-slate-400 mb-3">Cliente: {p.cliente}</p>
              )}

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-slate-400">Total SF</p>
                  <p className="font-semibold text-slate-700">{p.total_sf?.toLocaleString() ?? '—'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-slate-400">Tarifa/SF</p>
                  <p className="font-semibold text-slate-700">${p.tarifa_sf}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-amber-600">Ingreso</p>
                  <p className="font-semibold text-amber-700">
                    {p.ingreso_total ? `$${p.ingreso_total.toLocaleString('en-CA', { minimumFractionDigits: 0 })}` : '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Link
                  href={`/admin/proyectos/${p.id}`}
                  className="text-sm text-slate-600 hover:text-slate-900 font-medium"
                >
                  Ver detalle →
                </Link>
                <button
                  onClick={() => toggleActivo(p.id, p.activo)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  {p.activo ? 'Marcar terminado' : 'Reactivar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface RegistroHora {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  total_horas: number
  estado: 'aprobado' | 'pendiente' | 'rechazado'
  notas: string | null
  profiles: { nombre: string; apellido: string; email: string }
  proyectos: { nombre: string }
}

export default function AdminHorasPage() {
  const [registros, setRegistros] = useState<RegistroHora[]>([])
  const [filtro, setFiltro] = useState<'todos' | 'pendiente' | 'aprobado'>('pendiente')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadRegistros()
  }, [filtro])

  async function loadRegistros() {
    setLoading(true)
    let query = supabase
      .from('registros_horas')
      .select('*, profiles(nombre, apellido, email), proyectos(nombre)')
      .order('created_at', { ascending: false })

    if (filtro !== 'todos') query = query.eq('estado', filtro)

    const { data } = await query
    setRegistros((data as unknown as RegistroHora[]) ?? [])
    setLoading(false)
  }

  async function aprobar(id: string, email: string, nombre: string) {
    await supabase.from('registros_horas').update({ estado: 'aprobado' }).eq('id', id)
    // Notificar por email via API route
    await fetch('/api/notificar-aprobacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, nombre }),
    })
    loadRegistros()
  }

  async function rechazar(id: string) {
    await supabase.from('registros_horas').update({ estado: 'rechazado' }).eq('id', id)
    loadRegistros()
  }

  const estadoColor = {
    pendiente: 'bg-amber-100 text-amber-700',
    aprobado: 'bg-emerald-100 text-emerald-700',
    rechazado: 'bg-red-100 text-red-700',
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Control de Horas</h1>
        <p className="text-slate-500 mt-1">Revisa y aprueba los registros de horas de tus empleados</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        {(['pendiente', 'aprobado', 'todos'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtro === f ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f === 'pendiente' ? 'Pendientes' : f === 'aprobado' ? 'Aprobados' : 'Todos'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-500">Cargando...</p>
      ) : registros.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <p className="text-slate-400 text-lg">No hay registros {filtro === 'pendiente' ? 'pendientes' : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {registros.map(r => (
            <div key={r.id} className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-slate-800">
                      {r.profiles.nombre} {r.profiles.apellido}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${estadoColor[r.estado]}`}>
                      {r.estado}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-slate-600">
                    <div><span className="text-slate-400">Fecha:</span> {new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-CA', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <div><span className="text-slate-400">Proyecto:</span> {r.proyectos?.nombre ?? '-'}</div>
                    <div><span className="text-slate-400">Horario:</span> {r.hora_inicio} – {r.hora_fin}</div>
                    <div><span className="text-slate-400">Total:</span> <span className="font-semibold text-slate-800">{r.total_horas}h</span></div>
                  </div>
                  {r.notas && <p className="mt-2 text-sm text-slate-500 italic">"{r.notas}"</p>}
                </div>

                {r.estado === 'pendiente' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => aprobar(r.id, r.profiles.email, r.profiles.nombre)}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => rechazar(r.id)}
                      className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

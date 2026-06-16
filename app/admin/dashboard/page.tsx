'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Stats {
  totalEmpleados: number
  proyectosActivos: number
  horasPendientesAprobacion: number
  ingresoQuincena: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalEmpleados: 0,
    proyectosActivos: 0,
    horasPendientesAprobacion: 0,
    ingresoQuincena: 0,
  })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadStats() {
      const [empleados, proyectos, horasPendientes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'empleado'),
        supabase.from('proyectos').select('id', { count: 'exact' }).eq('activo', true),
        supabase.from('registros_horas').select('id', { count: 'exact' }).eq('estado', 'pendiente'),
      ])

      setStats({
        totalEmpleados: empleados.count ?? 0,
        proyectosActivos: proyectos.count ?? 0,
        horasPendientesAprobacion: horasPendientes.count ?? 0,
        ingresoQuincena: 0,
      })
      setLoading(false)
    }
    loadStats()
  }, [supabase])

  const cards = [
    { label: 'Empleados Activos', value: stats.totalEmpleados, color: 'bg-blue-500', icon: '👷' },
    { label: 'Proyectos Activos', value: stats.proyectosActivos, color: 'bg-emerald-500', icon: '🏠' },
    { label: 'Horas por Aprobar', value: stats.horasPendientesAprobacion, color: 'bg-amber-500', icon: '⏰', alert: stats.horasPendientesAprobacion > 0 },
    { label: 'Ingreso Quincena', value: `$${stats.ingresoQuincena.toLocaleString()}`, color: 'bg-purple-500', icon: '💰' },
  ]

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">Resumen general de GWC Drywall Construction</p>
      </div>

      {loading ? (
        <div className="text-slate-500">Cargando...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {cards.map(card => (
              <div key={card.label} className={`relative bg-white rounded-2xl p-6 shadow-sm border ${card.alert ? 'border-amber-300' : 'border-slate-100'}`}>
                {card.alert && (
                  <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
                <div className={`w-10 h-10 ${card.color} rounded-xl flex items-center justify-center text-lg mb-4`}>
                  {card.icon}
                </div>
                <p className="text-slate-500 text-sm">{card.label}</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="font-semibold text-slate-700 mb-4">Acciones Rápidas</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/admin/empleados/nuevo" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
                + Agregar Empleado
              </a>
              <a href="/admin/proyectos/nuevo" className="px-4 py-2 bg-amber-400 text-slate-900 rounded-lg text-sm font-medium hover:bg-amber-500 transition-colors">
                + Nuevo Proyecto
              </a>
              <a href="/admin/horas" className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                Ver Horas Pendientes
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

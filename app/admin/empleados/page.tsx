'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Empleado {
  id: string
  nombre: string
  apellido: string
  email: string
  email_etransfer: string | null
  activo: boolean
  created_at: string
}

export default function EmpleadosPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadEmpleados()
  }, [])

  async function loadEmpleados() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'empleado')
      .order('nombre')
    setEmpleados(data ?? [])
    setLoading(false)
  }

  async function toggleActivo(id: string, activo: boolean) {
    await supabase.from('profiles').update({ activo: !activo }).eq('id', id)
    loadEmpleados()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Empleados</h1>
          <p className="text-slate-500 mt-1">Gestiona tu equipo de trabajo</p>
        </div>
        <Link
          href="/admin/empleados/nuevo"
          className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold rounded-lg transition-colors"
        >
          + Agregar Empleado
        </Link>
      </div>

      {loading ? (
        <p className="text-slate-500">Cargando...</p>
      ) : empleados.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <p className="text-4xl mb-3">👷</p>
          <p className="text-slate-500">No hay empleados registrados todavía.</p>
          <Link href="/admin/empleados/nuevo" className="mt-4 inline-block text-amber-600 font-medium hover:underline">
            Agregar el primero
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nombre</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">E-Transfer</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {empleados.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center text-sm font-semibold text-slate-600">
                        {emp.nombre[0]}{emp.apellido[0]}
                      </div>
                      <span className="font-medium text-slate-800">{emp.nombre} {emp.apellido}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">{emp.email}</td>
                  <td className="px-6 py-4 text-slate-600 text-sm">{emp.email_etransfer ?? '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${emp.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {emp.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Link href={`/admin/empleados/${emp.id}`} className="text-sm text-slate-600 hover:text-slate-900 font-medium">
                        Ver detalle
                      </Link>
                      <button
                        onClick={() => toggleActivo(emp.id, emp.activo)}
                        className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {emp.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

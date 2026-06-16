'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { formatFecha } from '@/lib/quincena'

interface Factura {
  id: string
  numero_factura: string
  quincena_inicio: string
  quincena_fin: string
  subtotal: number
  gst: number
  total: number
  created_at: string
  empleado_id: string
}

interface Empleado {
  id: string
  nombre: string
  apellido: string
  email: string
  activo: boolean
  facturas: Factura[]
}

export default function AdminFacturasPage() {
  const supabase = createClient()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)

  async function cargar() {
    const [perfiles, facturas] = await Promise.all([
      supabase.from('profiles').select('id,nombre,apellido,email,activo').neq('role', 'admin').order('nombre'),
      supabase.from('facturas').select('id,numero_factura,quincena_inicio,quincena_fin,subtotal,gst,total,created_at,empleado_id').order('created_at', { ascending: false }),
    ])

    const facturasData: Factura[] = facturas.data ?? []
    const lista: Empleado[] = (perfiles.data ?? []).map(p => ({
      ...p,
      facturas: facturasData.filter(f => f.empleado_id === p.id),
    }))

    setEmpleados(lista)
    setLoading(false)
  }

  useEffect(() => {
    cargar()

    // Suscripción en tiempo real: cuando un empleado genera/actualiza una factura
    const channel = supabase
      .channel('facturas-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facturas' }, () => {
        cargar()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (loading) return <div className="p-8 text-slate-500">Cargando...</div>

  const totalFacturas = empleados.reduce((s, e) => s + e.facturas.length, 0)

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Facturas por Empleado</h1>
        <p className="text-slate-500 text-sm mt-1">{empleados.length} empleados · {totalFacturas} facturas en total</p>
      </div>

      <div className="space-y-3">
        {empleados.map(emp => {
          const abierto = expandido === emp.id
          const totalPagado = emp.facturas.reduce((s, f) => s + f.total, 0)

          return (
            <div key={emp.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Cabecera empleado */}
              <button
                onClick={() => setExpandido(abierto ? null : emp.id)}
                className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center text-sm font-black text-slate-900 shrink-0">
                    {emp.nombre[0]}{emp.apellido[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{emp.nombre} {emp.apellido}</p>
                    <p className="text-xs text-slate-400">{emp.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-slate-400">{emp.facturas.length} {emp.facturas.length === 1 ? 'factura' : 'facturas'}</p>
                    {totalPagado > 0 && (
                      <p className="font-bold text-slate-700">${totalPagado.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
                    )}
                  </div>
                  <span className={`text-slate-400 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}>▼</span>
                </div>
              </button>

              {/* Lista de facturas */}
              {abierto && (
                <div className="border-t border-slate-100">
                  {emp.facturas.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-slate-400 italic">Este empleado aún no ha generado facturas.</p>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {emp.facturas.map(f => {
                        const num = f.numero_factura.match(/^(INV-\d{6}-Q\d)/)?.[1] ?? f.numero_factura
                        return (
                          <Link
                            key={f.id}
                            href={`/admin/empleados/${emp.id}/facturas/${f.id}`}
                            className="flex items-center justify-between px-5 py-3.5 hover:bg-amber-50 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                              <div>
                                <p className="text-sm font-semibold text-slate-700">{num}</p>
                                <p className="text-xs text-slate-400">
                                  {formatFecha(f.quincena_inicio)} — {formatFecha(f.quincena_fin)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="font-bold text-slate-800">${f.total.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
                                {f.gst > 0 && <p className="text-xs text-slate-400">incl. GST ${f.gst.toFixed(2)}</p>}
                              </div>
                              <span className="text-xs text-amber-600 font-medium hover:underline">Ver →</span>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

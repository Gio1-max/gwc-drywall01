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
}

export default function FacturasPage() {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('facturas')
        .select('*').eq('empleado_id', user.id)
        .order('created_at', { ascending: false })
      setFacturas(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Mis Facturas</h1>
        <p className="text-slate-500 text-sm mt-0.5">Historial de facturas generadas</p>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Cargando...</p>
      ) : facturas.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <p className="text-4xl mb-3">🧾</p>
          <p className="text-slate-500">Aún no has generado ninguna factura.</p>
          <Link href="/empleado/horas" className="mt-3 inline-block text-amber-600 font-medium hover:underline text-sm">
            Ir a registrar horas
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {facturas.map(f => (
            <Link key={f.id} href={`/empleado/facturas/${f.id}`}
              className="block bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:border-amber-300 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{f.numero_factura}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {formatFecha(f.quincena_inicio)} — {formatFecha(f.quincena_fin)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-slate-800">${f.total.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
                  {f.gst > 0 && <p className="text-xs text-slate-400">incl. GST ${f.gst.toFixed(2)}</p>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

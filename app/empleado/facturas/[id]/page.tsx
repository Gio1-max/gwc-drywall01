'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatFecha } from '@/lib/quincena'

interface Factura {
  id: string
  numero_factura: string
  quincena_inicio: string
  quincena_fin: string
  subtotal: number
  gst: number
  total: number
  gst_number: string | null
  detalle: Array<{
    fecha: string; tipo: string; total_horas: number
    cantidad_sf: number | null; estado: string; notas: string | null
    pago_ayudante: number | null
    proyectos: { nombre: string; direccion: string }
  }>
  created_at: string
}

interface Perfil {
  nombre: string; apellido: string; email: string
  email_etransfer: string | null; telefono: string | null
  direccion: string | null; sin_number: string | null
  tarifa_hora: number | null; tarifa_sf: number | null
}

function calcularFechaPago(quincenaFin: string): string {
  const fin = new Date(quincenaFin + 'T00:00:00')
  const dia = fin.getDate()
  let fechaPago: Date
  if (dia === 15) {
    // Q1 terminó → la siguiente quincena (16-fin de mes) termina al final del mes
    const ultimoDia = new Date(fin.getFullYear(), fin.getMonth() + 1, 0).getDate()
    fechaPago = new Date(fin.getFullYear(), fin.getMonth(), ultimoDia)
  } else {
    // Q2 terminó → la siguiente quincena (1-15 del siguiente mes) termina el 15
    fechaPago = new Date(fin.getFullYear(), fin.getMonth() + 1, 15)
  }
  return fechaPago.toLocaleDateString('es-CA', { day: '2-digit', month: 'long', year: 'numeric' })
}

function getMontoExtra(r: { notas: string | null; pago_ayudante?: number | null }): number {
  if (!r.notas) return 0
  const match = r.notas.match(/SF:.*?=\s*\$?([\d.]+)/)
  const bruto = match ? parseFloat(match[1]) : 0
  return bruto - (r.pago_ayudante ?? 0)
}

// Extract only the INV-YYYYMM-QX part (no employee name)
function formatNumeroFactura(numero: string): string {
  const match = numero.match(/^(INV-\d{6}-Q\d)/)
  return match ? match[1] : numero
}

export default function FacturaDetallePage() {
  const { id } = useParams()
  const supabase = createClient()
  const [factura, setFactura] = useState<Factura | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [fac, prof] = await Promise.all([
        supabase.from('facturas').select('*').eq('id', id).single(),
        supabase.from('profiles').select('nombre,apellido,email,email_etransfer,telefono,direccion,sin_number,tarifa_hora,tarifa_sf').eq('id', user.id).single(),
      ])
      setFactura(fac.data)
      setPerfil(prof.data)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="p-8 text-slate-500">Cargando...</div>
  if (!factura || !perfil) return <div className="p-8 text-slate-500">Factura no encontrada.</div>

  const fechaEmision = new Date(factura.created_at).toLocaleDateString('es-CA', { day: '2-digit', month: 'long', year: 'numeric' })
  const fechaPago = calcularFechaPago(factura.quincena_fin)

  async function guardarPDF() {
    const element = document.getElementById('factura')
    if (!element) return
    setGuardando(true)
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = (canvas.height * pageWidth) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight)
      pdf.save(`${formatNumeroFactura(factura?.numero_factura ?? '')}.pdf`)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      {/* Botón imprimir - no se imprime */}
      <div className="mb-4 print:hidden flex items-center gap-3">
        <a href="/empleado/facturas" className="text-sm text-slate-500 hover:text-slate-700">← Volver</a>
        <button onClick={guardarPDF} disabled={guardando}
          className="ml-auto px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50">
          {guardando ? 'Generando...' : 'Guardar PDF'}
        </button>
      </div>

      {/* Factura imprimible */}
      <div id="factura" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 print:rounded-none print:border-none print:shadow-none print:p-6 text-xs">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 pb-4 border-b-2 border-slate-800 gap-2">
          <div>
            <h1 className="text-lg font-black text-slate-900">INVOICE</h1>
            <p className="text-slate-500 text-xs mt-0.5">{formatNumeroFactura(factura.numero_factura)}</p>
          </div>
          <div className="sm:text-right text-xs text-slate-600 space-y-0.5">
            <p><span className="font-semibold">Issue Date:</span> {fechaEmision}</p>
            <p><span className="font-semibold">Period:</span> {formatFecha(factura.quincena_inicio)} – {formatFecha(factura.quincena_fin)}</p>
            <p><span className="font-semibold">Payment Due:</span> {fechaPago}</p>
          </div>
        </div>

        {/* Partes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          {/* Emisor (empleado) */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">From</p>
            <p className="font-bold text-slate-800 text-sm">{perfil.nombre} {perfil.apellido}</p>
            {perfil.direccion && <p className="text-xs text-slate-600">{perfil.direccion}</p>}
            {perfil.telefono && <p className="text-xs text-slate-600">{perfil.telefono}</p>}
            <p className="text-xs text-slate-600">{perfil.email}</p>
            {perfil.sin_number && <p className="text-xs text-slate-500 mt-1">SIN: {perfil.sin_number}</p>}
            {factura.gst_number && <p className="text-xs text-slate-500">GST#: {factura.gst_number}</p>}
          </div>

          {/* Receptor (GWC) */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bill To</p>
            <p className="font-bold text-slate-800 text-sm">GWC DRYWALL CONSTRUCTION LTD</p>
            <p className="text-xs text-slate-600">79 Sage Hill Lane NW</p>
            <p className="text-xs text-slate-600">Calgary, AB T2G 1T2</p>
            <p className="text-xs text-slate-600">gwcdrywallconstructionltd@gmail.com</p>
            <p className="text-xs text-slate-500 mt-1">GST#: 733595425RT0001</p>
          </div>
        </div>

        {/* Tabla de servicios */}
        <div className="overflow-x-auto -mx-4 sm:mx-0 mb-5">
        <table className="w-full min-w-[480px] sm:min-w-0">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="text-left px-3 py-2 text-xs font-semibold rounded-tl-lg">Description</th>
              <th className="text-left px-3 py-2 text-xs font-semibold">Project</th>
              <th className="text-center px-3 py-2 text-xs font-semibold">Date</th>
              <th className="text-right px-3 py-2 text-xs font-semibold">Hours</th>
              <th className="text-right px-3 py-2 text-xs font-semibold rounded-tr-lg">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {factura.detalle.map((r, i) => {
              const monto = r.tipo === 'hora'
                ? r.total_horas * (perfil.tarifa_hora ?? 0)
                : r.tipo === 'sf'
                ? (r.cantidad_sf ?? 0) * (perfil.tarifa_sf ?? 0)
                : getMontoExtra(r)
              const descripcion = r.notas?.startsWith('TRABAJO EXTRA:')
                ? r.notas.split('|')[0].replace('TRABAJO EXTRA:', '').trim()
                : r.tipo === 'hora' ? 'Boarding Labour'
                : r.tipo === 'sf' ? 'Boarding Labour (SF)'
                : 'Extra Work'
              // Extract SF info from notas for display
              const sfMatch = r.tipo === 'extra' ? r.notas?.match(/SF:\s*([\d.]+)\s*x\s*\$([\d.]+)/) : null
              const ayudanteMatch = r.tipo === 'extra' ? r.notas?.match(/AYUDANTE:\s*([^|]+?)\s*-\s*[\d.]+h/) : null
              const horas = r.tipo === 'hora'
                ? `${r.total_horas}h`
                : r.tipo === 'sf'
                ? `${r.cantidad_sf} SF`
                : sfMatch ? `${sfMatch[1]} SF × $${sfMatch[2]}` : '—'
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-3 py-2 text-xs text-slate-700">
                    {descripcion}
                    {ayudanteMatch && r.pago_ayudante && (
                      <p className="text-[10px] text-slate-400 italic mt-0.5">Helper: {ayudanteMatch[1].trim()} (−${r.pago_ayudante.toFixed(2)})</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{r.proyectos?.direccion ?? r.proyectos?.nombre}</td>
                  <td className="px-3 py-2 text-xs text-slate-500 text-center">{new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-CA', { day: '2-digit', month: 'short' })}</td>
                  <td className="px-3 py-2 text-xs text-slate-600 text-right">{horas}</td>
                  <td className="px-3 py-2 text-xs font-medium text-slate-800 text-right">${monto.toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>

        {/* Totales */}
        <div className="flex justify-end">
          <div className="w-56">
            <div className="flex justify-between py-1.5 text-xs text-slate-600 border-b border-slate-100">
              <span>Subtotal</span>
              <span>${factura.subtotal.toFixed(2)}</span>
            </div>
            {factura.gst > 0 && (
              <div className="flex justify-between py-1.5 text-xs text-slate-600 border-b border-slate-100">
                <span>GST (5%)</span>
                <span>${factura.gst.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 font-bold text-slate-800 text-sm">
              <span>TOTAL</span>
              <span>${factura.total.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* E-Transfer info */}
        {perfil.email_etransfer && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs">
            <p className="font-semibold text-amber-800 mb-1">Payment Information</p>
            <p className="text-amber-700">Please send payment via E-Transfer to: <strong>{perfil.email_etransfer}</strong></p>
          </div>
        )}

        <div className="mt-6 pt-3 border-t border-slate-100 text-center text-[10px] text-slate-400">
          Invoice issued {fechaEmision} · GWC Drywall Construction Ltd. · Calgary, AB
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #factura, #factura * { visibility: visible; }
          #factura { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  )
}

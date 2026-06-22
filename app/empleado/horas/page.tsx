'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getQuincenaActual, formatFecha } from '@/lib/quincena'

interface Proyecto { id: string; nombre: string; direccion: string }

interface RegistroHora {
  id: string; fecha: string; hora_inicio: string; hora_fin: string
  total_horas: number; tipo: string; cantidad_sf: number | null
  estado: string; notas: string | null; proyecto_id: string
  ayudante_id: string | null; horas_ayudante: number | null; pago_ayudante: number | null
  proyectos: { nombre: string; direccion: string }
}

interface Ayudante { id: string; nombre: string; apellido: string; tarifa_hora: number | null }

interface Perfil {
  id: string; nombre: string; apellido: string; email: string
  email_etransfer: string | null; telefono: string | null
  direccion: string | null; sin_number: string | null
  tarifa_hora: number | null; tarifa_sf: number | null
  gst_number: string | null; cobra_gst: boolean
}

function calcularHoras(inicio: string, fin: string) {
  const [hI, mI] = inicio.split(':').map(Number)
  const [hF, mF] = fin.split(':').map(Number)
  return Math.max(0, Math.round(((hF * 60 + mF) - (hI * 60 + mI)) / 60 * 100) / 100)
}

function getMontoExtra(r: { notas: string | null; pago_ayudante?: number | null }): number {
  if (!r.notas) return 0
  const match = r.notas.match(/SF:.*?=\s*\$?([\d.]+)/)
  const bruto = match ? parseFloat(match[1]) : 0
  return bruto - (r.pago_ayudante ?? 0)
}

function parseExtraNotas(notas: string | null) {
  const result = { descripcionExtra: '', fechaInicioExtra: '', fechaFinExtra: '', cantidadSf: '', tarifaSfExtra: '', notas: '' }
  if (!notas) return result
  const parts = notas.split(' | ')
  result.descripcionExtra = parts[0]?.replace('TRABAJO EXTRA:', '').trim() ?? ''
  for (const part of parts.slice(1)) {
    const fechaMatch = part.match(/Del (\d{4}-\d{2}-\d{2}) al (\d{4}-\d{2}-\d{2})/)
    const sfMatch = part.match(/SF:\s*([\d.]+)\s*x\s*\$([\d.]+)/)
    const esAyudante = part.startsWith('AYUDANTE:')
    if (fechaMatch) { result.fechaInicioExtra = fechaMatch[1]; result.fechaFinExtra = fechaMatch[2] }
    else if (sfMatch) { result.cantidadSf = sfMatch[1]; result.tarifaSfExtra = sfMatch[2] }
    else if (!esAyudante && part) result.notas = part
  }
  return result
}

function parseOvertimeNotas(notas: string | null): string {
  if (!notas) return ''
  const match = notas.match(/HORAS EXTRAS — (.*)/)
  return match ? match[1] : ''
}

export default function EmpleadoHorasPage() {
  const router = useRouter()
  const supabase = createClient()
  const quincena = getQuincenaActual()
  const hoy = new Date().toISOString().split('T')[0]

  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [ayudantes, setAyudantes] = useState<Ayudante[]>([])
  const [historial, setHistorial] = useState<RegistroHora[]>([])
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [userId, setUserId] = useState('')
  const [tipo, setTipo] = useState<'hora' | 'sf' | 'extra' | 'overtime'>('hora')
  const [form, setForm] = useState({
    proyectoId: '', fecha: hoy,
    horaInicio: '', horaFin: '', cantidadSf: '',
    tarifaSfExtra: '', fechaInicioExtra: '', fechaFinExtra: '',
    descripcionExtra: '', notas: '',
    ayudanteId: '', horasAyudante: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
  const [mostrarGST, setMostrarGST] = useState(false)
  const [gstInput, setGstInput] = useState('')
  const [cobrarGST, setCobrarGST] = useState(false)
  const [facturaExistenteId, setFacturaExistenteId] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const esHoy = form.fecha === hoy
  const totalHoras = (form.horaInicio && form.horaFin) ? calcularHoras(form.horaInicio, form.horaFin) : 0
  const gananciaRegistro = (tipo === 'hora' || tipo === 'overtime')
    ? totalHoras * (perfil?.tarifa_hora ?? 0)
    : tipo === 'sf' ? parseFloat(form.cantidadSf || '0') * (perfil?.tarifa_sf ?? 0) : 0

  const ayudanteSeleccionado = ayudantes.find(a => a.id === form.ayudanteId)
  const pagoAyudante = form.ayudanteId && form.horasAyudante
    ? parseFloat(form.horasAyudante) * (ayudanteSeleccionado?.tarifa_hora ?? 0)
    : 0
  const montoSFBruto = (form.cantidadSf && form.tarifaSfExtra) ? parseFloat(form.cantidadSf) * parseFloat(form.tarifaSfExtra) : 0
  const montoSFNeto = montoSFBruto - pagoAyudante

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const [prof, proy, hist, ayud] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('proyectos').select('id, nombre, direccion').eq('activo', true),
        supabase.from('registros_horas')
          .select('*, proyectos(nombre, direccion)')
          .eq('empleado_id', user.id)
          .gte('fecha', quincena.inicio)
          .lte('fecha', quincena.fin)
          .order('fecha', { ascending: false }),
        supabase.from('profiles').select('id, nombre, apellido, tarifa_hora')
          .neq('role', 'admin').eq('activo', true).neq('id', user.id),
      ])
      if (prof.data) {
        setPerfil(prof.data)
        setGstInput(prof.data.gst_number ?? '')
        setCobrarGST(prof.data.cobra_gst ?? false)
      }
      setProyectos(proy.data ?? [])
      setHistorial((hist.data as unknown as RegistroHora[]) ?? [])
      setAyudantes(ayud.data ?? [])
    }
    init()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.proyectoId) { setError('Selecciona un proyecto.'); return }
    if ((tipo === 'hora' || tipo === 'overtime') && (!form.horaInicio || !form.horaFin)) { setError('Ingresa hora de inicio y fin.'); return }
    if ((tipo === 'hora' || tipo === 'overtime') && totalHoras <= 0) { setError('La hora de fin debe ser mayor a la de inicio.'); return }
    if (tipo === 'sf' && !form.cantidadSf) { setError('Ingresa la cantidad de SF.'); return }
    if (tipo === 'extra' && !form.descripcionExtra) { setError('Describe el trabajo extra realizado.'); return }
    if (tipo === 'extra' && form.ayudanteId && !form.horasAyudante) { setError('Ingresa las horas trabajadas del ayudante.'); return }

    setLoading(true); setError('')
    const estado = (tipo === 'hora' && esHoy) ? 'aprobado' : 'pendiente'

    const registro = {
      empleado_id: userId,
      proyecto_id: form.proyectoId,
      fecha: form.fecha,
      hora_inicio: (tipo === 'hora' || tipo === 'overtime') ? form.horaInicio : '00:00',
      hora_fin: (tipo === 'hora' || tipo === 'overtime') ? form.horaFin : '00:00',
      total_horas: (tipo === 'hora' || tipo === 'overtime') ? totalHoras : 0,
      tipo: tipo === 'overtime' ? 'hora' : tipo,
      cantidad_sf: tipo === 'sf' ? parseFloat(form.cantidadSf) : null,
      estado,
      ayudante_id: tipo === 'extra' && form.ayudanteId ? form.ayudanteId : null,
      horas_ayudante: tipo === 'extra' && form.ayudanteId && form.horasAyudante ? parseFloat(form.horasAyudante) : null,
      pago_ayudante: tipo === 'extra' && form.ayudanteId && form.horasAyudante ? pagoAyudante : null,
      notas: tipo === 'extra'
        ? [
            `TRABAJO EXTRA: ${form.descripcionExtra}`,
            form.fechaInicioExtra ? `Del ${form.fechaInicioExtra} al ${form.fechaFinExtra || form.fechaInicioExtra}` : '',
            form.cantidadSf && form.tarifaSfExtra ? `SF: ${form.cantidadSf} x $${form.tarifaSfExtra} = $${(parseFloat(form.cantidadSf) * parseFloat(form.tarifaSfExtra)).toFixed(2)}` : '',
            form.ayudanteId && form.horasAyudante ? `AYUDANTE: ${ayudanteSeleccionado?.nombre} ${ayudanteSeleccionado?.apellido} - ${form.horasAyudante}h` : '',
            form.notas || '',
          ].filter(Boolean).join(' | ')
        : tipo === 'overtime' ? `HORAS EXTRAS${form.notas ? ` — ${form.notas}` : ''}` : form.notas || null,
    }

    const { error: err } = editandoId
      ? await supabase.from('registros_horas').update(registro).eq('id', editandoId)
      : await supabase.from('registros_horas').insert(registro)

    if (err) { setError('Error al guardar. Intenta de nuevo.'); setLoading(false); return }

    if (estado === 'pendiente' && perfil && !editandoId) {
      await fetch('/api/notificar-admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: `${perfil.nombre} ${perfil.apellido}`, fecha: form.fecha }),
      })
    }

    setSuccess(true)
    setEditandoId(null)
    setTipo('hora')
    setForm(f => ({ ...f, proyectoId: '', horaInicio: '', horaFin: '', cantidadSf: '', tarifaSfExtra: '', fechaInicioExtra: '', fechaFinExtra: '', descripcionExtra: '', notas: '', ayudanteId: '', horasAyudante: '' }))
    setLoading(false)
    const { data } = await supabase.from('registros_horas')
      .select('*, proyectos(nombre, direccion)')
      .eq('empleado_id', userId)
      .gte('fecha', quincena.inicio).lte('fecha', quincena.fin)
      .order('fecha', { ascending: false })
    setHistorial((data as unknown as RegistroHora[]) ?? [])
    setTimeout(() => setSuccess(false), 3000)
  }

  function iniciarEdicion(r: RegistroHora) {
    setEditandoId(r.id)
    const esOvertime = r.tipo === 'hora' && r.notas?.startsWith('HORAS EXTRAS')
    setTipo(esOvertime ? 'overtime' : (r.tipo as typeof tipo))

    if (r.tipo === 'extra') {
      const parsed = parseExtraNotas(r.notas)
      setForm(f => ({ ...f, proyectoId: r.proyecto_id, fecha: r.fecha, ...parsed, ayudanteId: r.ayudante_id ?? '', horasAyudante: r.horas_ayudante?.toString() ?? '' }))
    } else if (esOvertime) {
      setForm(f => ({ ...f, proyectoId: r.proyecto_id, fecha: r.fecha, horaInicio: r.hora_inicio, horaFin: r.hora_fin, notas: parseOvertimeNotas(r.notas) }))
    } else {
      setForm(f => ({ ...f, proyectoId: r.proyecto_id, fecha: r.fecha, horaInicio: r.hora_inicio, horaFin: r.hora_fin, cantidadSf: r.cantidad_sf?.toString() ?? '', notas: r.notas ?? '' }))
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setTipo('hora')
    setForm(f => ({ ...f, proyectoId: '', fecha: hoy, horaInicio: '', horaFin: '', cantidadSf: '', tarifaSfExtra: '', fechaInicioExtra: '', fechaFinExtra: '', descripcionExtra: '', notas: '', ayudanteId: '', horasAyudante: '' }))
  }

  // Cálculos quincena
  const registrosAprobados = historial.filter(r => r.estado === 'aprobado')
  const totalHorasQuincena = registrosAprobados.filter(r => r.tipo !== 'sf' && r.tipo !== 'extra').reduce((s, r) => s + r.total_horas, 0)
  const totalSFQuincena = registrosAprobados.filter(r => r.tipo === 'sf').reduce((s, r) => s + (r.cantidad_sf ?? 0), 0)
  const gananciaHoras = totalHorasQuincena * (perfil?.tarifa_hora ?? 0)
  const gananciaSF = totalSFQuincena * (perfil?.tarifa_sf ?? 0)
  const gananciaExtras = registrosAprobados.filter(r => r.tipo === 'extra').reduce((s, r) => s + getMontoExtra(r), 0)
  const subtotal = gananciaHoras + gananciaSF + gananciaExtras
  const gstMonto = cobrarGST ? subtotal * 0.05 : 0
  const total = subtotal + gstMonto

  async function generarFactura() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const uid = user.id

    const detalleOrdenado = [...registrosAprobados].sort((a, b) => a.fecha.localeCompare(b.fecha))

    // Guardar GST si cambió
    if (gstInput !== perfil?.gst_number || cobrarGST !== perfil?.cobra_gst) {
      await supabase.from('profiles').update({
        gst_number: gstInput || null,
        cobra_gst: cobrarGST,
      }).eq('id', uid)
    }

    // Guardar o reemplazar factura
    const pad = (n: number) => String(n).padStart(2, '0')
    const numeroFactura = `INV-${quincena.anio}${pad(quincena.mes)}-Q${quincena.numero}-${perfil?.nombre?.toUpperCase().replace(/\s/g, '')}`

    let facturaId = facturaExistenteId

    if (facturaExistenteId) {
      // Actualizar la factura existente
      await supabase.from('facturas').update({
        subtotal,
        gst: gstMonto,
        total,
        gst_number: cobrarGST ? gstInput : null,
        detalle: detalleOrdenado,
      }).eq('id', facturaExistenteId)
    } else {
      // Crear nueva factura
      const { data: nuevaFactura } = await supabase.from('facturas').insert({
        empleado_id: uid,
        numero_factura: numeroFactura,
        quincena_inicio: quincena.inicio,
        quincena_fin: quincena.fin,
        subtotal,
        gst: gstMonto,
        total,
        gst_number: cobrarGST ? gstInput : null,
        detalle: detalleOrdenado,
      }).select('id').single()
      facturaId = nuevaFactura?.id ?? null
    }

    const factura = { id: facturaId }

    setMostrarConfirmacion(false)
    setMostrarGST(false)
    if (factura) {
      router.push(`/empleado/facturas/${factura.id}`)
    }
  }

  const porFecha = historial.reduce<Record<string, RegistroHora[]>>((acc, r) => {
    if (!acc[r.fecha]) acc[r.fecha] = []
    acc[r.fecha].push(r)
    return acc
  }, {})

  const estadoColor: Record<string, string> = {
    aprobado: 'bg-emerald-100 text-emerald-700',
    pendiente: 'bg-amber-100 text-amber-700',
    rechazado: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-5">
      {/* Header quincena */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Mis Horas</h1>
          <p className="text-slate-500 text-sm mt-0.5">Hola, {perfil?.nombre} 👋</p>
          <p className="text-xs text-amber-600 font-medium mt-1">{quincena.label}</p>
          <p className="text-xs text-slate-400">{formatFecha(quincena.inicio)} — {formatFecha(quincena.fin)}</p>
        </div>
        {perfil?.tarifa_hora && (
          <div className="text-right">
            <p className="text-xs text-slate-400">Tu tarifa</p>
            <p className="font-bold text-slate-700">${perfil.tarifa_hora}/hr</p>
            {perfil.tarifa_sf && <p className="text-xs text-slate-400">${perfil.tarifa_sf}/sf</p>}
          </div>
        )}
      </div>

      {/* Resumen quincena */}
      {subtotal > 0 && (
        <div className="bg-amber-400 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-amber-900 font-medium">Total aprobado esta quincena</p>
              <p className="text-3xl font-black text-slate-900">${total.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-4xl">💰</div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-amber-900">
            {gananciaHoras > 0 && <span>{totalHorasQuincena}h × ${perfil?.tarifa_hora} = ${gananciaHoras.toFixed(2)}</span>}
            {gananciaSF > 0 && <span>{totalSFQuincena} SF × ${perfil?.tarifa_sf} = ${gananciaSF.toFixed(2)}</span>}
            {gananciaExtras > 0 && <span>Trabajos extra = ${gananciaExtras.toFixed(2)}</span>}
            {cobrarGST && <span>GST 5% = ${gstMonto.toFixed(2)}</span>}
          </div>
          {/* Botón generar factura */}
          <button
            onClick={async () => {
              const { data: { user } } = await supabase.auth.getUser()
              if (!user) return
              const { data } = await supabase
                .from('facturas')
                .select('id')
                .eq('empleado_id', user.id)
                .eq('quincena_inicio', quincena.inicio)
                .eq('quincena_fin', quincena.fin)
                .maybeSingle()
              setFacturaExistenteId(data?.id ?? null)
              setMostrarConfirmacion(true)
            }}
            className="mt-3 w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            Generar Factura de la Quincena
          </button>
        </div>
      )}

      {/* Modal confirmación */}
      {mostrarConfirmacion && !mostrarGST && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-lg font-bold text-slate-800 mb-2">¿Generar factura?</h2>
            <p className="text-slate-600 text-sm mb-3">
              Antes de generar tu factura, asegúrate de que <strong>todos tus registros de trabajo están cargados y aprobados</strong>. Una vez generada, quedará guardada en tu historial. ¿Deseas continuar?
            </p>
            {facturaExistenteId && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-3">
                <p className="text-sm text-amber-800 font-semibold">⚠️ Ya existe una factura para esta quincena</p>
                <p className="text-xs text-amber-700 mt-1">La factura anterior será reemplazada con los registros actualizados. El número de factura se mantendrá.</p>
              </div>
            )}
            <div className="bg-slate-50 rounded-xl p-3 mb-4 text-sm text-slate-600">
              <p><span className="font-medium">Período:</span> {quincena.label}</p>
              <p><span className="font-medium">Registros aprobados:</span> {registrosAprobados.length}</p>
              <p><span className="font-medium">Subtotal:</span> ${subtotal.toFixed(2)}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setMostrarGST(true)}
                className="flex-1 bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold py-2.5 rounded-xl">
                Sí, continuar
              </button>
              <button onClick={() => setMostrarConfirmacion(false)}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal GST */}
      {mostrarGST && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-lg font-bold text-slate-800 mb-2">¿Tu factura incluye GST?</h2>
            <p className="text-slate-500 text-sm mb-4">Si estás registrado para cobrar GST, el 5% se sumará al total de tu factura.</p>

            <div className="flex gap-3 mb-4">
              <button onClick={() => setCobrarGST(true)}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-colors ${cobrarGST ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                Sí, cobro GST
              </button>
              <button onClick={() => setCobrarGST(false)}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-colors ${!cobrarGST ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                No, sin GST
              </button>
            </div>

            {cobrarGST && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Número de GST</label>
                <input type="text" value={gstInput} onChange={e => setGstInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="123456789RT0001" />
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm">
              <div className="flex justify-between text-slate-700"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              {cobrarGST && <div className="flex justify-between text-slate-700"><span>GST 5%</span><span>${(subtotal * 0.05).toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-slate-800 border-t border-amber-200 mt-2 pt-2">
                <span>Total</span>
                <span>${(subtotal + (cobrarGST ? subtotal * 0.05 : 0)).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={generarFactura}
                className="flex-1 bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold py-2.5 rounded-xl">
                Generar Factura
              </button>
              <button onClick={() => setMostrarGST(false)}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium">
                Atrás
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulario registro */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-700">{editandoId ? 'Editar Registro' : 'Registrar Trabajo'}</h2>
          {editandoId && (
            <button type="button" onClick={cancelarEdicion} className="text-xs text-slate-400 hover:text-slate-600">
              Cancelar edición
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { key: 'hora', label: 'Horas Normales' },
            { key: 'overtime', label: 'Horas Extras' },
            ...(perfil?.tarifa_sf ? [{ key: 'sf', label: 'Por SF' }] : []),
            { key: 'extra', label: 'Trabajo Extra' },
          ].map(t => (
            <button key={t.key} type="button" onClick={() => setTipo(t.key as typeof tipo)}
              className={`py-2 rounded-lg text-sm font-medium transition-colors ${tipo === t.key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {(tipo === 'overtime' || tipo === 'extra' || tipo === 'sf') && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
            <p className="text-xs text-amber-700">⚠️ Este registro queda pendiente de aprobación del administrador.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Proyecto *</label>
            <select value={form.proyectoId} onChange={e => setForm(f => ({ ...f, proyectoId: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400">
              <option value="">Selecciona un proyecto...</option>
              {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre} — {p.direccion}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha *</label>
            <input type="date" value={form.fecha} max={hoy} min={quincena.inicio}
              onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            {!esHoy && tipo === 'hora' && (
              <p className="mt-1 text-xs text-amber-600">⚠️ Registro de día anterior — pendiente de aprobación.</p>
            )}
          </div>

          {(tipo === 'hora' || tipo === 'overtime') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hora de Inicio *</label>
                <input type="time" value={form.horaInicio} onChange={e => setForm(f => ({ ...f, horaInicio: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hora de Fin *</label>
                <input type="time" value={form.horaFin} onChange={e => setForm(f => ({ ...f, horaFin: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>
          )}

          {tipo === 'sf' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad de SF *</label>
              <input type="number" value={form.cantidadSf} step="0.01" min="0"
                onChange={e => setForm(f => ({ ...f, cantidadSf: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="ej. 500" />
            </div>
          )}

          {tipo === 'extra' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción del trabajo *</label>
                <input type="text" value={form.descripcionExtra}
                  onChange={e => setForm(f => ({ ...f, descripcionExtra: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="ej. Boarding sala, taping cuartos..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de inicio</label>
                  <input type="date" value={form.fechaInicioExtra} max={hoy}
                    onChange={e => setForm(f => ({ ...f, fechaInicioExtra: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de término</label>
                  <input type="date" value={form.fechaFinExtra} max={hoy}
                    onChange={e => setForm(f => ({ ...f, fechaFinExtra: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>
              <div className="border-t border-slate-100 pt-3">
                <p className="text-sm font-medium text-slate-600 mb-2">Producción por SF (opcional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Total Square Feet (SF)</label>
                    <input type="number" value={form.cantidadSf} step="0.01" min="0"
                      onChange={e => setForm(f => ({ ...f, cantidadSf: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="ej. 1850" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tarifa por SF ($)</label>
                    <input type="number" value={form.tarifaSfExtra} step="0.01" min="0"
                      onChange={e => setForm(f => ({ ...f, tarifaSfExtra: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="0.01" />
                  </div>
                </div>
                {form.cantidadSf && form.tarifaSfExtra && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 flex justify-between">
                    <span className="text-sm text-amber-700">{form.cantidadSf} SF × ${form.tarifaSfExtra}</span>
                    <span className="font-bold text-amber-800">${montoSFBruto.toFixed(2)}</span>
                  </div>
                )}

                {/* Ayudante */}
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Selecciona a un ayudante:</label>
                    <select value={form.ayudanteId} onChange={e => setForm(f => ({ ...f, ayudanteId: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400">
                      <option value="">Ninguno</option>
                      {ayudantes.map(a => (
                        <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>
                      ))}
                    </select>
                  </div>
                  {form.ayudanteId && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Horas trabajadas (del ayudante)</label>
                      <input type="number" value={form.horasAyudante} step="0.5" min="0"
                        onChange={e => setForm(f => ({ ...f, horasAyudante: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="ej. 4.5" />
                    </div>
                  )}
                  {form.cantidadSf && form.tarifaSfExtra && pagoAyudante > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex justify-between">
                      <span className="text-sm text-emerald-700">Neto para ti (ya descontado el ayudante)</span>
                      <span className="font-bold text-emerald-800">${montoSFNeto.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {gananciaRegistro > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex justify-between items-center">
              <p className="text-sm text-amber-700">
                {(tipo === 'hora' || tipo === 'overtime') && `${totalHoras}h × $${perfil?.tarifa_hora}/hr`}
                {tipo === 'sf' && `${form.cantidadSf} sf × $${perfil?.tarifa_sf}/sf`}
              </p>
              <p className="font-bold text-amber-800">${gananciaRegistro.toFixed(2)}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notas (opcional)</label>
            <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2}
              placeholder="Observaciones..."
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
          {success && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">✓ Registro guardado correctamente</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-amber-400 hover:bg-amber-500 disabled:bg-amber-200 text-slate-900 font-semibold py-3 rounded-lg transition-colors">
            {loading ? 'Guardando...' : editandoId ? 'Guardar Cambios' : 'Guardar Registro'}
          </button>
        </form>
      </div>

      {/* Historial de la quincena */}
      {Object.keys(porFecha).length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4">Registros de esta quincena</h2>
          <div className="space-y-4">
            {Object.entries(porFecha).map(([fecha, registros]) => (
              <div key={fecha}>
                <p className="text-sm font-semibold text-slate-600 mb-2 capitalize">
                  {new Date(fecha + 'T00:00:00').toLocaleDateString('es-CA', { weekday: 'long', day: '2-digit', month: 'long' })}
                </p>
                <div className="space-y-2">
                  {registros.map(r => (
                    <div key={r.id} className="flex items-start justify-between p-3 rounded-lg bg-slate-50">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{r.proyectos?.nombre}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{r.proyectos?.direccion}</p>
                        {r.tipo === 'hora' && <p className="text-xs text-slate-400">{r.hora_inicio}–{r.hora_fin}</p>}
                        {r.tipo === 'sf' && <p className="text-xs text-slate-400">{r.cantidad_sf} SF</p>}
                        {r.notas && <p className="text-xs text-slate-400 italic mt-0.5">{r.notas}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-sm font-semibold text-slate-700">
                          {r.tipo === 'hora' ? `${r.total_horas}h` : r.tipo === 'sf' ? `${r.cantidad_sf} sf` : 'extra'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${estadoColor[r.estado] ?? ''}`}>{r.estado}</span>
                        <button
                          onClick={() => iniciarEdicion(r)}
                          className="ml-1 text-slate-300 hover:text-amber-500 transition-colors text-sm"
                          title="Editar"
                        >
                          ✎
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm('¿Eliminar este registro?')) return
                            const { error: delErr } = await supabase.from('registros_horas').delete().eq('id', r.id)
                            if (delErr) { alert('No se pudo eliminar: ' + delErr.message); return }
                            setHistorial(h => h.filter(x => x.id !== r.id))
                          }}
                          className="text-slate-300 hover:text-red-500 transition-colors text-lg leading-none"
                          title="Eliminar"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

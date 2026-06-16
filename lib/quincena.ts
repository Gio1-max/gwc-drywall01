export interface Quincena {
  inicio: string  // YYYY-MM-DD
  fin: string     // YYYY-MM-DD
  label: string   // "1ra quincena — Junio 2026"
  numero: 1 | 2
  mes: number
  anio: number
}

export function getQuincenaActual(fecha?: Date): Quincena {
  const hoy = fecha ?? new Date()
  const dia = hoy.getDate()
  const mes = hoy.getMonth() + 1
  const anio = hoy.getFullYear()

  const ultimoDia = new Date(anio, mes, 0).getDate()

  const pad = (n: number) => String(n).padStart(2, '0')
  const mesNombre = hoy.toLocaleDateString('es-CA', { month: 'long' })

  if (dia <= 15) {
    return {
      inicio: `${anio}-${pad(mes)}-01`,
      fin: `${anio}-${pad(mes)}-15`,
      label: `1ra quincena — ${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)} ${anio}`,
      numero: 1,
      mes,
      anio,
    }
  } else {
    return {
      inicio: `${anio}-${pad(mes)}-16`,
      fin: `${anio}-${pad(mes)}-${ultimoDia}`,
      label: `2da quincena — ${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)} ${anio}`,
      numero: 2,
      mes,
      anio,
    }
  }
}

export function formatFecha(fecha: string) {
  return new Date(fecha + 'T00:00:00').toLocaleDateString('es-CA', {
    day: '2-digit', month: 'long', year: 'numeric'
  })
}

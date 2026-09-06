/**
 * «Hace 2 horas».
 *
 * Va en su propio archivo y no junto a los componentes: un módulo que exporta
 * componentes Y funciones rompe el Fast Refresh de Vite, y en este repo ya
 * hizo falta separarlos cuatro veces (§3w).
 *
 * Redondea hacia abajo y se calla cuando no puede afirmar: por debajo del
 * minuto dice «recién», no «hace 0 minutos».
 */
export function haceCuanto(iso: string, ahora = Date.now()): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const s = Math.max(0, Math.floor((ahora - t) / 1000))
  if (s < 60) return 'recién'
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m} ${m === 1 ? 'minuto' : 'minutos'}`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`
  const d = Math.floor(h / 24)
  if (d < 30) return `hace ${d} ${d === 1 ? 'día' : 'días'}`
  const me = Math.floor(d / 30)
  return `hace ${me} ${me === 1 ? 'mes' : 'meses'}`
}

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


/**
 * Cuánto falta para el FINAL de una fecha, en días y horas.
 *
 * ── Por qué existe, y por qué la usan los dos ────────────────────────
 *
 * El botón de Inicio y la cuenta atrás del lobby hablan del MISMO plazo, y
 * cada uno lo calculaba por su lado: el botón redondeaba hacia arriba y decía
 * «cierra en 22 días» mientras el lobby, redondeando hacia abajo, decía «21
 * días 10 h». Dos números para la misma fecha, los dos defendibles, y la
 * persona que ve los dos concluye que uno está mal — que es peor que si uno lo
 * estuviera de verdad.
 *
 * `vence_el` e `inscripcion_cierra` son `date` sin hora, así que el plazo llega
 * hasta el FINAL de ese día: cerrar «el 27» significa que el 27 todavía se
 * puede. Devuelve `null` cuando no hay fecha o no se puede leer, y días
 * negativos nunca: pasado el plazo, `vencido` es true.
 */
export function restanHasta(
  fecha: string | null | undefined,
  ahora: number = Date.now(),
): { dias: number; horas: number; vencido: boolean } | null {
  if (!fecha) return null
  const fin = new Date(`${fecha}T23:59:59`).getTime()
  if (!Number.isFinite(fin)) return null
  const falta = fin - ahora
  if (falta <= 0) return { dias: 0, horas: 0, vencido: true }
  return {
    dias: Math.floor(falta / 86_400_000),
    horas: Math.floor((falta % 86_400_000) / 3_600_000),
    vencido: false,
  }
}

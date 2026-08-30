/**
 * La hora del SERVIDOR, para que dos personas vean el mismo número.
 *
 * ── El problema que resuelve ─────────────────────────────────────────
 *
 * El plazo de una ronda se guarda bien: un instante absoluto en UTC
 * (`official_events.round_timer_end`). Pero medirlo con `Date.now()` mide
 * contra el reloj DEL APARATO, y los relojes de los teléfonos se van. Si el
 * del organizador va tres minutos adelantado, arranca una ronda que para él
 * dura 50 minutos y para la mesa dura 53 — y nadie tiene forma de notarlo,
 * porque cada pantalla es coherente consigo misma.
 *
 * En un torneo eso no es un detalle: es la diferencia entre terminar la
 * partida y que te la corten.
 *
 * ── Cómo ─────────────────────────────────────────────────────────────
 *
 * Se le pregunta UNA vez la hora a la base y se guarda la diferencia. Después
 * `ahora()` devuelve la hora del servidor estimada sin volver a preguntar.
 * No hace falta más precisión: acá se cuentan minutos, no milisegundos.
 *
 * Se descuenta la mitad del viaje de ida y vuelta, que es la corrección
 * estándar y evita que una red lenta se lea como desfase.
 *
 * Si la consulta falla se usa el reloj local y ya. Un torneo con el reloj a
 * medio segundo de diferencia funciona; uno sin reloj, no.
 */

import { supabase, isSupabaseReady } from './supabase'

/** Milisegundos que hay que SUMARLE al reloj local para llegar al del servidor. */
let desfase = 0
let midiendo: Promise<void> | null = null

export async function medirDesfase(): Promise<void> {
  if (!isSupabaseReady()) return
  if (midiendo) return midiendo

  midiendo = (async () => {
    const salida = Date.now()
    const { data, error } = await supabase.rpc('hora_servidor')
    // §2f: supabase-js no lanza. Sin mirar `error`, un fallo dejaría el
    // desfase en 0 y se vería igual que un reloj perfecto.
    if (error || !data) {
      console.warn('[hora] no se pudo medir el desfase:', error?.message)
      return
    }
    const llegada = Date.now()
    const viaje = (llegada - salida) / 2
    desfase = new Date(data as string).getTime() + viaje - llegada
  })()

  await midiendo
  midiendo = null
}

/** La hora del servidor, estimada. Cae al reloj local si nunca se midió. */
export function ahora(): number {
  return Date.now() + desfase
}

/** Cuánto se estaba yendo este aparato. Para poder DECIRLO, no para adivinar. */
export function desfaseActual(): number {
  return desfase
}

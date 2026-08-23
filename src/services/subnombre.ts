/**
 * El sub-nombre de la credencial: leer, guardar y saber qué está reservado.
 *
 * ── La regla vive en el SERVIDOR; acá solo se adelanta ────────────────
 *
 * `subnombreReservado` es un espejo de la función de Postgres del mismo
 * nombre, y existe para poder decirlo ANTES de mandar — un mensaje que llega
 * después del viaje se lee como que la app falló, no como que la respuesta es
 * no. Pero la que manda es la de la base: `trg_profiles_subnombre` rechaza el
 * update con `check_violation` aunque el cliente esté parcheado.
 *
 * Dos copias de una regla se separan (§3c), así que hay una prueba que corre
 * la MISMA lista de casos contra las dos y falla si dan distinto:
 * `scripts/subnombre-espejo.mjs`.
 */

import { supabase, isSupabaseReady } from './supabase'
import { MAX_SUBNOMBRE, subnombreReservado } from './subnombreRegla'

export { MAX_SUBNOMBRE, subnombreReservado, normalizarSubnombre } from './subnombreRegla'

export type ResultadoSubnombre = { ok: true } | { ok: false; mensaje: string }

/** El sub-nombre guardado de una cuenta. `null` si no tiene. */
export async function getSubnombre(userId: string): Promise<string | null> {
  if (!isSupabaseReady() || !userId) return null
  const { data, error } = await supabase
    .from('profiles').select('subnombre').eq('id', userId).maybeSingle()
  // §2f: sin mirar `error`, un fallo se vería igual que «no tiene».
  if (error) { console.warn('[subnombre] no se pudo leer:', error.message); return null }
  return (data?.subnombre as string | null) ?? null
}

export async function guardarSubnombre(
  userId: string,
  texto: string,
): Promise<ResultadoSubnombre> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión al servidor.' }

  const limpio = (texto ?? '').trim().slice(0, MAX_SUBNOMBRE)

  // Se adelanta la respuesta del servidor. Si esto se salta, el disparador
  // igual rechaza: acá solo se ahorra el viaje y se da un mensaje claro.
  if (limpio && subnombreReservado(limpio)) {
    return { ok: false, mensaje: 'Ese sub-nombre está reservado para el creador de la plataforma.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ subnombre: limpio || null })
    .eq('id', userId)

  if (error) {
    // El disparador manda `check_violation` (23514); el CHECK del largo también.
    if (error.code === '23514') {
      return { ok: false, mensaje: error.message.includes('reservado')
        ? 'Ese sub-nombre está reservado para el creador de la plataforma.'
        : `Máximo ${MAX_SUBNOMBRE} caracteres.` }
    }
    return { ok: false, mensaje: error.message }
  }
  return { ok: true }
}

/**
 * EL TALLER DE SABLES — la capa de datos.
 *
 * Igual que en Sobredosis: acá no hay lógica. El precio, el saldo y la
 * comprobación de qué piezas son tuyas viven en Postgres, en funciones SECURITY
 * DEFINER. Si el precio lo pusiera el cliente, el cristal purificado costaría 0.
 *
 * ── El saldo NO es `player_stats.xp` ──────────────────────────────────
 *
 * `xp` es el total DE POR VIDA y de él se deriva el nivel: si comprar restara
 * de ahí, gastar te bajaría de nivel — comprar un pomo te degradaría de 11 a 10.
 * El servidor devuelve `saldo` = total − lo gastado en piezas, derivado de los
 * recibos de `sable_inventario`. No hay columna nueva y no hay dos verdades.
 */

import { supabase, isSupabaseReady } from './supabase'

export interface ParteTaller {
  id: string
  tipo: 'emisor' | 'cuerpo' | 'pomo' | 'color'
  nombre: string
  precio: number
  orden: number
  tengo: boolean
  rareza: string
  /* Los stats vienen POR PIEZA y se suman en la pantalla (`kyber.ts`). El
     servidor no manda el total: sería una segunda copia de algo derivado, y
     además la pantalla necesita los de cada pieza para poder decir «esta te
     sube 8 de control» antes de comprarla. */
  potencia: number
  control: number
  energia: number
}

export interface Taller {
  saldo: number
  xpTotal: number
  nivel: number
  /** Cuántas piezas de pago tenés, y cuántas hay. Para el «12 de 14». */
  cuantasTengo: number
  cuantasHay: number
  partes: ParteTaller[]
  diseno: {
    emisor: string; cuerpo: string; pomo: string; color: string; nombre: string | null
  } | null
}

/** `null` = no tenés acceso al taller, o no se pudo leer. */
export async function abrirTaller(): Promise<Taller | null> {
  if (!isSupabaseReady()) return null
  // §2f: supabase-js NO lanza ante un error de PostgREST. Sin mirar `error`, un
  // fallo de red se vería igual que «no tenés acceso».
  const { data, error } = await supabase.rpc('sable_taller')
  if (error) { console.warn('[Sable] no se pudo abrir el taller:', error.message); return null }
  const r = data as (Taller & { ok?: boolean; error?: string }) | null
  if (!r?.ok) return null
  return {
    saldo: r.saldo ?? 0, xpTotal: r.xpTotal ?? 0, nivel: r.nivel ?? 1,
    cuantasTengo: r.cuantasTengo ?? 0, cuantasHay: r.cuantasHay ?? 0,
    partes: r.partes ?? [], diseno: r.diseno ?? null,
  }
}

/**
 * El diseño guardado del PROPIO usuario, o `null` si nunca forjó uno.
 *
 * Va por la tabla y no por `sable_taller()` a propósito: la RPC exige ser
 * probador, pero TU diseño es tuyo — la policy de `sable_diseno` ya limita el
 * SELECT a `user_id = auth.uid()`, así que esta lectura no delata nada de
 * nadie y le sirve a la barra de XP de cualquier cuenta.
 */
export async function miDisenoSable(): Promise<{
  emisor: string; cuerpo: string; pomo: string; color: string
} | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase
    .from('sable_diseno')
    .select('emisor, cuerpo, pomo, color')
    .maybeSingle()
  if (error) { console.warn('[Sable] no se pudo leer el diseño:', error.message); return null }
  return data ?? null
}

export interface Resultado { ok: boolean; mensaje?: string; saldo?: number }

export async function comprarParte(parteId: string): Promise<Resultado> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con el servidor' }
  const { data, error } = await supabase.rpc('comprar_parte_sable', { p_parte: parteId })
  if (error) return { ok: false, mensaje: error.message }
  const r = data as { ok: boolean; error?: string; saldo?: number } | null
  if (!r?.ok) return { ok: false, mensaje: r?.error ?? 'No se pudo comprar' }
  return { ok: true, saldo: r.saldo }
}

export async function guardarSable(
  d: { emisor: string; cuerpo: string; pomo: string; color: string }, nombre?: string,
): Promise<Resultado> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con el servidor' }
  const { data, error } = await supabase.rpc('guardar_sable', {
    p_emisor: d.emisor, p_cuerpo: d.cuerpo, p_pomo: d.pomo, p_color: d.color,
    p_nombre: nombre?.trim() || null,
  })
  if (error) return { ok: false, mensaje: error.message }
  const r = data as { ok: boolean; error?: string } | null
  if (!r?.ok) return { ok: false, mensaje: r?.error ?? 'No se pudo guardar' }
  return { ok: true }
}

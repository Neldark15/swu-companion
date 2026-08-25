/**
 * TERRAFORMACIÓN — la capa de datos.
 *
 * Igual que en el Taller Kyber: acá no hay lógica. El precio, el saldo y qué
 * mejoras son tuyas viven en Postgres, en funciones SECURITY DEFINER.
 *
 * ── UNA SOLA BILLETERA ────────────────────────────────────────────────
 *
 * El saldo sale de `creditos_saldo()`, que resta lo gastado en piezas de sable
 * Y lo gastado en el planeta. Si cada pantalla llevara su cuenta, alguien
 * podría gastar los mismos créditos dos veces y las dos cuadrarían por
 * separado. No hay dos economías: hay una.
 *
 * ── Comprar y PONER son dos cosas ─────────────────────────────────────
 *
 * Comprar va por RPC (el precio no lo elige el cliente). Poner lo comprado se
 * guarda con el resto del perfil, en `profiles.planet_*`, y un trigger del
 * servidor lo BAJA al grado que de verdad se posee. Sin ese trigger, cualquiera
 * se pone METRÓPOLIS desde la consola.
 */

import { supabase, isSupabaseReady } from './supabase'

export interface MejoraPlaneta {
  id: string
  tipo: 'ciudades' | 'nubes' | 'auroras' | 'anillos'
  nombre: string
  /** Qué valor va a `profiles.planet_*` al ponerla. */
  grado: number
  precio: number
  rareza: string
  orden: number
  tengo: boolean
}

export interface TallerPlaneta {
  saldo: number
  mejoras: MejoraPlaneta[]
}

/** `null` = sin sesión o no se pudo leer. */
export async function abrirTallerPlaneta(): Promise<TallerPlaneta | null> {
  if (!isSupabaseReady()) return null
  // §2f: supabase-js NO lanza ante un error de PostgREST.
  const { data, error } = await supabase.rpc('planeta_taller')
  if (error) {
    console.warn('[Planeta] no se pudo abrir el taller:', error.message)
    return null
  }
  const r = data as (TallerPlaneta & { ok?: boolean }) | null
  if (!r?.ok) return null
  return { saldo: r.saldo ?? 0, mejoras: r.mejoras ?? [] }
}

export interface ResultadoPlaneta { ok: boolean; mensaje?: string; saldo?: number }

export async function comprarMejora(id: string): Promise<ResultadoPlaneta> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con el servidor' }
  const { data, error } = await supabase.rpc('comprar_mejora_planeta', { p_mejora: id })
  if (error) return { ok: false, mensaje: error.message }
  const r = data as { ok: boolean; error?: string; saldo?: number } | null
  if (!r?.ok) return { ok: false, mensaje: r?.error ?? 'No se pudo comprar' }
  return { ok: true, saldo: r.saldo }
}

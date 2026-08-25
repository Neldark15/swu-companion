/**
 * ASPECTOS — la capa de datos. Acá no hay lógica.
 *
 * Los umbrales y los premios los manda el SERVIDOR en la misma respuesta, en
 * vez de estar escritos también acá: un umbral que vive en dos lados es un
 * umbral que algún día va a decir dos cosas distintas. Lo único que pone el
 * cliente es el nombre bonito y el color (`aspectos.ts`).
 */

import { supabase, isSupabaseReady } from './supabase'
import { aspectoDe, type Aspecto } from './aspectos'

export interface TemaAspecto {
  tema: string
  aspecto: Aspecto
  correctas: number
  respondidas: number
  /** −1 = todavía no llegó al primero. 0..3 = escalón alcanzado. */
  escalon: number
  /** Los escalones ya cobrados. */
  cobrados: number[]
}

export interface MisAspectos {
  umbrales: number[]
  premios: number[]
  temas: TemaAspecto[]
}

export async function misAspectos(): Promise<MisAspectos | null> {
  if (!isSupabaseReady()) return null
  // §2f: supabase-js NO lanza ante un error de PostgREST.
  const { data, error } = await supabase.rpc('mis_aspectos')
  if (error) {
    console.warn('[Aspectos] no se pudieron leer:', error.message)
    return null
  }
  const r = data as {
    ok?: boolean; umbrales?: number[]; premios?: number[]
    temas?: { tema: string; correctas: number; respondidas: number; escalon: number; cobrados: number[] }[]
  } | null
  if (!r?.ok) return null
  return {
    umbrales: r.umbrales ?? [],
    premios: r.premios ?? [],
    temas: (r.temas ?? []).map(t => ({
      ...t,
      // El aspecto es el NOMBRE del tema en pantalla. El servidor razona en
      // temas justamente para que el mapa viva en un solo lado.
      aspecto: aspectoDe({ tema: t.tema }),
      cobrados: t.cobrados ?? [],
    })),
  }
}

export interface CobroAspecto { ok: boolean; mensaje?: string; premio?: number; saldo?: number }

export async function cobrarEscalon(tema: string, escalon: number): Promise<CobroAspecto> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con el servidor' }
  const { data, error } = await supabase.rpc('cobrar_escalon_trivia', {
    p_tema: tema, p_escalon: escalon,
  })
  if (error) return { ok: false, mensaje: error.message }
  const r = data as { ok: boolean; error?: string; premio?: number; saldo?: number } | null
  if (!r?.ok) return { ok: false, mensaje: r?.error ?? 'No se pudo cobrar' }
  return { ok: true, premio: r.premio, saldo: r.saldo }
}

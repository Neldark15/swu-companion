/**
 * TRANSMISIONES DESTACADAS — los directos de fuera.
 *
 * `/envivo` nació para NUESTRAS partidas: cámara → OBS → YouTube → la página.
 * Esto es lo otro, y Nel lo pidió con un ejemplo concreto: el «Meta Check-In»
 * de Fantasy Flight, a mediodía. Un directo ajeno con su hora, su cuenta atrás
 * y su aviso.
 *
 * Se lee SIN sesión, igual que el resto de `/envivo`: nadie se loguea para
 * mirar una transmisión.
 */

import { supabase, isSupabaseReady } from './supabase'

export interface Transmision {
  id: string
  titulo: string
  canal: string
  youtube: string
  empiezaEn: string
  duraMin: number
}

/** ¿En qué momento está una transmisión, comparada con el reloj? */
export type Momento = 'falta' | 'envivo' | 'termino'

export function momentoDe(t: Transmision, ahora: number): Momento {
  const inicio = new Date(t.empiezaEn).getTime()
  if (!Number.isFinite(inicio)) return 'termino'
  if (ahora < inicio) return 'falta'
  // El fin es ESTIMADO: YouTube no dice cuánto va a durar y preguntárselo en
  // cada visita costaría una llamada a su API por espectador.
  return ahora < inicio + t.duraMin * 60_000 ? 'envivo' : 'termino'
}

/**
 * La transmisión que hay que enseñar AHORA: la que está en vivo, o la
 * siguiente que venga. `null` si no hay ninguna a la vista.
 *
 * Se piden las que empezaron hace poco o empiezan pronto y se decide acá:
 * filtrar por «en vivo» en SQL exigiría que el reloj del servidor y el del
 * teléfono coincidan, y no coinciden.
 */
export async function transmisionDestacada(): Promise<Transmision | null> {
  if (!isSupabaseReady()) return null
  const desde = new Date(Date.now() - 6 * 60 * 60_000).toISOString()
  // §2f: supabase-js NO lanza ante un error de PostgREST.
  const { data, error } = await supabase
    .from('transmisiones')
    .select('id, titulo, canal, youtube, empieza_en, dura_min')
    .eq('activa', true)
    .gte('empieza_en', desde)
    .order('empieza_en', { ascending: true })
    .limit(4)
  if (error) {
    console.warn('[Transmisiones] no se pudieron leer:', error.message)
    return null
  }
  const lista: Transmision[] = (data ?? []).map(f => ({
    id: f.id as string,
    titulo: f.titulo as string,
    canal: f.canal as string,
    youtube: f.youtube as string,
    empiezaEn: f.empieza_en as string,
    duraMin: Number(f.dura_min ?? 150),
  }))
  const ahora = Date.now()
  // La que está EN VIVO gana siempre: si hay una corriendo, anunciar la de
  // mañana sería mandar a la gente a esperar algo que ya está pasando.
  return lista.find(t => momentoDe(t, ahora) === 'envivo')
    ?? lista.find(t => momentoDe(t, ahora) === 'falta')
    ?? null
}

/** «en 2 h 15 min», «en 40 min», «en 25 s». Para la cuenta atrás. */
export function faltaTexto(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`
  if (m > 0) return `${m} min ${String(s % 60).padStart(2, '0')} s`
  return `${s} s`
}

/** La hora local de la persona, escrita como se lee. */
export function horaLocal(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleString('es-SV', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit',
  })
}

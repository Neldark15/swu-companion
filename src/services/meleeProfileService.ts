/**
 * meleeProfileService — historial de torneos de melee.gg dentro del perfil.
 *
 * Melee es donde se juegan y se registran los torneos oficiales de SWU. Este
 * módulo enlaza un perfil público de allá con uno de HOLOCRON y trae los
 * resultados por `/api/melee-profile`, que es un proxy cerrado (el porqué está
 * en ese archivo).
 *
 * ── Lo que NO se puede hacer, y hay que decirlo ───────────────────────
 *
 * El perfil público de melee **no expone ningún campo editable** —ni biografía
 * ni descripción, solo el nombre de usuario—. Así que no existe forma técnica
 * de probar que una cuenta es de quien la enlaza: no hay dónde poner un código
 * de confirmación. Por eso `melee_verified` lo pone un admin a mano y la
 * interfaz dice «sin verificar» mientras tanto, en vez de dar por cierta la
 * propiedad de la cuenta.
 *
 * ── El puesto, solo, miente ───────────────────────────────────────────
 *
 * «Puesto 399» suena a desastre y es 399 de 1022: mejor que la mitad de la
 * sala. «Puesto 3» suena grande y puede ser 3 de 4. Por eso todo lo que sale
 * de acá lleva SIEMPRE los participantes al lado y un percentil, y nunca el
 * número pelado.
 */

import { supabase, isSupabaseReady } from './supabase'

export interface MeleeResultado {
  torneoId: number
  torneo: string
  organizador: string | null
  fecha: string | null
  puesto: number | null
  participantes: number | null
  record: string | null
  victorias: number | null
  derrotas: number | null
  empates: number | null
  formato: string | null
  estado: string | null
  decklistId: number | null
  decklistNombre: string | null
}

export interface MeleePerfil {
  usuario: string
  resultados: MeleeResultado[]
  totalEnMelee: number
  source: { nombre: string; url: string }
}

/** Lo que se muestra arriba, resumido de todos los torneos. */
export interface MeleeAgregados {
  torneos: number
  victorias: number
  derrotas: number
  empates: number
  /** Sobre partidas decididas. Los empates NO cuentan como media victoria:
   *  eso es una convención de desempate, no un resultado. */
  porcentajeVictorias: number | null
  /** El mejor percentil logrado, que es la métrica honesta de «qué tan bien
   *  te fue» cuando los torneos tienen tamaños tan distintos. */
  mejorPercentil: number | null
  mejorTorneo: MeleeResultado | null
  /** Cuántos torneos traen participantes: sin eso el percentil no se calcula. */
  conPercentil: number
}

// ── Entrada ──────────────────────────────────────────────────────────

/** Misma gramática que valida el proxy y la restricción de la base. */
const USUARIO_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$/

/**
 * Acepta lo que la gente vaya a pegar de verdad:
 *
 *   https://melee.gg/Profile/Index/neldark
 *   melee.gg/Profile/Index/neldark?algo=1
 *   neldark
 *
 * Devuelve solo el nombre de usuario, o null si no hay forma de sacarlo.
 */
export function parsearUsuarioMelee(entrada: string): string | null {
  const t = entrada.trim()
  if (!t) return null

  // ¿Viene como URL?
  const m = /(?:^|\/\/)(?:www\.)?melee\.gg\/Profile\/Index\/([^/?#\s]+)/i.exec(t)
  if (m) {
    let u: string
    try {
      u = decodeURIComponent(m[1])
    } catch {
      return null
    }
    return USUARIO_RE.test(u) && !u.includes('..') ? u : null
  }

  // Pegar una URL de melee que NO sea de perfil es un error que conviene
  // señalar, no interpretar como si el nombre de usuario fuera «Tournament».
  if (/melee\.gg/i.test(t)) return null

  return USUARIO_RE.test(t) && !t.includes('..') ? t : null
}

export function urlPerfilMelee(usuario: string): string {
  return `https://melee.gg/Profile/Index/${encodeURIComponent(usuario)}`
}

export function urlTorneoMelee(torneoId: number): string {
  return `https://melee.gg/Tournament/View/${torneoId}`
}

/**
 * Enlace al mazo.
 *
 * Se ENLAZA y nunca se descarga: el robots.txt de melee prohíbe
 * `/Decklist/View/` explícitamente. Mandar a la persona a verlo allá es
 * distinto de que nosotros nos bajemos el contenido.
 */
export function urlMazoMelee(decklistId: number): string {
  return `https://melee.gg/Decklist/View/${decklistId}`
}

// ── Traer los resultados ─────────────────────────────────────────────

const CACHE_PREFIJO = 'swu_melee_'
const CACHE_MS = 6 * 60 * 60 * 1000

interface Cacheado {
  at: number
  perfil: MeleePerfil
}

function leerCache(usuario: string): Cacheado | null {
  try {
    const s = localStorage.getItem(CACHE_PREFIJO + usuario.toLowerCase())
    return s ? (JSON.parse(s) as Cacheado) : null
  } catch {
    return null
  }
}

export class MeleeNoExiste extends Error {}

/**
 * Trae el historial. La caché local sirve además como red: si melee o el
 * proxy fallan, se devuelve lo último bueno en vez de un perfil vacío, que se
 * leería como «este no jugó nunca».
 */
export async function traerResultadosMelee(
  usuario: string,
  opciones: { forzar?: boolean } = {},
): Promise<MeleePerfil> {
  const cache = leerCache(usuario)
  if (!opciones.forzar && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.perfil
  }

  let res: Response
  try {
    res = await fetch(`/api/melee-profile?usuario=${encodeURIComponent(usuario)}`)
  } catch (e) {
    if (cache) return cache.perfil
    throw e
  }

  if (res.status === 404) {
    // Este sí es definitivo: el proxy ya distinguió «no existe» de «no jugó».
    throw new MeleeNoExiste('Ese perfil no existe en melee.gg')
  }
  if (!res.ok) {
    if (cache) return cache.perfil
    throw new Error('No se pudo consultar melee.gg')
  }

  const perfil = (await res.json()) as MeleePerfil
  try {
    localStorage.setItem(
      CACHE_PREFIJO + usuario.toLowerCase(),
      JSON.stringify({ at: Date.now(), perfil } satisfies Cacheado),
    )
  } catch {
    // Sin espacio en localStorage no es motivo para no mostrar los datos.
  }
  return perfil
}

// ── Agregados ────────────────────────────────────────────────────────

/**
 * Percentil dentro del torneo: 100 = ganó, 0 = último.
 *
 * Sale de `puesto` y `participantes`. Sin participantes no se calcula —y no se
 * inventa un valor por defecto, porque un percentil inventado es exactamente
 * la clase de número que después alguien cita como si fuera real.
 */
export function percentil(r: MeleeResultado): number | null {
  if (!r.puesto || !r.participantes || r.participantes < 2) return null
  const p = ((r.participantes - r.puesto) / (r.participantes - 1)) * 100
  return Math.max(0, Math.min(100, Math.round(p)))
}

export function agregar(resultados: MeleeResultado[]): MeleeAgregados {
  let v = 0, d = 0, e = 0, conPercentil = 0
  let mejorPercentil: number | null = null
  let mejorTorneo: MeleeResultado | null = null

  for (const r of resultados) {
    v += r.victorias ?? 0
    d += r.derrotas ?? 0
    e += r.empates ?? 0
    const p = percentil(r)
    if (p !== null) {
      conPercentil++
      if (mejorPercentil === null || p > mejorPercentil) {
        mejorPercentil = p
        mejorTorneo = r
      }
    }
  }

  const decididas = v + d
  return {
    torneos: resultados.length,
    victorias: v,
    derrotas: d,
    empates: e,
    porcentajeVictorias: decididas > 0 ? Math.round((v / decididas) * 100) : null,
    mejorPercentil,
    mejorTorneo,
    conPercentil,
  }
}

// ── Guardar el enlace ────────────────────────────────────────────────

/**
 * Guarda el usuario de melee en el perfil.
 *
 * Antes de guardar se comprueba contra melee que EXISTA, porque un usuario mal
 * escrito se guardaría igual y después la sección se vería vacía para siempre
 * sin decir por qué.
 */
export async function guardarUsuarioMelee(
  userId: string,
  entrada: string,
): Promise<{ ok: true; usuario: string } | { ok: false; error: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión al servidor' }

  const usuario = parsearUsuarioMelee(entrada)
  if (!usuario) {
    return {
      ok: false,
      error: 'No reconocí ese usuario. Pegá el enlace de tu perfil de melee o solo tu nombre de usuario.',
    }
  }

  try {
    await traerResultadosMelee(usuario, { forzar: true })
  } catch (e) {
    if (e instanceof MeleeNoExiste) {
      return { ok: false, error: `melee.gg no tiene un perfil «${usuario}». Revisá cómo está escrito.` }
    }
    // Si melee está caído no se bloquea el enlace: se guarda igual y ya
    // cargará. Peor sería no dejar a nadie enlazar porque su sitio se cayó.
  }

  const { error } = await supabase
    .from('profiles')
    .update({ melee_username: usuario })
    .eq('id', userId)

  // supabase-js NO lanza ante un error de PostgREST: hay que mirar `error`.
  if (error) return { ok: false, error: error.message }
  return { ok: true, usuario }
}

export async function desenlazarMelee(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión al servidor' }
  const { error } = await supabase
    .from('profiles')
    .update({ melee_username: null })
    .eq('id', userId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function leerEnlaceMelee(
  userId: string,
): Promise<{ usuario: string | null; verificado: boolean }> {
  if (!isSupabaseReady()) return { usuario: null, verificado: false }
  const { data, error } = await supabase
    .from('profiles')
    .select('melee_username, melee_verified')
    .eq('id', userId)
    .single()
  if (error || !data) return { usuario: null, verificado: false }
  return {
    usuario: (data as { melee_username: string | null }).melee_username,
    verificado: !!(data as { melee_verified: boolean }).melee_verified,
  }
}

/**
 * Verificar o desverificar. Va por una función `SECURITY DEFINER` que
 * comprueba que quien llama sea admin: la columna NO es escribible desde el
 * cliente, justamente para que nadie se ponga su propia insignia.
 */
export async function marcarVerificado(
  objetivo: string,
  verificado: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión al servidor' }
  const { error } = await supabase.rpc('set_melee_verified', {
    objetivo,
    verificado,
  })
  return error ? { ok: false, error: error.message } : { ok: true }
}

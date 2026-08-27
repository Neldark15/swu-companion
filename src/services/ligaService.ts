/**
 * ESPACIO DE CREADORES — la capa de datos. Acá no hay lógica.
 *
 * Todo lo que decide vive en Postgres con el guardia adentro (§3i-bis): quién
 * es creador, el cupo, el consentimiento, el fixture round-robin, la
 * normalización del VOD. El cliente pinta y llama.
 *
 * ── El demo cerrado ───────────────────────────────────────────────────
 *
 * Mientras dura la prueba, las policies solo dejan VER esto a los creadores y
 * a los admins (`puede_ver_creadores()`). Para cualquier otra cuenta las
 * consultas vuelven VACÍAS —no con error—, así que `null` acá significa «no
 * existe o no te toca verlo», y la pantalla lo dice sin drama.
 */

import { supabase, isSupabaseReady } from './supabase'

export interface Creador {
  userId: string
  code: string
  nombre: string
  canalYoutube: string | null
  logo: string | null
}

export interface Liga {
  id: string
  code: string
  creadorId: string
  nombre: string
  descripcion: string | null
  cupo: number
  estado: 'borrador' | 'inscripcion' | 'activa' | 'cerrada' | 'abandonada'
}

export interface InscripcionLiga {
  id: string
  userId: string | null
  nombre: string
  lider: string | null
  base: string | null
  retirado: boolean
}

export interface PartidaLiga {
  id: string
  jornada: number
  localInsc: string
  visitaInsc: string
  victoriasLocal: number
  victoriasVisita: number
  estado: 'programada' | 'jugada' | 'wo_local' | 'wo_visita' | 'sin_jugar'
  programadaPara: string | null
  vodYoutubeId: string | null
  vodT: number | null
}

/** Una fila de la tabla de posiciones, COMPUTADA de las partidas (§2y). */
export interface FilaTabla {
  inscId: string
  nombre: string
  lider: string | null
  userId: string | null
  jugadas: number
  ganadas: number
  perdidas: number
  puntos: number
  difGames: number
}

export async function getCreador(code: string): Promise<Creador | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase
    .from('creadores')
    .select('user_id, code, nombre_publico, canal_youtube, logo')
    .eq('code', code)
    .eq('activo', true)
    .maybeSingle()
  if (error || !data) return null
  return {
    userId: data.user_id as string,
    code: data.code as string,
    nombre: data.nombre_publico as string,
    canalYoutube: (data.canal_youtube as string | null) ?? null,
    logo: (data.logo as string | null) ?? null,
  }
}

export async function getLigaDeCreador(creadorId: string): Promise<Liga | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase
    .from('ligas')
    .select('id, code, creador_id, nombre, descripcion, cupo, estado')
    .eq('creador_id', creadorId)
    .in('estado', ['borrador', 'inscripcion', 'activa'])
    .maybeSingle()
  if (error || !data) return null
  return filaALiga(data)
}

export async function getLiga(code: string): Promise<Liga | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase
    .from('ligas')
    .select('id, code, creador_id, nombre, descripcion, cupo, estado')
    .eq('code', code)
    .maybeSingle()
  if (error || !data) return null
  return filaALiga(data)
}

function filaALiga(d: Record<string, unknown>): Liga {
  return {
    id: d.id as string,
    code: d.code as string,
    creadorId: d.creador_id as string,
    nombre: d.nombre as string,
    descripcion: (d.descripcion as string | null) ?? null,
    cupo: Number(d.cupo ?? 0),
    estado: d.estado as Liga['estado'],
  }
}

export async function getInscripciones(ligaId: string): Promise<InscripcionLiga[]> {
  if (!isSupabaseReady()) return []
  const { data, error } = await supabase
    .from('liga_inscripciones')
    .select('id, user_id, nombre_visible, lider, base, retirado')
    .eq('liga_id', ligaId)
    .order('inscrito_en')
  if (error || !data) return []
  return data.map(d => ({
    id: d.id as string,
    userId: (d.user_id as string | null) ?? null,
    nombre: d.nombre_visible as string,
    lider: (d.lider as string | null) ?? null,
    base: (d.base as string | null) ?? null,
    retirado: Boolean(d.retirado),
  }))
}

export async function getPartidas(ligaId: string): Promise<PartidaLiga[]> {
  if (!isSupabaseReady()) return []
  const { data, error } = await supabase
    .from('liga_partidas')
    .select('id, jornada, local_insc, visita_insc, victorias_local, victorias_visita, estado, programada_para, vod_youtube_id, vod_t')
    .eq('liga_id', ligaId)
    .order('jornada')
  if (error || !data) return []
  return data.map(d => ({
    id: d.id as string,
    jornada: Number(d.jornada),
    localInsc: d.local_insc as string,
    visitaInsc: d.visita_insc as string,
    victoriasLocal: Number(d.victorias_local ?? 0),
    victoriasVisita: Number(d.victorias_visita ?? 0),
    estado: d.estado as PartidaLiga['estado'],
    programadaPara: (d.programada_para as string | null) ?? null,
    vodYoutubeId: (d.vod_youtube_id as string | null) ?? null,
    vodT: d.vod_t == null ? null : Number(d.vod_t),
  }))
}

/**
 * La tabla de posiciones, computada. NUNCA se guarda (§2y): con ≤24 inscritos
 * es un pliegue trivial, y una tabla almacenada es una segunda verdad que
 * algún día contradice a las partidas.
 *
 * Puntos 3/0; desempate: diferencia de games. El walkover cuenta como 2-0.
 */
export function tablaDe(inscripciones: InscripcionLiga[], partidas: PartidaLiga[]): FilaTabla[] {
  const filas = new Map<string, FilaTabla>()
  for (const i of inscripciones) {
    if (i.retirado) continue
    filas.set(i.id, {
      inscId: i.id, nombre: i.nombre, lider: i.lider, userId: i.userId,
      jugadas: 0, ganadas: 0, perdidas: 0, puntos: 0, difGames: 0,
    })
  }
  for (const p of partidas) {
    if (p.estado === 'programada' || p.estado === 'sin_jugar') continue
    const local = filas.get(p.localInsc)
    const visita = filas.get(p.visitaInsc)
    if (!local || !visita) continue
    const vl = p.estado === 'wo_visita' ? 2 : p.estado === 'wo_local' ? 0 : p.victoriasLocal
    const vv = p.estado === 'wo_local' ? 2 : p.estado === 'wo_visita' ? 0 : p.victoriasVisita
    local.jugadas++; visita.jugadas++
    local.difGames += vl - vv; visita.difGames += vv - vl
    if (vl > vv) { local.ganadas++; local.puntos += 3; visita.perdidas++ }
    else { visita.ganadas++; visita.puntos += 3; local.perdidas++ }
  }
  return [...filas.values()].sort((a, b) =>
    b.puntos - a.puntos || b.difGames - a.difGames || a.nombre.localeCompare(b.nombre))
}

/** Lo que ve un jugador inscrito en su propio perfil. */
export interface MiLiga {
  miInscripcion: string
  liga: {
    id: string; code: string; nombre: string; estado: Liga['estado']
    /* Sin `creadorLogo` a propósito: es un data URI de decenas de KB y esta
       consulta corre al abrir el perfil, la pantalla más visitada. La marca
       vive en `/c/:code`, a un toque. */
    creadorNombre: string; creadorCode: string
  }
  inscripciones: InscripcionLiga[]
  partidas: PartidaLiga[]
}

/**
 * La liga del usuario, en UN viaje.
 *
 * `null` = no está inscrito en ninguna, que es el caso normal de casi todos.
 * La RPC devuelve lo suyo aunque el espacio de creadores siga en demo: tu
 * propia liga es tuya, la veas o no en la casa del creador.
 */
export async function getMiLiga(): Promise<MiLiga | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase.rpc('mi_liga')
  if (error) {
    console.warn('[Liga] no se pudo leer mi liga:', error.message)
    return null
  }
  const r = data as (MiLiga & { ok?: boolean; liga?: MiLiga['liga'] | null }) | null
  if (!r?.ok || !r.liga) return null
  return {
    miInscripcion: r.miInscripcion,
    liga: r.liga,
    inscripciones: (r.inscripciones ?? []) as InscripcionLiga[],
    partidas: (r.partidas ?? []) as PartidaLiga[],
  }
}

/** Lo que la casa del creador enseña cuando está transmitiendo AHORA. */
export interface EnVivoCreador {
  code: string
  youtube: string
  ronda: string
  nombre: string
}

/**
 * ¿Está el creador al aire en este momento?
 *
 * Sale de `stream_overlay.estado->>'envivo'`, el mismo interruptor que el
 * operador enciende en su estudio y que `/envivo` ya usa para toda la
 * comunidad — no hay un segundo sitio donde decir «estoy transmitiendo»
 * que se pueda quedar viejo (§3c).
 *
 * Devuelve `null` cuando no hay nada al aire, que es casi siempre.
 */
export async function enVivoDe(creadorCode: string): Promise<EnVivoCreador | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase.rpc('creador_en_vivo', { p_creador_code: creadorCode })
  if (error) {
    console.warn('[Liga] no se pudo consultar el directo:', error.message)
    return null
  }
  const r = data as (EnVivoCreador & { envivo?: boolean }) | null
  if (!r?.envivo) return null
  return { code: r.code, youtube: r.youtube ?? '', ronda: r.ronda ?? '', nombre: r.nombre ?? '' }
}

// ── Las acciones. Todas devuelven { ok, mensaje } y el guardia vive en la RPC ──

export interface ResultadoLiga { ok: boolean; mensaje?: string }

async function rpc(nombre: string, args: Record<string, unknown>): Promise<ResultadoLiga & { extra?: Record<string, unknown> }> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con el servidor' }
  // §2f: supabase-js NO lanza ante un error de PostgREST.
  const { data, error } = await supabase.rpc(nombre, args)
  if (error) return { ok: false, mensaje: error.message }
  const r = data as { ok: boolean; error?: string } | null
  if (!r?.ok) return { ok: false, mensaje: r?.error ?? 'No se pudo' }
  return { ok: true, extra: r as Record<string, unknown> }
}

export const crearLiga = (code: string, nombre: string, descripcion: string, cupo: number) =>
  rpc('liga_crear', { p_code: code, p_nombre: nombre, p_descripcion: descripcion, p_cupo: cupo })
export const abrirInscripcion = (liga: string) => rpc('liga_abrir_inscripcion', { p_liga: liga })
export const inscribirse = (liga: string, lider: string, base: string, consiente: boolean) =>
  rpc('liga_inscribirse', { p_liga: liga, p_lider: lider, p_base: base, p_consiente: consiente })
export const cerrarInscripcion = (liga: string) => rpc('liga_cerrar_inscripcion', { p_liga: liga })
export const reportarPartida = (partida: string, vl: number, vv: number, vod: string, vodT: number | null) =>
  rpc('liga_reportar', { p_partida: partida, p_victorias_local: vl, p_victorias_visita: vv, p_vod: vod || null, p_vod_t: vodT })
export const cerrarLiga = (liga: string) => rpc('liga_cerrar', { p_liga: liga })
export const subirLogo = (logo: string | null) => rpc('creador_subir_logo', { p_logo: logo })

/**
 * Da de alta la cabina de transmisión de un creador. **Solo admin.**
 *
 * El `code` de una cabina es su dirección pública (`/overlay/PUENTE3`), y
 * `stream_operadores` decide quién escribe el marcador que sale al aire: por
 * eso el alta no es una policy de INSERT sino una RPC de admin, igual que
 * `canal_youtube` (§4l). Lo que identifica a alguien de cara al público no se
 * lo pone esa misma persona.
 */
export const abrirCabina = (creadorCode: string, cabinaCode?: string) =>
  rpc('creador_abrir_cabina', { p_creador_code: creadorCode, p_cabina_code: cabinaCode ?? null })

/**
 * El `code` de la casa del creador de quien mira, o `null` si no es creador.
 *
 * Existe para poder pintar la casilla «Mi espacio» en Inicio sin cablear el
 * code: si mañana hay un segundo creador, su casilla lo lleva a SU casa sin
 * tocar una línea. Cablearlo sería el mismo error que armar el enlace del
 * estudio a partir del code del creador en vez de listarlo.
 *
 * La policy ya limita el SELECT a creadores y admins; acá se filtra por
 * `user_id` para que un admin no vea la casa de otro como si fuera la suya.
 */
export async function miCasaDeCreador(): Promise<string | null> {
  if (!isSupabaseReady()) return null
  const { data: sesion } = await supabase.auth.getUser()
  const uid = sesion?.user?.id
  if (!uid) return null
  const { data, error } = await supabase
    .from('creadores')
    .select('code')
    .eq('user_id', uid)
    .eq('activo', true)
    .maybeSingle()
  // §2f: sin mirar `error`, un fallo se ve igual que «no sos creador».
  if (error) return null
  return (data?.code as string | undefined) ?? null
}

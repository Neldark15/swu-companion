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

export type EstadoPartida =
  | 'programada' | 'reportada' | 'confirmada' | 'disputada'
  | 'vencida' | 'wo_local' | 'wo_visita' | 'anulada'

export interface PartidaLiga {
  id: string
  grupoId: string
  jornada: number
  localPlaza: string
  visitaPlaza: string
  vl: number
  vv: number
  estado: EstadoPartida
  /** 'acuerdo' los dos firmaron · 'silencio' el rival no contestó · 'laudo' lo resolvió la organización. */
  origen: 'acuerdo' | 'silencio' | 'laudo' | null
  venceEl: string | null
  vod: string | null
  reportadaPor: string | null
}

/** Una fila de la tabla de posiciones, COMPUTADA de las partidas (§2y). */
export interface PlazaLiga {
  id: string
  grupoId: string
  nombre: string
  lider: string | null
  base: string | null
  estado: 'activa' | 'abandonada' | 'anulada'
  esMia: boolean
}

export interface FilaTabla {
  plazaId: string
  nombre: string
  lider: string | null
  esMia: boolean
  abandonada: boolean
  jugadas: number
  ganadas: number
  perdidas: number
  puntos: number
  difGames: number
  gamesGanados: number
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



/**
 * La tabla de posiciones, computada. NUNCA se guarda (§2y): con ≤24 inscritos
 * es un pliegue trivial, y una tabla almacenada es una segunda verdad que
 * algún día contradice a las partidas.
 *
 * Puntos 3/0; desempate: diferencia de games. El walkover cuenta como 2-0.
 */
/**
 * La tabla de un GRUPO. Se computa, nunca se almacena (§2y).
 *
 * ── Los dos defectos que tenía, y por qué ninguno daba error ─────────
 *
 * 1. **Filtraba con lista NEGRA** (`estado === 'programada' || 'sin_jugar'`).
 *    Cualquier estado nuevo contaba por omisión — y ahora hay cinco más
 *    (reportada, disputada, vencida, anulada). Una partida que nadie confirmó
 *    habría sumado puntos.
 * 2. **El `else` le daba la victoria y 3 puntos a la VISITA en cada empate.**
 *    Y un 0-0 es exactamente el estado de una partida sin marcador: medido,
 *    8 de los 10 duelos reales de producción están así (§3a).
 *
 * Las dos producen una tabla plausible y equivocada, en público, sin una sola
 * excepción. Ahora la lista es BLANCA y el empate es su propia rama.
 *
 * ── Y quien abandona no borra lo que ya jugó ─────────────────────────
 *
 * Antes `if (!local || !visita) continue` hacía desaparecer el resultado del
 * que SÍ jugó y ganó. En una liga de 24 era ruido; en una de 120 con abandono
 * normal del 30 % son ~140 encuentros evaporados. La plaza abandonada se
 * queda en el mapa con bandera y se filtra al PINTAR, no al sumar.
 */

/** Los únicos estados que cuentan. Lista BLANCA: lo que no está, no suma. */
const CUENTAN = new Set(['confirmada', 'wo_local', 'wo_visita'])

export function tablaDe(
  plazas: PlazaLiga[],
  partidas: PartidaLiga[],
  grupoId?: string,
): FilaTabla[] {
  const filas = new Map<string, FilaTabla>()
  for (const p of plazas) {
    if (grupoId && p.grupoId !== grupoId) continue
    filas.set(p.id, {
      plazaId: p.id, nombre: p.nombre, lider: p.lider, esMia: p.esMia,
      abandonada: p.estado !== 'activa',
      jugadas: 0, ganadas: 0, perdidas: 0, puntos: 0, difGames: 0, gamesGanados: 0,
    })
  }

  for (const m of partidas) {
    if (grupoId && m.grupoId !== grupoId) continue
    if (!CUENTAN.has(m.estado)) continue
    const local = filas.get(m.localPlaza)
    const visita = filas.get(m.visitaPlaza)
    if (!local || !visita) continue

    const vl = m.estado === 'wo_visita' ? 2 : m.estado === 'wo_local' ? 0 : m.vl
    const vv = m.estado === 'wo_local' ? 2 : m.estado === 'wo_visita' ? 0 : m.vv

    local.jugadas++; visita.jugadas++
    local.gamesGanados += vl; visita.gamesGanados += vv
    local.difGames += vl - vv; visita.difGames += vv - vl

    if (vl > vv) { local.ganadas++; local.puntos += 3; visita.perdidas++ }
    else if (vv > vl) { visita.ganadas++; visita.puntos += 3; local.perdidas++ }
    // Empate: un BO3 no puede terminar empatado, así que un marcador igual es
    // una partida SIN marcador. No se le regala la victoria a nadie — cuenta
    // como jugada y punto. Antes esta rama no existía y la ganaba la visita.
  }

  const orden = [...filas.values()]
  return orden.sort((a, b) =>
    b.puntos - a.puntos ||
    // ENFRENTAMIENTO DIRECTO. En un round-robin de grupo dos empatados SIEMPRE
    // jugaron entre sí exactamente una vez, así que está siempre definido.
    // Terminar en `localeCompare` está bien para pintar y sería un escándalo
    // para ascender.
    directo(a, b, partidas) ||
    b.difGames - a.difGames ||
    b.gamesGanados - a.gamesGanados ||
    a.nombre.localeCompare(b.nombre))
}

/** −1 si `a` le ganó a `b`, 1 si perdió, 0 si no se cruzaron o no cuenta. */
function directo(a: FilaTabla, b: FilaTabla, partidas: PartidaLiga[]): number {
  for (const m of partidas) {
    if (!CUENTAN.has(m.estado)) continue
    const esEste =
      (m.localPlaza === a.plazaId && m.visitaPlaza === b.plazaId) ||
      (m.localPlaza === b.plazaId && m.visitaPlaza === a.plazaId)
    if (!esEste) continue
    const vl = m.estado === 'wo_visita' ? 2 : m.estado === 'wo_local' ? 0 : m.vl
    const vv = m.estado === 'wo_local' ? 2 : m.estado === 'wo_visita' ? 0 : m.vv
    if (vl === vv) return 0
    const ganoLocal = vl > vv
    const aEsLocal = m.localPlaza === a.plazaId
    return ganoLocal === aEsLocal ? -1 : 1
  }
  return 0
}

/** Mi grupo, para la tarjeta del perfil. Un viaje, ~11,6 KB. */
export interface MiLiga {
  miPlaza: string
  liga: { id: string; code: string; nombre: string; estado: string }
  grupo: { id: string; tier: string; orden: number; estado: string; cierra: string }
  plazas: PlazaLiga[]
  partidas: PartidaLiga[]
}

/**
 * Lo que ve en su perfil alguien que juega la liga.
 *
 * Devuelve SOLO su grupo —8 plazas y 28 partidas— y no la liga entera: a 120
 * plazas serían ~145 KB de JSON no cacheable en cada apertura del Perfil, que
 * es la pantalla que más se abre (§4m).
 *
 * `null` = no juega ninguna liga, que es el caso de casi todo el mundo.
 */
export async function getMiLiga(): Promise<MiLiga | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase.rpc('mi_liga')
  // §2f: sin mirar `error`, un fallo se ve idéntico a «no tenés liga» — que es
  // exactamente cómo esta tarjeta desapareció para todos sin que nadie lo notara.
  if (error) {
    console.warn('[Liga] mi_liga:', error.message)
    return null
  }
  const r = data as ({ ok?: boolean } & MiLiga) | null
  if (!r?.ok || !r.grupo) return null
  return r
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
export const cerrarInscripcion = (liga: string) => rpc('liga_cerrar_inscripcion', { p_liga: liga })
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


/* ══════════════════════════════════════════════════════════════════════
   LIGA INTERNACIONAL — la liga entera en UNA llamada

   `liga_ver` devuelve liga + temporada + grupos, y cada grupo con sus plazas
   y sus partidas. Con grupos de 8 eso son 8 plazas y 28 partidas por grupo:
   pedir cada cosa por separado serían tres viajes para pintar una pantalla.

   Lo que NO viaja: disponibilidad, zona horaria y `user_id`. Eso solo sale
   por `liga_panel`, y solo para quien organiza.
   ══════════════════════════════════════════════════════════════════════ */

export interface GrupoLiga {
  id: string
  tier: 'comun' | 'infrecuente' | 'raro' | 'legendario'
  orden: number
  estado: 'armado' | 'en_curso' | 'cerrado'
  arranca: string
  cierra: string
  plazas: PlazaLiga[]
  partidas: PartidaLiga[]
}

export interface TemporadaLiga {
  id: string
  nombre: string
  numero: number
  estado: 'inscripcion' | 'en_curso' | 'cerrada'
  arranca: string
  cierra: string
}

export interface LigaCompleta {
  liga: Liga & { tamanoGrupo: number; esStaff: boolean }
  temporada: TemporadaLiga | null
  miInscripcion: string | null
  grupos: GrupoLiga[]
}

/** El orden de la escalera: lo mejor arriba. */
export const TIERS = ['legendario', 'raro', 'infrecuente', 'comun'] as const
export const NOMBRE_TIER: Record<string, string> = {
  comun: 'Común', infrecuente: 'Infrecuente', raro: 'Raro', legendario: 'Legendario',
}

export async function verLiga(code: string): Promise<LigaCompleta | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase.rpc('liga_ver', { p_code: code })
  if (error) {
    console.warn('[Liga] no se pudo leer:', error.message)
    return null
  }
  const r = data as { ok?: boolean; liga?: LigaCompleta['liga'] | null } & LigaCompleta | null
  if (!r?.ok || !r.liga) return null
  // Las plazas llegan dentro de cada grupo sin `grupoId`: se lo pone acá para
  // que `tablaDe` pueda filtrar sin recorrer el árbol otra vez.
  const grupos = (r.grupos ?? []).map(g => ({
    ...g,
    plazas: (g.plazas ?? []).map(p => ({ ...p, grupoId: g.id })),
    partidas: (g.partidas ?? []).map(m => ({ ...m, grupoId: g.id })),
  }))
  return { liga: r.liga, temporada: r.temporada ?? null, miInscripcion: r.miInscripcion ?? null, grupos }
}

/** Todas las plazas y partidas de la liga, aplanadas. Para la tabla global. */
export function aplanar(l: LigaCompleta): { plazas: PlazaLiga[]; partidas: PartidaLiga[] } {
  return {
    plazas: l.grupos.flatMap(g => g.plazas),
    partidas: l.grupos.flatMap(g => g.partidas),
  }
}

/** Mi próxima partida: la primera sin cerrar donde estoy. Es la única acción. */
export function miProximaPartida(l: LigaCompleta): { partida: PartidaLiga; grupo: GrupoLiga; rival: PlazaLiga; miPlaza: PlazaLiga } | null {
  for (const g of l.grupos) {
    const mia = g.plazas.find(p => p.esMia)
    if (!mia) continue
    const abiertas = g.partidas
      .filter(m => (m.localPlaza === mia.id || m.visitaPlaza === mia.id))
      .filter(m => m.estado === 'programada' || m.estado === 'reportada' || m.estado === 'vencida')
      .sort((a, b) => a.jornada - b.jornada)
    // La que espera MI respuesta va primero: es lo único que puedo resolver hoy.
    const esperaMi = abiertas.find(m => m.estado === 'reportada' && m.reportadaPor !== mia.id)
    const partida = esperaMi ?? abiertas[0]
    if (!partida) continue
    const rivalId = partida.localPlaza === mia.id ? partida.visitaPlaza : partida.localPlaza
    const rival = g.plazas.find(p => p.id === rivalId)
    if (!rival) continue
    return { partida, grupo: g, rival, miPlaza: mia }
  }
  return null
}

// ── Acciones ────────────────────────────────────────────────────────
export const inscribirseLiga = (
  liga: string, lider: string, base: string,
  zona: string, franjas: string, transmision: boolean, perfil: boolean,
) => rpc('liga_inscribirse', {
  p_liga: liga, p_lider: lider, p_base: base, p_zona: zona, p_franjas: franjas,
  p_consiente_transmision: transmision, p_consiente_perfil: perfil,
})

export const guardarDisponibilidad = (liga: string, zona: string, franjas: string, nota?: string) =>
  rpc('liga_guardar_disponibilidad', { p_liga: liga, p_zona: zona, p_franjas: franjas, p_nota: nota ?? null })

export const abrirTemporada = (liga: string, nombre: string, arranca: string, cierra: string) =>
  rpc('liga_abrir_temporada', { p_liga: liga, p_nombre: nombre, p_arranca: arranca, p_cierra: cierra })

export const armarGrupos = (temporada: string, asignacion: unknown) =>
  rpc('liga_armar_grupos', { p_temporada: temporada, p_asignacion: asignacion })

export const sembrarGrupo = (grupo: string) => rpc('liga_sembrar_grupo', { p_grupo: grupo })

export const reportar = (partida: string, vl: number, vv: number, vod?: string, vodT?: number | null) =>
  rpc('liga_reportar', { p_partida: partida, p_victorias_local: vl, p_victorias_visita: vv,
                         p_vod: vod || null, p_vod_t: vodT ?? null })

/** El marcador viaja OTRA VEZ: si el botón solo dice «Aceptar», se acepta sin leer. */
export const confirmar = (partida: string, vl: number, vv: number) =>
  rpc('liga_confirmar', { p_partida: partida, p_victorias_local: vl, p_victorias_visita: vv })

export const disputar = (partida: string, motivo: string) =>
  rpc('liga_disputar', { p_partida: partida, p_motivo: motivo })

export const corregir = (partida: string, vl: number | null, vv: number | null, estado: string, motivo: string) =>
  rpc('liga_corregir', { p_partida: partida, p_vl: vl, p_vv: vv, p_estado: estado, p_motivo: motivo })

// ── El panel ────────────────────────────────────────────────────────
export interface InscritoPanel {
  inscId: string
  nombre: string
  tier: 'comun' | 'infrecuente' | 'raro' | 'legendario'
  estado: string
  lider: string | null
  base: string | null
  zona: string | null
  franjas: string | null
  horas: number
  inscritoEn: string
}

export interface PanelLiga {
  inscritos: InscritoPanel[]
  cola: Array<{
    id: string; estado: string; jornada: number; local: string; visita: string
    vl: number; vv: number; motivo: string | null; venceEl: string | null; grupo: string
  }>
  temporada: TemporadaLiga & { semilla: string } | null
}

export async function verPanel(liga: string): Promise<PanelLiga | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase.rpc('liga_panel', { p_liga: liga })
  if (error) { console.warn('[Liga] panel:', error.message); return null }
  const r = data as ({ ok?: boolean } & PanelLiga) | null
  if (!r?.ok) return null
  return { inscritos: r.inscritos ?? [], cola: r.cola ?? [], temporada: r.temporada ?? null }
}

export interface PlanGrupos {
  inscritos: number
  tamanoObjetivo: number
  gruposPropuestos: number
  sinDisponibilidad: number
  porTier: Record<string, number>
  inscritos_detalle: Array<{ inscId: string; nombre: string; tier: string; zona: string | null; horas: number }>
}

/** El ENSAYO: propone y no escribe nada. */
export async function planDeGrupos(temporada: string): Promise<PlanGrupos | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase.rpc('liga_plan_grupos', { p_temporada: temporada })
  if (error) { console.warn('[Liga] ensayo:', error.message); return null }
  const r = data as ({ ok?: boolean } & PlanGrupos) | null
  return r?.ok ? r : null
}

/** ¿Esta cuenta puede ver la liga? Mientras dure el demo, es una allowlist. */
export async function puedoVerLiga(): Promise<boolean> {
  if (!isSupabaseReady()) return false
  const { data, error } = await supabase.rpc('liga_visible')
  if (error) return false
  return data === true
}

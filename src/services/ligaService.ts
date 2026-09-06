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
import { TONO_POR_RAREZA } from './filtrosCarta'

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




/**
 * El color de un tier. Vive acá y no en cada pantalla.
 *
 * Estaba COPIADO literal en `LigaSeccion` y en `PanelLiga`, con dos nombres
 * distintos (`tonoDelTier` y `tonoDeTier`) y hasta con dos redes distintas
 * ante un tier desconocido. Dos copias de una tabla de colores no fallan: se
 * SEPARAN, y el mismo grupo sale de un color en la pantalla pública y de otro
 * en el panel sin que nadie lo note hasta compararlas.
 *
 * El tono NO se escribe acá: se DERIVA de `TONO_POR_RAREZA`, que es el mapa
 * que ya usan las cartas. Los tiers están en español porque así se llaman en
 * la liga y las rarezas en inglés porque así vienen del API; la traducción es
 * esta línea y nada más. Escribir los colores a mano sería tener dos ideas del
 * color de «legendario» y que un día se separen sin que nada falle.
 */
const RAREZA_DEL_TIER: Record<string, string> = {
  comun: 'Common', infrecuente: 'Uncommon', raro: 'Rare', legendario: 'Legendary',
}

export function tonoDelTier(tier: string) {
  return TONO_POR_RAREZA[RAREZA_DEL_TIER[tier] ?? 'Common'] ?? 'default'
}

/* La tabla vive en `ligaTabla.ts`, pura y sin red, para poder probarla sin
   levantar Supabase. Se re-exporta acá para que las pantallas sigan
   importando de un solo sitio. */
import type { EstadoPartida, PartidaLiga, PlazaLiga, FilaTabla, PartidaAbierta } from './ligaTabla'
export { tablaDe, misPartidasAbiertas, miProximaPartida } from './ligaTabla'
export type { EstadoPartida, PartidaLiga, PlazaLiga, FilaTabla, PartidaAbierta }

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

/**
 * Las ligas VIVAS de un creador. Devuelve lista, no una sola.
 *
 * Devolvía `.maybeSingle()`, que con dos filas contesta PGRST116 — y el
 * `if (error) return null` de abajo se lo tragaba. O sea que abrir una segunda
 * liga no daba un error: hacía DESAPARECER la primera de la casa del creador.
 *
 * El índice único que forzaba una sola liga viva ya no está: impedía Puente 4
 * mientras Puente 3 siguiera abierta. En su lugar hay un tope blando de 5
 * dentro de `liga_crear`, que es un límite con mensaje en vez de un índice que
 * miente.
 */
export async function getLigasDeCreador(creadorId: string): Promise<Liga[]> {
  if (!isSupabaseReady()) return []
  const { data, error } = await supabase
    .from('ligas')
    .select('id, code, creador_id, nombre, descripcion, cupo, estado')
    .eq('creador_id', creadorId)
    .in('estado', ['borrador', 'inscripcion', 'activa'])
    .order('creado_en', { ascending: true })
  if (error) { console.warn('[Liga] no se pudieron leer las ligas del creador:', error.message); return [] }
  return (data ?? []).map(filaALiga)
}

/** La primera liga viva. Para las pantallas que todavía asumen una sola. */
export async function getLigaDeCreador(creadorId: string): Promise<Liga | null> {
  return (await getLigasDeCreador(creadorId))[0] ?? null
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

/**
 * EL CARNÉ — lo que sos en la liga ANTES de tener plaza.
 *
 * Entre inscribirse y que el organizador arme los grupos pasan SEMANAS. En ese
 * hueco `mi_liga()` no tenía nada que devolver, así que quien acababa de
 * anotarse abría su perfil y lo veía igual de vacío que antes: ni la app le
 * decía «estás dentro» ni existía nada que lo trajera de vuelta. Ese es el
 * paso donde se cae la retención, no el formulario.
 *
 * `carne` es una clave NUEVA en una rama que ya devolvía `liga: null`, y eso
 * es a propósito: una PWA sin actualizar sigue cortando en `!r.grupo` y sigue
 * viendo exactamente lo de antes (§2g). La cicatriz de más arriba —«así fue
 * exactamente como esta tarjeta desapareció para todos»— es el motivo de que
 * el cambio sea aditivo y no una firma nueva.
 */
export interface CarneLiga {
  inscripcion: string
  ligaId: string
  code: string
  nombre: string
  estado: string
  /** El nombre tal como sale en la tabla: completo, o iniciales si no consintió. */
  nombreVisible: string
  consientePerfil: boolean
  pais: string | null
  lider: string | null
  base: string | null
  tier: string
  inscritoEn: string
  /** Tu propia disponibilidad. Sin esto, editarla arrancaría en blanco y guardar borraría. */
  zona: string | null
  franjas: string | null
  /** «Sos el 34 de 128». Las dos cifras juntas: un «34» suelto no dice nada. */
  puesto: number
  total: number
  cupo: number | null
}

/**
 * Una sola llamada para las dos preguntas: ¿tengo plaza? y, si no, ¿tengo carné?
 *
 * Van juntas porque son la misma fila del servidor. Preguntarlas por separado
 * serían dos viajes para pintar una tarjeta en la pantalla que más se abre.
 */
export async function getMiEstadoLiga(): Promise<{ liga: MiLiga | null; carne: CarneLiga | null }> {
  const vacio = { liga: null, carne: null }
  if (!isSupabaseReady()) return vacio
  const { data, error } = await supabase.rpc('mi_liga')
  // §2f otra vez: un fallo tiene que verse distinto de «no jugás ninguna liga».
  if (error) {
    console.warn('[Liga] mi_liga:', error.message)
    return vacio
  }
  const r = data as ({ ok?: boolean; carne?: CarneLiga } & MiLiga) | null
  if (!r?.ok) return vacio
  return { liga: r.grupo ? r : null, carne: r.carne ?? null }
}

/**
 * Mostrar o esconder el nombre propio en la tabla de la liga.
 *
 * Esto existe porque la decisión se toma en un formulario, una vez, sobre el
 * dato más expuesto de la liga — y no es simétrica: quien se escondió puede
 * querer mostrarse cuando gane, y quien se mostró puede querer esconderse. Lo
 * segundo es lo que no puede esperar a una pantalla de ajustes.
 *
 * El servidor recalcula el nombre desde `profiles` y toca también las plazas
 * vivas: el nombre de la tabla se copia a la plaza al armar los grupos, así
 * que sin esa segunda escritura el cambio no se vería donde importa.
 */
export const guardarNombrePublico = (liga: string, consiente: boolean) =>
  rpc('liga_nombre_publico', { p_liga: liga, p_consiente: consiente })

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

/**
 * `falta` viaja también en el FALLO, y es la mitad del valor de esta capa.
 *
 * Un error de texto le dice a la persona QUÉ pasó; `falta` le dice a la
 * pantalla QUÉ HACER. Sin esa clave, «Antes de entrar, elegí tu país» es una
 * pared: el mensaje es correcto y no hay forma de actuar sobre él sin salir
 * de la liga a buscar dónde se pone el país. Con ella, el asistente abre el
 * paso que corresponde.
 *
 * Los valores los define el servidor (`nombre`, `pais`, `horarios`,
 * `transmision`, `cupo`, `cerrada`, `repetida`). El cliente NO los inventa: si
 * llega uno que no conoce, cae en el mensaje de texto, que siempre está.
 */
export interface ResultadoLiga { ok: boolean; mensaje?: string; falta?: string }

async function rpc(nombre: string, args: Record<string, unknown>): Promise<ResultadoLiga & { extra?: Record<string, unknown> }> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con el servidor' }
  // §2f: supabase-js NO lanza ante un error de PostgREST.
  const { data, error } = await supabase.rpc(nombre, args)
  if (error) return { ok: false, mensaje: error.message }
  const r = data as { ok: boolean; error?: string; falta?: string } | null
  if (!r?.ok) return { ok: false, mensaje: r?.error ?? 'No se pudo', falta: r?.falta }
  return { ok: true, extra: r as Record<string, unknown> }
}

/**
 * `cupo` en `null` es SIN TOPE, y ahora significa eso de verdad.
 *
 * La columna tenía `default 10`, así que un null se convertía en diez al
 * insertar: el «sin tope» era inexpresable y una liga de 128 nacía capada.
 * Sin el default, null vuelve a ser lo único que puede ser.
 */
export const crearLiga = (code: string, nombre: string, descripcion: string, cupo: number | null) =>
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
  /** Cuándo se cierra la ENTRADA. `null` = sin plazo anunciado. Es otra cosa
   *  que `arranca`: se puede cerrar la inscripción dos semanas antes de que
   *  empiece el juego, y esa es la fecha que obliga a alguien a entrar hoy. */
  inscripcionCierra: string | null
}

/** Un aviso del creador a su liga. Seis campos y ninguno de más (§7.3). */
export interface AnuncioLiga {
  id: string
  titulo: string
  cuerpo: string
  creadoEn: string
}

export interface LigaCompleta {
  liga: Liga & { tamanoGrupo: number; esStaff: boolean; formato: string; cupo: number | null }
  temporada: TemporadaLiga | null
  miInscripcion: string | null
  /** Lo que va en el carrusel de la cabecera. Lo cuenta el servidor: contarlo
   *  en el cliente exigiría traerse el padrón entero, que es justo lo que los
   *  grants por columna de la Fase 0 dejaron de entregar. */
  cifras: { inscritos: number; paises: number }
  /** Quiénes van entrando. Cuatro campos y ninguno de más: sin `estado` (admite
   *  'vetado'), sin `user_id` y sin el puesto de llegada. Tope de 200. */
  padron: Array<{ id: string; nombre: string; pais: string | null; lider: string | null; base: string | null }>
  anuncios: AnuncioLiga[]
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
  const r = data as ({ ok?: boolean; liga?: LigaCompleta['liga'] | null } & LigaCompleta) | null
  if (!r?.ok || !r.liga) return null
  // Las plazas llegan dentro de cada grupo sin `grupoId`: se lo pone acá para
  // que `tablaDe` pueda filtrar sin recorrer el árbol otra vez.
  const grupos = (r.grupos ?? []).map(g => ({
    ...g,
    plazas: (g.plazas ?? []).map(p => ({ ...p, grupoId: g.id })),
    partidas: (g.partidas ?? []).map(m => ({ ...m, grupoId: g.id })),
  }))
  return {
    liga: r.liga,
    temporada: r.temporada ?? null,
    miInscripcion: r.miInscripcion ?? null,
    cifras: r.cifras ?? { inscritos: 0, paises: 0 },
    padron: r.padron ?? [],
    anuncios: r.anuncios ?? [],
    grupos,
  }
}

/** Todas las plazas y partidas de la liga, aplanadas. Para la tabla global. */
export function aplanar(l: LigaCompleta): { plazas: PlazaLiga[]; partidas: PartidaLiga[] } {
  return {
    plazas: l.grupos.flatMap(g => g.plazas),
    partidas: l.grupos.flatMap(g => g.partidas),
  }
}

/** Mi próxima partida: la primera sin cerrar donde estoy. Es la única acción. */
// ── Acciones ────────────────────────────────────────────────────────
export const inscribirseLiga = (
  liga: string, lider: string, base: string,
  zona: string, franjas: string, transmision: boolean, perfil: boolean,
  /** El mazo que va a jugar. El servidor comprueba que sea TUYO (§3a). */
  deck?: string | null,
) => rpc('liga_inscribirse', {
  p_liga: liga, p_lider: lider, p_base: base, p_zona: zona, p_franjas: franjas,
  p_consiente_transmision: transmision, p_consiente_perfil: perfil,
  p_deck: deck || null,
})

/**
 * Publicar un aviso de la liga. **Solo staff**, y lo comprueba el servidor.
 *
 * Existe porque Alejo no podía publicar NADA: la policy `news_insert` exige
 * `role = 'admin'` y `news` no tiene columna de alcance, así que un aviso de
 * PUENTE saldría en el Inicio de toda la comunidad salvadoreña. Y
 * `tournament_broadcasts` tampoco servía: su INSERT es `auth.uid() is not
 * null`, o sea el megáfono de la app para cualquier cuenta con sesión.
 */
export const publicarAnuncio = (liga: string, titulo: string, cuerpo: string) =>
  rpc('liga_anunciar', { p_liga: liga, p_titulo: titulo, p_cuerpo: cuerpo })

export const borrarAnuncio = (id: string) => rpc('liga_borrar_anuncio', { p_id: id })

/**
 * Configurar la liga desde el panel. **Solo staff**, y lo comprueba el servidor.
 *
 * Existe por la misma razón que el editor de la escala de sobres (§4s): hasta
 * hoy, cambiar el cupo, el formato o ABRIR LA INSCRIPCIÓN eran un `update`
 * suelto en el SQL Editor. Una decisión de quien organiza no puede necesitar a
 * un programador ni esperar a que esté disponible — así fue como el 4.º de una
 * final se quedó sin sobres.
 *
 * Todo lo que llega `null` se deja como estaba: la pantalla manda solo lo que
 * de verdad se tocó, y así dos personas editando campos distintos no se pisan.
 */
export const configurarLiga = (liga: string, cambios: {
  nombre?: string; descripcion?: string; cupo?: number | null
  formato?: string; tamanoGrupo?: number; estado?: string; publica?: boolean
}) => rpc('liga_configurar', {
  p_liga: liga,
  p_nombre: cambios.nombre ?? null,
  p_descripcion: cambios.descripcion ?? null,
  p_cupo: cambios.cupo ?? null,
  p_formato: cambios.formato ?? null,
  p_tamano_grupo: cambios.tamanoGrupo ?? null,
  p_estado: cambios.estado ?? null,
  p_publica: cambios.publica ?? null,
})

export const guardarDisponibilidad = (liga: string, zona: string, franjas: string, nota?: string) =>
  rpc('liga_guardar_disponibilidad', { p_liga: liga, p_zona: zona, p_franjas: franjas, p_nota: nota ?? null })

export const abrirTemporada = (liga: string, nombre: string, arranca: string, cierra: string) =>
  rpc('liga_abrir_temporada', { p_liga: liga, p_nombre: nombre, p_arranca: arranca, p_cierra: cierra })

export const armarGrupos = (temporada: string, asignacion: unknown) =>
  rpc('liga_armar_grupos', { p_temporada: temporada, p_asignacion: asignacion })

export const sembrarGrupo = (grupo: string) => rpc('liga_sembrar_grupo', { p_grupo: grupo })

/**
 * Cerrar una temporada: reparte ascensos y descensos, y libera el índice
 * `liga_una_temporada_viva` para que pueda existir una Temporada 2.
 *
 * **El resultado lo calcula el CLIENTE con `tablaDe`** y el servidor lo valida.
 * `tablaDe` es la única implementación de la tabla de posiciones y tiene prueba
 * golden; reimplementarla en SQL serían dos verdades de la misma tabla, y la
 * que reparte los ascensos no sería la que la gente vio toda la temporada.
 *
 * Con `ensayo` en true devuelve exactamente lo que haría —quién sube, quién
 * baja, cuántas partidas se sellan— **sin escribir nada**, por el MISMO camino
 * que el cierre real. Un ensayo que use otro camino no prueba nada.
 */
/** Lo mínimo para pintar el botón de la liga en Inicio. Ver `liga_para_inicio`. */
export interface LigaDeInicio {
  code: string
  nombre: string
  estado: string
  esStaff: boolean
  inscrito: boolean
  temporada: { estado: string; inscripcionCierra: string | null; arranca: string | null } | null
}

/**
 * Qué liga le toca a esta persona en Inicio, o `null`.
 *
 * **No se cablea `puente3` en el cliente.** El día que exista Puente 4 —o la
 * liga de otro creador— un code escrito a mano manda a todo el mundo a la liga
 * equivocada. La pregunta es «cuál es MI liga» y la contesta el servidor.
 *
 * Devuelve seis campos, no la liga entera: `verLiga` trae grupos, plazas y
 * partidas, y eso en la pantalla que más se abre serían cientos de filas para
 * pintar un botón.
 */
export async function ligaParaInicio(): Promise<LigaDeInicio | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase.rpc('liga_para_inicio')
  if (error) { console.warn('[Liga] inicio:', error.message); return null }
  const r = data as (LigaDeInicio & { code: string | null }) | null
  return r?.code ? (r as LigaDeInicio) : null
}

export const cerrarTemporada = (
  temporada: string,
  resultado: Array<{ plazaId: string; puesto: number }>,
  ensayo = false,
) => rpc('liga_cerrar_temporada', {
  p_temporada: temporada, p_resultado: resultado, p_ensayo: ensayo,
})

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
  /** ISO alpha-2, o null. Para la bandera de la ficha del panel. */
  pais: string | null
  zona: string | null
  franjas: string | null
  horas: number
  inscritoEn: string
}

export interface PanelLiga {
  inscritos: InscritoPanel[]
  cola: Array<{
    id: string; estado: string; jornada: number; local: string; visita: string
    /** El país de cada lado. En la cola el árbitro decide sin conocer a la
     *  gente: dos nombres sueltos son dos desconocidos. */
    localPais: string | null; visitaPais: string | null
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

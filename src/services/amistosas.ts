/**
 * DUELOS AMISTOSOS — la capa de datos que antes no existía.
 *
 * Los duelos de mesa se guardan en `duelos_amistosos` desde que existe el
 * Contador, pero las cuatro consultas vivían INLINE dentro de ContadorPage
 * (líneas 546, 574, 611 y 762). Con una pantalla propia serían seis sitios
 * repitiendo el mismo `.or(and(...),and(...))` y —lo que de verdad importa— el
 * mismo VOLTEO de punto de vista. Este archivo lo centraliza.
 *
 * ── El volteo, que es la única trampa real ───────────────────────────
 *
 * En la fila, `victorias_creador` son las de quien llevaba el teléfono. El
 * MISMO duelo es una victoria o una derrota según quién lo guardó. Si una
 * pantalla asume «yo siempre soy el creador», la mitad del historial sale con
 * el marcador al revés — y como los dos números son plausibles, nadie lo nota.
 * `vistaDe()` es el único sitio donde se decide, y todo lo demás lo consume.
 *
 * ── Lo que esta capa NO hace, a propósito ────────────────────────────
 *
 * No da XP, no toca `player_stats`, no escribe `tournament_results` y no
 * dispara logros. La tabla es amistosa POR CONTRATO (ver la cabecera de
 * `duelos-amistosos.sql`): la garantía es estructural —no hay triggers— y esta
 * capa no la puede romper aunque quisiera. Si algún día se quiere que un
 * amistoso dé XP, se discute primero: fue un pedido explícito.
 */

import { supabase, isSupabaseReady } from './supabase'

/** Las columnas que se piden. Explícitas: un `*` traería columnas nuevas sin querer. */
const COLUMNAS =
  'id, creador_id, rival_id, rival_nombre, lider_creador, base_creador, ' +
  'lider_rival, base_rival, victorias_creador, victorias_rival, rondas, ' +
  'terminado, created_at'

interface FilaDuelo {
  id: string
  creador_id: string
  rival_id: string | null
  rival_nombre: string
  lider_creador: string
  base_creador: string
  lider_rival: string
  base_rival: string
  victorias_creador: number
  victorias_rival: number
  rondas: number
  terminado: boolean
  created_at: string
}

/** Un lado del duelo, ya resuelto desde el punto de vista de quien mira. */
export interface LadoAmistoso {
  /** Perfil, si lo hay. `null` = invitado sin cuenta. */
  perfilId: string | null
  nombre: string
  avatar: string | null
  /** «Nombre — Subtítulo». Vacío en los duelos viejos: la columna no existía. */
  lider: string
  base: string
  victorias: number
}

/** Un duelo YA VOLTEADO: `yo` siempre soy quien está mirando la pantalla. */
export interface DueloVisto {
  id: string
  cuando: string
  yo: LadoAmistoso
  rival: LadoAmistoso
  /**
   * `'gane' | 'perdi' | 'empate' | 'sin-marcador'`.
   *
   * `sin-marcador` NO es lo mismo que empate, y la diferencia importa: de los
   * 9 duelos que hay hoy en producción, 8 están en 0-0 porque la gente usó el
   * Contador para llevar la VIDA y nunca marcó quién ganó el juego. Pintar eso
   * como «empate» sería inventar un resultado que nadie registró.
   */
  resultado: 'gane' | 'perdi' | 'empate' | 'sin-marcador'
  /** De dónde salió: el Contador solo sube duelos que llegaron a `terminado`. */
  rondas: number
}

/** El acumulado contra una persona. */
export interface CaraACara {
  rivalId: string | null
  nombre: string
  avatar: string | null
  duelos: number
  ganados: number
  perdidos: number
  empatados: number
  sinMarcador: number
}

/**
 * Voltea una fila al punto de vista de `miId`.
 *
 * `nombres` resuelve el nombre de quien creó el duelo cuando el creador fue el
 * OTRO: la fila guarda `rival_nombre` pero nunca el nombre del creador.
 */
function vistaDe(
  f: FilaDuelo,
  miId: string,
  nombres: Map<string, { name: string; avatar: string | null }>,
): DueloVisto {
  const yoCree = f.creador_id === miId

  const mias = yoCree ? f.victorias_creador : f.victorias_rival
  const suyas = yoCree ? f.victorias_rival : f.victorias_creador

  const otro = yoCree ? null : nombres.get(f.creador_id)

  const yo: LadoAmistoso = {
    perfilId: miId,
    nombre: 'Vos',
    avatar: null,
    lider: yoCree ? f.lider_creador : f.lider_rival,
    base: yoCree ? f.base_creador : f.base_rival,
    victorias: mias,
  }

  const rival: LadoAmistoso = {
    perfilId: yoCree ? f.rival_id : f.creador_id,
    nombre: yoCree ? (f.rival_nombre || 'Invitado') : (otro?.name ?? 'Alguien'),
    avatar: yoCree ? null : (otro?.avatar ?? null),
    lider: yoCree ? f.lider_rival : f.lider_creador,
    base: yoCree ? f.base_rival : f.base_creador,
    victorias: suyas,
  }

  // 0-0 es «nadie anotó», no un empate. Ver el comentario del tipo.
  const resultado: DueloVisto['resultado'] =
    mias === 0 && suyas === 0 ? 'sin-marcador'
      : mias > suyas ? 'gane'
        : suyas > mias ? 'perdi'
          : 'empate'

  return { id: f.id, cuando: f.created_at, yo, rival, resultado, rondas: f.rondas }
}

/**
 * `ok:false` NO es lo mismo que una lista vacía, y la pantalla necesita poder
 * distinguirlos: «todavía no jugaste ningún amistoso» y «no se pudo consultar»
 * piden botones distintos —uno lleva a registrar, el otro a reintentar— y con
 * un `[]` pelado los dos casos se ven idénticos.
 *
 * Es exactamente el fallo que tiene hoy `/arena`: `getPublicMatchFeed` se traga
 * el error y devuelve `[]`, así que la pantalla dice «no hay partidas» con la
 * red caída.
 */
export type Resultado<T> = { ok: true; datos: T } | { ok: false; mensaje: string }

/**
 * Los duelos terminados de `miId`, en LAS DOS direcciones.
 *
 * `terminado = true` es lo que separa una partida de un duelo abandonado a
 * medias: hoy 6 de 9 filas están en `false` porque quien abrió el Contador
 * nunca lo cerró. Mostrarlas sería llenar el historial de partidas que nadie
 * jugó.
 */
export async function listarAmistosas(miId: string, tope = 100): Promise<Resultado<DueloVisto[]>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }
  if (!miId) return { ok: true, datos: [] }

  const { data, error } = await supabase
    .from('duelos_amistosos')
    .select(COLUMNAS)
    .or(`creador_id.eq.${miId},rival_id.eq.${miId}`)
    .eq('terminado', true)
    .order('created_at', { ascending: false })
    .limit(tope)

  // Gotcha 2f: supabase-js no lanza ante un error de PostgREST. Sin mirar
  // `error`, un fallo se ve exactamente igual que «no hay duelos».
  if (error) {
    console.warn('[amistosas] no se pudieron leer los duelos:', error.message)
    return { ok: false, mensaje: 'No se pudieron cargar los duelos.' }
  }
  if (!data) return { ok: true, datos: [] }

  const filas = data as unknown as FilaDuelo[]

  // El nombre y el avatar de quien creó el duelo no viajan en la fila. Se
  // resuelven de una sola vez para todos los creadores ajenos.
  const ajenos = [...new Set(filas.filter(f => f.creador_id !== miId).map(f => f.creador_id))]
  const nombres = new Map<string, { name: string; avatar: string | null }>()
  if (ajenos.length) {
    const { data: perfiles, error: e2 } = await supabase
      .from('profiles')
      .select('id, name, avatar')
      .in('id', ajenos)
    if (e2) console.warn('[amistosas] no se pudieron resolver los perfiles:', e2.message)
    for (const p of perfiles ?? []) nombres.set(p.id, { name: p.name, avatar: p.avatar })
  }

  return { ok: true, datos: filas.map(f => vistaDe(f, miId, nombres)) }
}

/**
 * Agrupa los duelos por rival. Se calcula sobre lo que ya se leyó — no es una
 * segunda consulta.
 *
 * Los invitados sin cuenta se agrupan por NOMBRE: es lo único que los
 * distingue. Dos «Invitado» distintos van a caer en el mismo montón, y eso es
 * honesto — la app no sabe que son personas diferentes.
 */
export function agruparCaraACara(duelos: DueloVisto[]): CaraACara[] {
  const mapa = new Map<string, CaraACara>()

  for (const d of duelos) {
    const clave = d.rival.perfilId ?? `nombre:${d.rival.nombre}`
    let e = mapa.get(clave)
    if (!e) {
      e = {
        rivalId: d.rival.perfilId,
        nombre: d.rival.nombre,
        avatar: d.rival.avatar,
        duelos: 0, ganados: 0, perdidos: 0, empatados: 0, sinMarcador: 0,
      }
      mapa.set(clave, e)
    }
    e.duelos++
    if (d.resultado === 'gane') e.ganados++
    else if (d.resultado === 'perdi') e.perdidos++
    else if (d.resultado === 'empate') e.empatados++
    else e.sinMarcador++
    // El avatar puede faltar en un duelo y venir en otro (solo llega cuando el
    // rival fue el CREADOR). Se queda con el primero que aparezca.
    if (!e.avatar && d.rival.avatar) e.avatar = d.rival.avatar
  }

  // Primero contra quien más se jugó: es el cara-a-cara que la gente busca.
  return [...mapa.values()].sort((a, b) => b.duelos - a.duelos || a.nombre.localeCompare(b.nombre))
}

/** Lo que hace falta para anotar una partida que YA se jugó. */
export interface NuevaAmistosa {
  rivalId: string | null
  rivalNombre: string
  miLider: string
  miBase: string
  suLider: string
  suBase: string
  misVictorias: number
  susVictorias: number
  /** Fecha de la partida. Si no viene, ahora. */
  cuando?: Date | null
}

/**
 * Anota una partida ya jugada, sin pasar por el Contador.
 *
 * El Contador cubre el caso «estoy en la mesa AHORA». Este cubre el otro, que
 * es el más común: se jugó, se guardaron las cartas, y después alguien quiere
 * dejar constancia. Sin esto, todo lo que no se contó en vivo se pierde.
 *
 * Escribe con `terminado: true` de entrada: una partida que ya pasó no tiene
 * un estado «en curso» al que volver.
 *
 * OJO con quién escribe: la policy `duelos_update` exige `auth.uid() =
 * creador_id`, así que el RIVAL no puede corregir esta fila desde su teléfono.
 * Quien anota es el dueño del registro. Es la misma regla del Contador.
 */
export async function registrarAmistosa(miId: string, d: NuevaAmistosa): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión con la nube.' }
  if (!miId) return { ok: false, error: 'Hay que iniciar sesión para anotar un duelo.' }

  // El check de la tabla es `between 0 and 2`; recortar acá da un mensaje
  // entendible en vez de un 23514 de Postgres.
  const mias = Math.max(0, Math.min(2, Math.round(d.misVictorias)))
  const suyas = Math.max(0, Math.min(2, Math.round(d.susVictorias)))

  const fila = {
    id: crypto.randomUUID(),
    creador_id: miId,
    rival_id: d.rivalId,
    rival_nombre: d.rivalNombre.trim() || 'Invitado',
    lider_creador: d.miLider.trim(),
    base_creador: d.miBase.trim(),
    lider_rival: d.suLider.trim(),
    base_rival: d.suBase.trim(),
    victorias_creador: mias,
    victorias_rival: suyas,
    // `rondas` en el Contador se reinicia a 1 en cada juego, así que NO es la
    // duración del duelo. Acá se guarda el total de juegos disputados, que es
    // lo único que se sabe de una partida ya terminada.
    rondas: Math.max(1, mias + suyas),
    terminado: true,
    created_at: (d.cuando ?? new Date()).toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('duelos_amistosos').insert(fila)
  if (error) {
    console.warn('[amistosas] no se pudo anotar el duelo:', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

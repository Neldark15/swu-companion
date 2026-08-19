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
  'terminado, created_at, estado, mazo_creador_id, mazo_rival_id'

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
  estado: EstadoAmistosa
  mazo_creador_id: string | null
  mazo_rival_id: string | null
}

/**
 * Dónde está la partida en el camino a publicarse.
 *
 * - `pendiente`  el creador la anotó, el rival todavía no dijo nada.
 * - `confirmada` el rival aceptó: es pública y cuenta para el meta.
 * - `rechazada`  el rival dijo que no. Se queda, privada, en el historial de
 *                los dos: negarse a publicar no es negar que se jugó.
 * - `sin_rival`  se jugó contra alguien sin cuenta. No hay a quién preguntarle,
 *                así que nunca se publica.
 */
export type EstadoAmistosa = 'pendiente' | 'confirmada' | 'rechazada' | 'sin_rival'

/** Un lado del duelo, ya resuelto desde el punto de vista de quien mira. */
export interface LadoAmistoso {
  /** Perfil, si lo hay. `null` = invitado sin cuenta. */
  perfilId: string | null
  nombre: string
  avatar: string | null
  /** Id del mazo que este lado adjuntó, si adjuntó alguno. */
  mazoId: string | null
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
  estado: EstadoAmistosa
  /** `true` si soy YO quien la anotó. Decide quién puede confirmar. */
  laAnoteYo: boolean
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

  // Quién es «el otro» depende de quién abrió el duelo. Si lo abriste vos, el
  // otro está en `rival_id` —que puede ser nulo si era alguien sin cuenta—; si
  // lo abrió él, está en `creador_id`, que nunca es nulo.
  const otroId = yoCree ? f.rival_id : f.creador_id
  const otro = otroId ? nombres.get(otroId) ?? null : null

  const yo: LadoAmistoso = {
    perfilId: miId,
    nombre: 'Vos',
    avatar: nombres.get(miId)?.avatar ?? null,
    lider: yoCree ? f.lider_creador : f.lider_rival,
    base: yoCree ? f.base_creador : f.base_rival,
    victorias: mias,
    mazoId: yoCree ? f.mazo_creador_id : f.mazo_rival_id,
  }

  const rival: LadoAmistoso = {
    perfilId: otroId,
    // El nombre guardado en la fila es una foto del momento; si el rival tiene
    // cuenta, su nombre actual manda.
    nombre: otro?.name ?? (yoCree ? (f.rival_nombre || 'Invitado') : 'Alguien'),
    avatar: otro?.avatar ?? null,
    lider: yoCree ? f.lider_rival : f.lider_creador,
    base: yoCree ? f.base_rival : f.base_creador,
    victorias: suyas,
    mazoId: yoCree ? f.mazo_rival_id : f.mazo_creador_id,
  }

  // 0-0 es «nadie anotó», no un empate. Ver el comentario del tipo.
  const resultado: DueloVisto['resultado'] =
    mias === 0 && suyas === 0 ? 'sin-marcador'
      : mias > suyas ? 'gane'
        : suyas > mias ? 'perdi'
          : 'empate'

  return {
    id: f.id, cuando: f.created_at, yo, rival, resultado, rondas: f.rondas,
    estado: f.estado, laAnoteYo: yoCree,
  }
}

/**
 * `ok:false` NO es lo mismo que una lista vacía, y la pantalla necesita poder
 * distinguirlos: «todavía no jugaste ningún amistoso» y «no se pudo consultar»
 * piden botones distintos —uno lleva a registrar, el otro a reintentar— y con
 * un `[]` pelado los dos casos se ven idénticos.
 *
 * Era exactamente el fallo que tenía `/arena` (retirado): `getPublicMatchFeed` se tragaba
 * el error y devuelve `[]`, así que la pantalla dice «no hay partidas» con la
 * red caída.
 */
export type Resultado<T> = { ok: true; datos: T } | { ok: false; mensaje: string }

/**
 * Nombre y avatar de un puñado de perfiles, en un solo viaje.
 *
 * Lo usan el historial y las pendientes. Un fallo acá NO tumba la pantalla: se
 * pierde la foto, no el duelo — por eso avisa por consola y devuelve el mapa
 * a medias en vez de propagar el error.
 */
async function nombresDe(ids: string[]): Promise<Map<string, { name: string; avatar: string | null }>> {
  const mapa = new Map<string, { name: string; avatar: string | null }>()
  const limpios = [...new Set(ids.filter(Boolean))]
  if (limpios.length === 0) return mapa
  const { data, error } = await supabase
    .from('profiles').select('id, name, avatar').in('id', limpios)
  if (error) console.warn('[amistosas] no se pudieron resolver los perfiles:', error.message)
  for (const p of data ?? []) mapa.set(p.id, { name: p.name, avatar: p.avatar })
  return mapa
}

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

  // Ni el nombre ni el avatar del OTRO viajan en la fila, y el «otro» está en
  // una punta distinta según quién abrió el duelo. Antes solo se resolvía el
  // lado `creador_id`, así que en los duelos que abriste VOS el rival salía sin
  // foto —el círculo negro— aunque tuviera cuenta y avatar puestos.
  //
  // `rival_id` es NULO a propósito cuando se anota a alguien sin cuenta: esos
  // se quedan con `rival_nombre`, que es todo lo que la app sabe de ellos.
  // Va también `miId`: el lado «Vos» quiere su propia foto, y pedirla acá
  // cuesta cero (ya es la misma consulta) en vez de una segunda.
  const otros = [...new Set(
    [miId, ...filas.flatMap(f => [f.creador_id, f.rival_id])].filter((id): id is string => !!id),
  )]
  const nombres = await nombresDe(otros)

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
    // El avatar puede faltar en un duelo y venir en otro: los invitados sin
    // cuenta nunca traen uno. Se queda con el primero que aparezca.
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
  /**
   * Mi mazo de esa partida, si lo quiero adjuntar. El del rival NO se elige
   * acá: se lo adjunta él mismo al confirmar. Nadie publica el mazo de otro.
   */
  miMazoId?: string | null
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
    mazo_creador_id: d.miMazoId || null,
    // Con rival con cuenta nace PENDIENTE: hasta que él acepte, la partida es
    // privada. Contra un invitado sin cuenta no hay a quién preguntarle, así
    // que nace `sin_rival` y se queda en el historial personal.
    estado: d.rivalId ? 'pendiente' : 'sin_rival',
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


// ─────────────────────────────────────────────────────────────────────────────
// CONSENTIMIENTO
//
// Una amistosa la anota una persona pero la jugaron DOS. Publicarla sin
// preguntarle al otro sería contar su mazo, su resultado y con quién juega sin
// que él haya dicho que sí. Así que el creador anota, al rival le cae
// pendiente, y recién si acepta la partida es pública y cuenta para el meta.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Las partidas que alguien anotó CONTRA MÍ y esperan mi respuesta.
 *
 * Se consultan con la policy `duelos_select` (`creador OR rival`), que ya
 * existía: no hace falta abrir nada nuevo para que el rival vea lo suyo.
 */
export async function pendientesDeConfirmar(miId: string): Promise<Resultado<DueloVisto[]>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }
  if (!miId) return { ok: true, datos: [] }

  const { data, error } = await supabase
    .from('duelos_amistosos')
    .select(COLUMNAS)
    .eq('rival_id', miId)
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[amistosas] no se pudieron leer las pendientes:', error.message)
    return { ok: false, mensaje: 'No se pudieron leer las partidas por confirmar.' }
  }

  const filas = (data ?? []) as unknown as FilaDuelo[]
  if (filas.length === 0) return { ok: true, datos: [] }

  // Los nombres de quienes las anotaron: la fila guarda `rival_nombre` (o sea
  // el MÍO) pero nunca el nombre del creador.
  const ids = [...new Set(filas.map((f) => f.creador_id))]
  const nombres = await nombresDe([...ids, miId])
  return { ok: true, datos: filas.map((f) => vistaDe(f, miId, nombres)) }
}

/** Lo que el rival puede agregar de su lado al aceptar. */
export interface AlConfirmar {
  /** Corrige el líder que anotó el creador, si se equivocó o lo dejó vacío. */
  lider?: string | null
  base?: string | null
  /** Mi mazo. Solo se puede adjuntar uno propio: la función lo verifica. */
  mazoId?: string | null
}

/**
 * Acepta o rechaza que una partida se publique.
 *
 * Va por RPC y no por un `update` directo, y la razón no es de estilo: RLS es
 * por FILA, no por columna. Una policy que dejara al rival escribir esta fila
 * lo dejaría cambiar también el marcador y el mazo del creador. La función
 * `confirmar_amistosa` es SECURITY DEFINER, comprueba que quien llama sea el
 * rival, y toca exactamente cuatro campos.
 */
export async function confirmarAmistosa(
  dueloId: string,
  acepta: boolean,
  extra: AlConfirmar = {},
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión con la nube.' }

  const { error } = await supabase.rpc('confirmar_amistosa', {
    p_duelo: dueloId,
    p_acepta: acepta,
    p_lider: extra.lider?.trim() || null,
    p_base: extra.base?.trim() || null,
    p_mazo: extra.mazoId || null,
  })

  if (error) {
    console.warn('[amistosas] no se pudo confirmar:', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/** Una fila del meta amistoso: un arquetipo y cómo le fue fuera de torneo. */
export interface MetaAmistoso {
  lider: string
  base: string
  partidas: number
  ganadas: number
  perdidas: number
  /** Sobre las partidas CON marcador. Null si ninguna lo tuvo. */
  winrate: number | null
}

/**
 * Qué se está jugando de verdad fuera de torneo.
 *
 * Agrega los DOS lados de cada duelo, no solo el de quien anotó. Sin eso el
 * meta saldría sesgado hacia los mazos de la gente que lleva el teléfono a la
 * mesa, que siempre es la misma.
 *
 * Solo entra lo `confirmada`. Es la diferencia entre un meta y un chisme.
 */
export async function metaAmistoso(dias = 90): Promise<Resultado<MetaAmistoso[]>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }

  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase.rpc('meta_amistoso', { p_desde: desde })

  if (error) {
    console.warn('[amistosas] no se pudo leer el meta amistoso:', error.message)
    return { ok: false, mensaje: 'No se pudo leer el meta de amistosas.' }
  }

  const filas = (data ?? []) as Array<{
    lider: string; base: string; partidas: number; ganadas: number; perdidas: number
  }>
  return {
    ok: true,
    datos: filas.map((f) => {
      // El denominador son las partidas CON marcador, no todas: hoy 8 de 10
      // duelos en producción están 0-0 porque se usó el Contador para llevar
      // la vida y nadie marcó quién ganó. Meterlas al denominador daría un
      // winrate del 0% para todo el mundo.
      const conMarcador = f.ganadas + f.perdidas
      return {
        ...f,
        winrate: conMarcador > 0 ? Math.round((f.ganadas / conMarcador) * 100) : null,
      }
    }),
  }
}

/* ══════════════════════════════════════════════════════════════════════
 * LO PÚBLICO: el historial de otra persona, y el ranking de mesa
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * Las amistosas CONFIRMADAS de cualquier jugador, vistas desde su lado.
 *
 * Solo confirmadas, y no por elección de esta función: la política
 * `duelos_publicos` de la base deja leer exactamente ese estado a cualquiera
 * (§3a). Una pendiente es una partida que el rival todavía no aceptó publicar,
 * y enseñarla desde otro perfil sería publicarla por él.
 *
 * Se usa el MISMO `vistaDe` que el historial propio, con el id del perfil que
 * se está mirando en vez del mío: así el marcador sale desde su punto de vista
 * y no se duplica la lógica del volteo, que es donde vive el error clásico de
 * esta tabla.
 */
export async function amistosasDePerfil(
  userId: string,
  tope = 100,
): Promise<Resultado<DueloVisto[]>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }
  if (!userId) return { ok: true, datos: [] }

  const { data, error } = await supabase
    .from('duelos_amistosos')
    .select(COLUMNAS)
    .or(`creador_id.eq.${userId},rival_id.eq.${userId}`)
    .eq('estado', 'confirmada')
    .order('created_at', { ascending: false })
    .limit(tope)

  if (error) {
    console.warn('[amistosas] historial público:', error.message)
    return { ok: false, mensaje: 'No se pudo cargar el historial.' }
  }
  if (!data) return { ok: true, datos: [] }

  const filas = data as unknown as FilaDuelo[]
  const ids = [...new Set(
    [userId, ...filas.flatMap(f => [f.creador_id, f.rival_id])].filter((x): x is string => !!x),
  )]
  const nombres = await nombresDe(ids)

  return { ok: true, datos: filas.map(f => vistaDe(f, userId, nombres)) }
}

/** Una fila del ranking de amistosas. */
export interface FilaRankingAmistosas {
  userId: string
  nombre: string
  avatar: string | null
  duelos: number
  ganados: number
  perdidos: number
  empatados: number
  /** Duelos que nadie marcó. NO son empates. */
  sinMarcador: number
  rivales: number
}

/**
 * El ranking de las partidas de mesa.
 *
 * NO es «el ranking» — ese es `ranking_unificado()` en /rank, y ya cuenta las
 * amistosas confirmadas a 1 punto. Este responde otra pregunta: de las partidas
 * de mesa, ¿cómo voy? Por eso vive dentro de /amistosas y se titula con su
 * nombre completo. Ver §3c: 14 tablas de posiciones sin nombre propio fue
 * exactamente el problema que costó una reescritura.
 */
export async function rankingAmistosas(dias?: number): Promise<Resultado<FilaRankingAmistosas[]>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }

  const desde = dias
    ? new Date(Date.now() - dias * 86400_000).toISOString()
    : null

  const { data, error } = await supabase.rpc('ranking_amistosas', { p_desde: desde })
  if (error) {
    console.warn('[amistosas] ranking:', error.message)
    return { ok: false, mensaje: 'No se pudo cargar el ranking.' }
  }

  const filas = (data ?? []) as {
    user_id: string; nombre: string; avatar: string | null
    duelos: number; ganados: number; perdidos: number
    empatados: number; sin_marcador: number; rivales: number
  }[]

  return {
    ok: true,
    datos: filas.map(f => ({
      userId: f.user_id,
      nombre: f.nombre,
      avatar: f.avatar,
      duelos: Number(f.duelos ?? 0),
      ganados: Number(f.ganados ?? 0),
      perdidos: Number(f.perdidos ?? 0),
      empatados: Number(f.empatados ?? 0),
      sinMarcador: Number(f.sin_marcador ?? 0),
      rivales: Number(f.rivales ?? 0),
    })),
  }
}

/**
 * El porcentaje de victorias, o `null` si no hay con qué.
 *
 * El denominador son las partidas CON marcador. Hoy 6 de los 12 duelos de
 * producción están 0-0, así que para mucha gente esto devuelve `null` — y eso
 * es lo correcto. Un «0%» sacado de partidas que nadie marcó es peor que no
 * mostrar nada.
 */
export function winrateAmistosas(f: FilaRankingAmistosas): number | null {
  const marcadas = f.ganados + f.perdidos + f.empatados
  if (marcadas === 0) return null
  return Math.round((f.ganados / marcadas) * 100)
}

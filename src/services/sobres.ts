/**
 * SOBRES — la capa de datos del mini-juego de coleccionar.
 *
 * ── Por qué acá casi no hay lógica ───────────────────────────────────
 *
 * El sorteo NO vive en el cliente. Vive entero en `abrir_sobre()`, una función
 * SECURITY DEFINER en Postgres. Este archivo solo la llama y traduce lo que
 * devuelve. Es a propósito y no es negociable: si el cliente eligiera las
 * cartas, cualquiera con la consola del navegador abierta se regalaría una
 * serializada — y las serializadas son de UNA sola persona en toda la
 * comunidad. Lo mismo con el saldo: `anon` y `authenticated` no tienen INSERT
 * ni UPDATE en ninguna de las cinco tablas (se revocaron a mano, porque
 * Supabase concede ALL por defecto a toda tabla nueva de `public`). El único
 * camino de escritura son las funciones del servidor.
 *
 * Medido contra la base real: un `update sobres_saldo set disponibles = 999`
 * como `authenticated` responde «permission denied for table sobres_saldo», y
 * un segundo dueño para una serializada lo rechaza la llave primaria.
 *
 * ── Lo único que sí hace el cliente ──────────────────────────────────
 *
 * Resolver cada `card_id` contra el catálogo local (Dexie) para saber el
 * nombre, el arte y el set. El servidor devuelve solo `card_id` + `variante`
 * porque el catálogo ya está en el teléfono: mandar el resto sería repetir
 * 6.132 filas que la app ya tiene.
 *
 * El `card_id` es el uuid del API, NO `setCode-setNumber`: medido sobre las
 * 6.132 impresiones especiales, esa pareja choca 701 veces (varias series de
 * variantes numeran desde 1 cada una) mientras que el uuid es único 6.132 de
 * 6.132.
 */

import { supabase, isSupabaseReady } from './supabase'
import { getCardsByIds, MAIN_SET_LABELS } from './swuApi'
import { artesDeVariantes } from './sobresArte'
import type { Card } from '../types'

/**
 * Las cinco impresiones de la colección. TODAS brillan: es lo que hace que el
 * álbum valga la pena de mirar.
 *
 * La Hyperspace pelada y la Standard Foil se sacaron del pool el 2026-08-19
 * (ver `sobres-coleccion-solo-foil.sql`). Se dejan en el tipo porque una
 * apertura vieja guardada en `sobres_aperturas` todavía las nombra, y
 * `rarezaDe` tiene que saber qué hacer con ellas sin romperse.
 */
export type Variante =
  | 'Hyperspace Foil'
  | 'Standard Prestige'
  | 'Foil Prestige'
  | 'Serialized Prestige'
  | 'Showcase'
  /** @deprecated fuera del pool desde el 2026-08-19; solo en aperturas viejas. */
  | 'Hyperspace'
  /** @deprecated fuera del pool desde el 2026-08-19; solo en aperturas viejas. */
  | 'Standard Foil'

/**
 * El escalón de cada impresión.
 *
 * Ahora hay exactamente cinco variantes en el pool, así que cada una ES su
 * propio escalón: no hace falta una capa de «rareza» que agrupe dos cosas
 * distintas bajo el mismo nombre. Antes Showcase y Prestige compartían tramo y
 * eso obligaba a decidir cuál «se ve más», que era una discusión inventada.
 *
 * El orden es el de ESCASEZ MEDIDA en la ranura de premio (62 / 16 / 11 / 8 /
 * 3 %), no el de gusto personal. Showcase va por encima de las dos Prestige
 * porque de verdad sale menos —y además es la familia más chica del pool: 144
 * cartas contra 211.
 */
export type Rareza = 'hiper' | 'prestigio' | 'prestigioFoil' | 'showcase' | 'serializada'

export const RAREZA: Record<Variante, Rareza> = {
  'Hyperspace Foil': 'hiper',
  'Standard Prestige': 'prestigio',
  'Foil Prestige': 'prestigioFoil',
  Showcase: 'showcase',
  'Serialized Prestige': 'serializada',
  // Las dos retiradas caen al escalón de base: sin esto, una apertura vieja
  // pintaría con el color de relleno y se vería como un fallo.
  Hyperspace: 'hiper',
  'Standard Foil': 'hiper',
}

/** El orden en que se revelan: de menos a más, para que el sobre suba. */
export const ESCALA: Rareza[] = ['hiper', 'prestigio', 'prestigioFoil', 'showcase', 'serializada']

/**
 * El ACABADO de cada escalón: cómo brilla, que es distinto de cuán raro es.
 *
 * - `foil`   arcoíris que barre con el ángulo, el brillo clásico de la foil.
 * - `metal`  plateado duro y espejado, el de las Prestige.
 * - `oro`    el metal pero dorado, para la Prestige foil y la serializada.
 *
 * Va separado de la rareza porque son dos preguntas: una decide la fanfarria y
 * el orden, la otra decide qué material se pinta encima del arte.
 */
export type Acabado = 'foil' | 'metal' | 'oro'

export const ACABADO: Record<Rareza, Acabado> = {
  hiper: 'foil',
  prestigio: 'metal',
  prestigioFoil: 'oro',
  showcase: 'foil',
  serializada: 'oro',
}

/** Los colores de cada escalón. Un solo sitio, para que el binder y la apertura no se separen. */
export const COLOR_RAREZA: Record<Rareza, string> = {
  hiper: '#4fc3f7',
  prestigio: '#cbd5e1',
  prestigioFoil: '#fbbf24',
  showcase: '#a78bfa',
  serializada: '#ff4d6d',
}

export const NOMBRE_RAREZA: Record<Rareza, string> = {
  hiper: 'Hiperespacio Foil',
  prestigio: 'Prestige',
  prestigioFoil: 'Prestige Foil',
  showcase: 'Showcase',
  serializada: 'Serializada',
}

/** Una carta ya sacada del sobre, con su ficha del catálogo resuelta. */
export interface CartaSacada {
  cardId: string
  variante: Variante
  rareza: Rareza
  /** `true` si es la quinta ranura, la del premio. */
  premio: boolean
  /** `true` solo para las serializadas: en toda la comunidad hay una. */
  serializada: boolean
  /** La ficha del catálogo. `null` si el catálogo local todavía no la tiene. */
  carta: Card | null
  /**
   * La imagen a pintar — que NO es siempre la de esta impresión.
   *
   * Medido: la lámina «foil» del API es la misma imagen con tres destellos
   * blancos QUEMADOS en el archivo. Ese brillo está pintado, no reacciona al
   * gesto y encima tapa el arte. Así que se usa la lámina sin foil y el brillo
   * lo pone la app, que sí puede seguir al dedo. Ver `sobresArte.ts`.
   */
  arte: string
}

export interface SobreAbierto {
  cartas: CartaSacada[]
  /** Cuántos sobres quedan DESPUÉS de abrir este. */
  saldo: number
}

/** Una fila del binder digital. */
export interface CartaDelBinder {
  cardId: string
  cantidad: number
  /**
   * La impresión con la que se ganó. La guarda `sobres_pool`, no el binder:
   * una misma carta puede existir en varias impresiones y cada una es una
   * pieza distinta de la colección.
   */
  variante: Variante
  rareza: Rareza
  serializada: boolean
  carta: Card | null
  obtenida: string
}

interface FilaCruda {
  card_id: string
  variante: string
  premio?: boolean
  serializada?: boolean
}

/**
 * Toda variante desconocida cae al escalón de base: mejor sosa que reventada.
 * Pasa de verdad con las aperturas guardadas antes del recorte del pool.
 */
function rarezaDe(v: string): Rareza {
  return RAREZA[v as Variante] ?? 'hiper'
}

/**
 * Abre un sobre.
 *
 * Todo lo que importa pasa en el servidor y en UNA sola transacción: cobra el
 * sobre primero (con la fila bloqueada, para que dos pestañas no abran el
 * mismo), sortea, y reclama la serializada con un INSERT contra la llave
 * primaria. Si dos personas sacan la misma serializada en el mismo instante,
 * una recibe 23505 y se le vuelve a sortear; nunca hay dos dueños.
 *
 * Lanza si no queda saldo o si no hay sesión. Ese error se enseña tal cual:
 * son los dos casos que el jugador entiende sin traducción.
 */
export async function abrirSobre(): Promise<SobreAbierto> {
  if (!isSupabaseReady()) throw new Error('Sin conexión con el servidor')

  const { data, error } = await supabase.rpc('abrir_sobre')
  if (error) throw new Error(error.message || 'No se pudo abrir el sobre')
  if (!data) throw new Error('El servidor no devolvió el sobre')

  const crudas = (data.cartas ?? []) as FilaCruda[]
  const fichas = await getCardsByIds(crudas.map(c => c.card_id))

  // La lámina sin destellos quemados. Se resuelve de a montón (una lectura por
  // índice de Dexie para las cinco) y no una por carta.
  const artes = await artesDeVariantes(
    crudas
      .map(c => ({ carta: fichas.get(c.card_id), variante: c.variante as Variante }))
      .filter((x): x is { carta: Card; variante: Variante } => x.carta !== undefined),
  )

  return {
    saldo: Number(data.saldo ?? 0),
    cartas: crudas.map(c => {
      const ficha = fichas.get(c.card_id) ?? null
      return {
        cardId: c.card_id,
        variante: c.variante as Variante,
        rareza: rarezaDe(c.variante),
        premio: c.premio === true,
        serializada: c.serializada === true,
        carta: ficha,
        arte: artes.get(c.card_id) ?? ficha?.imageUrl ?? '',
      }
    }),
  }
}

/** Cuántos sobres tiene sin abrir. Cero si nunca ganó ninguno (no hay fila). */
export async function misSobres(userId: string): Promise<number> {
  if (!isSupabaseReady()) return 0
  const { data, error } = await supabase
    .from('sobres_saldo')
    .select('disponibles')
    .eq('user_id', userId)
    .maybeSingle()
  // `supabase-js` no lanza en errores de PostgREST: hay que mirar `error`.
  if (error || !data) return 0
  return Number(data.disponibles ?? 0)
}

/** Cuántos ha abierto en total. Para la ficha de coleccionista. */
export async function sobresAbiertos(userId: string): Promise<number> {
  if (!isSupabaseReady()) return 0
  const { data, error } = await supabase
    .from('sobres_saldo')
    .select('abiertos_total')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return 0
  return Number(data.abiertos_total ?? 0)
}

/**
 * El binder digital de alguien.
 *
 * La variante viene EMBEBIDA desde `sobres_pool`: hay clave foránea declarada
 * (`cartas_desbloqueadas.card_id → sobres_pool.card_id`), así que PostgREST
 * sabe hacer la unión y se ahorra una vuelta. Las serializadas sí necesitan su
 * propia consulta: son otra tabla y otra pregunta.
 */
export async function miBinder(userId: string): Promise<CartaDelBinder[]> {
  if (!isSupabaseReady()) return []

  const { data: filas, error } = await supabase
    .from('cartas_desbloqueadas')
    .select('card_id, cantidad, primera_vez, sobres_pool(variante)')
    .eq('user_id', userId)
  if (error || !filas || filas.length === 0) return []

  const ids = filas.map(f => f.card_id as string)

  const [{ data: serial }, fichas] = await Promise.all([
    supabase.from('serializadas_dueno').select('card_id').eq('user_id', userId),
    getCardsByIds(ids),
  ])

  const mias = new Set((serial ?? []).map(s => s.card_id as string))

  return filas
    .map(f => {
      const id = f.card_id as string
      // El embebido llega como objeto (uno a uno) — con `?? 'Hyperspace'` por si
      // el pool cambió bajo los pies y la fila quedó huérfana.
      const emb = f.sobres_pool as { variante?: string } | null
      const variante = (emb?.variante ?? 'Hyperspace') as Variante
      return {
        cardId: id,
        cantidad: Number(f.cantidad ?? 1),
        variante,
        rareza: rarezaDe(variante),
        serializada: mias.has(id),
        carta: fichas.get(id) ?? null,
        obtenida: String(f.primera_vez ?? ''),
      }
    })
    .sort((a, b) => {
      // Lo más raro arriba: el binder se abre para presumir.
      const d = ESCALA.indexOf(b.rareza) - ESCALA.indexOf(a.rareza)
      if (d !== 0) return d
      return (a.carta?.name ?? '').localeCompare(b.carta?.name ?? '', 'es')
    })
}

/** Cuántas piezas tiene el binder de alguien, sin traerlas todas. */
export async function tamanoBinder(userId: string): Promise<number> {
  if (!isSupabaseReady()) return 0
  const { count, error } = await supabase
    .from('cartas_desbloqueadas')
    .select('card_id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) return 0
  return count ?? 0
}

/** Cuántas impresiones especiales existen en total, para la barra de progreso. */
export async function totalColeccionable(): Promise<number> {
  if (!isSupabaseReady()) return 0
  const { count, error } = await supabase
    .from('sobres_pool')
    .select('card_id', { count: 'exact', head: true })
  if (error) return 0
  return count ?? 0
}

/** Quién tiene cada serializada, para el salón de la fama. Es información pública a propósito. */
export interface DuenoSerializada {
  cardId: string
  userId: string
  cuando: string
  carta: Card | null
}

export async function serializadasDeLaComunidad(limite = 50): Promise<DuenoSerializada[]> {
  if (!isSupabaseReady()) return []
  const { data, error } = await supabase
    .from('serializadas_dueno')
    .select('card_id, user_id, sacada_at')
    .order('sacada_at', { ascending: false })
    .limit(limite)
  if (error || !data) return []

  const fichas = await getCardsByIds(data.map(d => d.card_id as string))
  return data.map(d => ({
    cardId: d.card_id as string,
    userId: d.user_id as string,
    cuando: String(d.sacada_at ?? ''),
    carta: fichas.get(d.card_id as string) ?? null,
  }))
}

/* ══════════════════════════════════════════════════════════════════════
 * EL ÁLBUM
 *
 * ── Por qué la casilla NO es el número de la carta ───────────────────
 *
 * Parece lo obvio: casilla 1, casilla 2… con el número impreso. Pero medido
 * sobre el pool real eso se rompe de dos maneras distintas:
 *
 *   · TWI Hyperspace Foil tiene 220 cartas repartidas en un rango de 515
 *     números: 295 huecos. Un álbum indexado por número mostraría 295 casillas
 *     que NUNCA se pueden llenar — una colección que arranca imposible.
 *   · SEC Serialized Prestige repite CADA número tres veces (1125 ×3, 1128 ×3,
 *     1133 ×3…): son tiradas distintas de la misma carta. Tres cartas
 *     peleando por la misma casilla.
 *
 * Así que la casilla es la POSICIÓN ORDINAL dentro del bloque (set, variante)
 * y el número real va de etiqueta. Lo calcula `album_seccion()` en Postgres
 * con `row_number()`, no el cliente: que la posición dependa del orden en que
 * llegaron las filas sería un álbum que se reordena solo.
 * ══════════════════════════════════════════════════════════════════════ */

/** Una sección del álbum: un set y una impresión. */
export interface SeccionAlbum {
  setCode: string
  variante: Variante
  rareza: Rareza
  /** Cuántas casillas tiene en total. */
  total: number
  /** Cuántas tenés. */
  tenidas: number
}

/** Una casilla, tengas la carta o no. */
export interface CasillaAlbum {
  /** 1..total. Es lo que ordena las páginas de nueve. */
  posicion: number
  /** El número impreso en la carta. Puede repetirse: es etiqueta, no llave. */
  numero: number
  cardId: string
  cantidad: number
  tenida: boolean
  serializada: boolean
  /**
   * La ficha del catálogo. Viene resuelta TAMBIÉN para las casillas vacías:
   * el bolsillo vacío lleva el nombre de la carta que falta, que es lo que lo
   * convierte en una invitación en vez de un hueco gris. `null` solo si el
   * catálogo local todavía no la tiene.
   */
  carta: Card | null
  /**
   * La lámina SIN los destellos quemados; el brillo lo pone la app.
   * Cadena vacía cuando no la tenés: de un hueco no se pinta ninguna.
   */
  arte: string
}

/**
 * Las secciones del álbum con el progreso de quien pregunta.
 *
 * Dentro de cada set van ordenadas por ESCALA, no por número ni alfabéticas.
 * Por número sería inestable: medido, en TWI la Hyperspace Foil arranca en el
 * #3 (tiene 4 cartas fuera de banda: 3, 4, 294 y 297) mientras que en SOR y
 * SHD la Showcase arranca antes que ella — o sea que el mismo criterio pone
 * familias distintas primero según el set. Alfabético es peor todavía: dejaría
 * «Foil Prestige» antes que «Hyperspace Foil».
 */
export async function seccionesAlbum(): Promise<SeccionAlbum[]> {
  if (!isSupabaseReady()) return []
  const { data, error } = await supabase.rpc('album_secciones')
  if (error || !data) return []
  return (data as { set_code: string; variante: string; total: number; tenidas: number }[])
    .map(s => ({
      setCode: s.set_code,
      variante: s.variante as Variante,
      rareza: rarezaDe(s.variante),
      total: Number(s.total ?? 0),
      tenidas: Number(s.tenidas ?? 0),
    }))
    .sort((a, b) =>
      a.setCode === b.setCode
        ? ESCALA.indexOf(a.rareza) - ESCALA.indexOf(b.rareza)
        : ordenDeSet(a.setCode) - ordenDeSet(b.setCode) ||
          a.setCode.localeCompare(b.setCode),
    )
}

/**
 * El puesto de un set en el álbum: por orden de SALIDA, no alfabético.
 *
 * Alfabético mete los promos en medio de las expansiones — hoy el pool tiene
 * 10 sets y dos son promos (GG con 6 casillas y P25 con 2), que alfabéticamente
 * caen entre ASH y JTL, y entre LOF y SEC. Un álbum de verdad los pone al
 * final, y así además ninguna sección de 2 casillas abre el índice.
 *
 * `MAIN_SET_LABELS` ya declara las ocho expansiones en orden de salida (SOR,
 * SHD, TWI, JTL, LOF, SEC, LAW, ASH) y a propósito NO incluye los promos, así
 * que sirve de tabla de orden sin inventar una segunda lista que se desincronice.
 */
function ordenDeSet(setCode: string): number {
  const i = Object.keys(MAIN_SET_LABELS).indexOf(setCode)
  return i === -1 ? Number.MAX_SAFE_INTEGER : i
}

/**
 * Una sección entera, casilla por casilla.
 *
 * Se pide de a una sección y no el álbum completo: son 2.669 casillas en 33
 * secciones, y bajárselas todas para enseñar nueve es exactamente el error que
 * ya costó caro con las imágenes (§2t de CLAUDE.md: 45 MB para pintar 1,4).
 */
export async function casillasDeSeccion(setCode: string, variante: Variante): Promise<CasillaAlbum[]> {
  if (!isSupabaseReady()) return []
  const { data, error } = await supabase.rpc('album_seccion', {
    p_set: setCode,
    p_variante: variante,
  })
  if (error || !data) return []

  const filas = data as {
    posicion: number; numero: number; card_id: string
    cantidad: number; tenida: boolean; serializada: boolean
  }[]

  /* La ficha se resuelve para TODAS las casillas, no solo para las que tenés.
   *
   * Antes se pedían solo las tenidas, con el argumento de que resolver 238 para
   * tapar 230 con una silueta era trabajo tirado. El argumento se cae cuando el
   * bolsillo vacío deja de ser una silueta y pasa a llevar el NOMBRE de la
   * carta que falta: «te falta Darth Vader» es la invitación, y sin la ficha no
   * hay nombre que poner. Y hoy importa el doble, porque con población 0 la
   * sección entera son huecos.
   *
   * No cuesta una petición: `getCardsByIds` resuelve primero contra la caché de
   * memoria y después con un `where('id').anyOf(...)` sobre la PRIMARY KEY de
   * Dexie, todo local. `BinderDigital` ya espera a `ensureCards()` antes de
   * abrir nada, así que el catálogo está completo y nunca cae al respaldo de
   * red. */
  const fichas = await getCardsByIds(filas.map(f => f.card_id))

  /* El ARTE, en cambio, sigue resolviéndose solo para las tenidas — y no por
   * ahorrar: el bolsillo vacío NO pinta la carta a propósito (enseñar el arte
   * de la que no tenés le quita el sentido a abrir el sobre). Además
   * `artesDeVariantes` busca por el índice `name`, que trae todas las
   * impresiones de cada nombre: pedirlo para las 238 de una sección es ~1.200
   * filas para dibujar las 8 que tenés. */
  const artes = await artesDeVariantes(
    filas
      .filter(f => f.tenida)
      .map(f => ({ carta: fichas.get(f.card_id), variante }))
      .filter((x): x is { carta: Card; variante: Variante } => x.carta !== undefined),
  )

  return filas.map(f => {
    const ficha = fichas.get(f.card_id) ?? null
    const tenida = f.tenida === true
    return {
      posicion: Number(f.posicion),
      numero: Number(f.numero),
      cardId: f.card_id,
      cantidad: Number(f.cantidad ?? 0),
      tenida,
      serializada: f.serializada === true,
      carta: ficha,
      // Cadena vacía si no la tenés: el contrato es «la lámina que se pinta», y
      // de un hueco no se pinta ninguna. Así el bolsillo vacío no puede
      // filtrar el arte por descuido de quien lo dibuje.
      arte: tenida ? (artes.get(f.card_id) ?? ficha?.imageUrl ?? '') : '',
    }
  })
}

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
import { getCardsByIds } from './swuApi'
import type { Card } from '../types'

/** Las impresiones que puede traer un sobre. No hay Standard: esa se compra. */
export type Variante =
  | 'Hyperspace'
  | 'Hyperspace Foil'
  | 'Standard Foil'
  | 'Standard Prestige'
  | 'Foil Prestige'
  | 'Serialized Prestige'
  | 'Showcase'

/** Cuán rara es cada impresión, para decidir cuánta fanfarria merece. */
export type Rareza = 'comun' | 'brillante' | 'rara' | 'epica' | 'unica'

/**
 * De impresión a fanfarria.
 *
 * Esto NO son las probabilidades (esas viven en el servidor y solo ahí): es
 * cuánto ruido hace la carta al salir. Se separa porque son dos preguntas
 * distintas — una Showcase es más rara que una Standard Prestige en el sorteo,
 * pero la Prestige se ve más impresionante, y quien abre el sobre juzga por lo
 * que ve.
 */
export const RAREZA: Record<Variante, Rareza> = {
  Hyperspace: 'comun',
  'Standard Foil': 'brillante',
  'Hyperspace Foil': 'brillante',
  Showcase: 'rara',
  'Standard Prestige': 'epica',
  'Foil Prestige': 'epica',
  'Serialized Prestige': 'unica',
}

/** El orden en que se revelan: de menos a más, para que el sobre suba. */
export const ESCALA: Rareza[] = ['comun', 'brillante', 'rara', 'epica', 'unica']

/** Los colores de cada rareza. Un solo sitio, para que el binder y la apertura no se separen. */
export const COLOR_RAREZA: Record<Rareza, string> = {
  comun: '#8fa3b8',
  brillante: '#4fc3f7',
  rara: '#a78bfa',
  epica: '#fbbf24',
  unica: '#ff4d6d',
}

export const NOMBRE_RAREZA: Record<Rareza, string> = {
  comun: 'Hiperespacio',
  brillante: 'Foil',
  rara: 'Showcase',
  epica: 'Prestige',
  unica: 'Serializada',
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

/** Toda variante desconocida cae a 'comun': mejor sosa que reventada. */
function rarezaDe(v: string): Rareza {
  return RAREZA[v as Variante] ?? 'comun'
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

  return {
    saldo: Number(data.saldo ?? 0),
    cartas: crudas.map(c => ({
      cardId: c.card_id,
      variante: c.variante as Variante,
      rareza: rarezaDe(c.variante),
      premio: c.premio === true,
      serializada: c.serializada === true,
      carta: fichas.get(c.card_id) ?? null,
    })),
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

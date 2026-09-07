/**
 * LA TIENDA — repetidas que se vuelven créditos, y créditos que vuelven sobres.
 *
 * Igual que el resto de Sobredosis: acá no hay lógica. El precio, la tarifa de
 * cada repetida, el tope diario y el saldo viven en Postgres, en funciones
 * SECURITY DEFINER. Este archivo llama y traduce.
 *
 * ── UNA REPETIDA SALE DEL ÁLBUM, NUNCA DE `collection` ───────────────
 *
 * Son dos tablas parecidas con dos orígenes distintos y confundirlas sería una
 * impresora de dinero. `collection` la escribe el cliente y se puede IMPORTAR:
 * la colección más grande son 2.089 filas con `quantity = 3` de una
 * importación, así que canjear desde ahí sería regalar créditos por un archivo
 * de texto. `cartas_desbloqueadas` —lo que de verdad salió de un sobre— solo la
 * escribe `abrir_sobre()`, y `authenticated` no tiene sobre ella más que
 * SELECT.
 *
 * ── LA PRIMERA COPIA NO SE CANJEA ────────────────────────────────────
 *
 * El techo del canje es siempre `cantidad - 1`, del lado del servidor. El álbum
 * ES la colección: si el canje pudiera vaciar una casilla, alguien perdería su
 * Showcase por tocar un botón que decía «convertí lo que te sobra». Verificado
 * contra la base: canjeando TODO, las casillas vaciadas fueron 0.
 *
 * ── UNA SOLA LECTURA, Y UNA SOLA BILLETERA ───────────────────────────
 *
 * `tienda_sobres()` devuelve saldo, precio, tope, cuántos llevás hoy, tus
 * repetidas y las tarifas en un viaje — el mismo criterio que `mi_liga()`. Y el
 * saldo sale de `creditos_saldo()`, que ya descuenta el sable y el planeta: no
 * hay dos economías, hay una.
 *
 * Lo único que hace el cliente es resolver cada `card_id` contra Dexie para
 * saber nombre y arte, igual que al abrir un sobre.
 */

import { supabase, isSupabaseReady } from './supabase'
import { getCardsByIds } from './swuApi'
import { artesDeVariantes } from './sobresArte'
import type { Variante } from './sobres'
import type { Card } from '../types'

export interface RepetidaFila {
  cardId: string
  /** La impresión con la que salió. `'?'` si su fila del pool ya no existe. */
  variante: string
  /** Cuántas COPIAS de más hay. Nunca incluye la primera. */
  repetidas: number
  creditosCadaUna: number
  creditos: number
  carta: Card | null
  arte: string
}

export interface EstadoTienda {
  saldo: number
  precio: number
  /** `null` = sin tope diario. */
  tope: number | null
  hoy: number
  /** Sobres sin abrir. */
  disponibles: number
  /** Variante → créditos. La clave `'*'` es el comodín. */
  tarifas: Record<string, number>
  repetidas: RepetidaFila[]
  repetidasCartas: number
  repetidasCreditos: number
}

interface FilaCruda {
  cardId: string
  variante: string
  repetidas: number
  creditosCadaUna: number
  creditos: number
}

/** `null` = sin sesión, sin conexión o no se pudo leer. */
export async function verTienda(): Promise<EstadoTienda | null> {
  if (!isSupabaseReady()) return null
  // §2f: supabase-js NO lanza ante un error de PostgREST.
  const { data, error } = await supabase.rpc('tienda_sobres')
  if (error) {
    console.warn('[Tienda] no se pudo abrir:', error.message)
    return null
  }
  const r = data as {
    ok?: boolean
    saldo?: number; precio?: number; tope?: number | null; hoy?: number
    disponibles?: number; tarifas?: Record<string, number>
    repetidas?: FilaCruda[]; repetidasCartas?: number; repetidasCreditos?: number
  } | null
  if (!r?.ok) return null

  const crudas = r.repetidas ?? []
  const fichas = await getCardsByIds(crudas.map(c => c.cardId))

  // La lámina sin los destellos quemados en el PNG (§3i), de a montón.
  const artes = await artesDeVariantes(
    crudas
      .map(c => ({ carta: fichas.get(c.cardId), variante: c.variante as Variante }))
      .filter((x): x is { carta: Card; variante: Variante } => x.carta !== undefined),
  )

  return {
    saldo: r.saldo ?? 0,
    precio: r.precio ?? 0,
    tope: r.tope ?? null,
    hoy: r.hoy ?? 0,
    disponibles: r.disponibles ?? 0,
    tarifas: r.tarifas ?? {},
    repetidasCartas: r.repetidasCartas ?? 0,
    repetidasCreditos: r.repetidasCreditos ?? 0,
    repetidas: crudas.map(c => {
      const ficha = fichas.get(c.cardId) ?? null
      return {
        ...c,
        carta: ficha,
        arte: artes.get(c.cardId) ?? ficha?.imageUrl ?? '',
      }
    }),
  }
}

export interface ResultadoCanje {
  ok: boolean
  mensaje?: string
  cartas?: number
  creditos?: number
  saldo?: number
}

/**
 * Cambia TODAS las repetidas por créditos.
 *
 * Sin argumento el servidor toma todo lo que sobra. El parámetro `p_cartas`
 * existe para un selector por carta que hoy no hay: se deja porque el descuento
 * y el recibo ya viajan en la misma transacción, así que agregar la pantalla
 * después no toca el servidor.
 */
export async function canjearRepetidas(): Promise<ResultadoCanje> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con el servidor' }
  const { data, error } = await supabase.rpc('canjear_repetidas')
  if (error) return { ok: false, mensaje: error.message }
  const r = data as { ok: boolean; error?: string; cartas?: number; creditos?: number; saldo?: number } | null
  if (!r?.ok) return { ok: false, mensaje: r?.error ?? 'No se pudo canjear' }
  return { ok: true, cartas: r.cartas, creditos: r.creditos, saldo: r.saldo }
}

export interface ResultadoCompra {
  ok: boolean
  mensaje?: string
  sobres?: number
  costo?: number
  saldo?: number
  hoy?: number
  /** El total de sobres sin abrir DESPUÉS de la compra. */
  disponibles?: number
}

export async function comprarSobres(cantidad: number): Promise<ResultadoCompra> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con el servidor' }
  const { data, error } = await supabase.rpc('comprar_sobres', { p_cantidad: cantidad })
  if (error) return { ok: false, mensaje: error.message }
  const r = data as {
    ok: boolean; error?: string
    sobres?: number; costo?: number; saldo?: number; hoy?: number; disponibles?: number
  } | null
  if (!r?.ok) return { ok: false, mensaje: r?.error ?? 'No se pudo comprar' }
  return {
    ok: true, sobres: r.sobres, costo: r.costo,
    saldo: r.saldo, hoy: r.hoy, disponibles: r.disponibles,
  }
}

/**
 * PRECIO DE UN MAZO — cuánto costaría armarlo.
 *
 * ── Por qué el número viene con advertencias pegadas ─────────────────
 *
 * Porque un total solo, sin contexto, MIENTE. Medido contra `card_prices` en
 * producción:
 *
 *   3.630 cartas con precio
 *   3.628 con precio normal
 *     662 con desglose por impresión  ← solo el 18%
 *       0 mencionan «hyperspace»      ← NINGUNA, de las 662
 *
 * O sea dos cosas distintas, y por eso se cuentan aparte:
 *
 *   · Para 4 de cada 5 cartas no se sabe cuánto vale su FOIL. Depende de la
 *     carta: unas sí lo traen.
 *   · El precio HYPERSPACE no existe para ninguna. Las 662 filas con desglose
 *     traen exactamente «Normal» y «Foil». Marcar hyper nunca va a mover el
 *     total, y decir «no hay dato para esta carta» insinuaría que para otra sí.
 *
 * Si a un mazo marcado foil le devolviéramos un número sin decir nada, ese
 * número sería el precio de la versión normal disfrazado de precio de foil.
 *
 * Por eso `PrecioMazo` no devuelve un total: devuelve un total MÁS cuántas
 * cartas no tienen precio y cuántas cayeron al precio base. La pantalla enseña
 * las tres cosas. Un «≈ $180» al lado de «12 cartas sin precio» es un dato;
 * un «$180» solo es una afirmación falsa.
 *
 * ── Y por qué es aproximado, siempre ─────────────────────────────────
 *
 * El precio de una carta es el promedio de low/high/market/mid de TCGplayer
 * (ver `precioPromedio`), que es un mercado de Estados Unidos en dólares. En El
 * Salvador el precio real de mesa no es ese. Sirve para comparar mazos entre
 * sí y para saber si algo es caro o barato — no para poner en venta.
 */

import { getPricesForCards, precioVariante, type PriceInfo } from './pricing'
import type { Deck, DeckCard } from '../types'

/** Las tres impresiones que cambian el precio. */
export type VarianteMazo = 'normal' | 'foil' | 'hyperspace'

export const NOMBRE_VARIANTE: Record<VarianteMazo, string> = {
  normal: 'Normal',
  foil: 'Foil',
  hyperspace: 'Hyper',
}

/** El ciclo del selector: tocar la etiqueta pasa a la siguiente. */
export const CICLO_VARIANTE: VarianteMazo[] = ['normal', 'foil', 'hyperspace']

export function siguienteVariante(v: VarianteMazo | undefined): VarianteMazo {
  const i = CICLO_VARIANTE.indexOf(v ?? 'normal')
  return CICLO_VARIANTE[(i + 1) % CICLO_VARIANTE.length]
}

export interface PrecioMazo {
  /** La suma, en dólares. `null` si NINGUNA carta tenía precio. */
  total: number | null
  /** Cuántas copias se pudieron valorar (contando cantidad, no cartas distintas). */
  copiasConPrecio: number
  /** Cuántas copias no tienen precio en la caché. */
  copiasSinPrecio: number
  /**
   * Copias marcadas FOIL que se valoraron con el precio normal porque esa carta
   * concreta no trae desglose. Es el 82% de las cartas.
   */
  copiasFoilSinDato: number
  /**
   * Copias marcadas HYPERSPACE. Van aparte porque su causa es distinta y
   * absoluta: medido sobre las 662 filas con desglose, CERO mencionan
   * hyperspace. La fuente no publica ese precio para ninguna carta, así que
   * marcar hyper nunca va a mover el total — y decir «no hay dato para esta
   * carta» sería sugerir que para otra sí.
   */
  copiasHyperSiempreSinDato: number
  /** Los nombres de las que no tienen precio, para poder decir cuáles. */
  sinPrecio: string[]
}

/** Todas las cartas del mazo, con líder y base incluidos. */
export function cartasDelMazo(deck: Deck): DeckCard[] {
  return [
    ...deck.leaders,
    ...(deck.base ? [deck.base] : []),
    ...deck.mainDeck,
    ...deck.sideboard,
  ]
}

/**
 * ¿La carta tiene precio propio para la impresión pedida?
 *
 * Se pregunta aparte del cálculo porque la respuesta es lo que decide si el
 * total lleva advertencia. `precioVariante` cae al precio base en silencio —a
 * propósito, para no inventar un recargo— así que desde fuera no se distingue
 * «vale lo mismo» de «no sé cuánto vale».
 */
function tieneDesglose(p: PriceInfo | undefined, variante: VarianteMazo): boolean {
  if (variante === 'normal') return true
  if (!p?.variants) return false
  return Object.keys(p.variants).some(clave =>
    variante === 'hyperspace'
      ? /hyperspace/i.test(clave)
      : /foil/i.test(clave) && !/hyperspace/i.test(clave),
  )
}

/**
 * Cuánto costaría armar este mazo.
 *
 * Una sola consulta de precios para todas las cartas: `getPricesForCards` ya
 * resuelve caché local → nube → red, así que acá no hay que orquestar nada.
 */
export async function precioDeMazo(deck: Deck): Promise<PrecioMazo> {
  return precioDeCartas(cartasDelMazo(deck))
}

/**
 * La misma cuenta, sobre una lista suelta de cartas.
 *
 * Existe porque quien la llama desde una pantalla necesita depender SOLO de lo
 * que cambia el precio. Pasar el `Deck` entero obliga a que el efecto dependa
 * del mazo completo, y entonces se recalcularía con cada tecla del nombre.
 */
export async function precioDeCartas(cartas: DeckCard[]): Promise<PrecioMazo> {
  if (cartas.length === 0) {
    return {
      total: null, copiasConPrecio: 0, copiasSinPrecio: 0,
      copiasFoilSinDato: 0, copiasHyperSiempreSinDato: 0, sinPrecio: [],
    }
  }

  const precios = await getPricesForCards(cartas.map(c => c.cardId))

  let total = 0
  let conPrecio = 0
  let sinPrecio = 0
  let foilSinDato = 0
  let hyperSinDato = 0
  const faltantes: string[] = []

  for (const c of cartas) {
    const p = precios.get(c.cardId)
    const variante = (c.variante ?? 'normal') as VarianteMazo
    const unidad = precioVariante(p, variante)

    if (unidad == null) {
      sinPrecio += c.quantity
      if (!faltantes.includes(c.name)) faltantes.push(c.name)
      continue
    }
    total += unidad * c.quantity
    conPrecio += c.quantity
    if (!tieneDesglose(p, variante)) {
      if (variante === 'hyperspace') hyperSinDato += c.quantity
      else foilSinDato += c.quantity
    }
  }

  return {
    total: conPrecio > 0 ? total : null,
    copiasConPrecio: conPrecio,
    copiasSinPrecio: sinPrecio,
    copiasFoilSinDato: foilSinDato,
    copiasHyperSiempreSinDato: hyperSinDato,
    sinPrecio: faltantes,
  }
}

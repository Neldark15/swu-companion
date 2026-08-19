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

/** Las impresiones que se pueden marcar. Solo dos tienen precio propio. */
export type VarianteMazo = 'normal' | 'foil' | 'hyperspace' | 'alterna'

export const NOMBRE_VARIANTE: Record<VarianteMazo, string> = {
  normal: 'Normal',
  foil: 'Foil',
  hyperspace: 'Hyper',
  alterna: 'Alterna',
}

/** El ciclo del selector: tocar la etiqueta pasa a la siguiente. */
export const CICLO_VARIANTE: VarianteMazo[] = ['normal', 'foil', 'hyperspace', 'alterna']

export function siguienteVariante(v: VarianteMazo | undefined): VarianteMazo {
  const i = CICLO_VARIANTE.indexOf(v ?? 'normal')
  return CICLO_VARIANTE[(i + 1) % CICLO_VARIANTE.length]
}

/**
 * Las impresiones de una carta, UNA POR COPIA y siempre completas.
 *
 * Resuelve los tres estados en los que puede llegar una fila guardada:
 *   · sin nada          → todas normales
 *   · con `variante`    → el valor único de la versión anterior, repetido
 *   · con `variantes`   → tal cual, recortado o rellenado hasta `quantity`
 *
 * El recorte y el relleno importan: la cantidad se cambia con los botones + y −
 * y el arreglo puede quedar desfasado. Devolver menos entradas que copias haría
 * que la última carta de la hoja se pintara sin selector, y más entradas haría
 * que se cobraran copias que no existen.
 */
export function impresionesDe(c: {
  quantity: number
  variantes?: VarianteMazo[]
  variante?: 'normal' | 'foil' | 'hyperspace'
}): VarianteMazo[] {
  const base = c.variantes ?? (c.variante ? Array(c.quantity).fill(c.variante) : [])
  const out: VarianteMazo[] = []
  for (let i = 0; i < c.quantity; i++) out.push(base[i] ?? 'normal')
  return out
}

/** El resumen para la etiqueta de la fila: «Normal» o «2 foil · 1 normal». */
export function resumenImpresiones(vs: VarianteMazo[]): string {
  if (vs.length === 0) return NOMBRE_VARIANTE.normal
  const cuenta = new Map<VarianteMazo, number>()
  for (const v of vs) cuenta.set(v, (cuenta.get(v) ?? 0) + 1)
  if (cuenta.size === 1) return NOMBRE_VARIANTE[vs[0]]
  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1] || CICLO_VARIANTE.indexOf(a[0]) - CICLO_VARIANTE.indexOf(b[0]))
    .map(([v, n]) => `${n} ${NOMBRE_VARIANTE[v].toLowerCase()}`)
    .join(' · ')
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
   * Copias marcadas HYPER o ALTERNA. Van aparte porque su causa es distinta y
   * absoluta: medido sobre las 662 filas con desglose, CERO mencionan
   * hyperspace, showcase ni prestige. La fuente solo publica «Normal» y
   * «Foil», así que marcar hyper o alterna nunca va a mover el total — y decir
   * «no hay dato para esta carta» sería sugerir que para otra sí.
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
  // 'alterna' y 'hyperspace' no tienen precio propio en la fuente: medido,
  // CERO de las 662 filas con desglose los mencionan.
  if (variante !== 'foil') return false
  if (!p?.variants) return false
  return Object.keys(p.variants).some(
    clave => /foil/i.test(clave) && !/hyperspace/i.test(clave),
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

    // Copia por copia: una foil y dos normales de la misma carta suman
    // distinto, y ese era justamente el punto de guardar una impresión por
    // copia en vez de una por carta.
    for (const variante of impresionesDe(c)) {
      // `precioVariante` solo entiende las tres que tienen sentido para el
      // precio; 'alterna' no tiene precio propio y va al base, igual que hyper.
      const paraPrecio = variante === 'alterna' ? 'normal' : variante
      const unidad = precioVariante(p, paraPrecio)

      if (unidad == null) {
        sinPrecio += 1
        if (!faltantes.includes(c.name)) faltantes.push(c.name)
        continue
      }
      total += unidad
      conPrecio += 1
      if (!tieneDesglose(p, variante)) {
        if (variante === 'foil') foilSinDato += 1
        else hyperSinDato += 1
      }
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

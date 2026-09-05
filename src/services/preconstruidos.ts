/**
 * Los mazos preconstruidos que se venden, listos para agregar.
 *
 * ── Por qué esto existe ──────────────────────────────────────────────
 *
 * Quien compra un precon y quiere tenerlo en la app hoy tiene que meter 80
 * cartas a mano, una por una. Nadie lo hace: se queda con el mazo en la caja y
 * la app sin saber qué juega.
 *
 * ── Por qué se guarda por ID y no por nombre ─────────────────────────
 *
 * Cada carta se resolvió contra el catálogo ANTES de escribir el archivo, y lo
 * que quedó guardado es su id. Dos razones medidas, no teóricas:
 *
 *  · Hay cuatro «Ahsoka Tano» y siete «Obi-Wan Kenobi». Un nombre suelto no
 *    identifica una carta.
 *  · El catálogo trae **«C-3P0 — Die, Jedi Dogs!» con un CERO** en vez de la
 *    letra O. Ningún nombre escrito a mano casaría con eso jamás.
 *
 * Las listas vienen de la comunidad y traían tres erratas de transcripción
 * («Kashyyk» por Kashyyyk, «Darth Tyrannus» por Tyranus, y un «Obi-Wan
 * Kenobi» sin subtítulo). Se corrigieron contra el catálogo —la última por su
 * texto de reglas, que es el único Obi-Wan que da Restore 1 a los aliados— y
 * el archivo NO se genera si alguna carta no resuelve.
 *
 * Son mazos SINGLETON: una copia de cada carta. Por eso `quantity` es 1 y no
 * hay que contar repetidas.
 */

import type { Deck, DeckCard } from '../types'
import datos from '../data/preconTwinSuns.json'

export interface CartaPrecon {
  cardId: string
  name: string
  subtitle: string | null
  setCode: string
}

export interface MazoPrecon {
  slug: string
  nombre: string
  lideres: CartaPrecon[]
  base: CartaPrecon
  cartas: CartaPrecon[]
}

/** Los cuatro mazos de Twin Suns (TS26). */
export const PRECON_TWIN_SUNS = datos as MazoPrecon[]

function aCarta(c: CartaPrecon): DeckCard {
  return {
    cardId: c.cardId,
    name: c.name,
    subtitle: c.subtitle,
    quantity: 1,
    setCode: c.setCode,
    // Una copia, impresión normal. Quien tenga la foil la cambia después: no
    // se puede saber qué versión compró.
    printings: ['normal'],
  } as DeckCard
}

/**
 * Arma el mazo listo para guardar.
 *
 * El formato es `twin_suns` porque son de dos líderes: dejarlo en `premier`
 * haría que el validador lo marcara inválido apenas se abre, y la persona
 * pensaría que el precon está mal armado.
 */
export function construirPrecon(m: MazoPrecon): Deck {
  const ahora = Date.now()
  return {
    id: `d_${ahora}_${Math.random().toString(36).slice(2, 6)}`,
    name: m.nombre,
    format: 'twin_suns',
    leaders: m.lideres.map(aCarta),
    base: aCarta(m.base),
    mainDeck: m.cartas.map(aCarta),
    sideboard: [],
    isValid: false,
    validationErrors: [],
    isPublic: true,
    createdAt: ahora,
    updatedAt: ahora,
  } as Deck
}

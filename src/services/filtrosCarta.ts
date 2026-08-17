/**
 * El vocabulario con el que se filtran cartas, en UN solo sitio.
 *
 * Estaba copiado: el buscador tenía las cinco listas (`filterTypes`,
 * `filterAspects`, `filterArenas`, `filterRarities`, `filterCosts`) y el
 * constructor de mazos su propia `BUILDER_ASPECTS` con los mismos seis
 * aspectos escritos otra vez. Dos copias de una lista que el juego define son
 * dos oportunidades de que se separen: basta que salga un aspecto nuevo para
 * que una pantalla lo ofrezca y la otra no, sin que nada falle.
 *
 * Ahora lo consume también el Mercado, que es la tercera pantalla que filtra
 * cartas. Con tres copias el problema dejaba de ser hipotético.
 *
 * Los VALORES son los del juego, en inglés, porque así vienen del API y así se
 * guardan. Al usuario se le muestran traducidos con `translate*` de
 * translations.ts — la traducción es de presentación, nunca de datos.
 */

import { COST_MAX_BUCKET } from './swuApi'

/** Los cinco tipos de carta. */
export const TIPOS_CARTA = ['Leader', 'Base', 'Unit', 'Event', 'Upgrade'] as const

/** Los seis aspectos. */
export const ASPECTOS = ['Vigilance', 'Command', 'Aggression', 'Cunning', 'Heroism', 'Villainy'] as const

/** Las dos arenas. */
export const ARENAS = ['Ground', 'Space'] as const

/** Las cinco rarezas. */
export const RAREZAS = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Special'] as const

/**
 * Los costes que se ofrecen como filtro. El último es un CUBO, no un número:
 * `COST_MAX_BUCKET` significa «ese coste o más», porque hay cartas de 8, 9 y
 * más y una fila de veinte botones no la usa nadie.
 */
export const COSTES = [0, 1, 2, 3, 4, 5, 6, COST_MAX_BUCKET] as const

/**
 * El color de cada tipo en las insignias.
 *
 * Vive acá y no en cada pantalla para que un Líder sea ámbar en el buscador,
 * en el mercado y en el constructor. El color no es decoración: es cómo se
 * reconoce el tipo sin leer.
 */
export const TONO_POR_TIPO: Record<string, 'amber' | 'accent' | 'green' | 'purple' | 'default'> = {
  Leader: 'amber',
  Unit: 'accent',
  Event: 'green',
  Upgrade: 'purple',
  Base: 'default',
}

/** Lo mismo para la rareza. */
export const TONO_POR_RAREZA: Record<string, 'default' | 'green' | 'accent' | 'amber' | 'purple'> = {
  Common: 'default',
  Uncommon: 'green',
  Rare: 'accent',
  Legendary: 'amber',
  Special: 'purple',
}

/**
 * El tono de cada tipo para un `Chip`.
 *
 * NO es el mismo mapa que `TONO_POR_TIPO`: los tonos de `Badge` incluyen
 * `purple` y `default`, que en `ChipTone` no existen. Traducir a ojo en cada
 * sitio de uso es lo que produce un `as ChipTone` que compila y luego pinta un
 * color que no está en el sistema; acá la correspondencia es explícita y se
 * comprueba en compilación.
 */
export const TONO_CHIP_POR_TIPO: Record<string, 'accent' | 'amber' | 'cyan' | 'coral' | 'green' | 'neutral'> = {
  Leader: 'amber',
  Unit: 'accent',
  Event: 'green',
  Upgrade: 'cyan',
  Base: 'neutral',
}

// ─── Filtrado del mercado ────────────────────────────────────────────

/** Lo mínimo que el filtro necesita de una publicación. */
export interface PublicacionFiltrable {
  userId: string
  cardId: string
  sellerName: string
  notes: string | null
}

/** Lo mínimo que necesita de la carta. `null` = todavía no se hidrató. */
export interface CartaFiltrable {
  name: string
  subtitle: string | null
  type: string
  aspects: string[]
}

export interface FiltrosMercado {
  /** Texto ya estabilizado (sin espacios sobrantes). */
  texto: string
  vendedor: string | null
  tipo: string | null
  aspecto: string | null
}

/** ¿Hay algo puesto? Decide qué vacío se muestra y si aparece «Limpiar». */
export function hayFiltrosPuestos(f: FiltrosMercado): boolean {
  return !!f.texto.trim() || !!f.vendedor || !!f.tipo || !!f.aspecto
}

/**
 * ¿Esta publicación pasa los filtros?
 *
 * Vive acá y no dentro del componente para poder probarla: la regla de qué
 * hacer con una carta que TODAVÍA NO se hidrató desde Dexie es la parte que se
 * equivoca sola, y es invisible mirando la pantalla porque dura milisegundos.
 *
 * La regla: sin carta no se puede juzgar el tipo ni el aspecto. Si hay un
 * filtro de carta activo, la publicación se EXCLUYE —mostrarla sería afirmar
 * que cumple algo que no se sabe—; si no lo hay, se conserva, para no perder
 * publicaciones por una carrera de carga. Y el texto todavía puede casar
 * contra el vendedor, las notas o el id, que no dependen de la carta.
 */
export function pasaFiltros(
  pub: PublicacionFiltrable,
  carta: CartaFiltrable | null | undefined,
  f: FiltrosMercado,
): boolean {
  if (f.vendedor && pub.userId !== f.vendedor) return false
  if (f.tipo && carta?.type !== f.tipo) return false
  if (f.aspecto && !(carta?.aspects ?? []).includes(f.aspecto)) return false

  const q = f.texto.trim().toLowerCase()
  if (!q) return true
  if (!carta) {
    return pub.cardId.toLowerCase().includes(q)
        || pub.sellerName.toLowerCase().includes(q)
        || (pub.notes?.toLowerCase().includes(q) ?? false)
  }
  return carta.name.toLowerCase().includes(q)
      || (carta.subtitle?.toLowerCase().includes(q) ?? false)
      || pub.sellerName.toLowerCase().includes(q)
      || (pub.notes?.toLowerCase().includes(q) ?? false)
}

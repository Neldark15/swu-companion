import type { Card, Deck } from '../../types'

/** La misma carta jugable puede tener distintas impresiones y expansiones.
 * El subtítulo distingue versiones del mismo personaje; el tipo evita cruzar
 * un líder con una unidad. No se compara por nombre parcial ni por número. */
export function identidadCartaJugable(carta: Pick<Card, 'name' | 'subtitle' | 'type'>): string {
  return JSON.stringify([carta.name, carta.subtitle ?? '', carta.type])
}

export interface CopiasFisicas {
  cardId: string
  quantity: number
  profileId?: string
}

export interface CartaFaltante {
  carta: Card
  necesarias: number
  disponibles: number
  faltantes: number
}

export type FaltantesDelMazo =
  | { estado: 'sin-perfil' | 'catalogo-incompleto' }
  | { estado: 'sin-resolver'; cartasMazo: string[]; cartasColeccion: string[] }
  | { estado: 'cantidades-invalidas' }
  | {
      estado: 'listo'
      cartas: CartaFaltante[]
      totalNecesarias: number
      totalDisponibles: number
      totalFaltantes: number
    }

/** Compara la lista actual con la colección FÍSICA del perfil activo.
 * Main y sideboard consumen una única bolsa: una copia nunca cubre ambos.
 * No reserva cartas entre mazos ni exige la terminación cosmética elegida.
 * Un catálogo incompleto/ID desconocido no autoriza a afirmar «no la tenés». */
export function calcularFaltantesMazo(
  mazo: Pick<Deck, 'leaders' | 'base' | 'mainDeck' | 'sideboard'>,
  catalogo: readonly Card[],
  coleccion: readonly CopiasFisicas[],
  perfilId: string | null,
  catalogoCompleto: boolean,
): FaltantesDelMazo {
  if (!perfilId) return { estado: 'sin-perfil' }
  if (!catalogoCompleto) return { estado: 'catalogo-incompleto' }

  const porId = new Map<string, Card>()
  for (const carta of catalogo) porId.set(carta.id, carta)
  // `legacyId` lo conserva únicamente la impresión que resuelve ese id viejo.
  // Se prioriza siempre un UUID real si existiera también como clave primaria.
  for (const carta of catalogo) {
    if (carta.legacyId && !porId.has(carta.legacyId)) porId.set(carta.legacyId, carta)
  }
  const filas = [
    ...mazo.leaders, ...(mazo.base ? [mazo.base] : []), ...mazo.mainDeck, ...mazo.sideboard,
  ]
  const propias = coleccion.filter(c => c.profileId === perfilId)
  if ([...filas, ...propias].some(c => !Number.isSafeInteger(c.quantity) || c.quantity < 0)) {
    return { estado: 'cantidades-invalidas' }
  }
  const cartasMazo = [...new Set(filas.filter(c => c.quantity > 0 && !porId.has(c.cardId)).map(c => c.cardId))]
  const cartasColeccion = [...new Set(propias.filter(c => c.quantity > 0 && !porId.has(c.cardId)).map(c => c.cardId))]
  if (cartasMazo.length || cartasColeccion.length) return { estado: 'sin-resolver', cartasMazo, cartasColeccion }

  const disponibles = new Map<string, number>()
  for (const item of propias) {
    if (!item.quantity) continue
    const clave = identidadCartaJugable(porId.get(item.cardId)!)
    disponibles.set(clave, (disponibles.get(clave) ?? 0) + item.quantity)
  }
  const demanda = new Map<string, { carta: Card; necesarias: number }>()
  for (const item of filas) {
    if (!item.quantity) continue
    const carta = porId.get(item.cardId)!
    const clave = identidadCartaJugable(carta)
    const anterior = demanda.get(clave)
    if (anterior) anterior.necesarias += item.quantity
    else demanda.set(clave, { carta, necesarias: item.quantity })
  }

  const cartas: CartaFaltante[] = []
  let totalNecesarias = 0
  let totalDisponibles = 0
  for (const [clave, { carta, necesarias }] of demanda) {
    const tengo = disponibles.get(clave) ?? 0
    const faltantes = Math.max(0, necesarias - tengo)
    totalNecesarias += necesarias
    totalDisponibles += Math.min(necesarias, tengo)
    if (faltantes) cartas.push({ carta, necesarias, disponibles: tengo, faltantes })
  }
  cartas.sort((a, b) => b.faltantes - a.faltantes || a.carta.name.localeCompare(b.carta.name)
    || (a.carta.subtitle ?? '').localeCompare(b.carta.subtitle ?? ''))
  return { estado: 'listo', cartas, totalNecesarias, totalDisponibles, totalFaltantes: totalNecesarias - totalDisponibles }
}

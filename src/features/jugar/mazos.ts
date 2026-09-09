import type { Card, Deck, DeckCard } from '../../types'
import type { CartaMazoMotor, MazoMotor } from './tipos'
import { objeto } from './tipos'

const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
const identidad = (carta: Pick<Card, 'name' | 'subtitle' | 'type'>) =>
  `${normalizar(carta.name)}|${normalizar(carta.subtitle ?? '')}|${carta.type}`

/** Las variantes tienen numeración propia: resolver primero su carta Standard. */
export function convertirMazo(mazo: Pick<Deck, 'leaders' | 'base' | 'mainDeck' | 'sideboard' | 'format'>, catalogo: Card[]): MazoMotor {
  if (mazo.format !== 'premier' || mazo.leaders.length !== 1 || !mazo.base) {
    throw new Error('Elegí un mazo Premier con un líder y una base.')
  }
  const porId = new Map(catalogo.map(carta => [carta.id, carta]))
  const canonicas = new Map<string, Card[]>()
  for (const carta of catalogo) {
    if (carta.variantType !== 'Standard' && !carta.isCanonical) continue
    const clave = identidad(carta)
    canonicas.set(clave, [...(canonicas.get(clave) ?? []), carta])
  }
  function resolver(entrada: DeckCard, tipo?: Card['type']): CartaMazoMotor {
    if (!Number.isSafeInteger(entrada.quantity) || entrada.quantity < 1 || entrada.quantity > 100) {
      throw new Error(`La cantidad de ${entrada.name} no es válida.`)
    }
    let carta = porId.get(entrada.cardId)
    if (!carta) {
      const opciones = catalogo.filter(c => c.legacyId === entrada.cardId
        && normalizar(c.name) === normalizar(entrada.name)
        && normalizar(c.subtitle ?? '') === normalizar(entrada.subtitle ?? '') && (!tipo || c.type === tipo))
      if (new Set(opciones.map(identidad)).size !== 1) throw new Error(`No se pudo identificar ${entrada.name}. Actualizá el catálogo y revisá el mazo.`)
      carta = opciones.find(c => c.variantType === 'Standard') ?? opciones[0]
    }
    if (!carta || (tipo ? carta.type !== tipo : ['Leader', 'Base'].includes(carta.type))) {
      throw new Error(`${entrada.name} no corresponde a esta zona del mazo.`)
    }
    const opciones = canonicas.get(identidad(carta)) ?? []
    const ordenadas = [...opciones].sort((a, b) =>
      Number(b.variantType === 'Standard') - Number(a.variantType === 'Standard')
      || Number(b.setCode === carta.setCode) - Number(a.setCode === carta.setCode)
      || a.setCode.localeCompare(b.setCode) || a.setNumber - b.setNumber)
    const canonica = ordenadas[0]
    if (!canonica || !/^[A-Z0-9]{2,6}$/.test(canonica.setCode) || !Number.isSafeInteger(canonica.setNumber) || canonica.setNumber < 1) {
      throw new Error(`Falta la impresión de juego de ${entrada.name}. Actualizá el catálogo.`)
    }
    return { id: `${canonica.setCode}_${String(canonica.setNumber).padStart(3, '0')}`, count: entrada.quantity }
  }
  function zona(entradas: DeckCard[]): CartaMazoMotor[] {
    const resultado = new Map<string, number>()
    for (const entrada of entradas) {
      const carta = resolver(entrada)
      resultado.set(carta.id, (resultado.get(carta.id) ?? 0) + carta.count)
    }
    return [...resultado].map(([id, count]) => ({ id, count }))
  }
  return { leader: resolver(mazo.leaders[0], 'Leader'), base: resolver(mazo.base, 'Base'),
    deck: zona(mazo.mainDeck), sideboard: zona(mazo.sideboard) }
}

/** La importación es explícita; reglas y habilidades se validan de nuevo en servidor. */
export function leerMazoMotor(valor: unknown): MazoMotor {
  const mazo = objeto(valor)
  function carta(valor: unknown): CartaMazoMotor {
    const fila = objeto(valor)
    if (!fila || typeof fila.id !== 'string' || !/^[A-Z0-9]{2,6}_\d{3,5}$/.test(fila.id)
      || !Number.isSafeInteger(fila.count) || Number(fila.count) < 1 || Number(fila.count) > 100) {
      throw new Error('El JSON debe usar cartas con id de edición (por ejemplo JTL_001) y count entero.')
    }
    return { id: fila.id, count: Number(fila.count) }
  }
  function zona(valor: unknown): CartaMazoMotor[] {
    if (!Array.isArray(valor) || valor.length > 150) throw new Error('La lista de cartas del JSON no es válida.')
    return valor.map(carta)
  }
  if (!mazo) throw new Error('Pegá el JSON de un mazo de SWUDB.')
  return { leader: carta(mazo.leader), base: carta(mazo.base), deck: zona(mazo.deck), sideboard: zona(mazo.sideboard ?? []) }
}

export function importarMazoOnline(texto: string): { nombre: string; mazo: MazoMotor } {
  if (texto.length > 50_000) throw new Error('El JSON del mazo es demasiado grande.')
  let valor: unknown
  try { valor = JSON.parse(texto) as unknown } catch { throw new Error('El texto no es un JSON válido. Exportá el mazo como JSON de SWUDB.') }
  const datos = objeto(valor)
  const metadata = objeto(datos?.metadata)
  return { nombre: typeof metadata?.name === 'string' ? metadata.name.slice(0, 100) : 'Mazo importado', mazo: leerMazoMotor(valor) }
}

/** Leer solo los campos necesarios de una fila cloud, sin convertir errores en mazo vacío. */
export function leerMazoGuardado(valor: unknown): Pick<Deck, 'leaders' | 'base' | 'mainDeck' | 'sideboard' | 'format'> {
  const datos = objeto(valor)
  function entrada(valor: unknown): DeckCard {
    const fila = objeto(valor)
    if (!fila || typeof fila.cardId !== 'string' || typeof fila.name !== 'string'
      || !Number.isSafeInteger(fila.quantity) || Number(fila.quantity) < 1
      || !(fila.subtitle == null || typeof fila.subtitle === 'string')) throw new Error('El mazo guardado tiene una carta incompleta.')
    return { cardId: fila.cardId, name: fila.name, subtitle: typeof fila.subtitle === 'string' ? fila.subtitle : null,
      quantity: Number(fila.quantity), setCode: typeof fila.setCode === 'string' ? fila.setCode : '' }
  }
  function zona(valor: unknown): DeckCard[] {
    if (!Array.isArray(valor)) throw new Error('El mazo guardado está incompleto.')
    return valor.map(entrada)
  }
  if (!datos || datos.format !== 'premier') throw new Error('Este mazo no es Premier.')
  return { format: 'premier', leaders: zona(datos.leaders), base: datos.base ? entrada(datos.base) : null,
    mainDeck: zona(datos.mainDeck), sideboard: zona(datos.sideboard ?? []) }
}

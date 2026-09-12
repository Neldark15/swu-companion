import type { Card } from '../../types'
import { leerBaseCalculadora, type BaseCalculadora } from './estadoCalculadora'

/** Los metadatos de búsqueda quedan en el catálogo; la partida guarda solo su base. */
export interface OpcionBaseCalculadora extends BaseCalculadora {
  expansion: string
  numero: number
  busqueda: string
}

export function normalizarBusquedaBase(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['’ʼ]/g, '').toLowerCase().trim()
}

/** Reconoce creación de Fuerza en la habilidad; mencionar una unidad Force no basta. */
export function baseUsaFuerza(carta: Pick<Card, 'type' | 'text' | 'epicAction'>): boolean {
  if (carta.type !== 'Base') return false
  const texto = normalizarBusquedaBase([carta.text, carta.epicAction].filter(t => typeof t === 'string').join(' ')
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '))
  return /\bcreate your force token\b/.test(texto)
    || /(?:^|[.:;,])\s*the force is with you\b/.test(texto)
    || /\bcrea tu ficha de (?:la )?fuerza\b/.test(texto)
    || /(?:^|[.:;,])\s*la fuerza esta contigo\b/.test(texto)
}

export function catalogoBasesCalculadora(cartas: readonly Card[]): OpcionBaseCalculadora[] {
  const vistas = new Set<string>()
  return cartas.flatMap(carta => {
    if (carta.type !== 'Base' || carta.isCanonical === false || !carta.id || !carta.name.trim()
      || carta.hp === null || !Number.isSafeInteger(carta.hp) || carta.hp < 1 || carta.hp > 999
      || vistas.has(carta.id)) return []
    const nombre = [carta.name.trim(), carta.subtitle?.trim()].filter(Boolean).join(' · ')
    const datos = { id: carta.id, nombre, imagen: carta.imageUrl || null, vidaImpresa: carta.hp, usaFuerza: baseUsaFuerza(carta) }
    // Una ilustración inválida no impide elegir una base de nombre/vida válidos.
    const base = leerBaseCalculadora(datos) ?? leerBaseCalculadora({ ...datos, imagen: null })
    if (!base) return []
    vistas.add(carta.id)
    return [{
      ...base,
      expansion: carta.setCode,
      numero: carta.setNumber,
      busqueda: normalizarBusquedaBase(`${nombre} ${carta.setCode} ${carta.setNumber}`),
    }]
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')
    || a.expansion.localeCompare(b.expansion) || a.numero - b.numero || a.id.localeCompare(b.id))
}

/** Cada palabra puede coincidir con nombre, subtítulo, expansión o número. */
export function filtrarBasesCalculadora(bases: readonly OpcionBaseCalculadora[], consulta: string): OpcionBaseCalculadora[] {
  const palabras = normalizarBusquedaBase(consulta).split(/\s+/).filter(Boolean)
  return bases.filter(base => palabras.every(palabra => base.busqueda.includes(palabra)))
}

/**
 * TALLER KYBER — el vocabulario de la pantalla. Puro, sin React y sin red.
 *
 * Vive aparte porque un módulo que exporta componentes Y constantes rompe el
 * Fast Refresh de Vite — y RE-EXPORTARLAS lo rompe igual. Es la cuarta vez que
 * hace falta esta separación en el repo (§3w).
 */

import type { ParteTaller } from '../../services/sableService'

/* ── Rarezas ──────────────────────────────────────────────────────────
 *
 * El color de rareza NO es decoración: es lo que deja escanear una lista de
 * doce piezas sin leer un precio. Por eso son cuatro y no ocho, y por eso el
 * salto de color entre una y la siguiente es grande.
 *
 * `borde` y `texto` se separan porque el borde va sobre el fondo de la tarjeta
 * y el texto sobre la ficha de rareza, que ya lleva su propio tinte: el mismo
 * tono no pasa contraste en los dos sitios. Es la lección del `acentoTexto` de
 * la credencial (§3x), donde el acento crudo fallaba AA en tres temas. */
export interface Rareza {
  clave: string
  rotulo: string
  borde: string
  ficha: string
  texto: string
}

export const RAREZAS: Record<string, Rareza> = {
  comun: {
    clave: 'comun', rotulo: 'Común',
    borde: 'border-swu-border', ficha: 'bg-swu-surface', texto: 'text-swu-muted',
  },
  raro: {
    clave: 'raro', rotulo: 'Raro',
    borde: 'border-sky-500/50', ficha: 'bg-sky-500/15', texto: 'text-sky-300',
  },
  epico: {
    clave: 'epico', rotulo: 'Épico',
    borde: 'border-violet-500/55', ficha: 'bg-violet-500/15', texto: 'text-violet-300',
  },
  legendario: {
    clave: 'legendario', rotulo: 'Legendario',
    borde: 'border-amber-400/60', ficha: 'bg-amber-400/15', texto: 'text-amber-300',
  },
}

export function rarezaDe(clave: string): Rareza {
  return RAREZAS[clave] ?? RAREZAS.comun
}

/* ── Los pasos ───────────────────────────────────────────────────────
 *
 * Cuatro y en este orden, y el orden importa: el CRISTAL va antes del color
 * porque el cristal es lo que decide de qué colores se puede elegir; al revés,
 * uno elige un color y después descubre que no tiene el cristal.
 *
 * `Prueba` es un paso y no un botón perdido: encender la hoja es el momento por
 * el que se armó todo lo demás, y merece su sitio propio. */
export type Paso = 'piezas' | 'cristal' | 'color' | 'prueba'

export const PASOS: { id: Paso; n: number; rotulo: string }[] = [
  { id: 'piezas', n: 1, rotulo: 'Piezas' },
  { id: 'cristal', n: 2, rotulo: 'Cristal' },
  { id: 'color', n: 3, rotulo: 'Color' },
  { id: 'prueba', n: 4, rotulo: 'Prueba' },
]

/* ── Las ranuras del mango ───────────────────────────────────────────── */

export const RANURAS_MANGO: { tipo: ParteTaller['tipo']; rotulo: string }[] = [
  { tipo: 'emisor', rotulo: 'Emisor' },
  { tipo: 'cuerpo', rotulo: 'Empuñadura' },
  { tipo: 'pomo', rotulo: 'Pomo' },
]

/* ── Los stats ───────────────────────────────────────────────────────
 *
 * SE SUMAN DE LAS PIEZAS. No hay ninguna fila que diga «potencia 76»: la
 * potencia ES lo que aportan las cuatro piezas puestas. Guardarla sería una
 * segunda copia de algo derivado y habría que acordarse de recalcularla cada
 * vez que alguien cambia un emisor (§3c).
 *
 * Y no afectan a NADA fuera del taller, a propósito: son la identidad del sable
 * y el motivo para preferir una pieza sobre otra. Engancharlos al ranking o a
 * las partidas convertiría gastar créditos en comprar ventaja competitiva. */
export interface Stats { potencia: number; control: number; energia: number }

export const TOPE_STAT = 120

export function sumarStats(partes: ParteTaller[], puestas: string[]): Stats {
  const s: Stats = { potencia: 0, control: 0, energia: 0 }
  for (const id of puestas) {
    const p = partes.find(x => x.id === id)
    if (!p) continue
    s.potencia += p.potencia
    s.control += p.control
    s.energia += p.energia
  }
  return s
}

/**
 * Cuánto cambiaría cada stat si se pusiera `candidata` en lugar de la que está.
 *
 * Es lo que convierte una lista de precios en una decisión: sin el delta, elegir
 * entre dos emisores de 900 y 1.800 es adivinar. Devuelve null si la pieza ya
 * está puesta — un «+0 / +0 / +0» es ruido.
 */
export function deltaDe(
  partes: ParteTaller[], puestas: string[], candidata: ParteTaller,
): Stats | null {
  if (puestas.includes(candidata.id)) return null
  const sinEsaRanura = puestas.filter(id => {
    const p = partes.find(x => x.id === id)
    return p?.tipo !== candidata.tipo
  })
  const antes = sumarStats(partes, puestas)
  const despues = sumarStats(partes, [...sinEsaRanura, candidata.id])
  return {
    potencia: despues.potencia - antes.potencia,
    control: despues.control - antes.control,
    energia: despues.energia - antes.energia,
  }
}

/**
 * Parseo del `DecklistName` de melee.gg a cartas canónicas.
 *
 * ── Qué formato es ────────────────────────────────────────────────────
 *
 * Melee autogenera el nombre de cada mazo de SWU como:
 *
 *     "{nombre del líder}, {subtítulo del líder} - {nombre de la base}"
 *
 * OJO: NO es "Líder, Sub - Base, Sub". **Ninguna base tiene subtítulo**
 * (medido: 0 de 90). Cuando se ve una coma del lado derecho —
 * "Nevarro City, Restored"— esa coma es parte del NOMBRE de la carta.
 *
 * ── La trampa que envenena el meta ────────────────────────────────────
 *
 * Partir el lado derecho por la coma para "quitarle el subtítulo a la base"
 * convierte `Nevarro City, Restored` (ASH 20, Vigilance) en `Nevarro City`
 * (SHD 22, Command): **otra carta real, de otro set y de otro aspecto**.
 * Mismo caso con `Sundari` (TWI, Vigilance, 30hp) vs `Sundari Palace`
 * (TS26, Cunning, 27hp). El lado derecho se busca ENTERO y nunca se corta.
 *
 * ── Por qué el separador es " - " y no "-" ────────────────────────────
 *
 * Medido sobre las 154 llaves de líder y las 90 de base: **cero** contienen
 * " - " (guion rodeado de espacios), pero **nueve** contienen un guion pegado
 * — Bo-Katan Kryze, C-3PO, IG-88, Obi-Wan Kenobi, Qui-Gon Jinn,
 * Chk-chk-chk-chk, Human-Cyborg Relations. Partir por "-" a secas destroza
 * a esos. El separador SIEMPRE lleva los dos espacios.
 *
 * ── Regla de oro ──────────────────────────────────────────────────────
 *
 * Melee deja renombrar la lista a mano. Un arquetipo inventado envenena el
 * meta, así que ante la mínima duda se devuelve `null`. Las dos mitades
 * tienen que dar contra una carta REAL de la base local; si una sola falla,
 * no hay resultado. Nunca se adivina por nombre parcial ni por apodo.
 */

import type { Card } from '../types'

/** Lo que devuelve el parser cuando logra resolver las dos cartas. */
export interface ArquetipoParseado {
  /** `Card.id` (uuid) de la impresión canónica del líder. */
  liderId: string
  /** `Card.id` (uuid) de la impresión canónica de la base. */
  baseId: string
  /**
   * `exacta`   — las dos mitades coincidieron carácter a carácter (normalizado).
   * `truncada` — el nombre venía cortado por la UI y la base se resolvió por
   *              un prefijo que apunta a UNA sola carta. Solo aparece si se
   *              pide `permitirTruncado`.
   */
  confianza: 'exacta' | 'truncada'
}

/** Índice precalculado. Se construye una vez y se reutiliza. */
export interface IndiceArquetipos {
  /** norm("nombre, subtítulo") → carta */
  lideres: Map<string, Card>
  /** norm("nombre") → carta */
  bases: Map<string, Card>
  /** Claves de `bases` ordenadas, para el rescate por prefijo. */
  clavesBase: string[]
}

const SEPARADOR = ' - '
/**
 * Los caracteres raros van escritos con escapes `\uXXXX` a proposito: un NBSP
 * literal dentro de un regex es invisible al leer el diff y ESLint lo rechaza
 * (`no-irregular-whitespace`).
 */
/** Guiones tipograficos (U+2010..U+2015, U+2212) que aparecen en vez del ASCII. */
const GUIONES = /[\u2010-\u2015\u2212]/g
/** Cualquier espacio: \s mas NBSP, el fino, el de cifras y el BOM. */
const ESPACIOS = /[\s\u00A0\u202F\u2007\uFEFF]+/g
/** Marcas diacriticas combinantes, tras el NFD: Padme(NFD) -> Padme. */
const DIACRITICOS = /[\u0300-\u036F]/g
/** Apostrofes rectos y tipograficos: "Can't" / "Can’t". */
const APOSTROFES = /['\u2018\u2019\u02BC`]/g

/**
 * Normaliza para comparar. Se aplica a AMBOS lados —índice y consulta— así que
 * "Padmé"/"Padme", "Can't"/"Can’t" y "A – B"/"A - B" colapsan al mismo texto.
 * Misma filosofía que `normalizeSearch` de swuApi.ts.
 */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .replace(APOSTROFES, '')
    .replace(GUIONES, '-')
    .replace(ESPACIOS, ' ')
    .toLowerCase()
    .trim()
}

/**
 * Orden de preferencia entre impresiones de una misma carta — el mismo criterio
 * que usa swuApi para elegir la impresión canónica.
 */
const VARIANT_PRIORITY = [
  'Standard', 'Standard Foil', 'Hyperspace', 'Hyperspace Foil',
  'Standard Prestige', 'Foil Prestige', 'Serialized Prestige',
  'Weekly Play', 'Weekly Play Foil',
]

function rangoVariante(c: Card): number {
  const i = VARIANT_PRIORITY.indexOf(c.variantType ?? 'Standard')
  return i === -1 ? VARIANT_PRIORITY.length : i
}

/**
 * Desempata dos impresiones de la misma carta de forma DETERMINISTA.
 *
 * Hace falta de verdad: `Chopper Base` está impresa como Standard en SOR 30 y
 * otra vez en JTL 29 (misma carta, 30hp Cunning). Sin un desempate estable, el
 * mismo torneo podía resolver al uuid de SOR una vez y al de JTL la siguiente,
 * y el agregado del meta contaría el arquetipo como dos.
 */
function preferida(a: Card, b: Card): Card {
  const ra = rangoVariante(a), rb = rangoVariante(b)
  if (ra !== rb) return ra < rb ? a : b
  if (a.setCode !== b.setCode) return a.setCode < b.setCode ? a : b
  if (a.setNumber !== b.setNumber) return a.setNumber < b.setNumber ? a : b
  return a.id < b.id ? a : b
}

/**
 * Construye el índice desde las cartas locales (Dexie / `getAllCards()`).
 *
 * Se le pasan TODAS las cartas: filtra por `type` internamente. Un líder sin
 * subtítulo no entra —no podría formar la llave del formato— pero hoy los 154
 * lo tienen.
 */
export function construirIndiceArquetipos(cartas: Card[]): IndiceArquetipos {
  const lideres = new Map<string, Card>()
  const bases = new Map<string, Card>()

  for (const c of cartas) {
    if (c.type === 'Leader') {
      const sub = (c.subtitle ?? '').trim()
      if (!sub) continue
      const k = norm(`${c.name.trim()}, ${sub}`)
      const prev = lideres.get(k)
      lideres.set(k, prev ? preferida(prev, c) : c)
    } else if (c.type === 'Base') {
      const k = norm(c.name.trim())
      const prev = bases.get(k)
      bases.set(k, prev ? preferida(prev, c) : c)
    }
  }

  return { lideres, bases, clavesBase: [...bases.keys()].sort() }
}

export interface OpcionesParseo {
  /**
   * Acepta nombres cortados por la UI ("… - Nevarro City, Re..."). Solo
   * resuelve si el prefijo apunta a UNA sola base; si apunta a dos —"Nevarro
   * City..." calza con `Nevarro City` y con `Nevarro City, Restored`— devuelve
   * null. Déjalo apagado cuando el nombre venga del API, que no trunca.
   */
  permitirTruncado?: boolean
}

/** Prefijo mínimo para intentar el rescate por truncado. */
const MIN_PREFIJO = 4

/**
 * Devuelve el líder y la base de un `DecklistName`, o `null` si el nombre no
 * sigue el formato autogenerado (lista renombrada a mano, apodo, basura…).
 */
export function parseDecklistName(
  nombre: string | null | undefined,
  idx: IndiceArquetipos,
  opts: OpcionesParseo = {},
): ArquetipoParseado | null {
  if (typeof nombre !== 'string') return null

  let s = norm(nombre)
  // El más corto posible ronda los 20 caracteres; el más largo medido, 60.
  if (s.length < 5 || s.length > 200) return null

  let truncado = false
  if (opts.permitirTruncado) {
    const cortado = s.replace(/(\.\.\.|…)$/, '')
    if (cortado !== s) { s = cortado.trim(); truncado = true }
  }

  // Se prueban TODOS los cortes por " - ". Hoy siempre hay exactamente uno,
  // pero si algún día sale una carta con " - " en el nombre esto no se rompe:
  // exige que UNA sola partición resuelva y devuelve null si resuelven dos.
  const exitos: ArquetipoParseado[] = []
  for (let i = s.indexOf(SEPARADOR); i !== -1; i = s.indexOf(SEPARADOR, i + 1)) {
    const izq = s.slice(0, i).trim()
    const der = s.slice(i + SEPARADOR.length).trim()

    const lider = idx.lideres.get(izq)
    if (!lider) continue

    // El lado derecho se busca ENTERO. Nunca se corta por la coma.
    let base: Card | undefined
    let confianza: ArquetipoParseado['confianza']

    if (!truncado) {
      base = idx.bases.get(der)
      confianza = 'exacta'
    } else {
      // Con el nombre cortado, un acierto EXACTO no basta y es justo el caso
      // peligroso: "Nevarro City..." calza exacto con `Nevarro City` (SHD,
      // Command) cuando lo que había era `Nevarro City, Restored` (ASH,
      // Vigilance). Lo mismo "Sundari ..." vs `Sundari Palace`. Por eso aquí
      // SIEMPRE se exige que el prefijo apunte a UNA sola base; si hay dos
      // candidatas —aunque una calce entera— no se resuelve.
      if (der.length < MIN_PREFIJO) continue
      const candidatas = idx.clavesBase.filter(k => k.startsWith(der))
      if (candidatas.length !== 1) continue
      base = idx.bases.get(candidatas[0])
      confianza = candidatas[0] === der ? 'exacta' : 'truncada'
    }
    if (!base) continue

    exitos.push({ liderId: lider.id, baseId: base.id, confianza })
  }

  return exitos.length === 1 ? exitos[0] : null
}

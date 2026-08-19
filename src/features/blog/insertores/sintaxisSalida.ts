/**
 * sintaxisSalida — convierte el modelo de un formulario en la sintaxis del
 * artículo, y REHÚSA producir sintaxis inválida.
 *
 * ── La garantía ──────────────────────────────────────────────────────
 *
 * Todo lo que sale de acá pasa antes por el parser DE VERDAD —`parsearMazo` y
 * `parsearBloqueEstadistico`, los mismos que usa el renderizador—. Si el
 * parser devuelve null, la función devuelve un error y el botón de insertar
 * queda deshabilitado. No hay forma de que un formulario produzca un bloque
 * que después se pinte como texto plano.
 *
 * Eso NO alcanza para los seis casos de corrupción SILENCIOSA (el bloque
 * parsea pero muestra otra cosa), porque ahí el parser dice que sí. Esos se
 * frenan en `validarFila` y en `codigoImpresion`, campo por campo:
 *
 *  - `:` en el valor de barras   → el corte es por el ÚLTIMO `:`, así que
 *                                  «A: 3:1» parsea como «A: 3 → 1 %».
 *  - `:` en la etiqueta de ficha → el corte es por el PRIMER `:`.
 *  - `·` o `|` en ficha          → son separadores de campo.
 *  - etiqueta `fuente`           → se la roba el marco del bloque.
 *  - set mal escrito en carta    → se ignora y dibuja una impresión cualquiera.
 *  - cero a la izquierda (ASH-011) → no casa y cae al set completo.
 *
 * Va en `.ts` y no en `.tsx` a propósito: un archivo que exporta componentes Y
 * funciones rompe el Fast Refresh de Vite.
 */

import { parsearBloqueEstadistico, type TipoBloqueEstadistico } from '../sintaxisEstadistica'
import { parsearMazo } from '../sintaxisMazo'
import type { TipoBloque } from './edicionTexto'
import type { Card, TournamentFormat } from '../../../types'

export type TipoGrafico = TipoBloqueEstadistico
export type FormatoMazo = TournamentFormat | 'limited'

/** sintaxisMazo.ts:92-94. El orden es el del selector. */
export const FORMATOS_MAZO: readonly FormatoMazo[] = [
  'premier', 'twin_suns', 'trilogy', 'sealed', 'draft', 'limited',
]

export const ETIQUETA_FORMATO: Record<FormatoMazo, string> = {
  premier: 'Premier',
  twin_suns: 'Twin Suns',
  trilogy: 'Trilogy',
  sealed: 'Sellado',
  draft: 'Draft',
  limited: 'Limitado',
}

/** sintaxisEstadistica.ts:56-58 y sintaxisMazo.ts:89-90. Pasarse cae a texto plano. */
export const MAX_FILAS: Record<TipoGrafico, number> = { barras: 40, curva: 20, ficha: 24 }
export const MAX_LINEAS_MAZO = 90
export const MAX_COPIAS = 30

// ── Saneadores de campo ──────────────────────────────────────────────

/**
 * El título del marcador es `[^\]]*`: un `]` hace que el marcador entero se
 * lea como texto. Se filtra AL ESCRIBIR, así que el caso no llega nunca al
 * serializador.
 */
export function limpiarTitulo(s: string): string {
  return s.replace(/[\]\r\n]/g, '')
}

/** La fuente es una línea: un salto la partiría en dos y la segunda mitad tumbaría el bloque. */
export function limpiarUnaLinea(s: string): string {
  return s.replace(/[\r\n]/g, ' ')
}

// ── Carta ────────────────────────────────────────────────────────────

/**
 * `ASH-11` — el código de impresión que entienden `[[carta:]]` y `[[mazo:]]`.
 *
 * `Card.setNumber` es `number` (types/index.ts), así que `String()` nunca
 * produce el `ASH-011` que el resolvedor descarta en silencio. El código de
 * set se valida contra el MISMO regex del parser: uno de 6 caracteres se
 * ignoraría sin avisar y la ficha dibujaría otra impresión.
 */
export function codigoImpresion(carta: Card): string | null {
  const set = (carta.setCode ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9]{2,5}$/.test(set)) return null
  if (!Number.isInteger(carta.setNumber) || carta.setNumber < 0) return null
  return `${set}-${carta.setNumber}`
}

export interface SalidaCarta {
  texto: string
  /** Se pudo escribir el nombre pero NO fijar la impresión. */
  aviso: string | null
}

/**
 * `[[carta:Nombre|ASH-11]]`.
 *
 * Se valida con las DOS expresiones de Articulo.tsx: la que trocea el párrafo
 * (línea 219) y la que valida la ficha (línea 222). Un nombre con `]` o `|`
 * no se puede referenciar de ninguna forma y devuelve error.
 */
export function fichaCarta(
  carta: Card,
  fijarImpresion: boolean,
): { ok: true; salida: SalidaCarta } | { ok: false; error: string } {
  const nombre = (carta.name ?? '').trim()
  if (!nombre) return { ok: false, error: 'La carta no tiene nombre.' }
  if (nombre.includes(']')) {
    return { ok: false, error: 'El nombre lleva un «]» y eso rompe la ficha entera.' }
  }
  if (nombre.includes('|')) {
    return { ok: false, error: 'El nombre lleva un «|», que es el separador del código de impresión.' }
  }

  const codigo = fijarImpresion ? codigoImpresion(carta) : null
  const aviso = fijarImpresion && !codigo
    ? `No se pudo fijar la impresión (set «${carta.setCode}»): la ficha va solo con el nombre y puede dibujar otra impresión.`
    : null

  const texto = codigo ? `[[carta:${nombre}|${codigo}]]` : `[[carta:${nombre}]]`

  if (!/^\[\[carta:[^\]]+\]\]$/.test(texto)) {
    return { ok: false, error: 'La ficha no se puede formar con ese nombre.' }
  }
  if (!/^\[\[carta:([^\]|]+)(?:\|([^\]]+))?\]\]$/.test(texto)) {
    return { ok: false, error: 'La ficha no se puede formar con ese nombre.' }
  }
  return { ok: true, salida: { texto, aviso } }
}

// ── Gráficos (barras · curva · ficha) ────────────────────────────────

export interface FilaGrafico {
  /** Etiqueta en barras y ficha; coste en curva. */
  a: string
  /** Valor en barras y ficha; cantidad en curva. */
  b: string
}

export interface FormGrafico {
  tipo: TipoGrafico
  titulo: string
  fuente: string
  filas: FilaGrafico[]
}

export interface ErroresFila {
  a?: string
  b?: string
}

const ES_FUENTE = /^fuente\s*$/i

/** Errores por celda. Vacío = la fila sirve. */
export function validarFila(tipo: TipoGrafico, fila: FilaGrafico): ErroresFila {
  const a = fila.a.trim()
  const b = fila.b.trim()
  const e: ErroresFila = {}

  if (tipo === 'curva') {
    if (!/^\d{1,2}\+?$/.test(a)) e.a = 'Un coste: 1…99, o «6+».'
    if (!/^\d{1,3}$/.test(b)) e.b = 'Cuántas cartas: 0…999.'
    return e
  }

  if (!a) e.a = 'Falta la etiqueta.'
  else if (ES_FUENTE.test(a)) e.a = 'No puede llamarse «fuente»: el artículo se roba esa línea.'
  else if (tipo === 'ficha' && a.includes(':')) e.a = 'La etiqueta de una ficha no puede llevar «:».'
  else if (tipo === 'ficha' && /[·|]/.test(a)) e.a = 'Ni «·» ni «|»: son los separadores de campo.'

  if (tipo === 'barras') {
    const n = b.replace(/\s*%$/, '')
    if (!n) e.b = 'Falta el porcentaje.'
    else if (!/^\d{1,3}(?:[.,]\d+)?$/.test(n)) e.b = 'Solo un número, con punto o coma. Nada de «:».'
    else if (Number(n.replace(',', '.')) > 100) e.b = 'El máximo es 100.'
  } else {
    if (!b) e.b = 'Falta el valor.'
    else if (/[·|]/.test(b)) e.b = 'Ni «·» ni «|»: son los separadores de campo.'
  }
  return e
}

function lineaDeFila(tipo: TipoGrafico, fila: FilaGrafico): string {
  const a = fila.a.trim()
  const b = fila.b.trim()
  return tipo === 'curva' ? `${a}:${b}` : `${a}: ${b}`
}

/** El cuerpo tal como lo verá el parser (sin marcador y sin la línea `fuente:`). */
export function cuerpoGrafico(f: FormGrafico): string[] {
  const filas = f.filas.filter(x => x.a.trim() !== '' || x.b.trim() !== '')
  if (f.tipo === 'curva') {
    // Todos los pares en UNA línea: un espacio dentro del par lo parte y tumba
    // el bloque, así que la única separación posible es entre pares.
    return filas.length === 0 ? [] : [filas.map(x => lineaDeFila('curva', x)).join(' ')]
  }
  return filas.map(x => lineaDeFila(f.tipo, x))
}

export type Serializado =
  | { ok: true; texto: string; avisos: string[] }
  | { ok: false; error: string }

export function serializarGrafico(f: FormGrafico): Serializado {
  const filas = f.filas.filter(x => x.a.trim() !== '' || x.b.trim() !== '')
  if (filas.length === 0) return { ok: false, error: 'Agregá al menos una fila.' }
  if (filas.length > MAX_FILAS[f.tipo]) {
    return { ok: false, error: `El máximo son ${MAX_FILAS[f.tipo]} filas; hay ${filas.length}.` }
  }
  for (let i = 0; i < filas.length; i++) {
    const e = validarFila(f.tipo, filas[i])
    const msg = e.a ?? e.b
    if (msg) return { ok: false, error: `Fila ${i + 1}: ${msg}` }
  }

  const cuerpo = cuerpoGrafico({ ...f, filas })

  // La prueba de fuego: el parser DE VERDAD, el mismo del renderizador.
  if (!parsearBloqueEstadistico(f.tipo, cuerpo)) {
    return { ok: false, error: 'Estos datos no cumplen el formato del bloque.' }
  }

  const titulo = limpiarTitulo(f.titulo).trim()
  const marcador = titulo ? `[[${f.tipo}: ${titulo}]]` : `[[${f.tipo}]]`
  const fuente = limpiarUnaLinea(f.fuente).trim()
  const lineas = [marcador, ...cuerpo, ...(fuente ? [`fuente: ${fuente}`] : [])]

  return { ok: true, texto: lineas.join('\n'), avisos: [] }
}

/**
 * Rellena el formulario desde un bloque ya escrito, INCLUSO si está roto.
 *
 * Con el bloque roto es cuando más falta hace el formulario, así que no se
 * usa el parser (que es todo-o-nada): se parte igual que él, celda por celda,
 * y `validarFila` marca en rojo la que no cumple.
 */
export function filasDesdeCuerpo(tipo: TipoGrafico, lineas: string[]): FilaGrafico[] {
  if (tipo === 'curva') {
    return lineas.join(' ').split(/\s+/).filter(Boolean).map(t => {
      const i = t.indexOf(':')
      return i < 0 ? { a: t, b: '' } : { a: t.slice(0, i), b: t.slice(i + 1) }
    })
  }
  if (tipo === 'ficha') {
    const filas: FilaGrafico[] = []
    for (const l of lineas) {
      for (const frag of l.split(/\s*[·|]\s*/).filter(Boolean)) {
        const i = frag.indexOf(':')
        if (i < 0) filas.push({ a: frag.trim(), b: '' })
        else filas.push({ a: frag.slice(0, i).trim(), b: frag.slice(i + 1).trim() })
      }
    }
    return filas
  }
  return lineas.map(l => {
    const i = l.lastIndexOf(':')
    if (i < 0) return { a: l.trim(), b: '' }
    return { a: l.slice(0, i).trim(), b: l.slice(i + 1).trim() }
  })
}

// ── Mazo ─────────────────────────────────────────────────────────────

export interface RefMazoForm {
  carta: Card
  cantidad: number
}

export interface FormMazo {
  titulo: string
  fuente: string
  formato: FormatoMazo
  lider: Card | null
  base: Card | null
  main: RefMazoForm[]
  banquillo: RefMazoForm[]
}

/** La línea `3x Nombre|ASH-11`, o el porqué de que no se pueda escribir. */
function lineaCarta(ref: RefMazoForm): { linea: string; aviso: string | null } | { error: string } {
  const nombre = (ref.carta.name ?? '').trim()
  if (!nombre) return { error: 'Una de las cartas no tiene nombre.' }
  // sintaxisMazo.ts:116 — el nombre se corta por el último `|`.
  if (nombre.includes('|')) return { error: `«${nombre}» lleva un «|» y no se puede poner en la lista.` }
  if (!Number.isInteger(ref.cantidad) || ref.cantidad < 1 || ref.cantidad > MAX_COPIAS) {
    return { error: `«${nombre}»: la cantidad va de 1 a ${MAX_COPIAS}.` }
  }
  const codigo = codigoImpresion(ref.carta)
  return {
    linea: codigo ? `${ref.cantidad}x ${nombre}|${codigo}` : `${ref.cantidad}x ${nombre}`,
    aviso: codigo ? null : `No se pudo fijar la impresión de «${nombre}»: puede resolver a otra.`,
  }
}

function lineaEtiqueta(clave: 'lider' | 'base', carta: Card): { linea: string; aviso: string | null } | { error: string } {
  const r = lineaCarta({ carta, cantidad: 1 })
  if ('error' in r) return r
  // Se quita el `1x ` del principio: la etiqueta no lleva cantidad.
  return { linea: `${clave}: ${r.linea.replace(/^1x /, '')}`, aviso: r.aviso }
}

/** Dos filas que resuelven a la misma impresión se funden solas al pintar; se funden acá. */
export function fundirRepetidas(filas: RefMazoForm[]): RefMazoForm[] {
  const porClave = new Map<string, RefMazoForm>()
  for (const f of filas) {
    const clave = `${f.carta.name}|${codigoImpresion(f.carta) ?? ''}`
    const ya = porClave.get(clave)
    if (ya) ya.cantidad = Math.min(MAX_COPIAS, ya.cantidad + f.cantidad)
    else porClave.set(clave, { carta: f.carta, cantidad: f.cantidad })
  }
  return [...porClave.values()]
}

export function serializarMazo(f: FormMazo): Serializado {
  if (!f.lider) return { ok: false, error: 'Falta el líder.' }
  if (!f.base) return { ok: false, error: 'Falta la base.' }
  const main = fundirRepetidas(f.main)
  const banquillo = fundirRepetidas(f.banquillo)
  if (main.length === 0) return { ok: false, error: 'El mazo principal está vacío.' }

  const avisos: string[] = []
  const cuerpo: string[] = [`formato: ${f.formato}`]

  for (const [clave, carta] of [['lider', f.lider], ['base', f.base]] as const) {
    const r = lineaEtiqueta(clave, carta)
    if ('error' in r) return { ok: false, error: r.error }
    if (r.aviso) avisos.push(r.aviso)
    cuerpo.push(r.linea)
  }

  for (const ref of main) {
    const r = lineaCarta(ref)
    if ('error' in r) return { ok: false, error: r.error }
    if (r.aviso) avisos.push(r.aviso)
    cuerpo.push(r.linea)
  }
  if (banquillo.length > 0) {
    cuerpo.push('banquillo')
    for (const ref of banquillo) {
      const r = lineaCarta(ref)
      if ('error' in r) return { ok: false, error: r.error }
      if (r.aviso) avisos.push(r.aviso)
      cuerpo.push(r.linea)
    }
  }

  if (cuerpo.length > MAX_LINEAS_MAZO) {
    return { ok: false, error: `El bloque admite ${MAX_LINEAS_MAZO} líneas y este lleva ${cuerpo.length}.` }
  }
  if (!parsearMazo(cuerpo)) {
    return { ok: false, error: 'La lista no cumple el formato del bloque de mazo.' }
  }

  const titulo = limpiarTitulo(f.titulo).trim()
  const marcador = titulo ? `[[mazo: ${titulo}]]` : '[[mazo]]'
  const fuente = limpiarUnaLinea(f.fuente).trim()
  const lineas = [marcador, ...cuerpo, ...(fuente ? [`fuente: ${fuente}`] : [])]

  return { ok: true, texto: lineas.join('\n'), avisos }
}

// ── Diagnóstico línea por línea ──────────────────────────────────────

export interface Problema {
  /** 1 = primera línea del CUERPO (el marcador no cuenta). */
  linea: number
  texto: string
  motivo: string
}

/**
 * Por qué un bloque ya escrito no parsea, línea por línea.
 *
 * El parser es todo-o-nada y no dice cuál línea lo tumbó: 40 líneas de mazo
 * se aplastan en un párrafo de texto crudo y hay que revisarlas a ojo. Esto
 * repite sus reglas para poder señalar la línea.
 */
export function diagnosticarCuerpo(tipo: TipoBloque, lineas: string[]): Problema[] {
  const problemas: Problema[] = []
  const marcar = (i: number, motivo: string) => problemas.push({ linea: i + 1, texto: lineas[i], motivo })

  if (tipo === 'mazo') {
    let lider = false
    let base = false
    let main = 0
    lineas.forEach((l, i) => {
      const t = l.trim()
      if (!t) return
      if (/^(banquillo|sideboard|reserva)\s*:?$/i.test(t)) return
      const etiqueta = /^(formato|l[ií]der|leader|base)\s*:\s*(.+)$/i.exec(t)
      if (etiqueta) {
        const clave = etiqueta[1].toLowerCase()
        if (clave === 'formato') {
          const v = etiqueta[2].trim().toLowerCase().replace(/[\s-]+/g, '_')
          if (!FORMATOS_MAZO.some(x => x === v)) marcar(i, `«${etiqueta[2].trim()}» no es un formato válido.`)
          return
        }
        if (clave === 'base') {
          if (base) marcar(i, 'La base ya estaba puesta más arriba.')
          base = true
        } else {
          if (lider) marcar(i, 'El líder ya estaba puesto más arriba (lider, líder y leader son la misma ranura).')
          lider = true
        }
        if (!refValida(etiqueta[2].trim())) marcar(i, 'El nombre lleva un «|» o el código de set no es válido.')
        return
      }
      const fila = /^(\d{1,2})\s*x\s+(.+)$/i.exec(t)
      if (!fila) { marcar(i, 'No es «Nx Nombre|SET-NUM» (falta el espacio después de la x, o falta la x).'); return }
      const n = Number(fila[1])
      if (n < 1 || n > MAX_COPIAS) { marcar(i, `La cantidad va de 1 a ${MAX_COPIAS}.`); return }
      if (!refValida(fila[2])) { marcar(i, 'El nombre lleva un «|» o el código de set no es válido.'); return }
      main++
    })
    if (!lider) problemas.push({ linea: 0, texto: '', motivo: 'Falta la línea «lider:».' })
    if (!base) problemas.push({ linea: 0, texto: '', motivo: 'Falta la línea «base:».' })
    if (main === 0) problemas.push({ linea: 0, texto: '', motivo: 'No hay ninguna carta en el mazo principal.' })
    if (lineas.length > MAX_LINEAS_MAZO) {
      problemas.push({ linea: 0, texto: '', motivo: `Son ${lineas.length} líneas y el máximo es ${MAX_LINEAS_MAZO}.` })
    }
    return problemas
  }

  const filas = filasDesdeCuerpo(tipo, lineas)
  filas.forEach((fila, i) => {
    const e = validarFila(tipo, fila)
    const motivo = e.a ?? e.b
    if (motivo) problemas.push({ linea: i + 1, texto: `${fila.a}${fila.b ? `: ${fila.b}` : ''}`, motivo })
  })
  if (filas.length === 0) problemas.push({ linea: 0, texto: '', motivo: 'El bloque no tiene ninguna fila.' })
  if (filas.length > MAX_FILAS[tipo]) {
    problemas.push({ linea: 0, texto: '', motivo: `Son ${filas.length} filas y el máximo es ${MAX_FILAS[tipo]}.` })
  }
  return problemas
}

/** sintaxisMazo.ts:107-119, para poder explicar el fallo sin duplicar el parser. */
function refValida(texto: string): boolean {
  const s = texto.trim()
  if (!s) return false
  const corte = s.lastIndexOf('|')
  if (corte < 0) return !s.includes('|')
  const nombre = s.slice(0, corte).trim()
  const set = s.slice(corte + 1).trim()
  if (!nombre || nombre.includes('|')) return false
  return /^[A-Za-z0-9]{2,5}(?:-\d+)?$/.test(set)
}

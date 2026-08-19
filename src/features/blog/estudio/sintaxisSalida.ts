/**
 * sintaxisSalida — construir la sintaxis del blog desde un formulario.
 *
 * Va en un `.ts` pelado y NO en un `.tsx` por el mismo motivo que
 * sintaxisMazo.ts y sintaxisEstadistica.ts: un archivo que exporta componentes
 * Y funciones rompe el Fast Refresh de Vite (`react-refresh/only-export-components`).
 *
 * Este archivo es el REVÉS de esos dos: ellos leen la sintaxis, éste la
 * escribe. Y su única razón de ser es que el formato de almacenamiento sigue
 * siendo texto plano: el estudio es una capa de composición ENCIMA de la misma
 * sintaxis, nunca un formato nuevo. Si esto emitiera otra cosa, los artículos
 * ya publicados dejarían de renderizarse.
 *
 * ── Los seis casos que el formulario TIENE que atajar ─────────────────
 *
 * El fallback a texto plano de Articulo.tsx protege de los errores ruidosos: un
 * bloque que no parsea se ve como texto y el autor lo nota. NO protege de los
 * silenciosos, que son los que este archivo bloquea:
 *
 *  1. `]` en el título de un bloque → el marcador entero se lee como texto.
 *  2. Cero a la izquierda en el número de impresión (`ASH-011`) → no casa y se
 *     cae al set completo SIN avisar (Articulo.tsx:148, `Card.setNumber` es number).
 *  3. `:` en el valor de una fila de barras → el corte es por el ÚLTIMO `:`,
 *     así que `A: 3:1` no falla: dibuja «A: 3 → 1 %».
 *  4. Una etiqueta llamada `fuente` en ficha o barras → el marco se la roba
 *     antes de que el parser la vea y la fila DESAPARECE.
 *  5. `·` o `|` dentro de un campo de ficha → parte el fragmento en dos.
 *  6. Un salto de línea dentro de un campo → una línea en blanco CIERRA el
 *     bloque, así que media tabla se publica truncada.
 */

/** Un campo de formulario nunca puede meter saltos de línea en el cuerpo de un bloque. */
export function unaLinea(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').trim()
}

/**
 * `SETCODE-numero` para `[[carta:…|X]]` y para las filas de `[[mazo:]]`.
 *
 * `Card.setNumber` es `number` (types/index.ts) y Articulo.tsx compara contra
 * `String(c.setNumber)`. Un `padStart` acá haría que la carta se resolviera a
 * una impresión cualquiera del set, en silencio.
 */
export function refImpresion(setCode: string, setNumber: number): string {
  return `${setCode.toUpperCase()}-${setNumber}`
}

/** Motivo por el que un campo no se puede emitir, o null si está bien. */
export type Reparo = string | null

export function revisarTitulo(t: string): Reparo {
  if (t.includes(']')) return 'El título no puede llevar «]»: rompe el marcador entero.'
  return null
}

export function revisarEtiqueta(t: string, tipo: 'barras' | 'ficha'): Reparo {
  const s = unaLinea(t)
  if (!s) return 'La etiqueta no puede quedar vacía.'
  if (/^fuente\s*$/i.test(s)) return 'Una etiqueta llamada «fuente» desaparece del bloque: la roba la línea de fuente.'
  if (tipo === 'ficha' && /[·|:]/.test(s)) return 'En una ficha la etiqueta no puede llevar «:», «·» ni «|».'
  return null
}

export function revisarValorBarras(v: string): Reparo {
  const s = unaLinea(v)
  if (s.includes(':')) return 'El valor no puede llevar «:»: se corta por el último y publica otro número.'
  const t = s.replace(/\s*%$/, '')
  if (!/^\d{1,3}(?:[.,]\d+)?$/.test(t)) return 'Escribí un porcentaje: 79.7, 79,7 u 80 %.'
  if (Number(t.replace(',', '.')) > 100) return 'Un porcentaje no pasa de 100.'
  return null
}

export function revisarValorFicha(v: string): Reparo {
  const s = unaLinea(v)
  if (!s) return 'El valor no puede quedar vacío.'
  if (/[·|]/.test(s)) return 'El valor no puede llevar «·» ni «|»: separan campos.'
  return null
}

/** Nombre de carta tal cual lo exige el resolvedor: pelado, sin subtítulo. */
export function revisarNombreCarta(n: string): Reparo {
  const s = unaLinea(n)
  if (!s) return 'Falta el nombre.'
  if (s.includes('|')) return 'El nombre no puede llevar «|»: es el separador del set.'
  if (s.includes(']')) return 'El nombre no puede llevar «]».'
  return null
}

/**
 * Arma el texto de un bloque completo.
 *
 * Siempre se emite con línea en blanco al final: es el ÚNICO cierre que
 * existe. `insertarBloque` se encarga de la de arriba.
 */
export function armarBloque(
  tipo: 'barras' | 'curva' | 'ficha' | 'mazo',
  titulo: string,
  cuerpo: string[],
  fuente: string,
): string {
  const t = unaLinea(titulo)
  const cabecera = t ? `[[${tipo}: ${t}]]` : `[[${tipo}]]`
  const lineas = [cabecera, ...cuerpo.map(unaLinea).filter(Boolean)]
  const f = unaLinea(fuente)
  if (f) lineas.push(`fuente: ${f}`)
  return lineas.join('\n')
}

export interface Insercion { texto: string; cursor: number }

/**
 * Mete un fragmento EN LÍNEA (una ficha `[[carta:]]`, negrita) en la selección.
 */
export function insertarEnLinea(texto: string, ini: number, fin: number, frag: string): Insercion {
  const nuevo = texto.slice(0, ini) + frag + texto.slice(fin)
  return { texto: nuevo, cursor: ini + frag.length }
}

/**
 * Mete un BLOQUE, garantizando línea en blanco antes y después.
 *
 * Sin esto, dos bloques pegados se destruyen mutuamente: el segundo marcador
 * cae DENTRO del cuerpo del primero, porque dentro de un bloque toda línea es
 * dato (Articulo.tsx:329-336). Es el error más fácil de cometer con un botón
 * de «insertar» y el más difícil de ver leyendo el textarea.
 */
export function insertarBloque(texto: string, ini: number, fin: number, bloque: string): Insercion {
  const antes = texto.slice(0, ini).replace(/\s+$/, '')
  const despues = texto.slice(fin).replace(/^\s+/, '')
  const cabeza = antes ? antes + '\n\n' : ''
  const cola = despues ? '\n\n' + despues : '\n'
  const nuevo = cabeza + bloque + cola
  return { texto: nuevo, cursor: cabeza.length + bloque.length }
}

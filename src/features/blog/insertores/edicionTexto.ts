/**
 * edicionTexto — mover texto dentro del <textarea> del editor sin romper la
 * sintaxis del artículo.
 *
 * ── Por qué existe ────────────────────────────────────────────────────
 *
 * Los insertores no «escriben en el editor»: producen un texto y un RANGO, y
 * este archivo los aplica. Va aparte —y en `.ts`— por dos motivos: es lógica
 * pura que se puede probar sin montar nada, y un archivo que exporta
 * componentes Y funciones rompe el Fast Refresh de Vite (mismo motivo que
 * sintaxisMazo.ts y sintaxisEstadistica.ts).
 *
 * ── Las dos reglas que este archivo garantiza ─────────────────────────
 *
 * 1. Un bloque `[[…]]` SIEMPRE queda con una línea en blanco antes y después.
 *    Sin la de antes, pegar un bloque con el cursor dentro de OTRO bloque mete
 *    el marcador en el cuerpo del primero (Articulo.tsx:329-336: dentro de un
 *    bloque toda línea es dato). Sin la de después, la primera línea del texto
 *    que sigue entra al bloque y lo tumba entero.
 * 2. El cursor termina DESPUÉS de la línea en blanco que cierra el bloque, no
 *    al final de la última fila: escribir ahí corrompería la última fila.
 *
 * Las expresiones regulares de acá son COPIA LITERAL de Articulo.tsx (líneas
 * 340, 332 y 373). Si alguna cambia allá, cambia acá.
 */

/** Los cuatro bloques de línea propia. */
export type TipoBloque = 'barras' | 'curva' | 'ficha' | 'mazo'

export interface Rango {
  desde: number
  hasta: number
}

export interface Edicion {
  /** El contenido completo ya modificado. */
  texto: string
  /** Dónde queda el cursor (colapsado) al aplicar. */
  cursor: number
}

/** Articulo.tsx:340 — sin flag `i`, el marcador va SOLO en su línea. */
const ABRE_BLOQUE = /^\[\[(barras|curva|ficha|mazo)(?::([^\]]*))?\]\]$/
/** Articulo.tsx:332 — se la roba el marco antes de que el parser vea la línea. */
const ROBA_FUENTE = /^fuente\s*:\s*(.+)$/i
/** Articulo.tsx:373 — la imagen tiene que ir sola en su línea. */
const LINEA_IMAGEN = /^!\[([^\]]*)\]\(([^)]+)\)$/

interface Linea {
  texto: string
  desde: number
  /** Índice del `\n` (o del final del texto). El salto NO entra en el rango. */
  hasta: number
}

function cortarLineas(texto: string): Linea[] {
  const salida: Linea[] = []
  let desde = 0
  for (;;) {
    const nl = texto.indexOf('\n', desde)
    if (nl < 0) {
      salida.push({ texto: texto.slice(desde), desde, hasta: texto.length })
      return salida
    }
    salida.push({ texto: texto.slice(desde, nl), desde, hasta: nl })
    desde = nl + 1
  }
}

// ── Encontrar qué hay bajo el cursor ─────────────────────────────────

export interface BloqueHallado {
  tipo: TipoBloque
  titulo: string
  fuente: string
  /** Cuerpo SIN la línea `fuente:` — exactamente lo que ve el parser. */
  lineas: string[]
  /** Del principio de la línea del marcador al final de la última línea del cuerpo. */
  rango: Rango
}

interface Abierto {
  tipo: TipoBloque
  titulo: string
  fuente: string
  lineas: string[]
  desde: number
  hasta: number
}

function aHallado(a: Abierto): BloqueHallado {
  return {
    tipo: a.tipo,
    titulo: a.titulo,
    fuente: a.fuente,
    lineas: a.lineas,
    rango: { desde: a.desde, hasta: a.hasta },
  }
}

/**
 * El bloque `[[…]]` que contiene la posición del cursor, o null.
 *
 * Recorre desde el principio porque «esta línea abre un bloque» depende de si
 * ya hay uno abierto: es el mismo bucle de Articulo.tsx, con offsets.
 */
export function bloqueEnCursor(texto: string, pos: number): BloqueHallado | null {
  let abierto: Abierto | null = null

  for (const ln of cortarLineas(texto)) {
    const l = ln.texto.trim()

    if (abierto) {
      if (l === '') {
        const b = aHallado(abierto)
        abierto = null
        if (pos >= b.rango.desde && pos <= b.rango.hasta) return b
        continue
      }
      const f = ROBA_FUENTE.exec(l)
      if (f) abierto.fuente = f[1].trim()
      else abierto.lineas.push(l)
      abierto.hasta = ln.hasta
      continue
    }

    const m = ABRE_BLOQUE.exec(l)
    if (m) {
      abierto = {
        tipo: m[1] as TipoBloque,
        titulo: m[2]?.trim() ?? '',
        fuente: '',
        lineas: [],
        desde: ln.desde,
        hasta: ln.hasta,
      }
    }
  }

  if (abierto) {
    const b = aHallado(abierto)
    if (pos >= b.rango.desde && pos <= b.rango.hasta) return b
  }
  return null
}

export interface CartaHallada {
  nombre: string
  set: string | null
  rango: Rango
}

/**
 * La ficha `[[carta:…]]` bajo el cursor.
 *
 * Se busca en una sola línea a propósito. El renderizador junta el párrafo con
 * espacios ANTES de trocear (Articulo.tsx:277), así que una ficha partida en
 * dos líneas también funciona al pintar; para EDITARLA habría que reescribir
 * dos líneas y el caso no vale la complejidad. Una ficha partida simplemente
 * no se ofrece para editar.
 */
export function cartaEnCursor(texto: string, pos: number): CartaHallada | null {
  const re = /\[\[carta:[^\]\n]+\]\]/g
  for (let m = re.exec(texto); m; m = re.exec(texto)) {
    const desde = m.index
    const hasta = desde + m[0].length
    if (pos < desde || pos > hasta) continue
    // La MISMA validación de Articulo.tsx:222: si no casa, no es una ficha.
    const v = /^\[\[carta:([^\]|]+)(?:\|([^\]]+))?\]\]$/.exec(m[0])
    if (!v) return null
    return { nombre: v[1].trim(), set: v[2]?.trim() ?? null, rango: { desde, hasta } }
  }
  return null
}

export interface ImagenHallada {
  pie: string
  url: string
  rango: Rango
}

/** La línea `![pie](url)` bajo el cursor, si el cursor no está dentro de un bloque. */
export function imagenEnCursor(texto: string, pos: number): ImagenHallada | null {
  if (bloqueEnCursor(texto, pos)) return null
  for (const ln of cortarLineas(texto)) {
    if (pos < ln.desde || pos > ln.hasta) continue
    const m = LINEA_IMAGEN.exec(ln.texto.trim())
    if (!m) return null
    return { pie: m[1], url: m[2], rango: { desde: ln.desde, hasta: ln.hasta } }
  }
  return null
}

// ── Aplicar ──────────────────────────────────────────────────────────

/** Reemplazo EN LÍNEA (una ficha `[[carta:…]]`). No toca los saltos. */
export function reemplazarEnLinea(texto: string, rango: Rango, fragmento: string): Edicion {
  return {
    texto: texto.slice(0, rango.desde) + fragmento + texto.slice(rango.hasta),
    cursor: rango.desde + fragmento.length,
  }
}

/**
 * Reemplazo de BLOQUE: garantiza línea en blanco antes y después.
 *
 * También sirve para la imagen: una línea `![pie](url)` rodeada de líneas en
 * blanco siempre se lee como imagen, nunca se pega a un párrafo ni la traga
 * un bloque abierto más arriba.
 */
export function reemplazarBloque(texto: string, rango: Rango, cuerpo: string): Edicion {
  const izq = texto.slice(0, rango.desde)
  const der = texto.slice(rango.hasta)

  const antes = izq === '' ? '' : izq.endsWith('\n\n') ? '' : izq.endsWith('\n') ? '\n' : '\n\n'
  const despues = der === '' ? '\n' : der.startsWith('\n\n') ? '' : der.startsWith('\n') ? '\n' : '\n\n'

  const final = izq + antes + cuerpo + despues + der
  const finCuerpo = rango.desde + antes.length + cuerpo.length
  // El cursor salta la línea en blanco que cierra el bloque: dejarlo al final
  // de la última fila haría que la siguiente tecla corrompiera esa fila.
  const salto = /^\n[^\S\n]*\n/.exec(final.slice(finCuerpo))
  return { texto: final, cursor: finCuerpo + (salto ? salto[0].length : 0) }
}

/** El rango seleccionado del textarea (colapsado en el cursor si no hay selección). */
export function rangoDeSeleccion(area: HTMLTextAreaElement | null, largo: number): Rango {
  if (!area) return { desde: largo, hasta: largo }
  return { desde: area.selectionStart ?? largo, hasta: area.selectionEnd ?? largo }
}

/**
 * Escribe el resultado y devuelve el foco con el cursor puesto.
 *
 * El `requestAnimationFrame` no es adorno: el textarea es controlado, así que
 * `setSelectionRange` antes de que React confirme el valor nuevo se pierde al
 * redibujar. Es el mismo patrón que ya usa `subir()` en BlogEditorPage.tsx:159.
 */
export function aplicarEdicion(
  area: HTMLTextAreaElement | null,
  edicion: Edicion,
  escribir: (texto: string) => void,
): void {
  escribir(edicion.texto)
  if (!area) return
  requestAnimationFrame(() => {
    area.focus()
    area.setSelectionRange(edicion.cursor, edicion.cursor)
  })
}

/**
 * puentePrevia — el contrato entre el estudio y el marco de vista previa.
 *
 * ── Por qué hay un iframe y no una caja de 375 px ─────────────────────
 *
 * MEDIDO en este repo, con el navegador a 1440×900:
 *
 *   Un `<div>` de 375 px dentro del escritorio:
 *     `grid-cols-2 sm:grid-cols-3` → 125px 125px 125px  (TRES columnas)
 *     `sm:rounded-xl`              → border-radius: 12px
 *     `-mx-4 sm:mx-0`              → margin-left: 0px
 *
 *   El MISMO marcado dentro de un `<iframe>` de 390 px:
 *     `grid-cols-2 sm:grid-cols-3` → 195px 195px         (DOS columnas)
 *     `sm:rounded-xl`              → border-radius: 0px
 *     `-mx-4 sm:mx-0`              → margin-left: -16px
 *
 * Las tres clases están en el renderizador del artículo: la ficha de datos
 * (BloquesEstadisticos.tsx:119), la imagen del cuerpo y su sangrado a los
 * bordes (Articulo.tsx:379 y :387). El breakpoint `sm` de Tailwind 4 es
 * `@media (width >= 40rem)` sobre el VIEWPORT (`--breakpoint-sm: 40rem` en
 * node_modules/tailwindcss/theme.css:327), y en este proyecto no hay ni una
 * sola consulta de contenedor: `grep '@container\|container-type' src/index.css`
 * no devuelve nada. Un div angosto no cambia el viewport; un iframe SÍ tiene
 * el suyo. No hay tercera opción que no sea reescribir el CSS del artículo.
 *
 * ── Lo que el iframe NO reproduce ─────────────────────────────────────
 *
 * También medido dentro del iframe de 390 px: `pointer: coarse` sigue en
 * `false` y `hover: hover` en `true`, porque son capacidades del APARATO, no
 * del viewport. Así que el bloque `@media (pointer: coarse)` de index.css:790
 * —el que sube los `input` a 16 px para que iOS no haga zoom— no se ve acá, y
 * los estados `hover:` se pintan aunque un teléfono no los tenga. Para un
 * artículo da igual (no lleva campos), pero no hay que vender el marco como
 * «el teléfono»: es «el ancho del teléfono», que es justo lo que cambia el
 * diseño. `devicePixelRatio` también se hereda del monitor (medido: 2).
 *
 * ── Por qué postMessage y no un parámetro de URL ──────────────────────
 *
 * El artículo más largo medido son 10.532 caracteres. Meterlo en la URL es
 * pasarse de largo en varios navegadores, y además cada tecla volvería a
 * navegar el iframe: se remontaría la app entera y el marco parpadearía. Con
 * postMessage el iframe se carga UNA vez por sesión y solo re-renderiza.
 *
 * El iframe NO lleva `sandbox`. Sin `allow-same-origin` quedaría en un origen
 * opaco y perdería IndexedDB, que es de donde salen las cartas: medido, el
 * iframe abre `swu-companion@v100` y cuenta 9.185 filas de `cards` sin error
 * ni `onblocked` — o sea que la previa resuelve `[[carta:]]` y `[[mazo:]]`
 * contra la MISMA base local, sin volver a descargar nada. Y con
 * `allow-same-origin` el sandbox no restringe nada, así que sería decorado.
 * Lo que de verdad protege es que el renderizador arma elementos React y no
 * toca `dangerouslySetInnerHTML`.
 */

export const CANAL = 'swu-blog-previa-v1'

/** Lo que el estudio manda al marco. Todo lo que la página pública pinta. */
export interface Sobre {
  canal: typeof CANAL
  contenido: string
  titulo: string
  excerpt: string
  portada: string | null
  kind: string
  tags: string[]
  autor: string | null
}

/** Lo que el marco contesta al montar, para que el estudio sepa a quién hablarle. */
export interface Saludo {
  canal: typeof CANAL
  listo: true
}

export function esSobre(d: unknown): d is Sobre {
  return typeof d === 'object' && d !== null && (d as { canal?: unknown }).canal === CANAL
    && typeof (d as { contenido?: unknown }).contenido === 'string'
}

export function esSaludo(d: unknown): d is Saludo {
  return typeof d === 'object' && d !== null && (d as { canal?: unknown }).canal === CANAL
    && (d as { listo?: unknown }).listo === true
}

/**
 * Anchos de aparato. Se elige el ANCHO y no un «modelo» porque el ancho es lo
 * único que miran las media queries; el alto solo decide cuánto se ve de una
 * vez, y el marco se lo queda del panel.
 */
export const ANCHOS = [
  { id: 'chico', ancho: 360, nombre: '360 · Android chico' },
  { id: 'base', ancho: 390, nombre: '390 · iPhone 14/15' },
  { id: 'grande', ancho: 430, nombre: '430 · iPhone Pro Max' },
] as const

export type IdAncho = (typeof ANCHOS)[number]['id']

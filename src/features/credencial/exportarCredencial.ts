/**
 * La credencial como PNG, para mandarla a un chat.
 *
 * ── Lo que se midió antes de escribir esto ────────────────────────────
 *
 * Todo acá está decidido por medición en el navegador, no por lo que
 * «debería» funcionar. Tres cosas, y las tres muerden:
 *
 * 1. **Las imágenes con `href` relativo NO se dibujan.** El SVG se pinta
 *    metiéndolo en un `data:` URL, y un `data:` no tiene base contra la cual
 *    resolver `/avatars/boba-fett.png`. Medido: con href relativo, la ventana
 *    de la foto sale con CERO píxeles de color; con las imágenes convertidas a
 *    data URI, 7646. Y lo peor: `toDataURL` NO falla en el primer caso —
 *    devuelve un PNG perfecto con la foto vacía. Un error que se ve como éxito.
 *
 * 2. **`var(--font-mono)` no existe dentro del SVG suelto.** Las variables CSS
 *    son del documento, y el SVG serializado ya no está en él. Hay que
 *    sustituirla por una familia concreta Y empotrar la fuente: un
 *    `font-family:'JetBrains Mono'` a secas tampoco sirve, porque el SVG
 *    tampoco tiene acceso a las `@font-face` de la página. Se empotran las
 *    caras latinas en base64 (75 KB medidos) y ahí sí. Comprobado que cambia
 *    el dibujo: 7347 píxeles de tinta con la fuente de reserva contra 6635 con
 *    la de verdad.
 *
 * 3. **El canvas queda LIMPIO.** Como todo va en data URI, no hay recurso de
 *    otro origen y `toBlob` no lanza `SecurityError`. Verificado.
 *
 * ── Por qué fondo transparente y no un lienzo ─────────────────────────
 *
 * Se pidió que se renderice EXACTAMENTE la tarjeta. La silueta de la placa es
 * escalonada y tiene agujero de llavero: sobre el fondo del chat se lee como
 * un OBJETO, no como una captura de pantalla. Se le hornea una sombra suave
 * para que no quede recortada contra fondos claros.
 */

/** Escala del PNG. 3× sobre 512×320 da 1536×960: nítido y liviano. */
const ESCALA = 3
/** Aire alrededor, en unidades del viewBox, para que quepa la sombra. */
const AIRE = 14

/** Convierte cualquier URL del propio sitio en un data URI. */
async function aDataUri(url: string): Promise<string> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`no se pudo leer ${url}`)
  const blob = await resp.blob()
  return await new Promise<string>((res, rej) => {
    const f = new FileReader()
    f.onload = () => res(String(f.result))
    f.onerror = () => rej(new Error('no se pudo codificar'))
    f.readAsDataURL(blob)
  })
}

/**
 * Las `@font-face` de la mono, empotradas.
 *
 * Se descubren leyendo las hojas de estilo EN VIVO en vez de escribir las
 * rutas a mano: el empaquetador les pone un hash al nombre en cada build, así
 * que cualquier ruta escrita a mano se rompe en el próximo despliegue sin que
 * nadie se entere hasta que un usuario comparte una tarjeta con la tipografía
 * cambiada.
 *
 * Solo los subconjuntos latinos: el cirílico, el griego y el vietnamita son
 * otros 60 KB que esta tarjeta no usa nunca.
 */
let cssFuenteCache: string | null = null
async function cssDeLaFuente(): Promise<string> {
  if (cssFuenteCache !== null) return cssFuenteCache
  const partes: string[] = []
  for (const hoja of Array.from(document.styleSheets)) {
    let reglas: CSSRuleList | null = null
    // Una hoja de otro origen lanza al leer `cssRules`. No es un error: es
    // que esa hoja no es nuestra.
    try { reglas = hoja.cssRules } catch { continue }
    for (const regla of Array.from(reglas ?? [])) {
      if (!(regla instanceof CSSFontFaceRule)) continue
      const familia = regla.style.getPropertyValue('font-family')
      if (!/JetBrains/i.test(familia)) continue
      const src = regla.style.getPropertyValue('src')
      const m = /url\(["']?([^"')]+)/.exec(src)
      if (!m || !/-latin(-ext)?-\d/.test(m[1])) continue
      try {
        const datos = await aDataUri(m[1])
        const peso = regla.style.getPropertyValue('font-weight') || '400'
        partes.push(
          `@font-face{font-family:'CredMono';font-style:normal;font-weight:${peso};src:url(${datos}) format('woff2');}`,
        )
      } catch {
        // Sin esta cara la tarjeta sale con la mono de reserva. Es peor, pero
        // sigue siendo una tarjeta: no se cancela la exportación por esto.
      }
    }
  }
  cssFuenteCache = partes.join('')
  return cssFuenteCache
}

/** Dónde se firma la placa. Es lo que hace que la cadena pueda volver. */
const SITIO = 'swusv.com'

export interface Exportada {
  blob: Blob
  archivo: File
  /** Para la vista previa. Hay que revocarla al desmontar. */
  url: string
  ancho: number
  alto: number
}

/**
 * Toma el SVG que está EN PANTALLA y devuelve el PNG.
 *
 * Se clona el que se ve, no se reconstruye: lo que se comparte es exactamente
 * lo que la persona tiene delante, sin una segunda implementación que pueda
 * separarse de la primera. Es la misma regla que sigue la impresión.
 */
export async function exportarCredencial(
  svgEnPantalla: SVGSVGElement,
  nombreArchivo = 'credencial',
): Promise<Exportada> {
  const clon = svgEnPantalla.cloneNode(true) as SVGSVGElement
  clon.removeAttribute('class')
  clon.removeAttribute('style')

  // ── 1. Las imágenes, a data URI (ver el punto 1 de la cabecera) ──
  for (const img of Array.from(clon.querySelectorAll('image'))) {
    const href = img.getAttribute('href') ?? img.getAttribute('xlink:href') ?? ''
    if (!href || href.startsWith('data:')) continue
    try {
      img.setAttribute('href', await aDataUri(new URL(href, window.location.origin).toString()))
      img.removeAttribute('xlink:href')
    } catch {
      // Sin el emblema la placa sigue siendo la placa. Sin la exportación, no
      // hay nada que compartir.
      img.remove()
    }
  }

  // ── 2. La firma del sitio ──
  // Va DENTRO de la placa, en el bisel del pie, no en un banner alrededor: una
  // imagen reenviada pierde el texto que la acompañaba, y sin esto la tarjeta
  // no puede traer a nadie de vuelta.
  //
  // Va sobre su propia placa oscura y NO en blanco a secas: dos de los
  // catorce temas tienen la chapa casi blanca (rebelde #E8DFC9, hoth
  // #D7DEE4), y ahí un texto blanco al 45% sencillamente no existe. La placa
  // le da el mismo contraste en los catorce.
  const ns = 'http://www.w3.org/2000/svg'
  const placa = document.createElementNS(ns, 'rect')
  placa.setAttribute('x', '386'); placa.setAttribute('y', '303')
  placa.setAttribute('width', '100'); placa.setAttribute('height', '15')
  placa.setAttribute('rx', '3')
  placa.setAttribute('fill', '#000000'); placa.setAttribute('opacity', '0.45')
  clon.appendChild(placa)

  const firma = document.createElementNS(ns, 'text')
  firma.setAttribute('x', '478')
  firma.setAttribute('y', '314')
  firma.setAttribute('text-anchor', 'end')
  firma.setAttribute('font-family', "'CredMono',ui-monospace,monospace")
  firma.setAttribute('font-size', '9')
  firma.setAttribute('letter-spacing', '1.2')
  firma.setAttribute('font-weight', '700')
  firma.setAttribute('fill', '#ffffff')
  firma.setAttribute('opacity', '0.92')
  firma.textContent = SITIO
  clon.appendChild(firma)

  // ── 3. Aire y sombra ──
  // El viewBox se agranda para que la sombra no quede cortada, y la placa se
  // recentra. Sin esto la sombra se pierde justo en el canto, que es donde se
  // nota.
  const ancho = 512 + AIRE * 2
  const alto = 320 + AIRE * 2
  clon.setAttribute('viewBox', `${-AIRE} ${-AIRE} ${ancho} ${alto}`)
  clon.setAttribute('width', String(ancho * ESCALA))
  clon.setAttribute('height', String(alto * ESCALA))

  const defs = clon.querySelector('defs')
  if (defs) {
    const filtro = document.createElementNS(ns, 'filter')
    filtro.setAttribute('id', 'sombraCompartir')
    filtro.setAttribute('x', '-20%'); filtro.setAttribute('y', '-20%')
    filtro.setAttribute('width', '140%'); filtro.setAttribute('height', '140%')
    const sombra = document.createElementNS(ns, 'feDropShadow')
    sombra.setAttribute('dx', '0'); sombra.setAttribute('dy', '5')
    sombra.setAttribute('stdDeviation', '6')
    sombra.setAttribute('flood-color', '#000'); sombra.setAttribute('flood-opacity', '0.55')
    filtro.appendChild(sombra)
    defs.appendChild(filtro)
    // El filtro se aplica al primer trazo de la silueta, que es la chapa.
    const chapa = clon.querySelector('path[fill-rule="evenodd"]')
    chapa?.setAttribute('filter', 'url(#sombraCompartir)')
  }

  // ── 4. La fuente (ver el punto 2 de la cabecera) ──
  let xml = new XMLSerializer().serializeToString(clon)
  xml = xml.replace(/var\(--font-mono\)/g, "'CredMono',ui-monospace,monospace")
  const css = await cssDeLaFuente()
  if (css) xml = xml.replace('<defs>', `<defs><style type="text/css">${css}</style>`)

  // ── 5. Al lienzo ──
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const el = new Image()
    el.onload = () => res(el)
    el.onerror = () => rej(new Error('el navegador no pudo dibujar la credencial'))
    el.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
  })

  const lienzo = document.createElement('canvas')
  lienzo.width = ancho * ESCALA
  lienzo.height = alto * ESCALA
  const ctx = lienzo.getContext('2d')
  if (!ctx) throw new Error('no se pudo abrir el lienzo')
  ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height)

  const blob = await new Promise<Blob>((res, rej) => {
    lienzo.toBlob((b) => (b ? res(b) : rej(new Error('no se pudo generar el PNG'))), 'image/png')
  })

  return {
    blob,
    archivo: new File([blob], `${nombreArchivo}.png`, { type: 'image/png' }),
    url: URL.createObjectURL(blob),
    ancho: lienzo.width,
    alto: lienzo.height,
  }
}

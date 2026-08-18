/**
 * Detector de choques de la credencial. Solo desarrollo (`/banco-credencial`).
 *
 * POR QUÉ EXISTE
 * El usuario reportó «hay textos que se ven encima del diseño» y tenía razón en
 * tres lugares a la vez: un remache pintado sobre las letras Aurebesh de RANGO,
 * la sublínea de DESPLEGADO cayéndose del panel por una muesca de la silueta, y
 * el bloque legal del dorso metiéndose en el emblema. Ninguno de los tres se
 * podía ver leyendo el código: hay que MEDIR dónde termina cada caja después de
 * aplicarse la fuente, el letter-spacing y el escalado del glifo.
 *
 * Así que se mide. Este componente lee las cajas REALES del SVG ya pintado
 * (`getBoundingClientRect`, convertido a unidades del viewBox) y lista todo
 * texto que pise decoración. Si la lista está vacía, la placa está limpia.
 *
 * TRES TRAMPAS QUE YA COSTARON TIEMPO
 * - `getBBox()` NO sirve acá: devuelve coordenadas locales, antes del
 *   `transform` del grupo. Las sublíneas Aurebesh son grupos trasladados, así
 *   que con getBBox las 8 salían apiladas en el origen y chocaban entre ellas.
 * - El dorso vive dentro de un `rotateY(180deg)`, así que sus cajas de
 *   pantalla vienen en ESPEJO. La primera versión intentó deshacerlo a mano y
 *   lo hizo AL REVÉS: daba por fuera de su fondo un texto que estaba adentro.
 *   Ahora no se deshace nada — los choques se miden en coordenadas de
 *   PANTALLA, donde el espejo afecta a los dos elementos por igual y se
 *   cancela solo.
 * - `isPointInFill` interpreta el punto en el sistema LOCAL del elemento, o
 *   sea ANTES de su propio `transform`. El panel del dorso lleva
 *   `translate(0 78) scale(1 0.68)`, así que preguntarle con coordenadas del
 *   viewBox devolvía que sí a puntos que estaban 70 unidades más arriba. Se
 *   resuelve con `getScreenCTM().inverse()`, que lleva el punto de pantalla al
 *   sistema de cada fondo sea cual sea su cadena de transformaciones.
 */

import { useCallback, useState } from 'react'

interface Caja { x: number; y: number; w: number; h: number; q: string }

/** Lo que cuenta como «diseño»: si un texto lo pisa, es un choque. */
const DECORACION = 'circle, image, line, [data-deco]'

function solape(a: Caja, b: Caja) {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return ox > 1 && oy > 1 ? { ox, oy } : null
}

interface Informe { lineas: string[]; medidas: number; saltadas: number }

export function DetectorChoques() {
  const [informe, setInforme] = useState<Informe | null>(null)

  const medir = useCallback(() => {
    const lineas: string[] = []
    let medidas = 0
    let saltadas = 0
    document.querySelectorAll<SVGSVGElement>('svg[data-cara]').forEach((svg, i) => {
      const marco = svg.getBoundingClientRect()
      // Una placa sin ancho no se puede medir. Se CUENTA, no se ignora: la
      // primera versión de esto devolvía «limpio» habiendo saltado las 27
      // placas porque la pestaña tenía viewport 0. Un verde que en realidad
      // no midió nada es peor que un rojo.
      if (marco.width < 10) { saltadas++; return }
      medidas++
      // Los filtros MIENTEN sobre el tamaño. `getBoundingClientRect` de un
      // elemento filtrado devuelve la región del filtro, no la tinta: el
      // nombre repujado declaraba 160% de su alto y «pisaba» su propia
      // sublínea 2 unidades que en pantalla no existen. Se apagan mientras se
      // mide y se reponen enseguida — la medición es síncrona, así que nadie
      // llega a ver la placa sin relieve.
      const filtrados = [...svg.querySelectorAll('[filter]')].map(el => ({
        el, valor: el.getAttribute('filter')!,
      }))
      filtrados.forEach(({ el }) => el.removeAttribute('filter'))
      // Solo para expresar los solapes en unidades del viewBox, que es como
      // están escritas las coordenadas en el código y por tanto lo único
      // accionable para quien lee el informe.
      const k = 512 / marco.width
      const cara = svg.getAttribute('data-cara')

      const caja = (el: Element, q: string): Caja => {
        const b = el.getBoundingClientRect()
        return { x: b.left, y: b.top, w: b.width, h: b.height, q }
      }

      const textos: Caja[] = []
      svg.querySelectorAll('text').forEach(t =>
        textos.push(caja(t, `"${(t.textContent ?? '').trim().slice(0, 20)}"`)))
      svg.querySelectorAll('g[aria-hidden="true"]').forEach(g =>
        textos.push(caja(g, 'aurebesh')))

      const deco: Caja[] = []
      svg.querySelectorAll(DECORACION).forEach(e => {
        if (e.closest('clipPath') || e.closest('defs') || e.hasAttribute('data-fondo')) return
        const c = caja(e, e.tagName === 'image' ? 'EMBLEMA/FOTO' : e.tagName)
        if (c.w * k > 2 && c.h * k > 2) deco.push(c)
      })

      // ── Regla 1: ningún texto puede pisar decoración ──
      textos.forEach(t => deco.forEach(d => {
        // La foto no es un choque de nadie: nada de texto vive ahí.
        if (d.q === 'EMBLEMA/FOTO' && d.w * k < 120) return
        const s = solape(t, d)
        if (s) lineas.push(
          `#${i} ${cara}: ${t.q} pisa ${d.q} → ${(s.ox * k).toFixed(1)}×${(s.oy * k).toFixed(1)}`,
        )
      }))

      // ── Regla 1b: los textos tampoco pueden pisarse ENTRE ELLOS ──
      //
      // Faltaba, y se notó: al re-repartir la fila inferior, la sublínea
      // Aurebesh de RANGO llegaba hasta x=214 y la de DESPLEGADO arrancaba en
      // x=200. Las dos estaban sobre el panel y ninguna pisaba decoración, así
      // que las dos reglas anteriores decían «limpio» mientras en pantalla se
      // leían como una sola palabra corrida.
      for (let a = 0; a < textos.length; a++) {
        for (let b = a + 1; b < textos.length; b++) {
          const s = solape(textos[a], textos[b])
          if (s) lineas.push(
            `#${i} ${cara}: ${textos[a].q} pisa ${textos[b].q} → ${(s.ox * k).toFixed(1)}×${(s.oy * k).toFixed(1)}`,
          )
        }
      }

      // ── Regla 2: todo texto tiene que caer DENTRO de su fondo ──
      //
      // Esta es la que cazó el peor choque, y ninguna comparación de cajas la
      // habría encontrado: SILUETA_PANEL tiene una MUESCA (entre x=216 y x=324
      // su borde inferior sube a y=294), y la sublínea de DESPLEGADO se caía
      // por ahí al bisel metálico. Media letra sobre el panel oscuro y media
      // sobre el metal claro.
      //
      // Se resuelve preguntándole a cada fondo si el punto está adentro, en SU
      // propio sistema de coordenadas — sin reimplementar el recorrido del
      // polígono ni sus muescas, que es donde estaría el error.
      const fondos = [...svg.querySelectorAll<SVGGeometryElement>('[data-fondo]')]
        .map(f => ({ el: f, inv: f.getScreenCTM()?.inverse() }))
        .filter(f => f.inv)
      const punto = svg.createSVGPoint()
      const dentroDeAlgunFondo = (px: number, py: number) => fondos.some(({ el, inv }) => {
        punto.x = px
        punto.y = py
        const local = punto.matrixTransform(inv!)
        try { return el.isPointInFill(local) } catch { return false }
      })

      textos.forEach(t => {
        // Las cuatro esquinas, un pelo hacia adentro para no fallar por el
        // borde exacto. El margen va en píxeles de pantalla equivalentes a
        // 0,6 unidades del viewBox.
        const e = 0.6 / k
        const esquinas: Array<[number, number]> = [
          [t.x + e, t.y + e], [t.x + t.w - e, t.y + e],
          [t.x + e, t.y + t.h - e], [t.x + t.w - e, t.y + t.h - e],
        ]
        const fuera = esquinas.filter(([px, py]) => !dentroDeAlgunFondo(px, py))
        if (fuera.length > 0 && fuera.length < 4) {
          lineas.push(`#${i} ${cara}: ${t.q} se sale de su fondo (${fuera.length}/4 esquinas afuera)`)
        }
      })

      filtrados.forEach(({ el, valor }) => el.setAttribute('filter', valor))
    })
    setInforme({ lineas, medidas, saltadas })
  }, [])

  return (
    <div className="rounded-xl border border-swu-border bg-swu-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-mono tracking-wider text-swu-muted">DETECTOR DE CHOQUES</p>
        <button
          onClick={medir}
          className="rounded-lg bg-swu-accent px-3 py-1.5 text-[11px] font-bold text-swu-accent-fg"
        >
          Medir todas las placas
        </button>
      </div>
      {informe && (
        <div className="mt-2 space-y-1">
          <p className="font-mono text-[10px] text-swu-muted">
            {informe.medidas} placas medidas
            {informe.saltadas > 0 && ` · ${informe.saltadas} sin ancho (NO medidas)`}
          </p>
          {informe.saltadas > 0 && informe.medidas === 0 && (
            <p className="text-[11px] font-bold text-swu-red">
              No se midió NADA. Ensanchá la ventana y volvé a medir — este resultado no dice nada.
            </p>
          )}
          {informe.medidas > 0 && informe.lineas.length === 0 && (
            <p className="text-[11px] font-bold text-swu-green">Limpio: ningún texto pisa decoración.</p>
          )}
          {informe.lineas.length > 0 && (
            <ul className="space-y-0.5">
              {informe.lineas.map((l, i) => (
                <li key={i} className="font-mono text-[10px] text-swu-amber">{l}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!informe && (
        <p className="mt-2 text-[10px] text-swu-muted">
          Mide las cajas reales del SVG pintado. Un texto sobre el panel o la banda no cuenta —
          ese es su fondo. Sí cuentan remaches, sello, circuitos, código de barras y emblema.
        </p>
      )}
    </div>
  )
}

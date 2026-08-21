/**
 * BahiaModulos — una bahía de la consola: la cabecera de categoría, y lo que
 * guarda debajo.
 *
 * ── El problema que resuelve, con números ────────────────────────────
 *
 * Inicio tiene 26 módulos en cinco categorías (Jugar 4, Competir 6, Construir
 * 4, Colección 6, Comunidad 6). En un teléfono la cuadrícula es de DOS
 * columnas, así que son trece filas de mosaicos más cinco separadores, y todo
 * eso va SIEMPRE desplegado. Lo que hay debajo —los próximos torneos, las
 * noticias— queda a dos pantallas de scroll de distancia.
 *
 * ── Lo que NO se rediseñó ────────────────────────────────────────────
 *
 * Los mosaicos. Siguen siendo el mismo `renderModulo` de siempre: el panel del
 * HUD con su inclinación 3D, sus marcas de esquina y su ícono octogonal. Esta
 * pieza es solo la TAPA — si además cambiara las casillas, no habría forma de
 * saber cuál de las dos cosas rompió algo.
 *
 * Y por eso la cabecera es un `HudPanel`, no un div con un borde: es la misma
 * chapa recortada que ya usan los módulos, con el mismo sándwich de dos capas
 * que hace falta porque `clip-path` se come el borde en la diagonal.
 *
 * ── Cómo se anima el alto sin animar el alto ─────────────────────────
 *
 * `height: auto` no se puede transicionar, y medir con JS obliga a leer
 * geometría del DOM en cada apertura. Se usa `grid-template-rows: 0fr → 1fr`,
 * que sí es interpolable: el hueco es una rejilla de una fila y el cuerpo va
 * con `overflow: hidden` y `min-height: 0`. Sin ese `min-height: 0` la fila no
 * baja de la altura de su contenido y no se cierra nada — es el detalle que
 * hace fallar este truco.
 *
 * Los mosaicos entran escalonados por CSS puro (`nth-child` con retardos), sin
 * envolver cada uno en un div: envolverlos rompería la cadena de `h-full` que
 * mantiene todas las casillas de una fila del mismo alto.
 *
 * ── Cerrada no es solo invisible ─────────────────────────────────────
 *
 * Con `0fr` + `overflow: hidden` los botones miden cero PERO siguen recibiendo
 * el tabulador: se navega con el teclado hacia adentro de una bahía cerrada y
 * el foco desaparece de la pantalla. Por eso el cuerpo lleva además
 * `visibility: hidden`, que sí los saca del orden de tabulación, con el
 * retardo justo para que se aplique cuando la animación terminó.
 */

import { useId, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { HudPanel, HexIcon } from '../../components/Hud'
import { HUD_TEXTO, type HudTone } from '../../components/hudTones'

interface Props {
  titulo: string
  /** El ícono de la categoría. El mismo lenguaje que las casillas. */
  icono: ReactNode
  tono: HudTone
  /** Cuántos módulos guarda. Se enseña cerrada: una tapa sin número es una caja. */
  cantidad: number
  abierta: boolean
  onAlternar: () => void
  children: ReactNode
}

export function BahiaModulos({
  titulo, icono, tono, cantidad, abierta, onAlternar, children,
}: Props) {
  const idCuerpo = useId()

  return (
    <div className="px-4 pt-2.5">
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierta}
        aria-controls={idCuerpo}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-swu-accent rounded-lg"
      >
        {/* `compact` para que el escalón de la esquina sea el chico: la
            cabecera mide 52 px y el recorte grande se le comería la mitad. */}
        <HudPanel tone={abierta ? tono : 'neutral'} compact glow={abierta}>
          <div className="flex items-center gap-2.5 py-2 pl-2 pr-3">
            {/* El ícono se ENCIENDE al abrir: es el estado, no un adorno.
                Cerrada va en neutro y sin resplandor, como un instrumento
                apagado. */}
            <HexIcon tone={abierta ? tono : 'neutral'} size={34}>{icono}</HexIcon>

            <span className={`flex-1 font-mono text-[10px] uppercase tracking-[0.35em]
                              transition-colors ${abierta ? HUD_TEXTO[tono] : 'text-swu-muted'}`}>
              {titulo}
            </span>

            {/* Tabular para que los números no bailen al abrir y cerrar. */}
            <span className="font-mono text-[11px] tabular-nums text-swu-muted">
              {String(cantidad).padStart(2, '0')}
            </span>

            <ChevronRight
              size={15}
              aria-hidden
              className={`flex-shrink-0 text-swu-muted transition-transform duration-200
                          ${abierta ? 'rotate-90' : ''}`}
              style={{ transitionProperty: 'transform' }}
            />
          </div>
        </HudPanel>
      </button>

      <div className="bahia-hueco" data-abierta={abierta}>
        <div id={idCuerpo} className="bahia-cuerpo">
          <div className="grid grid-cols-2 gap-3 pt-2.5 lg:grid-cols-3 xl:grid-cols-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

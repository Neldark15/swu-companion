/**
 * MarcoHud — el marco de la foto dibujado como un panel HUD.
 *
 * Sustituye al marco viejo (un borde con degradado y cuatro esquinitas) por el
 * lenguaje visual de una interfaz de nave: silueta octogonal con las esquinas
 * cortadas, doble línea, barras de neón en el centro de cada lado y remaches.
 *
 * ── Las tres restricciones que mandan sobre el diseño ────────────────
 *
 * 1. **Se dibuja DESDE 44 px.** La lista de Comunidad lo pinta a 44 y el perfil
 *    a 88. Un panel con el detalle de una referencia a 900 px se convierte en
 *    barro a 44. Por eso el detalle está ESCALONADO por nivel y las líneas
 *    finas se apagan solas en tamaños chicos (`denso`), en vez de dibujar
 *    adornos que a esa escala son ruido de un píxel.
 *
 * 2. **Vive en LISTAS.** Nada de `filter`/`feGaussianBlur`: un desenfoque por
 *    fila es de lo más caro que hay. El resplandor se finge con un trazo más
 *    ancho a baja opacidad debajo del trazo real — cuesta lo mismo que una
 *    línea y se ve como neón.
 *
 * 3. **El color NO puede ser el único portador de significado.** Los siete
 *    niveles se distinguen además por CUÁNTAS piezas tiene el panel: el de
 *    nivel 1 es un contorno pelado y el máximo lleva doble línea, barras,
 *    remaches y eco exterior. Se nota en blanco y negro.
 *
 * El SVG usa `viewBox` de 100×100, así que escala sin tocar números: todas las
 * medidas de abajo están en esas unidades, no en píxeles.
 */

/**
 * Corte de la esquina, en unidades del viewBox.
 *
 * Empezó en 18 y se bajó MIRÁNDOLO: a 18 la pieza deja de leerse como un panel
 * con los bordes biselados y pasa a leerse como un octágono —una señal de
 * tránsito—. A 12 el bisel se nota y la silueta sigue siendo la de un marco.
 */
const C = 12

/** La silueta: un cuadrado con las cuatro esquinas cortadas a 45°. */
const OCTAGONO = `M ${C} 0 L ${100 - C} 0 L 100 ${C} L 100 ${100 - C} L ${100 - C} 100 L ${C} 100 L 0 ${100 - C} L 0 ${C} Z`

/**
 * El mismo recorte para la FOTO, en porcentajes.
 *
 * Que la foto tome la silueta del panel es lo que hace que el marco se sienta
 * parte de la pieza y no una calcomanía encima de un cuadrado.
 */
export const RECORTE_HUD =
  `polygon(${C}% 0%, ${100 - C}% 0%, 100% ${C}%, 100% ${100 - C}%, ${100 - C}% 100%, ${C}% 100%, 0% ${100 - C}%, 0% ${C}%)`

export interface MarcoHudProps {
  /** 1..7 — cuánta maquinaria lleva el panel. */
  tier: number
  /** Color de la estructura. */
  borde: string
  /** Color del neón: barras, remaches y resplandor. */
  brillo: string
  /** Lado en px del marco ya renderizado. Decide si caben los detalles finos. */
  lado: number
  /** Respira (solo niveles altos). */
  animado?: boolean
}

export function MarcoHud({ tier, borde, brillo, lado, animado = false }: MarcoHudProps) {
  // Por debajo de ~64 px una línea de 1 unidad del viewBox mide medio píxel:
  // se ve como suciedad gris, no como un detalle. Ahí se apagan los adornos
  // finos y queda la estructura, que es lo que de verdad se lee.
  const denso = lado >= 64

  const conEsquinas = tier >= 2
  const conBarras = tier >= 3
  const conLineaInterna = tier >= 4 && denso
  const conRemaches = tier >= 5 && denso
  const conCircuito = tier >= 6 && denso
  const conEco = tier >= 7

  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
      /* `visibleFill` no: el trazo se sale medio ancho del viewBox y se
         recortaría contra el borde. `overflow: visible` lo deja respirar. */
      style={{ overflow: 'visible' }}
    >
      {/* Eco exterior — solo el marco máximo. Un segundo octágono apenas más
          grande sugiere un campo de energía sin costar un desenfoque. */}
      {conEco && (
        <path
          d={OCTAGONO}
          fill="none"
          stroke={brillo}
          strokeOpacity={0.22}
          strokeWidth={1.5}
          transform="translate(50 50) scale(1.09) translate(-50 -50)"
        />
      )}

      {/* Resplandor: el MISMO trazo, más ancho y translúcido, debajo del real.
          Es el truco que reemplaza al blur: cuesta una línea y se lee como neón. */}
      <path d={OCTAGONO} fill="none" stroke={brillo} strokeOpacity={tier >= 5 ? 0.3 : 0.18} strokeWidth={tier >= 5 ? 8 : 6} />

      {/* Estructura principal */}
      <path d={OCTAGONO} fill="none" stroke={borde} strokeWidth={3} strokeLinejoin="round" />

      {/* Segunda línea interior: la que da la sensación de «panel construido»
          en vez de «cuadro dibujado». */}
      {conLineaInterna && (
        <path
          d={OCTAGONO}
          fill="none"
          stroke={borde}
          strokeOpacity={0.55}
          strokeWidth={1}
          transform="translate(50 50) scale(0.88) translate(-50 -50)"
        />
      )}

      {/* Escuadras en las esquinas cortadas: refuerzan el bisel y son lo
          primero que distingue al nivel 2 del 1. */}
      {conEsquinas && (
        <g stroke={brillo} strokeWidth={3.5} strokeLinecap="round" fill="none">
          <path d={`M ${C - 5} 2.5 L ${C + 3} 2.5`} />
          <path d={`M ${100 - C - 3} 2.5 L ${100 - C + 5} 2.5`} />
          <path d={`M ${C - 5} 97.5 L ${C + 3} 97.5`} />
          <path d={`M ${100 - C - 3} 97.5 L ${100 - C + 5} 97.5`} />
          <path d={`M 2.5 ${C - 5} L 2.5 ${C + 3}`} />
          <path d={`M 2.5 ${100 - C - 3} L 2.5 ${100 - C + 5}`} />
          <path d={`M 97.5 ${C - 5} L 97.5 ${C + 3}`} />
          <path d={`M 97.5 ${100 - C - 3} L 97.5 ${100 - C + 5}`} />
        </g>
      )}

      {/* Barras de neón al centro de cada lado — la firma visual de la
          referencia y lo que hace que el marco «encienda».
          Van en DOS pasadas: una ancha y translúcida (el halo de la barra) y
          otra fina a tope de brillo encima. Dos líneas cuestan nada y dan el
          núcleo caliente que tiene un tubo de neón de verdad. */}
      {conBarras && (
        <>
          <g stroke={brillo} strokeOpacity={0.35} strokeWidth={9} strokeLinecap="round" fill="none">
            <path d="M 36 1.5 L 64 1.5" />
            <path d="M 36 98.5 L 64 98.5" />
            <path d="M 1.5 36 L 1.5 64" />
            <path d="M 98.5 36 L 98.5 64" />
          </g>
          <g stroke={brillo} strokeWidth={4} strokeLinecap="round" fill="none">
            <path d="M 36 1.5 L 64 1.5" />
            <path d="M 36 98.5 L 64 98.5" />
            <path d="M 1.5 36 L 1.5 64" />
            <path d="M 98.5 36 L 98.5 64" />
          </g>
        </>
      )}

      {/* Remaches: pares de marcas cortas flanqueando cada barra. Detalle de
          panel real; a tamaño chico se apagan (`denso`). */}
      {conRemaches && (
        <g stroke={borde} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.85}>
          <path d="M 30 1.5 L 34 1.5" /><path d="M 66 1.5 L 70 1.5" />
          <path d="M 30 98.5 L 34 98.5" /><path d="M 66 98.5 L 70 98.5" />
          <path d="M 1.5 30 L 1.5 34" /><path d="M 1.5 66 L 1.5 70" />
          <path d="M 98.5 30 L 98.5 34" /><path d="M 98.5 66 L 98.5 70" />
        </g>
      )}

      {/* Circuito: cuatro trazos cortos que entran desde el bisel hacia dentro.
          Insinúan conexiones sin llenar el marco de líneas ilegibles. */}
      {conCircuito && (
        <g stroke={brillo} strokeOpacity={0.5} strokeWidth={1.2} strokeLinecap="round" fill="none">
          <path d={`M ${C * 0.5} ${C * 0.5} L ${C * 0.5 + 7} ${C * 0.5 + 7}`} />
          <path d={`M ${100 - C * 0.5} ${C * 0.5} L ${100 - C * 0.5 - 7} ${C * 0.5 + 7}`} />
          <path d={`M ${C * 0.5} ${100 - C * 0.5} L ${C * 0.5 + 7} ${100 - C * 0.5 - 7}`} />
          <path d={`M ${100 - C * 0.5} ${100 - C * 0.5} L ${100 - C * 0.5 - 7} ${100 - C * 0.5 - 7}`} />
        </g>
      )}

      {/* La respiración toca SOLO opacidad (regla de rendimiento de las listas),
          y se detiene con `prefers-reduced-motion`. */}
      {animado && (
        <path
          d={OCTAGONO}
          fill="none"
          stroke={brillo}
          strokeWidth={2}
          className="animate-pulse motion-reduce:animate-none"
          strokeOpacity={0.45}
        />
      )}
    </svg>
  )
}

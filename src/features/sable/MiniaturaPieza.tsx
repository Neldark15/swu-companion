/**
 * La miniatura de una pieza, en la tarjeta.
 *
 * ── Sale del MISMO perfil que la malla 3D ─────────────────────────────
 *
 * No es un icono parecido dibujado al lado: es la silueta exacta de la pieza
 * torneada, porque una pieza girada 360° se ve de lado como su perfil espejado.
 * Así no hay forma de que la miniatura y el sable se separen — que es
 * exactamente lo que pasó con la tarjeta de jugador cuando había dos dibujos del
 * mismo dato (§2y).
 *
 * ── Y también el MISMO material ───────────────────────────────────────
 *
 * El color ya no se decide acá. Antes eran dos constantes —acero para emisor y
 * pomo, oscuro para el cuerpo— y con eso las diez empuñaduras del catálogo
 * salían del mismo gris en las tarjetas aunque en 3D una fuera de cuero y otra
 * de bronce. Ahora el relleno sale de `MATERIALES`, la misma tabla que alimenta
 * el PBR: si a una pieza se le cambia el material, la tarjeta cambia sola.
 *
 * ── Los herrajes que se VEN a este tamaño ─────────────────────────────
 *
 * A 46 px de alto no cabe un remache, pero sí una banda o una aleta. Se dibujan
 * solo los herrajes que de verdad se leen, y con el color de SU material: es lo
 * que distingue de un vistazo TRÍADA (tres aros de latón) de CINTURA (dos
 * vueltas de cuero), que en silueta pura se parecen bastante.
 */

import {
  siluetaDePieza, perfilDePieza, radioEn, asientoDe, materialDe,
} from './partesSable'

interface Props {
  tipo: 'emisor' | 'cuerpo' | 'pomo'
  id: string
  size?: number
  /** El color de la hoja, para los herrajes de material `luz`. */
  colorHoja?: string
}

export function MiniaturaPieza({ tipo, id, size = 46, colorHoja }: Props) {
  const alto = size
  const ancho = Math.round(size * 0.62)
  const d = siluetaDePieza(tipo, id, ancho, alto)
  const pieza = perfilDePieza(tipo, id)
  const mat = materialDe(pieza.material)

  const rMax = Math.max(...pieza.puntos.map(([r]) => r)) || 1
  const escalaX = (ancho / 2 - 1.5) / rMax
  const escalaY = (alto - 3) / pieza.alto
  const cx = ancho / 2
  const py = (y: number) => alto - 1.5 - y * escalaY

  return (
    <svg
      width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`}
      className="shrink-0" aria-hidden="true"
    >
      <path d={d} fill={mat.plano} stroke={mat.borde} strokeWidth="1" strokeLinejoin="round" />
      {pieza.herrajes.map((h, i) => {
        const y = h.y * pieza.alto
        const { fuera } = asientoDe(pieza.puntos, h, pieza.alto)
        const superficie = radioEn(pieza.puntos, y)
        const m = materialDe(h.material)
        const color = h.material === 'luz' ? (colorHoja ?? m.plano) : m.plano
        // Una banda más fina que medio píxel no se dibuja: a este tamaño no
        // agrega un aro, agrega una línea sucia sobre la silueta.
        const grueso = (fuera - superficie) * 2 * escalaY
        if (h.tipo === 'anillo' || h.tipo === 'cable') {
          if (grueso < 0.9) return null
          return (
            <rect
              key={i} x={cx - fuera * escalaX} y={py(y) - grueso / 2}
              width={fuera * 2 * escalaX} height={grueso}
              fill={color} opacity={h.tipo === 'cable' ? 0.85 : 1}
            />
          )
        }
        // Botones, gemas y aletas: se ven de PERFIL, o sea asomando por el
        // costado. Dibujarlos de frente los pondría donde no están.
        const sobresale = (fuera - superficie) * escalaX
        if (sobresale < 0.8) return null
        const largo = Math.max(
          1.4,
          (h.tipo === 'caja' || h.tipo === 'aleta' ? h.alto : h.radio * 2) * escalaY,
        )
        return (
          <rect
            key={i} x={cx + superficie * escalaX} y={py(y) - largo / 2}
            width={sobresale} height={largo} rx={h.tipo === 'gema' ? sobresale / 2 : 0.4}
            fill={color}
          />
        )
      })}
    </svg>
  )
}

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
 * ── El color dice de qué está hecha ───────────────────────────────────
 *
 * Acero para emisor y pomo, oscuro para la empuñadura: los mismos materiales que
 * en 3D. Si la miniatura fuera toda gris, la empuñadura de la tarjeta y la del
 * sable serían dos objetos distintos.
 */

import { siluetaDePieza } from './partesSable'

interface Props {
  tipo: 'emisor' | 'cuerpo' | 'pomo'
  id: string
  size?: number
}

export function MiniaturaPieza({ tipo, id, size = 46 }: Props) {
  const alto = size
  const ancho = Math.round(size * 0.62)
  const d = siluetaDePieza(tipo, id, ancho, alto)
  // La empuñadura es agarre, no metal — mismo criterio que los materiales 3D.
  const relleno = tipo === 'cuerpo' ? '#2b2e35' : '#aeb6c0'
  const borde = tipo === 'cuerpo' ? '#4a4f57' : '#e6ebf2'

  return (
    <svg
      width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`}
      className="shrink-0" aria-hidden="true"
    >
      <path d={d} fill={relleno} stroke={borde} strokeWidth="1" strokeLinejoin="round" />
    </svg>
  )
}

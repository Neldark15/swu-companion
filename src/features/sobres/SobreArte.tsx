/**
 * SobreArte — el sobre en sí, dibujado.
 *
 * ── Por qué es SVG y no una imagen ───────────────────────────────────
 *
 * Porque hay que mostrar seis a la vez y girarlos en 3D. Seis PNG a la
 * resolución que aguanta un acercamiento son cientos de kilobytes por una
 * pantalla que ya carga arte de cartas; y ampliar un PNG al levantar el sobre
 * lo deja borroso justo en el momento en que se está mirando de cerca. En SVG
 * pesa nada, se ve nítido a cualquier tamaño y el sello puede cambiar de color
 * por sobre sin generar seis archivos.
 *
 * El plateado NO es un degradado quieto: es una banda clara inclinada que se
 * mueve con `--px`, la misma variable que ya usa `Carta3D` para el brillo. Así
 * el sobre reacciona al dedo igual que las cartas, y no hace falta enseñar dos
 * lenguajes distintos.
 */

/** Las proporciones de un sobre de verdad: alto y angosto. */
export const ANCHO = 200
export const ALTO = 300

interface Props {
  /**
   * Qué sobre de la caja es. Decide el color del sello y la inclinación del
   * plateado: los seis se ven hermanos pero ninguno idéntico, que es lo que
   * hace que elegir uno signifique algo.
   */
  indice: number
  /** Un sello roto y el papel abierto, para cuando ya se rasgó. */
  abierto?: boolean
  className?: string
}

/** Los colores de sello. Seis, uno por sobre de la caja. */
const SELLOS = ['#DC2626', '#22D3EE', '#F59E0B', '#a78bfa', '#22C55E', '#FB7185']

/**
 * El borde dentado de arriba y abajo, como el prensado de un sobre real.
 * Se genera en vez de escribirse a mano para poder cambiar el paso sin
 * recontar picos.
 */
function dientes(y: number, alto: number): string {
  const paso = 10
  let d = `M 0 ${y}`
  for (let x = 0; x <= ANCHO; x += paso) {
    d += ` L ${x + paso / 2} ${y + alto} L ${x + paso} ${y}`
  }
  return d + ' Z'
}

export function SobreArte({ indice, abierto = false, className = '' }: Props) {
  const sello = SELLOS[indice % SELLOS.length]
  // Cada sobre lleva el plateado en otro ángulo. El 37 es primo respecto a 6,
  // así que los seis de la caja caen en inclinaciones distintas.
  const giro = (indice * 37) % 60 - 30
  const id = `sobre-${indice}`

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      className={className}
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      <defs>
        {/* El cuerpo: un metal oscuro con la luz cayendo de arriba. */}
        <linearGradient id={`${id}-cuerpo`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#31314a" />
          <stop offset="38%" stopColor="#22223a" />
          <stop offset="100%" stopColor="#131322" />
        </linearGradient>

        {/* La banda de plateado que recorre el sobre al inclinarlo. */}
        <linearGradient
          id={`${id}-lustre`}
          x1="0" y1="0" x2="1" y2="1"
          gradientTransform={`rotate(${giro} 0.5 0.5)`}
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="42%" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="58%" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* El halo del sello. */}
        <radialGradient id={`${id}-halo`}>
          <stop offset="0%" stopColor={sello} stopOpacity="0.55" />
          <stop offset="100%" stopColor={sello} stopOpacity="0" />
        </radialGradient>

        {/* Recorte del cuerpo: todo lo de adentro se queda adentro. */}
        <clipPath id={`${id}-recorte`}>
          <rect x="0" y="6" width={ANCHO} height={ALTO - 12} rx="6" />
        </clipPath>
      </defs>

      {/* Cuerpo */}
      <rect x="0" y="6" width={ANCHO} height={ALTO - 12} rx="6" fill={`url(#${id}-cuerpo)`} />

      <g clipPath={`url(#${id}-recorte)`}>
        {/* Rejilla tenue: da textura sin pesar. */}
        {Array.from({ length: 14 }, (_, i) => (
          <line
            key={i}
            x1="0" y1={20 + i * 20} x2={ANCHO} y2={20 + i * 20}
            stroke="#ffffff" strokeOpacity="0.03" strokeWidth="1"
          />
        ))}

        {/* Franja diagonal de color, la marca del sobre. */}
        <path
          d={`M -20 ${ALTO * 0.62} L ${ANCHO + 20} ${ALTO * 0.44} L ${ANCHO + 20} ${ALTO * 0.53} L -20 ${ALTO * 0.71} Z`}
          fill={sello}
          fillOpacity="0.16"
        />
        <path
          d={`M -20 ${ALTO * 0.62} L ${ANCHO + 20} ${ALTO * 0.44}`}
          stroke={sello}
          strokeOpacity="0.5"
          strokeWidth="1.5"
          fill="none"
        />

        {/* El emblema: un rombo dentro de un anillo partido. */}
        <g transform={`translate(${ANCHO / 2} ${ALTO * 0.34})`}>
          <circle r="46" fill={`url(#${id}-halo)`} />
          <circle r="34" fill="none" stroke={sello} strokeOpacity="0.7" strokeWidth="2"
            strokeDasharray="38 14" />
          <circle r="27" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1" />
          <path d="M 0 -19 L 15 0 L 0 19 L -15 0 Z" fill={sello} fillOpacity="0.85" />
          <path d="M 0 -19 L 15 0 L 0 19 L -15 0 Z" fill="none" stroke="#ffffff"
            strokeOpacity="0.45" strokeWidth="1" />
          <path d="M 0 -10 L 7 0 L 0 10 L -7 0 Z" fill="#ffffff" fillOpacity="0.55" />
        </g>

        {/* Las cinco marcas de abajo: una por carta. Sin texto: el sobre no
            dice lo que trae, ese es el punto. */}
        <g transform={`translate(${ANCHO / 2 - 34} ${ALTO * 0.79})`}>
          {[0, 1, 2, 3, 4].map(i => (
            <rect
              key={i}
              x={i * 17} y="0" width="11" height="15" rx="2"
              fill="#ffffff"
              fillOpacity={i === 4 ? 0.5 : 0.16}
              stroke={i === 4 ? sello : 'none'}
              strokeWidth="1"
            />
          ))}
        </g>

        {/* El plateado va ENCIMA de todo y se mueve con el dedo. */}
        <rect
          x="0" y="6" width={ANCHO} height={ALTO - 12}
          fill={`url(#${id}-lustre)`}
          style={{
            // La misma `--px` que usa Carta3D. Sin ella (sobre quieto) vale 0
            // y la banda se queda en el centro, que es como se ve un sobre
            // sobre la mesa.
            transform: 'translateX(calc(var(--px, 0) * 18%))',
            transformOrigin: 'center',
            transition: 'transform 220ms ease',
          }}
        />
      </g>

      {/* Prensado de arriba y abajo */}
      <path d={dientes(6, -6)} fill="#2a2a42" />
      <path d={dientes(ALTO - 6, 6)} fill="#2a2a42" />

      {/* Cuando ya se rasgó: el borde de arriba desaparece y queda la boca
          abierta con el papel doblado hacia afuera. */}
      {abierto && (
        <>
          <path d={`M 0 6 L ${ANCHO} 6 L ${ANCHO} 34 L 0 26 Z`} fill="#0d0d18" />
          <path d={`M 0 26 L ${ANCHO} 34`} stroke={sello} strokeOpacity="0.6" strokeWidth="2" />
        </>
      )}

      {/* Canto */}
      <rect
        x="0.5" y="6.5" width={ANCHO - 1} height={ALTO - 13} rx="6"
        fill="none" stroke="#ffffff" strokeOpacity="0.12"
      />
    </svg>
  )
}

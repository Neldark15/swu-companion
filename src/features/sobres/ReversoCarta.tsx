/**
 * ReversoCarta — el dorso que se ve mientras la carta está boca abajo.
 *
 * No es el dorso del juego: es el de ESTE módulo, y por eso se dibuja acá en
 * vez de traer una imagen. Tiene que hacer dos cosas que una foto no puede:
 * teñirse del color de la rareza que viene (el anuncio sin espóiler) y
 * respirar mientras la carta espera.
 */

interface Props {
  /** El color de la rareza que hay del otro lado. */
  color: string
  /** Late y le pasa un barrido de luz: algo grande viene. */
  misterio?: boolean
}

export function ReversoCarta({ color, misterio = false }: Props) {
  return (
    <svg
      viewBox="0 0 286 400"
      className="h-full w-full"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="dorso-base" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#232338" />
          <stop offset="55%" stopColor="#16162a" />
          <stop offset="100%" stopColor="#0d0d18" />
        </linearGradient>
        <radialGradient id="dorso-nucleo">
          <stop offset="0%" stopColor={color} stopOpacity="0.85" />
          <stop offset="45%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <clipPath id="dorso-recorte">
          <rect x="0" y="0" width="286" height="400" rx="14" />
        </clipPath>
      </defs>

      <rect width="286" height="400" rx="14" fill="url(#dorso-base)" />

      <g clipPath="url(#dorso-recorte)">
        {/* Anillos concéntricos, como un blanco visto desde arriba. */}
        <g transform="translate(143 200)" opacity="0.5">
          {[132, 108, 84, 60].map((r, i) => (
            <circle
              key={r}
              r={r}
              fill="none"
              stroke={color}
              strokeOpacity={0.1 + i * 0.06}
              strokeWidth="1"
              strokeDasharray={i % 2 ? '5 9' : undefined}
            />
          ))}
        </g>

        {/* El núcleo, que es lo que se tiñe de la rareza. */}
        <circle cx="143" cy="200" r="120" fill="url(#dorso-nucleo)" />

        {/* Rombo central, el mismo del sobre: se lee como la misma familia. */}
        <g transform="translate(143 200)">
          <path d="M 0 -46 L 34 0 L 0 46 L -34 0 Z" fill="none" stroke={color}
            strokeOpacity="0.75" strokeWidth="2" />
          <path d="M 0 -24 L 18 0 L 0 24 L -18 0 Z" fill={color} fillOpacity="0.5" />
        </g>

        {/* Esquinas: cuatro escuadras, para que el dorso tenga orientación. */}
        {[
          [22, 22, 1, 1],
          [264, 22, -1, 1],
          [22, 378, 1, -1],
          [264, 378, -1, -1],
        ].map(([x, y, sx, sy], i) => (
          <path
            key={i}
            d={`M ${x} ${y + sy * 26} L ${x} ${y} L ${x + sx * 26} ${y}`}
            fill="none"
            stroke={color}
            strokeOpacity="0.4"
            strokeWidth="2"
          />
        ))}

        {/* El barrido del misterio. Es un <rect> que se desplaza: solo
            `transform`, nada que repintar. */}
        {misterio && (
          <rect
            className="dorso-barrido"
            x="-120" y="0" width="120" height="400"
            fill="#ffffff"
            fillOpacity="0.09"
            transform="skewX(-14)"
          />
        )}
      </g>

      <rect x="1" y="1" width="284" height="398" rx="14" fill="none"
        stroke={color} strokeOpacity="0.5" strokeWidth="2" />
    </svg>
  )
}

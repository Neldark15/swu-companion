/**
 * ProgressRing — completitud de colección de un vistazo.
 *
 * Ámbar es "progreso" en todo el sistema; al llegar al 100% pasa a verde,
 * que es la única vez que el color cambia de significado y por eso lleva
 * también el número al centro.
 *
 * El SVG es puramente decorativo (`aria-hidden`): el valor accesible va en el
 * texto del contenedor, que es lo que un lector de pantalla debe leer.
 */

export interface ProgressRingProps {
  /** 0-100. */
  pct: number
  /** Texto grande del centro. Por defecto, el porcentaje. */
  label?: string
  /** Texto chico debajo del centro. */
  sub?: string
  size?: number
  stroke?: number
  className?: string
}

export function ProgressRing({
  pct, label, sub, size = 96, stroke = 8, className = '',
}: ProgressRingProps) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0))
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const dash = (safe / 100) * circumference
  const done = safe >= 100

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(safe)}% completo${sub ? ` — ${sub}` : ''}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={stroke}
          className="stroke-swu-border"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          className={`transition-all duration-500 ${done ? 'stroke-swu-green' : 'stroke-swu-amber'}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className={`font-extrabold font-mono ${done ? 'text-swu-green' : 'text-swu-text'}`}
              style={{ fontSize: size * 0.24 }}>
          {label ?? `${Math.round(safe)}%`}
        </span>
        {sub && (
          <span className="text-swu-muted mt-0.5" style={{ fontSize: size * 0.11 }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  )
}

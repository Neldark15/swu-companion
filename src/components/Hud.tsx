/**
 * Hud — las piezas de la consola del Centro de Mando.
 *
 * ── Por qué los paneles se anidan ─────────────────────────────────────
 *
 * Las esquinas cortadas se hacen con `clip-path`, y `clip-path` recorta el
 * borde junto con todo lo demás: un `border` normal queda mordido justo en la
 * diagonal, que es donde más se nota. Por eso cada panel son DOS capas
 * recortadas con la misma forma: la de afuera pinta la línea, la de adentro
 * —separada 1px— pinta el relleno. Así la diagonal queda limpia.
 *
 * El color se pasa por `tone` y no por clases sueltas para que los módulos no
 * inventen paletas: los tonos son los que ya tiene la app.
 */

import type { ReactNode } from 'react'
import { HUD_LINEA as LINEA, HUD_RESPLANDOR as RESPLANDOR, HUD_TEXTO, type HudTone } from './hudTones'

export type { HudTone }


interface HudPanelProps {
  children: ReactNode
  tone?: HudTone
  /** Esquinas más chicas, para piezas compactas. */
  compact?: boolean
  /** Fondo interior. Por defecto la superficie de la app. */
  fill?: string
  className?: string
  glow?: boolean
}

export function HudPanel({
  children, tone = 'neutral', compact = false, fill = 'bg-swu-surface', className = '', glow = false,
}: HudPanelProps) {
  const clip = compact ? 'clip-hud-sm' : 'clip-hud'
  return (
    <div className={`${clip} ${LINEA[tone]} p-px ${glow ? RESPLANDOR[tone] : ''} ${className}`}>
      <div className={`${clip} ${fill} w-full h-full`}>{children}</div>
    </div>
  )
}

/**
 * Marcas de esquina del HUD. Puramente decorativas — van con `aria-hidden` y
 * `pointer-events-none` para no meterse ni en el foco ni en el táctil.
 */
export function HudCorners({ tone = 'cyan' }: { tone?: HudTone }) {
  const c = LINEA[tone].replace('/45', '/70')
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className={`absolute top-1.5 right-1.5 h-px w-4 ${c}`} />
      <div className={`absolute top-1.5 right-1.5 h-4 w-px ${c}`} />
      <div className={`absolute bottom-1.5 left-1.5 h-px w-4 ${c}`} />
      <div className={`absolute bottom-1.5 left-1.5 h-4 w-px ${c}`} />
    </div>
  )
}

interface HexIconProps {
  children: ReactNode
  tone?: HudTone
  /** Lado de la caja en px. */
  size?: number
  className?: string
}

/** Ícono dentro de un octágono con contorno del tono. Mismo truco de anidado. */
export function HexIcon({ children, tone = 'cyan', size = 44, className = '' }: HexIconProps) {
  return (
    <div
      className={`clip-oct ${LINEA[tone]} p-px flex-shrink-0 ${RESPLANDOR[tone]} ${className}`}
      style={{ width: size, height: size }}
    >
      <div className={`clip-oct w-full h-full bg-swu-bg flex items-center justify-center ${HUD_TEXTO[tone]}`}>
        {children}
      </div>
    </div>
  )
}

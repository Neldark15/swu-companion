/**
 * Chip — filtro o etiqueta de estado.
 *
 * Los `tone` son los del sistema y cada uno significa UNA cosa:
 *   amber = progreso · cyan = exploración · coral = buscadas · green = ofertas
 *
 * El color nunca es el único portador de significado: el chip siempre lleva
 * texto, y cuando es removible el aspa tiene etiqueta accesible.
 */

import { X } from 'lucide-react'

export type ChipTone = 'accent' | 'amber' | 'cyan' | 'coral' | 'green' | 'neutral'

const ACTIVE: Record<ChipTone, string> = {
  accent: 'bg-swu-accent/15 border-swu-accent/50 text-swu-accent',
  amber: 'bg-swu-amber/15 border-swu-amber/50 text-swu-amber',
  cyan: 'bg-swu-cyan/15 border-swu-cyan/50 text-swu-cyan',
  coral: 'bg-swu-coral/15 border-swu-coral/50 text-swu-coral',
  green: 'bg-swu-green/15 border-swu-green/50 text-swu-green',
  neutral: 'bg-swu-surface border-swu-border text-swu-text',
}

const IDLE = 'bg-swu-bg border-swu-border text-swu-muted hover:text-swu-text'

export interface ChipProps {
  children: React.ReactNode
  tone?: ChipTone
  active?: boolean
  onClick?: () => void
  /** Si viene, dibuja un aspa que dispara esto en vez de `onClick`. */
  onRemove?: () => void
  /** Etiqueta accesible del aspa, p. ej. "Quitar filtro Unidad". */
  removeLabel?: string
  title?: string
  className?: string
}

export function Chip({
  children, tone = 'accent', active = false,
  onClick, onRemove, removeLabel = 'Quitar', title, className = '',
}: ChipProps) {
  const base = `
    inline-flex items-center gap-1 rounded-full border px-2.5 py-1
    text-[11px] font-semibold transition-colors
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent
    ${active ? ACTIVE[tone] : IDLE} ${className}
  `

  if (onRemove) {
    return (
      <span className={base} title={title}>
        {children}
        {/* El área táctil es 24x24 (mínimo de WCAG 2.5.8) aunque el aspa se vea
            de 11px: con `p-0.5` medía 15x15 reales y es el ÚNICO modo de
            quitar un filtro individual. El margen negativo evita que el chip
            crezca por fuera. */}
        <button
          onClick={onRemove}
          aria-label={removeLabel}
          className="-my-1 -mr-1.5 w-6 h-6 rounded-full flex items-center justify-center
                     hover:bg-white/10 active:scale-90 transition-transform
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
        >
          <X size={11} aria-hidden />
        </button>
      </span>
    )
  }

  if (onClick) {
    return (
      <button onClick={onClick} title={title} aria-pressed={active} className={`${base} active:scale-95`}>
        {children}
      </button>
    )
  }

  return <span className={base} title={title}>{children}</span>
}

/**
 * Button — el botón de la app.
 *
 * Hasta ahora no existía: cada pantalla repetía a mano su propia cadena de
 * clases, así que dos botones "iguales" rara vez lo eran. Esto fija tamaño de
 * toque, foco visible y jerarquía en un solo lugar.
 *
 * Accesibilidad:
 * - `min-h-11` (44px) en todos los tamaños salvo `xs`: es el mínimo táctil.
 * - Anillo de foco visible siempre — no se apaga `outline` sin reemplazo.
 * - `loading` deshabilita y anuncia con `aria-busy`, sin cambiar el ancho.
 */

import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'xs' | 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-swu-accent text-white border-transparent hover:brightness-110',
  secondary:
    'bg-swu-surface text-swu-text border-swu-border hover:border-swu-accent/40',
  ghost:
    'bg-transparent text-swu-muted border-transparent hover:text-swu-text hover:bg-swu-surface',
  danger:
    'bg-swu-red/10 text-swu-red border-swu-red/30 hover:bg-swu-red/20',
}

const SIZES: Record<Size, string> = {
  xs: 'text-[11px] px-2.5 py-1 rounded-lg gap-1',
  sm: 'text-xs px-3 min-h-11 rounded-xl gap-1.5',
  md: 'text-sm px-4 min-h-11 rounded-xl gap-2',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  /** Ocupa todo el ancho disponible. */
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, block = false,
    className = '', children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`
        inline-flex items-center justify-center font-semibold border
        transition-colors active:scale-[0.98]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent focus-visible:ring-offset-2 focus-visible:ring-offset-swu-bg
        disabled:opacity-45 disabled:pointer-events-none
        ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''} ${className}
      `}
      {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

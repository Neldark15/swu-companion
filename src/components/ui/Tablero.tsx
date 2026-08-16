/**
 * TABLERO — el estilo de tabla de transmisión oficial.
 *
 * Sale de los paneles «Top 64 Meta» del Sector Qualifier: fondo oscuro con un
 * dejo de nebulosa, marco cian fino, esquinas superiores cortadas en ángulo, y
 * una cabecera en versalitas muy espaciadas. Es el look de un marcador en
 * pantalla grande, no el de una tabla de hoja de cálculo.
 *
 * Es un CONTENEDOR, no una tabla con columnas fijas: cada tabla que lo use
 * define su propia grilla adentro. Así el estilo es uno solo —el marco, el
 * fondo, el trato de la cabecera— y el contenido lo manda cada pantalla.
 *
 * Las filas se dibujan con `FilaTablero`, que reparte la nebulosa por encima
 * del fondo y alterna un velo tenue para que el ojo siga el renglón.
 */

import type { ReactNode } from 'react'

interface TableroProps {
  /** Va en la cabecera, en versalitas. Sin esto no hay cabecera. */
  titulo?: ReactNode
  /** A la derecha del título: un contador, una etiqueta, un rótulo de fase. */
  extra?: ReactNode
  children: ReactNode
  className?: string
}

export function Tablero({ titulo, extra, children, className = '' }: TableroProps) {
  return (
    <div
      className={`relative overflow-hidden border border-swu-cyan/30 bg-[#080b16] ${className}`}
      // Esquinas superiores cortadas, como los paneles del broadcast. Va inline
      // y no en una clase de Tailwind para que el polígono se lea de un vistazo.
      style={{ clipPath: 'polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)' }}
    >
      {/* El resplandor de nebulosa, arriba. `pointer-events-none` para no comer
          los clics de las filas. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 120% 60% at 50% 0%, rgba(56,120,200,0.20), transparent 60%)' }}
      />
      {titulo != null && (
        <div className="relative flex items-center justify-between gap-2 border-b border-swu-cyan/25 bg-swu-cyan/[0.06] px-3 py-2">
          <span className="text-[11px] font-black uppercase tracking-[0.25em] text-swu-cyan">{titulo}</span>
          {extra != null && <span className="text-[10px] font-mono text-swu-cyan/70">{extra}</span>}
        </div>
      )}
      <div className="relative">{children}</div>
    </div>
  )
}

interface FilaProps {
  children: ReactNode
  /** Barra de acento a la izquierda: para destacar podio o iniciativa. */
  acento?: string
  /** Vela la fila para el rayado cebra. */
  cebra?: boolean
  onClick?: () => void
  className?: string
}

export function FilaTablero({ children, acento, cebra, onClick, className = '' }: FilaProps) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={`relative flex w-full items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 text-left
        ${cebra ? 'bg-white/[0.02]' : ''} ${onClick ? 'transition-colors hover:bg-swu-cyan/[0.06]' : ''} ${className}`}
    >
      {acento && <span className={`absolute inset-y-0 left-0 w-[3px] ${acento}`} />}
      {children}
    </Comp>
  )
}

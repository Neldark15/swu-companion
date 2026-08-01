/**
 * SegmentedControl — elegir UNA opción entre pocas, siempre todas a la vista.
 *
 * Se usa para Todas/Tengo/Me falta/Repetidas y para alternar binder/lista.
 * A diferencia de un menú, no esconde las opciones: en una app donde los
 * filtros escondidos no se descubrían, eso es el punto.
 *
 * Es un `radiogroup` de verdad, así que las flechas del teclado funcionan
 * como espera un lector de pantalla.
 */

export interface SegmentOption<T extends string> {
  value: T
  label: string
  icon?: React.ReactNode
  /** Número al lado de la etiqueta (p. ej. cuántas faltan). */
  count?: number
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (v: T) => void
  /** Etiqueta accesible del grupo. */
  label: string
  className?: string
}

export function SegmentedControl<T extends string>({
  options, value, onChange, label, className = '',
}: SegmentedControlProps<T>) {
  const move = (dir: 1 | -1) => {
    const i = options.findIndex(o => o.value === value)
    const next = options[(i + dir + options.length) % options.length]
    if (next) onChange(next.value)
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex gap-1 p-1 rounded-xl bg-swu-bg border border-swu-border ${className}`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(1) }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
      }}
    >
      {options.map(o => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`
              flex-1 min-h-9 px-2 rounded-lg text-[11px] font-semibold
              inline-flex items-center justify-center gap-1 transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent
              ${active
                ? 'bg-swu-surface text-swu-text shadow-none'
                : 'text-swu-muted hover:text-swu-text'}
            `}
          >
            {o.icon}
            {o.label}
            {o.count !== undefined && (
              <span className={active ? 'text-swu-amber' : 'text-swu-muted/60'}>
                {o.count.toLocaleString()}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

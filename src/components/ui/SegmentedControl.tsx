import { useRef } from 'react'

/**
 * SegmentedControl — elegir UNA opción entre pocas, siempre todas a la vista.
 *
 * Se usa para Todas/Tengo/Me falta/Repetidas y para alternar binder/lista.
 * A diferencia de un menú, no esconde las opciones: en una app donde los
 * filtros escondidos no se descubrían, eso es el punto.
 *
 * Es un `radiogroup` de verdad, así que las flechas del teclado funcionan
 * como espera un lector de pantalla.
 *
 * Las opciones se reparten el ancho a partes iguales y **se recortan**: con
 * cuatro pestañas en un teléfono angosto, `flex-1` sin `min-w-0` no encoge y
 * la fila entera se sale de la pantalla. Que una etiqueta termine en «…» es
 * peor que nada solo si el icono no dice ya de qué se trata; que la fila
 * desborde rompe la pantalla completa.
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
  const groupRef = useRef<HTMLDivElement>(null)

  const move = (dir: 1 | -1) => {
    const i = options.findIndex(o => o.value === value)
    const nextIndex = (i + dir + options.length) % options.length
    const next = options[nextIndex]
    if (!next) return
    onChange(next.value)
    // El foco tiene que seguir a la selección: con roving tabindex, el botón
    // que lo tenía pasa a tabIndex=-1 al redibujar y el foco se caía al body,
    // así que la flecha siguiente ya no hacía nada.
    requestAnimationFrame(() => {
      groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[nextIndex]?.focus()
    })
  }

  return (
    <div
      ref={groupRef}
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
            // `min-w-0` va junto a `flex-1` y no es decorativo: sin él la caja
            // no puede encogerse por debajo de su contenido, así que con cuatro
            // opciones la fila DESBORDA por debajo de ~325px de ancho. El icono
            // y el contador se declaran `flex-shrink-0` para que lo que ceda
            // sea la etiqueta, que es lo único que se puede recortar sin
            // perder información (el icono ya la duplica).
            className={`
              flex-1 min-w-0 min-h-9 px-2 rounded-lg text-[11px] font-semibold
              inline-flex items-center justify-center gap-1 transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent
              ${active
                ? 'bg-swu-surface text-swu-text shadow-none'
                : 'text-swu-muted hover:text-swu-text'}
            `}
          >
            {o.icon && (
              <span className="flex-shrink-0 inline-flex items-center" aria-hidden>
                {o.icon}
              </span>
            )}
            {/* El `title` deja leer entera la etiqueta recortada. */}
            <span className="truncate min-w-0" title={o.label}>{o.label}</span>
            {o.count !== undefined && (
              <span className={`flex-shrink-0 ${active ? 'text-swu-amber' : 'text-swu-muted/60'}`}>
                {o.count.toLocaleString()}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

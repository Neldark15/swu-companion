import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { CardImage } from './CardImage'
import type { Card } from '../types'

/**
 * Buscador de una carta entre líderes o bases. Local, sin red.
 *
 * Vivía dentro de `RegistrarAmistosa`. Se saca acá porque la inscripción a un
 * torneo pide exactamente lo mismo —líder y base—, y copiarlo garantizaba que
 * los dos se fueran separando: el día que uno gane un filtro o un arreglo, el
 * otro no.
 */
export function ElegirCarta({
  etiqueta, opciones, valor, onElegir,
}: {
  etiqueta: string
  opciones: Card[]
  valor: Card | null
  onElegir: (c: Card | null) => void
}) {
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState(false)

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return opciones.slice(0, 40)
    return opciones
      .filter(c => `${c.name} ${c.subtitle ?? ''}`.toLowerCase().includes(t))
      .slice(0, 40)
  }, [q, opciones])

  if (valor) {
    return (
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-swu-muted">{etiqueta}</p>
        <div className="flex items-center gap-2 rounded-xl border border-swu-border bg-swu-bg p-2">
          <CardImage
            src={valor.imageUrl}
            alt=""
            className="h-10 w-14 shrink-0 rounded-md"
            orientacion={valor.type === 'Leader' || valor.type === 'Base' ? 'apaisada' : undefined}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-bold text-swu-text">{valor.name}</p>
            {valor.subtitle && (
              <p className="truncate text-[10px] text-swu-muted">{valor.subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => { onElegir(null); setQ(''); setAbierto(false) }}
            aria-label={`Quitar ${etiqueta}`}
            className="shrink-0 rounded-lg p-1.5 text-swu-muted hover:text-swu-text"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-swu-muted">{etiqueta}</p>
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-swu-muted" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setAbierto(true) }}
          onFocus={() => setAbierto(true)}
          placeholder={`Buscar ${etiqueta.toLowerCase()}…`}
          className="w-full rounded-xl border border-swu-border bg-swu-bg py-2 pl-8 pr-2 text-[13px] text-swu-text
                     placeholder:text-swu-muted focus:border-swu-accent focus:outline-none"
        />
      </div>
      {abierto && filtradas.length > 0 && (
        <ul className="mt-1 max-h-52 overflow-y-auto rounded-xl border border-swu-border bg-swu-surface">
          {filtradas.map(c => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => { onElegir(c); setAbierto(false); setQ('') }}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-swu-bg"
              >
                <CardImage src={c.imageUrl} alt="" className="h-8 w-11 shrink-0 rounded" orientacion="apaisada" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold text-swu-text">{c.name}</span>
                  {c.subtitle && <span className="block truncate text-[10px] text-swu-muted">{c.subtitle}</span>}
                </span>
                {typeof c.hp === 'number' && c.type === 'Base' && (
                  <span className="shrink-0 font-mono text-[11px] text-swu-muted">{c.hp}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

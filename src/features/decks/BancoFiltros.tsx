/**
 * Banco del panel de filtros del constructor (solo desarrollo).
 *
 * El constructor exige sesión y un mazo abierto. Acá el panel vive suelto,
 * con los aspectos del mazo simulados, para poder ver que las listas de
 * rasgos y palabras clave se llenan de verdad desde la base.
 */
import { useState } from 'react'
import { FiltrosBusqueda } from './FiltrosBusqueda'
import { SIN_FILTROS, contarActivos, type FiltrosAvanzados } from './filtrosAvanzados'

const MAZOS = [
  { nombre: 'Sin líder ni base', aspectos: [] as string[] },
  { nombre: 'Vigilancia + Heroísmo', aspectos: ['Vigilance', 'Heroism'] },
  { nombre: 'Agresividad + Maldad + Mando', aspectos: ['Aggression', 'Villainy', 'Command'] },
]

export function BancoFiltros() {
  const [f, setF] = useState<FiltrosAvanzados>(SIN_FILTROS)
  const [mazo, setMazo] = useState(1)

  return (
    <div className="min-h-screen space-y-4 bg-swu-bg p-5 text-swu-text">
      <div>
        <h1 className="text-lg font-bold">Filtros del constructor</h1>
        <p className="text-xs text-swu-muted">
          Solo desarrollo. Los rasgos y las palabras clave se leen de la base
          local — si salen vacíos, la base todavía se está descargando.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {MAZOS.map((m, i) => (
          <button
            key={m.nombre}
            onClick={() => setMazo(i)}
            className={`min-h-11 rounded-xl border px-3 text-xs font-bold ${
              mazo === i ? 'border-swu-accent bg-swu-accent/15' : 'border-swu-border bg-swu-surface'
            }`}
          >
            {m.nombre}
          </button>
        ))}
      </div>

      <div className="max-w-sm rounded-xl border border-swu-border bg-swu-surface/40 p-3">
        <FiltrosBusqueda valor={f} onCambio={setF} aspectosDelMazo={MAZOS[mazo].aspectos} />
      </div>

      <pre className="overflow-x-auto rounded-xl border border-swu-border bg-swu-bg p-3 font-mono text-[11px] text-swu-muted">
{JSON.stringify(f, null, 1)}
{'\n'}activos: {contarActivos(f)}
      </pre>
    </div>
  )
}

/**
 * Banco de la fila de mesa — /banco-mesa-fila (solo desarrollo)
 *
 * La fila con el nombre, la vida y los puestos es la superficie que MÁS se
 * toca durante un torneo de mesas, y vive detrás de una sesión de admin (el
 * panel) o de inscripción (el lobby). O sea que la única forma de verla era
 * estar en un torneo de verdad, con gente esperando.
 *
 * Acá se ve suelta, con los casos que importan: vida sin anotar, vida baja,
 * mesa cerrada, y un nombre largo. La escritura falla a propósito —no hay
 * sesión— y eso sirve: es el camino de vuelta atrás, que es el único que no
 * se puede probar tocando bonito.
 */

import { useState } from 'react'
import { ContadorVida } from './ContadorVida'
import type { AsientoMesa } from '../../services/mesasService'

const PUNTOS = [3, 2, 1, 0]

function asiento(nombre: string, vida: number | null, conCuenta = true): AsientoMesa {
  return {
    id: `banco-${nombre}`, event_id: 'e', round_id: 'r', mesa: 1,
    user_id: conCuenta ? 'u' : null, player_name: nombre,
    puesto: null, puntos: null, vida,
  }
}

const CASOS: Array<{ titulo: string; gente: AsientoMesa[]; bloqueada: boolean }> = [
  {
    titulo: 'Mesa de 4, jugando',
    bloqueada: false,
    gente: [
      asiento('Winnie', 30),
      asiento('Dario', 12),
      asiento('Roberto Dominguez', null, false),
      asiento('ElDaigo', 4),
    ],
  },
  {
    titulo: 'Mesa de 3, ya anotada (bloqueada)',
    bloqueada: true,
    gente: [asiento('Vara', 25), asiento('Viaud', 8), asiento('Jaime', 0)],
  },
]

export function BancoMesaFila() {
  const [error, setError] = useState('')

  return (
    <div className="min-h-screen bg-swu-bg p-4">
      <h1 className="mb-1 text-lg font-bold text-swu-text">La fila de mesa</h1>
      <p className="mb-4 text-xs text-swu-muted">
        Sin sesión: tocar ± cambia el número al instante y el servidor lo rechaza
        ~450 ms después — así se ve el camino de vuelta atrás.
      </p>

      {error && (
        <p className="mb-3 rounded-lg bg-swu-red/15 px-3 py-2 text-xs text-swu-red-texto">
          {error}
        </p>
      )}

      <div className="space-y-5">
        {CASOS.map(caso => (
          <div key={caso.titulo} className="rounded-2xl border border-swu-border bg-swu-surface p-3">
            <p className="mb-2 text-sm font-bold text-swu-text">{caso.titulo}</p>
            <div className="space-y-1.5">
              {caso.gente.map(j => (
                <div key={j.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-swu-text">
                      {j.player_name}
                      {!j.user_id && (
                        <span className="ml-1.5 font-mono text-[9px] uppercase text-swu-muted">sin cuenta</span>
                      )}
                    </p>
                    <ContadorVida asiento={j} bloqueada={caso.bloqueada} onError={setError} />
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    {caso.gente.map((_, i) => (
                      <button
                        key={i}
                        disabled={caso.bloqueada}
                        className="flex h-11 w-9 items-center justify-center rounded bg-swu-bg
                                   font-mono text-sm font-bold text-swu-muted disabled:opacity-40"
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 font-mono text-[10px] text-swu-muted">
              {caso.gente.map((_, i) => `${i + 1}.º = ${PUNTOS[i]}`).join(' · ')} puntos
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

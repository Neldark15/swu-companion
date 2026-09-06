/**
 * Banco del panel de mesas — /banco-mesa-fila (solo desarrollo)
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
import { ClasificacionResultante } from './MesasPanel'
import type { AsientoMesa, MesaArmada } from '../../services/mesasService'
import type { CloudStanding } from '../../services/tournamentCloud'

const PUNTOS = [3, 2, 1, 0]

function asiento(nombre: string, vida: number | null, conCuenta = true): AsientoMesa {
  return {
    id: `banco-${nombre}`, event_id: 'e', round_id: 'r', mesa: 1,
    /* El id va DERIVADO del nombre, no un `'u'` literal para todos: con un id
       compartido el cruce contra la clasificación no casa con nadie y el banco
       enseñaba «sin mesa» en las once filas — un banco que miente sobre lo que
       está probando es peor que no tenerlo. */
    user_id: conCuenta ? `u-${nombre}` : null, player_name: nombre,
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


/* ── La clasificación resultante, con los datos REALES del TWIN SUNS ──
 *
 * Ronda 2 del SWUXF2W, que es el único torneo de mesas cerrado que existe.
 * Los puestos son los que calcula la regla nueva (mesa 1 = la final, el resto
 * interlineado). Se incluye a propósito a alguien SIN CUENTA: por `user_id` a
 * secas ése cae en la casilla `null` y se le asigna la mesa de cualquiera. */

const TS_MESAS: MesaArmada[] = [
  { mesa: 1, anotada: true, jugadores: [
    asiento('Jbeltramirez', 10), asiento('iNelo', 7), asiento('Viaud', 0), asiento('Nelson', 0),
  ].map((a, i) => ({ ...a, mesa: 1, puesto: i + 1 })) },
  { mesa: 2, anotada: true, jugadores: [
    asiento('Vara', 12), asiento('Winnie', 5), asiento('Rokutenshi', 0), asiento('LuisG05', 0),
  ].map((a, i) => ({ ...a, mesa: 2, puesto: i + 1 })) },
  { mesa: 3, anotada: true, jugadores: [
    asiento('Lemaster89', 14), asiento('isuraji', 12), asiento('Coffeetech', 0, false),
  ].map((a, i) => ({ ...a, mesa: 3, puesto: i + 1 })) },
]

const TS_ORDEN = ['Jbeltramirez','iNelo','Viaud','Nelson','Lemaster89','Vara',
                  'Winnie','isuraji','Rokutenshi','Coffeetech','LuisG05']

const TS_STANDINGS: CloudStanding[] = TS_ORDEN.map((nombre, i) => ({
  id: `st-${nombre}`, event_id: 'e',
  user_id: nombre === 'Coffeetech' ? null : `u-${nombre}`,
  player_name: nombre, points: 0,
  match_wins: 0, match_losses: 0, match_draws: 0, game_wins: 0, game_losses: 0,
  byes: 0, omw_pct: 0, gw_pct: 0, dropped: false, seed: null, puesto: i + 1,
}))

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

      <div className="mb-5 rounded-2xl border border-swu-border bg-swu-surface p-3">
        <p className="mb-2 text-sm font-bold text-swu-text">
          La clasificación que queda al fijar (TWIN SUNS real)
        </p>
        <ClasificacionResultante activos={TS_STANDINGS} mesas={TS_MESAS} />
        <p className="mt-2 text-[11px] text-swu-muted">
          «Coffeetech» va sin cuenta a propósito: si el cruce fuera por <code>user_id</code>,
          se quedaría sin mesa o con la de otro.
        </p>
      </div>

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

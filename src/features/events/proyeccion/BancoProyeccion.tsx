/**
 * Banco de la proyección — /banco-proyeccion (solo desarrollo)
 *
 * ── Por qué existe ───────────────────────────────────────────────────
 *
 * Esta pantalla tiene ocho estados y cinco escalones de densidad, y en la vida
 * real solo se puede ver UNO: el que le toque al torneo que haya. Los otros
 * siete aparecen por primera vez en la tienda, encendidos en una pared,
 * delante de cuarenta personas, sin nadie que pueda tocarlos.
 *
 * Los estados que más importan son justamente los que nunca se ven
 * desarrollando: el torneo cerrado sin una sola fila, el reloj vencido, el
 * sorteo, la ronda entera anotada. Se siembran acá.
 *
 * No toca la base: los datos son inventados y no se escribe una fila. Los
 * torneos de verdad se miran en `/events/live/:code`.
 */

import { useState } from 'react'
import { Tablero } from './ProyeccionPage'
import type { DatosProyeccion } from './datos'
import type { CloudStanding } from '../../../services/tournamentCloud'
import type { MesaArmada } from '../../../services/mesasService'

const NOMBRES = [
  'Winnie', 'Dario', 'ElDaigo', 'Vara', 'Jaime', 'Viaud', 'Isura', 'JuanZforce',
  'Christian', 'Nelson', 'Luis', 'Lemaster89', 'Rokutenshi', 'Coffeetech',
  'iNelo', 'isuraji', 'LuisG05', 'Jbeltramirez', 'Satou02', 'Naun2000',
  'Rodorigo', 'Wayo', 'Allister', 'Roberto Dominguez', 'Ana Meléndez',
  'Ana Martínez', 'Ávila', 'Ñoño', 'Bruno', 'Karla', 'Mario', 'Nora',
  'Oscar', 'Pablo', 'Quique', 'Raúl', 'Sofía', 'Tito', 'Ulises', 'Vicky',
  'Wendy', 'Ximena', 'Yamil', 'Zoe',
  /* Hasta 56 para que el escenario de paginación PAGINE de verdad. Con 44
     justos, el escalón de 44 los mostraba a todos de una y la escena no probaba
     nada — una prueba que no prueba se parece muchísimo a una que pasa. */
  'Adrián', 'Beto', 'Cecilia', 'Diego', 'Emilio', 'Fátima', 'Gerardo',
  'Hilda', 'Ignacio', 'Julia', 'Kevin', 'Lucía',
]

const ESCENAS = [
  { id: 'tablero-11', rotulo: '11 · mesas, en juego' },
  { id: 'tablero-8', rotulo: '8 · el más grande' },
  { id: 'tablero-27', rotulo: '27 · tres columnas' },
  { id: 'tablero-40', rotulo: '40 · modo lleno' },
  { id: 'tablero-52', rotulo: '52 · pagina' },
  { id: 'suizo-12', rotulo: '12 · suizo, con BYE y disputa' },
  { id: 'reloj-poco', rotulo: 'reloj: quedan 40 s' },
  { id: 'reloj-vencido', rotulo: 'reloj: TIEMPO' },
  { id: 'cierre', rotulo: 'ronda entera anotada' },
  { id: 'sorteando', rotulo: 'sorteando' },
  { id: 'convocatoria', rotulo: 'convocatoria con lista' },
  { id: 'convocatoria-vacia', rotulo: 'convocatoria SIN nadie' },
  { id: 'final-puestos', rotulo: 'final con puestos' },
  { id: 'final-sin', rotulo: 'final sin puestos' },
  { id: 'final-vacio', rotulo: 'final sin nadie' },
  { id: 'cancelado', rotulo: 'cancelado' },
  { id: 'sin-senal', rotulo: 'sin señal' },
] as const

type Escena = typeof ESCENAS[number]['id']

export function BancoProyeccion() {
  const [escena, setEscena] = useState<Escena>('tablero-11')
  const [chica, setChica] = useState(false)

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {ESCENAS.map(e => (
          <button
            key={e.id}
            onClick={() => setEscena(e.id)}
            className={`rounded px-3 py-1.5 text-xs font-bold ${
              escena === e.id ? 'bg-swu-accent text-white' : 'bg-swu-surface text-swu-muted'
            }`}
          >
            {e.rotulo}
          </button>
        ))}
        <button
          onClick={() => setChica(c => !c)}
          className={`ml-auto rounded px-3 py-1.5 text-xs font-bold ${
            chica ? 'bg-swu-amber text-black' : 'bg-swu-surface text-swu-muted'
          }`}
        >
          {chica ? 'tele de 43"' : 'tele de 55"'}
        </button>
      </div>

      {/* El lienzo real, a escala, con proporción de tele. */}
      <div className="relative mx-auto overflow-hidden bg-swu-bg" style={{ width: 1280, height: 720 }}>
        <div style={{ width: 1920, height: 1080, transform: 'scale(0.6667)', transformOrigin: 'top left' }}>
          <div style={{ position: 'absolute', left: 96, top: 54, width: 1728, height: 972, transform: 'scale(1)' }}>
            <Tablero datos={sembrar(escena)} pantallaChica={chica} />
          </div>
        </div>
      </div>

      <p className="mx-auto mt-3 max-w-[1280px] text-xs text-swu-muted">
        Datos inventados. No toca la base. Los torneos de verdad van en
        <code className="mx-1 text-swu-amber">/events/live/:code</code>.
        El lienzo está a 2/3 — a tamaño real cada letra es 1,5× más grande que acá.
      </p>
    </div>
  )
}

/* ── La siembra ─────────────────────────────────────────────────────── */

function jugador(nombre: string, i: number, puntos?: number): CloudStanding {
  return {
    id: `s${i}`, event_id: 'e', user_id: null, player_name: nombre,
    points: puntos ?? Math.max(0, 9 - Math.floor(i / 2)),
    match_wins: 0, match_losses: 0, match_draws: 0,
    game_wins: 0, game_losses: 0, byes: 0,
    omw_pct: 0, gw_pct: 0, dropped: false, seed: i + 1, puesto: null,
  }
}

function gente(n: number): CloudStanding[] {
  return NOMBRES.slice(0, n).map((nom, i) => jugador(nom, i))
}

/** Sienta a la gente en mesas de 4 y 3, como lo hace el torneo de verdad. */
function mesasDe(std: CloudStanding[], anotadas: number): MesaArmada[] {
  const salida: MesaArmada[] = []
  let n = 0
  for (let i = 0; i < std.length; i += 4) {
    const trozo = std.slice(i, i + 4)
    if (!trozo.length) break
    n++
    salida.push({
      mesa: n,
      anotada: n <= anotadas,
      jugadores: trozo.map((s, j) => ({
        id: `m${s.id}`, event_id: 'e', round_id: 'r', mesa: n,
        user_id: null, player_name: s.player_name,
        puesto: n <= anotadas ? j + 1 : null,
        puntos: null,
        vida: n <= anotadas ? 0 : [25, 18, 7, 3][j % 4] ?? null,
      })),
    })
  }
  return salida
}

function base(): DatosProyeccion {
  return {
    estado: 'tablero',
    evento: {
      id: 'e', name: 'TWIN SUNS', code: 'SV07', status: 'active',
      tournament_type: 'mesas', max_rounds: 4, current_round: 2,
      round_timer_minutes: 50, round_timer_end: enMinutos(23),
      image_url: null, format: 'twin_suns', match_type: 'bo1',
    },
    logo: '/torneos/twin-suns.webp',
    standings: [], pairings: [], mesas: [], deMesas: true,
    mesasListas: 0, mesasTotal: 0, frescuraMs: 4000,
  }
}

function enMinutos(m: number): string {
  return new Date(Date.now() + m * 60_000).toISOString()
}

function sembrar(escena: Escena): DatosProyeccion {
  const d = base()

  const conMesas = (n: number, anotadas = 1) => {
    d.standings = gente(n)
    d.mesas = mesasDe(d.standings, anotadas)
    d.mesasTotal = d.mesas.length
    d.mesasListas = anotadas
    return d
  }

  switch (escena) {
    case 'tablero-11': return conMesas(11, 1)
    case 'tablero-8':  return conMesas(8, 0)
    case 'tablero-27': return conMesas(27, 3)
    case 'tablero-40': return conMesas(40, 5)
    case 'tablero-52': return conMesas(52, 6)

    case 'suizo-12': {
      d.deMesas = false
      d.evento = { ...d.evento!, tournament_type: 'swiss', name: 'Torneo semanal', code: 'SV12' }
      d.logo = '/torneos/premier.webp'
      d.standings = gente(12)
      d.pairings = [0, 2, 4, 6, 8, 10].map((i, k) => ({
        id: `p${k}`, round_id: 'r', event_id: 'e', table_number: k + 1,
        player1_id: null, player2_id: null, winner_id: null, score: null,
        reported_by: null, created_at: null,
        // La 1 anotada, la 2 en disputa, la 6 sin rival (BYE), el resto jugando.
        reported_at: k === 0 ? new Date().toISOString() : null,
        confirmed_by: null, confirmed_at: null,
        disputed_by: null, disputed_at: k === 1 ? new Date().toISOString() : null,
        player1_nombre: null, player2_nombre: null,
        player1_standing: `s${i}`,
        player2_standing: k === 5 ? null : `s${i + 1}`,
        winner_standing: null,
      }))
      d.mesasTotal = 6
      d.mesasListas = 2
      return d
    }

    case 'reloj-poco':
      conMesas(11, 1)
      d.evento = { ...d.evento!, round_timer_end: new Date(Date.now() + 40_000).toISOString() }
      return d

    case 'reloj-vencido':
      conMesas(11, 1)
      d.evento = { ...d.evento!, round_timer_end: new Date(Date.now() - 90_000).toISOString() }
      return d

    case 'cierre':
      conMesas(11, 3)
      d.estado = 'cierre-ronda'
      return d

    case 'sorteando':
      d.standings = gente(11)
      d.estado = 'sorteando'
      return d

    case 'convocatoria':
      d.standings = gente(14)
      d.estado = 'convocatoria'
      d.evento = { ...d.evento!, status: 'open', current_round: 0, round_timer_end: null }
      return d

    case 'convocatoria-vacia':
      d.estado = 'convocatoria'
      d.evento = { ...d.evento!, status: 'open', current_round: 0, round_timer_end: null }
      return d

    case 'final-puestos':
      d.standings = gente(11).map((s, i) => ({ ...s, puesto: i + 1 }))
      d.estado = 'final'
      d.evento = { ...d.evento!, status: 'finished', round_timer_end: null }
      return d

    case 'final-sin':
      d.standings = gente(11)
      d.estado = 'final'
      d.evento = { ...d.evento!, status: 'finished', round_timer_end: null }
      return d

    case 'final-vacio':
      d.estado = 'final'
      d.evento = { ...d.evento!, status: 'finished', current_round: 0, round_timer_end: null }
      return d

    case 'cancelado':
      d.estado = 'cancelado'
      d.evento = { ...d.evento!, status: 'cancelled', current_round: 0, round_timer_end: null }
      return d

    case 'sin-senal':
      conMesas(11, 1)
      d.frescuraMs = 420_000
      return d
  }
}

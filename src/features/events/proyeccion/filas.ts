/**
 * De lo que dice la base a lo que se dibuja en una fila.
 *
 * Vive aparte de `Directorio.tsx` por dos razones. La de forma: un módulo que
 * exporta componentes Y funciones rompe el Fast Refresh de Vite, y en este repo
 * ya hubo que hacer esta separación tres veces (§3w). La de fondo, que importa
 * más: acá está el CRUCE entre `tournament_standings` y `tournament_mesas`, que
 * es exactamente el sitio donde un tercio de la sala se puede volver invisible
 * sin un solo error. Suelto y puro, se puede probar.
 */

import type { CloudStanding, CloudPairing } from '../../../services/tournamentCloud'
import type { MesaArmada } from '../../../services/mesasService'
import { clavePersona } from './escalones'

/** Lo que se sabe de una persona para dibujar su renglón. */
export interface Fila {
  id: string
  player_name: string
  /** Número de mesa, o null si todavía no tiene. */
  mesa: number | null
  /** Qué pasa con su mesa. Decide el color de la chapa. */
  chapa: 'pendiente' | 'cerrada' | 'disputa' | 'libre' | 'fuera'
  puesto: number | null
  vida: number | null
}

/**
 * Una mesa está CERRADA cuando su resultado ya se anotó.
 *
 * ── Por qué `reported_at` y no `confirmed_at` ────────────────────────
 *
 * Lo natural sería mirar `confirmed_at`, que es la columna que suena a
 * definitiva. Está MEDIDO contra los torneos reales y no sirve:
 *
 *     SV150826   12 pareos · 12 reportados · 0 confirmados   (torneo TERMINADO)
 *     SV290826   24 pareos · 24 reportados · 12 confirmados
 *
 * `confirmed_at` lo escribe `confirmPairingResult`, que solo se llama desde la
 * vista del jugador: exige que el RIVAL abra la app y confirme. Con un tercio
 * de la sala sin cuenta, eso no pasa — y el torneo del 15 de agosto habría
 * mostrado «MESAS 0/4» toda la tarde con todos los resultados adentro.
 *
 * Lo que la sala quiere saber cuando pregunta «¿ya casi terminamos?» es si el
 * resultado está anotado, y eso es `reported_at`. `disputed_at` lo REABRE:
 * una mesa en disputa no terminó.
 */
export function mesaCerrada(p: CloudPairing): boolean {
  if (p.disputed_at && !p.confirmed_at) return false
  // Sin rival no hay partida que jugar: cuenta cerrada desde el principio.
  if (!p.player2_standing) return true
  return p.reported_at !== null
}

/**
 * Las filas de un torneo DE MESAS.
 *
 * Cruza por `clavePersona` y no por `user_id`: `tournament_mesas` no tiene
 * clave foránea contra `tournament_standings` y un tercio de la sala juega sin
 * cuenta — por `user_id` todos esos caen en la misma casilla `null` del Map y
 * se les asigna la mesa de cualquiera.
 */
export function filasDeMesas(standings: CloudStanding[], mesas: MesaArmada[]): Fila[] {
  const porClave = new Map<string, { mesa: number; anotada: boolean; vida: number | null; puesto: number | null }>()
  for (const m of mesas) {
    for (const j of m.jugadores) {
      porClave.set(clavePersona(j.user_id, j.player_name), {
        mesa: m.mesa, anotada: m.anotada, vida: j.vida, puesto: j.puesto,
      })
    }
  }

  return standings
    .filter(s => !s.dropped)
    .map(s => {
      const a = porClave.get(clavePersona(s.user_id, s.player_name))
      return {
        id: s.id,
        player_name: s.player_name,
        mesa: a?.mesa ?? null,
        chapa: (a ? (a.anotada ? 'cerrada' : 'pendiente') : 'fuera') as Fila['chapa'],
        puesto: a?.puesto ?? null,
        vida: a?.vida ?? null,
      }
    })
}

/**
 * Las filas de un torneo suizo o de eliminación.
 *
 * El BYE se decide por `player2_standing`, JAMÁS por `player2_id`: un invitado
 * tiene lo primero y no lo segundo, y confundirlos es exactamente lo que
 * dibujaba como BYE —resuelta 2-0— una partida que había que jugar.
 */
export function filasDePareos(standings: CloudStanding[], pairings: CloudPairing[]): Fila[] {
  const porStanding = new Map<string, { mesa: number | null; chapa: Fila['chapa'] }>()

  for (const p of pairings) {
    const chapa: Fila['chapa'] =
      p.disputed_at && !p.confirmed_at ? 'disputa'
        : !p.player2_standing ? 'libre'
        : mesaCerrada(p) ? 'cerrada'
        : 'pendiente'

    if (p.player1_standing) porStanding.set(p.player1_standing, { mesa: p.table_number, chapa })
    if (p.player2_standing) porStanding.set(p.player2_standing, { mesa: p.table_number, chapa })
  }

  return standings
    .filter(s => !s.dropped)
    .map(s => {
      const a = porStanding.get(s.id)
      return {
        id: s.id,
        player_name: s.player_name,
        mesa: a?.mesa ?? null,
        /* Sin pareo en la ronda en curso: en eliminación eso significa que ya
           no está jugando. Sin este caso el directorio borraría en silencio a
           media sala desde la ronda 2. */
        chapa: a?.chapa ?? 'fuera',
        puesto: null,
        vida: null,
      }
    })
}

/**
 * TORNEOS — el archivo de lo que ya se jugó.
 *
 * El sistema de eventos de la app está hecho para llevar un torneo EN VIVO, y
 * cuando termina lo esconde: `getOfficialEvents` y `getEventByCode` filtran
 * `status in ('open','active')`, así que un torneo `finished` desaparece de
 * toda la app y solo se llega tecleando su código. Un torneo que se jugó es
 * justamente el que la gente quiere volver a mirar.
 *
 * ── El puesto manda sobre el cálculo ─────────────────────────────────
 *
 * `getStandings` ordena por `puntos → omw_pct → gw_pct → nombre`. Para un
 * torneo corrido EN la app eso está bien. Para uno cargado después, no: el
 * orden lo dictó la herramienta que se usó en la mesa.
 *
 * Caso real del 15/8: con los mismos resultados, la cadena estándar (OMW con
 * piso del 33 %) da Christian 2º y Challonge da Vara 2º. La diferencia entera
 * es que el piso le regala un 33,3 % al único 0-3 del torneo, y Christian fue
 * quien lo enfrentó.
 *
 * Por eso, si la fila trae `puesto`, ese manda. Los porcentajes que se muestran
 * siguen siendo los REALES calculados de las partidas — no se toca un número
 * para forzar un orden.
 */

import { supabase, isSupabaseReady } from './supabase'

export interface TorneoResumen {
  id: string
  code: string
  nombre: string
  descripcion: string | null
  fecha: string
  lugar: string | null
  formato: string
  tipo: string | null
  rondas: number | null
  jugadores: number
  /** Quién ganó, ya resuelto. Es el dato que se busca de un vistazo. */
  campeon: string | null
  fuente: string | null
  fuenteUrl: string | null
  desempate: string | null
}

export interface ClasificadoTorneo {
  puesto: number
  perfilId: string | null
  nombre: string
  puntos: number
  victorias: number
  derrotas: number
  empates: number
  juegosGanados: number
  juegosPerdidos: number
  omw: number
  gw: number
}

export interface PartidaTorneo {
  id: string
  ronda: number
  mesa: number | null
  /** Nombres ya resueltos: la fila guarda id O nombre suelto, nunca los dos. */
  jugadorA: string
  jugadorB: string
  perfilA: string | null
  perfilB: string | null
  marcador: string | null
  ganadorId: string | null
}

export interface TorneoCompleto {
  torneo: TorneoResumen
  clasificacion: ClasificadoTorneo[]
  partidas: PartidaTorneo[]
}

export type Resultado<T> = { ok: true; datos: T } | { ok: false; mensaje: string }

const CAMPOS_EVENTO =
  'id, code, name, description, date, location, format, tournament_type, max_rounds, ' +
  'fuente, fuente_url, desempate'

/* Los tipos generados de Supabase todavía no conocen `fuente`, `fuente_url` ni
 * `desempate` (recién migradas), así que PostgREST tipa la fila entera como
 * error. Se describe la forma cruda acá y se castea con `as unknown as`, que es
 * el patrón que ya usa tournamentCloud.ts para joins que el tipo no infiere. */
interface FilaEvento {
  id: string
  code: string
  name: string
  description: string | null
  date: string
  location: string | null
  format: string
  tournament_type: string | null
  max_rounds: number | null
  fuente: string | null
  fuente_url: string | null
  desempate: string | null
}

/**
 * Los torneos terminados, del más nuevo al más viejo.
 *
 * Se piden los standings de todos en UNA consulta y se agrupan acá, en vez de
 * una consulta por torneo. Con 1 torneo da igual; con 30 serían 31 viajes.
 */
export async function listarTorneos(): Promise<Resultado<TorneoResumen[]>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }

  const { data, error } = await supabase
    .from('official_events')
    .select(CAMPOS_EVENTO)
    .eq('status', 'finished')
    .order('date', { ascending: false })

  // Gotcha 2f: sin mirar `error`, una caída se ve igual que «no hay torneos».
  if (error) {
    console.warn('[torneos] no se pudieron listar:', error.message)
    return { ok: false, mensaje: 'No se pudieron cargar los torneos.' }
  }
  const eventos = (data ?? []) as unknown as FilaEvento[]
  if (!eventos.length) return { ok: true, datos: [] }

  const { data: clas, error: e2 } = await supabase
    .from('tournament_standings')
    .select('event_id, player_name, puesto, points, omw_pct, gw_pct')
    .in('event_id', eventos.map(e => e.id))

  if (e2) console.warn('[torneos] no se pudo leer la clasificación:', e2.message)

  const porEvento = new Map<string, { nombre: string; puesto: number | null; puntos: number }[]>()
  for (const c of clas ?? []) {
    const lista = porEvento.get(c.event_id) ?? []
    lista.push({ nombre: c.player_name, puesto: c.puesto, puntos: c.points })
    porEvento.set(c.event_id, lista)
  }

  return {
    ok: true,
    datos: eventos.map(e => {
      const lista = porEvento.get(e.id) ?? []
      // El campeón sale del puesto anunciado; si no hay, del que más puntos
      // hizo. Nunca se inventa: sin filas, queda en null.
      const orden = [...lista].sort((a, b) =>
        (a.puesto ?? 99) - (b.puesto ?? 99) || b.puntos - a.puntos)
      return {
        id: e.id,
        code: e.code,
        nombre: e.name,
        descripcion: e.description,
        fecha: e.date,
        lugar: e.location,
        formato: e.format,
        tipo: e.tournament_type,
        rondas: e.max_rounds,
        jugadores: lista.length,
        campeon: orden[0]?.nombre ?? null,
        fuente: e.fuente,
        fuenteUrl: e.fuente_url,
        desempate: e.desempate,
      }
    }),
  }
}

/** Un torneo entero: cabecera, clasificación y todas sus partidas. */
export async function verTorneo(code: string): Promise<Resultado<TorneoCompleto>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }

  const { data: ev, error } = await supabase
    .from('official_events')
    .select(CAMPOS_EVENTO)
    // El código se guarda en mayúsculas; normalizar acá evita que un enlace
    // compartido en minúsculas devuelva «no encontrado».
    .eq('code', code.trim().toUpperCase())
    .eq('status', 'finished')
    .maybeSingle()

  if (error) {
    console.warn('[torneos] no se pudo leer el torneo:', error.message)
    return { ok: false, mensaje: 'No se pudo cargar el torneo.' }
  }
  if (!ev) return { ok: false, mensaje: 'No existe un torneo con ese código.' }
  const evento = ev as unknown as FilaEvento

  const [{ data: clas, error: e2 }, { data: rondas, error: e3 }] = await Promise.all([
    supabase.from('tournament_standings')
      .select('user_id, player_name, puesto, points, match_wins, match_losses, match_draws, game_wins, game_losses, omw_pct, gw_pct')
      .eq('event_id', evento.id),
    supabase.from('tournament_rounds').select('id, round_number').eq('event_id', evento.id),
  ])
  if (e2 || e3) {
    console.warn('[torneos] clasificación o rondas:', e2?.message ?? e3?.message)
    return { ok: false, mensaje: 'No se pudo cargar la clasificación.' }
  }

  const numeroDeRonda = new Map((rondas ?? []).map(r => [r.id, r.round_number]))

  const { data: pares, error: e4 } = await supabase
    .from('tournament_pairings')
    .select('id, round_id, table_number, player1_id, player2_id, player1_nombre, player2_nombre, winner_id, score')
    .eq('event_id', evento.id)
  if (e4) console.warn('[torneos] no se pudieron leer las partidas:', e4.message)

  // Los nombres de quienes SÍ tienen cuenta no viajan en la fila de partidas:
  // se resuelven contra la clasificación, que ya los trae. Una consulta menos.
  const nombrePorPerfil = new Map<string, string>()
  for (const c of clas ?? []) if (c.user_id) nombrePorPerfil.set(c.user_id, c.player_name)
  const resolver = (id: string | null, suelto: string | null) =>
    (id ? nombrePorPerfil.get(id) : null) ?? suelto ?? 'Sin rival'

  const clasificacion: ClasificadoTorneo[] = (clas ?? [])
    .map((c, i) => ({
      puesto: c.puesto ?? i + 1,
      perfilId: c.user_id,
      nombre: c.player_name,
      puntos: c.points,
      victorias: c.match_wins,
      derrotas: c.match_losses,
      empates: c.match_draws,
      juegosGanados: c.game_wins,
      juegosPerdidos: c.game_losses,
      omw: c.omw_pct,
      gw: c.gw_pct,
    }))
    .sort((a, b) => a.puesto - b.puesto)

  const partidas: PartidaTorneo[] = (pares ?? [])
    .map(p => ({
      id: p.id,
      ronda: numeroDeRonda.get(p.round_id) ?? 0,
      mesa: p.table_number,
      jugadorA: resolver(p.player1_id, p.player1_nombre),
      jugadorB: resolver(p.player2_id, p.player2_nombre),
      perfilA: p.player1_id,
      perfilB: p.player2_id,
      marcador: p.score,
      ganadorId: p.winner_id,
    }))
    .sort((a, b) => a.ronda - b.ronda || (a.mesa ?? 99) - (b.mesa ?? 99))

  return {
    ok: true,
    datos: {
      torneo: {
        id: evento.id, code: evento.code, nombre: evento.name, descripcion: evento.description,
        fecha: evento.date, lugar: evento.location, formato: evento.format,
        tipo: evento.tournament_type, rondas: evento.max_rounds,
        jugadores: clasificacion.length,
        campeon: clasificacion[0]?.nombre ?? null,
        fuente: evento.fuente, fuenteUrl: evento.fuente_url, desempate: evento.desempate,
      },
      clasificacion,
      partidas,
    },
  }
}

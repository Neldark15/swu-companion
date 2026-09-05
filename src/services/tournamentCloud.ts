/**
 * Tournament Cloud Service — HOLOCRON SWU
 * Manages cloud-based tournaments via Supabase
 * Supports Swiss and Single Elimination formats
 */

import type { TipoTorneo } from './tipoTorneo'
import { supabase, isSupabaseReady } from './supabase'
import { generatePairings, suggestedRounds } from './swiss'
import {
  generateEliminationPairings,
  generateNextRoundPairings,
  eliminationRounds,
  type BracketPlayer,
} from './elimination'
import type { TournamentPlayer } from '../types'

// ─── Cloud Types ─────────────────────────────────────────────

export interface CloudStanding {
  id: string
  event_id: string
  /**
   * `null` para quien juega SIN CUENTA — y en la sala real es un tercio.
   *
   * Estuvo declarado como `string` a secas mientras la columna siempre admitió
   * null. Esa mentira es la razón de que el compilador jamás señalara el caso
   * del invitado: todo el motor de pareos llavea por este campo, y con el tipo
   * mintiendo, `Map.get(null)` y `id: null` pasaban sin una advertencia.
   */
  user_id: string | null
  player_name: string
  points: number
  match_wins: number
  match_losses: number
  match_draws: number
  game_wins: number
  game_losses: number
  byes: number
  omw_pct: number
  gw_pct: number
  dropped: boolean
  seed: number | null
  /** Puesto final. `null` mientras no se haya cerrado la clasificación. */
  puesto: number | null
}

export interface CloudPairing {
  id: string
  round_id: string
  event_id: string
  table_number: number | null
  /**
   * QUIÉN JUEGA: `tournament_standings.id`. Nunca null salvo BYE de verdad.
   *
   * Es distinto de `player1_id`, que dice QUÉ CUENTA puede reportar el
   * resultado. Un invitado tiene lo primero y no lo segundo — y confundirlos
   * es lo que hacía que el motor leyera «rival invitado» como «BYE» y
   * regalara la partida 2-0.
   */
  player1_standing: string | null
  player2_standing: string | null
  winner_standing: string | null
  /** QUÉ CUENTA. `null` para quien juega sin cuenta. Solo para permisos. */
  player1_id: string | null
  player2_id: string | null
  winner_id: string | null
  score: string | null
  reported_by: string | null
  reported_at: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  disputed_by: string | null
  disputed_at: string | null
  // Joined
  player1_name?: string
  player2_name?: string
}

export type BroadcastType =
  | 'pairing_set'         // Round pairings published
  | 'result_submitted'    // Player reported a score, waiting confirmation
  | 'result_confirmed'    // Score confirmed by opponent → standings updated
  | 'result_disputed'     // Opponent disputed
  | 'round_complete'      // All results in
  | 'tournament_finished' // Final standings
  | 'announcement'        // Admin-issued generic announcement (merch, news, etc.)

export interface TournamentBroadcast {
  id: string
  event_id: string | null
  event_name: string | null
  event_code: string | null
  type: BroadcastType
  message: string
  payload: Record<string, unknown>
  created_at: string
}

export interface CloudRound {
  id: string
  event_id: string
  round_number: number
  started_at: string
  completed_at: string | null
}

export interface CloudEvent {
  id: string
  name: string
  code: string
  status: string
  tournament_type: TipoTorneo
  max_rounds: number | null
  current_round: number
  round_timer_minutes: number
  round_timer_end: string | null
}

// ─── Initialize Tournament ──────────────────────────────────

export async function initializeTournament(
  eventId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  // Get event info
  const { data: event, error: evErr } = await supabase
    .from('official_events')
    .select('id, tournament_type, max_rounds')
    .eq('id', eventId)
    .single()

  if (evErr || !event) return { ok: false, error: 'Evento no encontrado' }

  // Get registrations with profile names
  const { data: regs, error: regErr } = await supabase
    .from('event_registrations')
    /* Sin el `profiles!fk(...)` embebido: esa clave foránea apunta a
       `auth.users`, no a `public.profiles`, así que PostgREST no podía
       resolver el enlace y la consulta ENTERA fallaba. El error caía en el
       `if (regErr || regs.length < 2)` de abajo y salía como «Se necesitan al
       menos 2 jugadores registrados» — con cinco inscritos. El nombre se
       resuelve aparte, unas líneas más abajo. */
    .select('user_id, leader_1, leader_2, base_carta')
    .eq('event_id', eventId)
    /* `checked_in` también entra. Con el filtro en 'registered' a secas, el
       día que se encienda el check-in TODO el que marque llegada desaparece
       de la clasificación — sin error y sin que nadie lo note hasta que falte
       gente en los pareos. Se excluye solo a quien se dio de baja. */
    .in('status', ['registered', 'checked_in'])

  if (regErr || !regs || regs.length < 2) {
    return { ok: false, error: 'Se necesitan al menos 2 jugadores registrados' }
  }

  // Calculate max rounds if not set
  let maxRounds = event.max_rounds
  if (!maxRounds) {
    maxRounds = event.tournament_type === 'elimination'
      ? eliminationRounds(regs.length)
      : suggestedRounds(regs.length)
  }

  const idsDeCuenta = [...new Set(regs.map(r => r.user_id as string))]
  const { data: perfiles } = await supabase
    .from('profiles').select('id, name').in('id', idsDeCuenta)
  const nombrePorId = new Map((perfiles ?? []).map(p => [p.id as string, p.name as string]))

  // Create standings for each player
  const standings = regs.map((r, idx) => {
    const profile = { name: nombrePorId.get(r.user_id as string) ?? '' }
    /* El mazo que la persona declaró al inscribirse viaja SOLO a la
       clasificación. Antes se transcribía a mano después del torneo,
       preguntándole uno por uno qué había jugado: los doce del 29/8 se
       cargaron así y uno quedó inventado porque nadie se acordaba.
       Los dos líderes se juntan con « + », que es como se lee un Twin Suns. */
    const lideres = [r.leader_1, r.leader_2].filter(Boolean) as string[]
    return {
      event_id: eventId,
      user_id: r.user_id,
      player_name: profile.name || `Jugador ${idx + 1}`,
      /* Cadena VACÍA y no `null`: las dos columnas son NOT NULL con `''` por
         defecto. Con `null`, el INSERT de la clasificación entera revienta —
         no la fila de quien no declaró mazo: TODAS—, y sembrar el torneo
         fallaba con dos personas sin mazo declarado. Encontrado ensayando la
         siembra contra la base antes de que Nel apretara el botón. */
      leader: lideres.length > 0 ? lideres.join(' + ') : '',
      base: (r.base_carta as string | null) ?? '',
      points: 0,
      match_wins: 0,
      match_losses: 0,
      match_draws: 0,
      game_wins: 0,
      game_losses: 0,
      byes: 0,
      omw_pct: 0,
      gw_pct: 0,
      dropped: false,
      seed: idx + 1,
    }
  })

  const { error: sErr } = await supabase
    .from('tournament_standings')
    .insert(standings)

  if (sErr) return { ok: false, error: `Error creando standings: ${sErr.message}` }

  // Update event status
  const { error: uErr } = await supabase
    .from('official_events')
    .update({
      status: 'active',
      current_round: 0,
      max_rounds: maxRounds,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)

  if (uErr) return { ok: false, error: uErr.message }

  return { ok: true }
}

// ─── Generate Swiss Pairings ────────────────────────────────

export async function generateSwissPairings(
  eventId: string,
  roundNum: number
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  // Get current standings (active players only)
  const { data: standings, error: sErr } = await supabase
    .from('tournament_standings')
    .select('*')
    .eq('event_id', eventId)
    .eq('dropped', false)

  if (sErr || !standings || standings.length < 2) {
    return { ok: false, error: 'No hay suficientes jugadores activos' }
  }

  /* TODO lo que sigue se llavea por `tournament_standings.id` y NO por
   * `user_id`.
   *
   * Con `user_id`, las filas de los invitados colapsan en la única clave
   * `null`: el `Set` de emparejados de `swiss.ts` marca al primero y a partir
   * de ahí da por emparejados a TODOS los demás. Medido sobre 8 jugadores con
   * 3 invitados: dos personas desaparecen de la ronda —sin mesa, sin bye y
   * sin un solo error—. Y el historial de rivales queda compartido, así que
   * evitar revanchas trata a todos los invitados como la misma persona.
   *
   * `swiss.ts` no se toca: nunca le importó qué SIGNIFICA el id, solo que sea
   * único. El fallo estaba acá, en lo que se le pasaba. */
  const { data: prevPairings } = await supabase
    .from('tournament_pairings')
    .select('player1_standing, player2_standing')
    .eq('event_id', eventId)

  // Build opponent map
  const opponentMap = new Map<string, string[]>()
  for (const s of standings) {
    opponentMap.set(s.id, [])
  }
  for (const p of prevPairings || []) {
    if (p.player1_standing && p.player2_standing) {
      opponentMap.get(p.player1_standing)?.push(p.player2_standing)
      opponentMap.get(p.player2_standing)?.push(p.player1_standing)
    }
  }

  /** De la fila de clasificación a la cuenta. Solo para poblar los permisos. */
  const cuentaDe = new Map<string, string | null>(standings.map(s => [s.id, s.user_id]))

  // Convert to TournamentPlayer format for swiss.ts
  const players: TournamentPlayer[] = standings.map(s => ({
    id: s.id,
    name: s.player_name,
    points: s.points,
    matchWins: s.match_wins,
    matchLosses: s.match_losses,
    matchDraws: s.match_draws,
    gameWins: s.game_wins,
    gameLosses: s.game_losses,
    byes: s.byes,
    opponentIds: opponentMap.get(s.id) || [],
  }))

  // Generate pairings using existing Swiss algorithm
  const pairings = generatePairings(players, true)

  // Create round
  const { data: round, error: rErr } = await supabase
    .from('tournament_rounds')
    .insert({ event_id: eventId, round_number: roundNum })
    .select()
    .single()

  if (rErr || !round) return { ok: false, error: `Error creando ronda: ${rErr?.message}` }

  // Insert pairings
  /* Ahora `p.player1Id`/`p.player2Id` son ids de CLASIFICACIÓN, así que
   * `player2Id === null` por fin significa lo único que debería significar:
   * no hay rival. Las columnas de cuenta se derivan, y quedan en null cuando
   * el jugador no tiene: escribir ahí un id de clasificación no daría error
   * —no hay FK que lo frene— y corrompería en silencio. */
  const dbPairings = pairings.map((p, idx) => {
    const esBye = p.player2Id === null
    return {
      round_id: round.id,
      event_id: eventId,
      table_number: idx + 1,
      player1_standing: p.player1Id,
      player2_standing: p.player2Id,
      winner_standing: esBye ? p.player1Id : null,
      player1_id: cuentaDe.get(p.player1Id) ?? null,
      player2_id: p.player2Id ? (cuentaDe.get(p.player2Id) ?? null) : null,
      winner_id: esBye ? (cuentaDe.get(p.player1Id) ?? null) : null,
      score: esBye ? '2-0' : null,
    }
  })

  const { error: pErr } = await supabase
    .from('tournament_pairings')
    .insert(dbPairings)

  if (pErr) return { ok: false, error: `Error creando emparejamientos: ${pErr.message}` }

  // Update event current round
  await supabase
    .from('official_events')
    .update({ current_round: roundNum, updated_at: new Date().toISOString() })
    .eq('id', eventId)

  await arrancarRelojDeRonda(eventId)

  // Auto-apply bye results to standings. `p.player1Id` ya es la FILA de
  // clasificación, así que un bye de alguien sin cuenta también se acredita.
  for (const p of pairings) {
    if (p.player2Id === null && p.player1Id) {
      await applyByeResult(p.player1Id)
    }
  }

  // Notify globally
  const ev = await getEventNameAndCode(eventId)
  await broadcast(
    eventId, ev.name, ev.code,
    'pairing_set',
    `Ronda ${roundNum} publicada — ${pairings.length} mesas`,
    { round: roundNum, tables: pairings.length }
  )

  return { ok: true }
}

// ─── Generate Elimination Bracket ───────────────────────────

export async function generateEliminationBracket(
  eventId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  // Get standings sorted by seed
  const { data: standings, error: sErr } = await supabase
    .from('tournament_standings')
    .select('*')
    .eq('event_id', eventId)
    .eq('dropped', false)
    .order('seed', { ascending: true })

  if (sErr || !standings || standings.length < 2) {
    return { ok: false, error: 'No hay suficientes jugadores' }
  }

  // Convert to BracketPlayer format — por FILA de clasificación, igual que el
  // suizo: con `user_id`, dos invitados son el mismo jugador para el cuadro.
  const cuentaDe = new Map<string, string | null>(standings.map(s => [s.id, s.user_id]))
  const bracketPlayers: BracketPlayer[] = standings.map(s => ({
    id: s.id,
    name: s.player_name,
    seed: s.seed || 1,
  }))

  // Generate seeded first round pairings
  const pairings = generateEliminationPairings(bracketPlayers)

  // Create round 1
  const { data: round, error: rErr } = await supabase
    .from('tournament_rounds')
    .insert({ event_id: eventId, round_number: 1 })
    .select()
    .single()

  if (rErr || !round) return { ok: false, error: `Error creando ronda: ${rErr?.message}` }

  // Insert pairings
  const dbPairings = pairings.map((p, idx) => {
    const ganador = p.isBye ? (p.player1Id || p.player2Id) : null
    return {
      round_id: round.id,
      event_id: eventId,
      table_number: idx + 1,
      player1_standing: p.player1Id,
      player2_standing: p.player2Id,
      winner_standing: ganador,
      player1_id: p.player1Id ? (cuentaDe.get(p.player1Id) ?? null) : null,
      player2_id: p.player2Id ? (cuentaDe.get(p.player2Id) ?? null) : null,
      winner_id: ganador ? (cuentaDe.get(ganador) ?? null) : null,
      score: p.isBye ? 'BYE' : null,
    }
  })

  const { error: pErr } = await supabase
    .from('tournament_pairings')
    .insert(dbPairings)

  if (pErr) return { ok: false, error: pErr.message }

  // Update event
  await supabase
    .from('official_events')
    .update({ current_round: 1, updated_at: new Date().toISOString() })
    .eq('id', eventId)

  await arrancarRelojDeRonda(eventId)

  // Notify globally
  const evMeta = await getEventNameAndCode(eventId)
  await broadcast(
    eventId, evMeta.name, evMeta.code,
    'pairing_set',
    `Bracket de eliminación publicado — ${dbPairings.length} mesas`,
    { round: 1, tables: dbPairings.length, format: 'elimination' }
  )

  return { ok: true }
}

// ─── Advance Elimination Round ──────────────────────────────

export async function advanceEliminationRound(
  eventId: string,
  currentRoundNum: number
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  // Get current round pairings
  const { data: currentPairings, error: cpErr } = await supabase
    .from('tournament_pairings')
    .select('*')
    .eq('event_id', eventId)
    .order('table_number', { ascending: true })

  if (cpErr || !currentPairings) return { ok: false, error: 'Error obteniendo emparejamientos' }

  // Filter to current round
  const { data: currentRound } = await supabase
    .from('tournament_rounds')
    .select('id')
    .eq('event_id', eventId)
    .eq('round_number', currentRoundNum)
    .single()

  if (!currentRound) return { ok: false, error: 'Ronda actual no encontrada' }

  const roundPairings = currentPairings.filter(p => p.round_id === currentRound.id)

  /* Se exige `winner_standing`, no `winner_id`.
   *
   * Con la columna de cuenta, una mesa GANADA POR UN INVITADO se veía como
   * «sin resultado» y el cuadro no podía avanzar nunca: el torneo quedaba
   * trabado con un error que decía «faltan resultados» sobre mesas ya
   * jugadas. */
  const incomplete = roundPairings.filter(p => !p.winner_standing)
  if (incomplete.length > 0) {
    return { ok: false, error: `Faltan ${incomplete.length} resultados por reportar` }
  }

  // Collect winners — por fila de clasificación, así avanza también un invitado.
  const winnerIds = roundPairings.map(p => p.winner_standing as string)

  // If only 1 winner, tournament is complete
  if (winnerIds.length <= 1) {
    await supabase
      .from('official_events')
      .update({ status: 'finished', updated_at: new Date().toISOString() })
      .eq('id', eventId)

    const evMeta = await getEventNameAndCode(eventId)
    await broadcast(
      eventId, evMeta.name, evMeta.code,
      'tournament_finished',
      `Torneo terminado — campeón coronado`,
      { winnerId: winnerIds[0] ?? null, format: 'elimination' }
    )

    return { ok: true }
  }

  // Generate next round pairings
  const nextRoundNum = currentRoundNum + 1
  const nextPairings = generateNextRoundPairings(winnerIds)

  // Mark current round complete
  await supabase
    .from('tournament_rounds')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', currentRound.id)

  // Create next round
  const { data: nextRound, error: nrErr } = await supabase
    .from('tournament_rounds')
    .insert({ event_id: eventId, round_number: nextRoundNum })
    .select()
    .single()

  if (nrErr || !nextRound) return { ok: false, error: nrErr?.message || 'Error' }

  /* Los ganadores que llegan acá ya son filas de clasificación (vienen de
   * `winner_standing`), así que hay que traducir a cuenta para las columnas
   * de permisos. */
  const { data: clasif } = await supabase
    .from('tournament_standings').select('id, user_id').eq('event_id', eventId)
  const cuentaDe = new Map<string, string | null>((clasif ?? []).map(c => [c.id, c.user_id]))

  // Insert next round pairings
  const dbPairings = nextPairings.map((p, idx) => {
    const ganador = p.isBye ? (p.player1Id || p.player2Id) : null
    return {
      round_id: nextRound.id,
      event_id: eventId,
      table_number: idx + 1,
      player1_standing: p.player1Id,
      player2_standing: p.player2Id,
      winner_standing: ganador,
      player1_id: p.player1Id ? (cuentaDe.get(p.player1Id) ?? null) : null,
      player2_id: p.player2Id ? (cuentaDe.get(p.player2Id) ?? null) : null,
      winner_id: ganador ? (cuentaDe.get(ganador) ?? null) : null,
      score: p.isBye ? 'BYE' : null,
    }
  })

  const { error: pErr } = await supabase
    .from('tournament_pairings')
    .insert(dbPairings)

  if (pErr) return { ok: false, error: pErr.message }

  // Update event
  await supabase
    .from('official_events')
    .update({ current_round: nextRoundNum, updated_at: new Date().toISOString() })
    .eq('id', eventId)

  await arrancarRelojDeRonda(eventId)

  return { ok: true }
}

/**
 * Publicar una ronda ARRANCA su reloj, en el mismo acto.
 *
 * Antes eran dos botones en dos pestañas distintas: generar los pareos y —si
 * te acordabas— ir a Timer y apretar 50/55/60. Medido: los tres torneos que
 * se jugaron de verdad tienen `round_timer_end` en NULL. Nadie lo usó nunca.
 *
 * El día que el organizador esté resolviendo una disputa se salta el segundo
 * botón, y el sistema no lo reporta. Un paso que hay que acordarse de dar es
 * un paso que un día no se da.
 *
 * Si el reloj falla NO se tumba la ronda: los pareos ya están publicados y eso
 * es lo que la gente necesita. Pero queda dicho.
 */
async function arrancarRelojDeRonda(eventId: string) {
  const { error } = await supabase.rpc('arrancar_reloj', { p_evento: eventId, p_minutos: null })
  if (error) console.warn('[torneo] la ronda salió pero el reloj no arrancó:', error.message)
}

// ─── Broadcast helpers (global tournament feed) ─────────────

/**
 * El aviso in-app: una fila en `tournament_broadcasts` que despierta a quien
 * tenga la app abierta.
 *
 * ── Por qué NO puede ser mudo ────────────────────────────────────────
 *
 * Estaba envuelto en un `try/catch` vacío, y supabase-js **no lanza** ante un
 * error de PostgREST (§2f): el `catch` no se ejecutaba nunca y el `error` no
 * se miraba jamás. Medido: la tabla tenía CERO filas después de cuatro rondas
 * generadas en vivo. O sea que este canal —el único que alcanza a quien no
 * tiene push, que son 2 de cada 3— no entregó un solo mensaje en su vida, y
 * desde afuera se veía exactamente igual que si funcionara.
 *
 * Sigue siendo best-effort: que falle el aviso no puede tumbar la ronda. Pero
 * ahora deja rastro.
 */
async function broadcast(
  eventId: string,
  eventName: string | null,
  eventCode: string | null,
  type: BroadcastType,
  message: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  const { error: bErr } = await supabase.from('tournament_broadcasts').insert({
    event_id: eventId,
    event_name: eventName,
    event_code: eventCode,
    type,
    message,
    payload,
  })
  if (bErr) console.warn('[torneo] el aviso in-app no se guardó:', bErr.message)

  // Fire-and-forget Web Push (server-side will reject if caller isn't admin
  // — that's intentional: only admin-driven events broadcast to all
  // participants via push. Player-driven events rely on in-app realtime toasts).
  if (type === 'pairing_set' || type === 'round_complete' || type === 'tournament_finished') {
    void firePushForBroadcast(eventId, eventName, eventCode, type, message, payload)
  }

  // El podio queda en el feed del hub como memoria permanente del grupo.
  // (Los broadcasts son efímeros; esto es lo que se ve al día siguiente.)
  if (type === 'tournament_finished') {
    void publishTournamentResultToFeed(eventId, eventName, payload)
  }
}

/**
 * Avisar que salieron las mesas — con push.
 *
 * `armarMesas` escribía la fila de `tournament_broadcasts` A MANO, y por eso
 * en un torneo de mesas no salía UN SOLO push: `firePushForBroadcast` vive
 * acá dentro y quien inserta directo se lo saltea. El toast in-app llegaba
 * solo a quien tuviera la app abierta en ese segundo exacto; al reabrirla no
 * había nada esperando, porque nunca se mandó.
 *
 * Se exporta esta puerta y no `broadcast` entera: desde afuera solo hace falta
 * anunciar mesas, y abrir el resto invitaría a mandar cualquier tipo desde
 * cualquier lado.
 */
export async function avisarMesasArmadas(
  eventId: string,
  eventName: string | null,
  eventCode: string | null,
  ronda: number,
  mesas: number,
): Promise<void> {
  await broadcast(eventId, eventName, eventCode, 'pairing_set',
    `Ya salieron las mesas de la ronda ${ronda}`.trim(), { ronda, mesas })
}

async function publishTournamentResultToFeed(
  eventId: string,
  eventName: string | null,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const uid = sessionData.session?.user?.id
    if (!uid) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, avatar')
      .eq('id', uid)
      .single()

    const podium = Array.isArray(payload.podium) ? (payload.podium as string[]) : []
    const champion = podium[0]
    const content = champion
      ? `Torneo "${eventName ?? 'SWU'}" terminado — campeón: ${champion}${podium.length > 1 ? ` · podio: ${podium.slice(0, 3).join(', ')}` : ''}`
      : `Torneo "${eventName ?? 'SWU'}" terminado`

    const { publishAutoPost } = await import('./communityService')
    await publishAutoPost({
      userId: uid,
      userName: (profile?.name as string) || 'Organizador',
      userAvatar: (profile?.avatar as string) || '🏆',
      type: 'tournament',
      content,
      metadata: { eventId, eventName, podium },
      dedupKey: `tournament:${eventId}`,
    })
  } catch {
    // silencioso
  }
}

async function firePushForBroadcast(
  eventId: string,
  eventName: string | null,
  eventCode: string | null,
  type: BroadcastType,
  message: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return

    // Round-complete / tournament-finished → push to all participants of the event
    // (the server resolves participants via eventId)
    const targets: { userIds?: string[]; eventId?: string; allSubscribers?: boolean } = {
      eventId,
    }

    await fetch('/api/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: eventName || 'HOLOCRON SWU',
        body: message,
        link: eventCode ? `/events/play/${eventCode}` : '/',
        tag: `tournament-${eventId}`,
        type,
        targets,
        meta: payload,
      }),
    })
  } catch {
    // silent — push is best-effort
  }
}

async function getEventNameAndCode(eventId: string): Promise<{ name: string | null; code: string | null }> {
  const { data } = await supabase
    .from('official_events')
    .select('name, code')
    .eq('id', eventId)
    .single()
  return { name: data?.name ?? null, code: data?.code ?? null }
}

// ─── Submit / Confirm / Dispute (player-driven flow) ─────────

/**
 * Player A submits the score. Marks reported_by + reported_at + score + winner_id
 * but does NOT touch standings yet — waits for opponent confirmation.
 * If the pairing has no opponent (bye), confirms automatically.
 */
export async function submitPairingResult(
  pairingId: string,
  /** La FILA de clasificación que ganó, no la cuenta. `null` = empate. */
  winnerStanding: string | null,
  score: string,        // "2-1"
  reporterId: string
): Promise<{ ok: boolean; needsConfirmation: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, needsConfirmation: false, error: 'Sin conexión' }

  const { data: pairing, error: pErr } = await supabase
    .from('tournament_pairings')
    .select('*, tournament_rounds!inner(event_id, round_number)')
    .eq('id', pairingId)
    .single()

  if (pErr || !pairing) return { ok: false, needsConfirmation: false, error: 'Emparejamiento no encontrado' }

  // Reporter must be one of the two players
  if (pairing.player1_id !== reporterId && pairing.player2_id !== reporterId) {
    return { ok: false, needsConfirmation: false, error: 'No participas en este emparejamiento' }
  }

  /* Bye → se resuelve solo. Se mira `player2_standing` y NO `player2_id`:
   * con la columna de cuenta, un rival INVITADO se leía como «no hay
   * oponente» y la mesa se cerraba sola sin jugarse. */
  if (!pairing.player2_standing) {
    return finalizeResult(pairingId, winnerStanding, score, reporterId, reporterId)
      .then(r => ({ ok: r.ok, needsConfirmation: false, error: r.error }))
  }

  // Already confirmed → re-submission not allowed
  if (pairing.confirmed_at) {
    return { ok: false, needsConfirmation: false, error: 'El resultado ya fue confirmado' }
  }

  // Store the submission (overwrites previous submission from same reporter)
  const { error: uErr } = await supabase
    .from('tournament_pairings')
    .update({
      winner_standing: winnerStanding,
      /* La columna de cuenta se DERIVA y queda null si ganó un invitado. Eso
       * está bien porque el empate ya no se lee de acá: se lee de
       * `winner_standing`. Antes se deducía de `winner_id === null` y, cuando
       * el que ganaba no tenía cuenta, el rival cobraba EMPATE por una
       * partida que había perdido. */
      winner_id: winnerStanding === pairing.player1_standing ? pairing.player1_id
               : winnerStanding === pairing.player2_standing ? pairing.player2_id
               : null,
      score,
      reported_by: reporterId,
      reported_at: new Date().toISOString(),
      // Clear any previous dispute when a fresh submission comes in
      disputed_by: null,
      disputed_at: null,
    })
    .eq('id', pairingId)

  if (uErr) return { ok: false, needsConfirmation: false, error: uErr.message }

  // Notify globally
  const round = pairing.tournament_rounds as unknown as { event_id: string; round_number: number }
  const { name: evName, code: evCode } = await getEventNameAndCode(round.event_id)
  await broadcast(
    round.event_id, evName, evCode,
    'result_submitted',
    `Resultado reportado en mesa ${pairing.table_number ?? '?'} — pendiente de confirmación`,
    {
      round: round.round_number,
      table: pairing.table_number,
      pairingId,
      score,
      winnerStanding,
      reporterId,
    }
  )

  return { ok: true, needsConfirmation: true }
}

/**
 * Player B confirms the result reported by player A.
 * Validates that confirmer is the opponent (not the same as reporter),
 * then finalizes standings + tiebreakers.
 */
export async function confirmPairingResult(
  pairingId: string,
  confirmerId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  const { data: pairing, error: pErr } = await supabase
    .from('tournament_pairings')
    .select('*')
    .eq('id', pairingId)
    .single()

  if (pErr || !pairing) return { ok: false, error: 'Emparejamiento no encontrado' }
  if (!pairing.reported_by) return { ok: false, error: 'No hay resultado para confirmar' }
  if (pairing.confirmed_at) return { ok: false, error: 'Ya está confirmado' }

  // Confirmer must be the OPPONENT of the reporter
  const isOpponent =
    (pairing.player1_id === confirmerId && pairing.reported_by === pairing.player2_id) ||
    (pairing.player2_id === confirmerId && pairing.reported_by === pairing.player1_id)
  if (!isOpponent) return { ok: false, error: 'Solo el oponente del reportador puede confirmar' }

  return finalizeResult(pairingId, pairing.winner_standing, pairing.score ?? '0-0', pairing.reported_by, confirmerId)
}

/**
 * Opponent disputes the reported result. Admin needs to resolve manually.
 * Clears the reported_* fields so they can be re-submitted, marks dispute.
 */
export async function disputePairingResult(
  pairingId: string,
  disputerId: string,
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  const { data: pairing, error: pErr } = await supabase
    .from('tournament_pairings')
    .select('*, tournament_rounds!inner(event_id, round_number)')
    .eq('id', pairingId)
    .single()

  if (pErr || !pairing) return { ok: false, error: 'Emparejamiento no encontrado' }
  if (pairing.confirmed_at) return { ok: false, error: 'Ya está confirmado, no puede disputarse' }

  // Disputer must be the OPPONENT of the reporter
  const isOpponent =
    (pairing.player1_id === disputerId && pairing.reported_by === pairing.player2_id) ||
    (pairing.player2_id === disputerId && pairing.reported_by === pairing.player1_id)
  if (!isOpponent) return { ok: false, error: 'Solo el oponente puede disputar' }

  const { error: uErr } = await supabase
    .from('tournament_pairings')
    .update({
      disputed_by: disputerId,
      disputed_at: new Date().toISOString(),
      // Don't clear reported_* yet — admin sees what was claimed vs disputed
    })
    .eq('id', pairingId)

  if (uErr) return { ok: false, error: uErr.message }

  const round = pairing.tournament_rounds as unknown as { event_id: string; round_number: number }
  const { name: evName, code: evCode } = await getEventNameAndCode(round.event_id)
  await broadcast(
    round.event_id, evName, evCode,
    'result_disputed',
    `Resultado disputado en mesa ${pairing.table_number ?? '?'} — requiere atención del admin`,
    {
      round: round.round_number,
      table: pairing.table_number,
      pairingId,
      disputerId,
      reason: reason ?? null,
    }
  )

  return { ok: true }
}

/**
 * Internal: applies the final result to standings + tiebreakers + broadcast.
 * Called by confirmPairingResult and reportResult (admin override) and bye auto-confirm.
 */
async function finalizeResult(
  pairingId: string,
  /** La FILA de clasificación que ganó. `null` = empate. Ver abajo. */
  winnerStanding: string | null,
  score: string,
  reporterId: string,
  confirmerId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: pairing, error: pErr } = await supabase
    .from('tournament_pairings')
    .select('*, tournament_rounds!inner(event_id, round_number)')
    .eq('id', pairingId)
    .single()

  if (pErr || !pairing) return { ok: false, error: 'Emparejamiento no encontrado' }

  const round = pairing.tournament_rounds as unknown as { event_id: string; round_number: number }
  const eventId = round.event_id

  // Mark confirmed
  const { error: uErr } = await supabase
    .from('tournament_pairings')
    .update({
      winner_standing: winnerStanding,
      // La cuenta se deriva; queda null si el que ganó no tiene. El empate ya
      // no se lee de acá (ver `isDraw` más abajo).
      winner_id: winnerStanding === pairing.player1_standing ? pairing.player1_id
               : winnerStanding === pairing.player2_standing ? pairing.player2_id
               : null,
      score,
      reported_by: reporterId,
      reported_at: pairing.reported_at ?? new Date().toISOString(),
      confirmed_by: confirmerId,
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', pairingId)

  if (uErr) return { ok: false, error: uErr.message }

  /* Se aplica por FILA de clasificación, no por cuenta: el lado invitado
   * tenía la columna en null, su `if` no entraba, y su fila se quedaba
   * congelada en ceros toda la noche sin un solo error. */
  const [s1, s2] = score.split('-').map(Number).map(n => n || 0)
  if (pairing.player1_standing) {
    await updatePlayerStanding(pairing.player1_standing, {
      isWinner: winnerStanding === pairing.player1_standing,
      isDraw: winnerStanding === null,
      gameWins: s1,
      gameLosses: s2,
    })
  }
  if (pairing.player2_standing) {
    await updatePlayerStanding(pairing.player2_standing, {
      isWinner: winnerStanding === pairing.player2_standing,
      isDraw: winnerStanding === null,
      gameWins: s2,
      gameLosses: s1,
    })
  }

  await recalculateTiebreakers(eventId)

  // Notify globally
  const { name: evName, code: evCode } = await getEventNameAndCode(eventId)
  await broadcast(
    eventId, evName, evCode,
    'result_confirmed',
    `Mesa ${pairing.table_number ?? '?'} — Ronda ${round.round_number}: ${score} confirmado`,
    {
      round: round.round_number,
      table: pairing.table_number,
      pairingId,
      score,
      winnerStanding,
      player1_id: pairing.player1_id,
      player2_id: pairing.player2_id,
    }
  )

  return { ok: true }
}

// ─── Player view helpers ─────────────────────────────────────

/**
 * Returns the user's pairing for the given round, or null if not paired
 * (not registered, eliminated, or no round yet).
 */
export async function getMyPairing(eventId: string, userId: string, roundNumber: number): Promise<CloudPairing | null> {
  if (!isSupabaseReady()) return null
  const { data: round } = await supabase
    .from('tournament_rounds')
    .select('id')
    .eq('event_id', eventId)
    .eq('round_number', roundNumber)
    .single()
  if (!round) return null

  const { data } = await supabase
    .from('tournament_pairings')
    .select('*')
    .eq('round_id', round.id)
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .maybeSingle()

  return (data as CloudPairing | null)
}

/**
 * Is this user a participant in the event?
 */
export async function isEventParticipant(eventId: string, userId: string): Promise<boolean> {
  if (!isSupabaseReady()) return false
  const { count } = await supabase
    .from('event_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('user_id', userId)
  return (count ?? 0) > 0
}

/**
 * Recent global broadcasts (any event). Used by non-participants who want a feed.
 */
export async function getRecentBroadcasts(limit = 20): Promise<TournamentBroadcast[]> {
  if (!isSupabaseReady()) return []
  const { data } = await supabase
    .from('tournament_broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data as TournamentBroadcast[] | null) ?? []
}

/**
 * Realtime: subscribe to ANY new global broadcast (used by NotificationHub
 * to surface toasts for non-participants).
 */
export function subscribeToBroadcasts(onNew: (b: TournamentBroadcast) => void): () => void {
  if (!isSupabaseReady()) return () => undefined
  const ch = supabase
    .channel('tournament-broadcasts-global')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'tournament_broadcasts' },
      (payload) => onNew(payload.new as TournamentBroadcast)
    )
    .subscribe()
  return () => { supabase.removeChannel(ch) }
}

// ─── Report Match Result (ADMIN OVERRIDE — bypasses confirmation) ─

/**
 * Direct write that finalizes immediately without confirmation.
 * Use for admin overrides (e.g., resolving a dispute, fixing a no-show).
 * For the normal player flow, use submitPairingResult + confirmPairingResult.
 */
/**
 * Reporta el resultado de una mesa.
 *
 * `winnerStanding` es la fila de `tournament_standings`, NO la cuenta: es la
 * única forma de decir «ganó el invitado». `null` es empate.
 */
export async function reportResult(
  pairingId: string,
  winnerStanding: string | null,
  score: string,
  reportedBy: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }
  return finalizeResult(pairingId, winnerStanding, score, reportedBy, reportedBy)
}

// ─── Advance Swiss Round ────────────────────────────────────

export async function advanceSwissRound(
  eventId: string,
  currentRoundNum: number
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  // Check all pairings in current round are complete
  const { data: currentRound } = await supabase
    .from('tournament_rounds')
    .select('id')
    .eq('event_id', eventId)
    .eq('round_number', currentRoundNum)
    .single()

  if (!currentRound) return { ok: false, error: 'Ronda actual no encontrada' }

  const { data: pairings } = await supabase
    .from('tournament_pairings')
    .select('winner_standing, player2_standing')
    .eq('round_id', currentRound.id)

  /* Una mesa está pendiente si TIENE rival y no tiene ganador. Con las
   * columnas de cuenta, una mesa con un invitado enfrente se contaba como bye
   * («no hay rival») y la ronda se daba por completa con partidas sin jugar. */
  const incomplete = (pairings || []).filter(p => p.player2_standing !== null && !p.winner_standing)
  if (incomplete.length > 0) {
    return { ok: false, error: `Faltan ${incomplete.length} resultados` }
  }

  // Mark current round complete
  await supabase
    .from('tournament_rounds')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', currentRound.id)

  // Broadcast round complete
  const evMetaRound = await getEventNameAndCode(eventId)
  await broadcast(
    eventId, evMetaRound.name, evMetaRound.code,
    'round_complete',
    `Ronda ${currentRoundNum} completada`,
    { round: currentRoundNum }
  )

  // Check if max rounds reached
  const { data: event } = await supabase
    .from('official_events')
    .select('max_rounds')
    .eq('id', eventId)
    .single()

  if (event && event.max_rounds && currentRoundNum >= event.max_rounds) {
    // Tournament finished
    await supabase
      .from('official_events')
      .update({ status: 'finished', updated_at: new Date().toISOString() })
      .eq('id', eventId)

    // Get top finisher for broadcast
    const { data: leaders } = await supabase
      .from('tournament_standings')
      .select('player_name, points')
      .eq('event_id', eventId)
      .order('points', { ascending: false })
      .limit(3)

    const podium = (leaders || []).map(l => l.player_name).filter(Boolean)
    await broadcast(
      eventId, evMetaRound.name, evMetaRound.code,
      'tournament_finished',
      podium.length > 0
        ? `Torneo terminado — Campeón: ${podium[0]}`
        : 'Torneo terminado',
      { format: 'swiss', podium }
    )

    return { ok: true }
  }

  // Generate next round
  const nextRound = currentRoundNum + 1
  return generateSwissPairings(eventId, nextRound)
}

// ─── Timer Control ──────────────────────────────────────────

/**
 * Arranca el reloj de la ronda.
 *
 * El plazo lo calcula la BASE (`now() + minutos`), no el navegador. Antes se
 * anclaba con `Date.now()` del aparato del organizador: si su teléfono iba
 * tres minutos adelantado, la ronda entera duraba tres minutos de menos para
 * todos los demás y nadie tenía cómo notarlo.
 */
export async function startRoundTimer(
  eventId: string,
  minutes: number
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  const { error } = await supabase.rpc('arrancar_reloj', {
    p_evento: eventId,
    p_minutos: minutes,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Estira la ronda. La suma parte de `greatest(fin, ahora)` en la base: sumarle
 * cinco minutos a un plazo vencido hace veinte dejaba el final EN EL PASADO, y
 * el organizador apretaba el botón cinco veces sin entender por qué el reloj
 * seguía en 00:00.
 */
export async function extendTimer(
  eventId: string,
  extraMinutes: number
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  const { error } = await supabase.rpc('estirar_reloj', {
    p_evento: eventId,
    p_minutos: extraMinutes,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function stopTimer(
  eventId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  const { error } = await supabase
    .from('official_events')
    .update({
      round_timer_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ─── Data Fetchers ──────────────────────────────────────────

export async function getStandings(eventId: string): Promise<CloudStanding[]> {
  if (!isSupabaseReady()) return []

  const { data, error } = await supabase
    .from('tournament_standings')
    .select('*')
    .eq('event_id', eventId)
    .order('points', { ascending: false })

  if (error || !data) return []

  // Sort with tiebreakers
  return data.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.omw_pct !== a.omw_pct) return b.omw_pct - a.omw_pct
    if (b.gw_pct !== a.gw_pct) return b.gw_pct - a.gw_pct
    return a.player_name.localeCompare(b.player_name)
  })
}

export async function getRoundPairings(
  eventId: string,
  roundNum: number
): Promise<CloudPairing[]> {
  if (!isSupabaseReady()) return []

  const { data: round } = await supabase
    .from('tournament_rounds')
    .select('id')
    .eq('event_id', eventId)
    .eq('round_number', roundNum)
    .single()

  if (!round) return []

  const { data: pairings, error } = await supabase
    .from('tournament_pairings')
    .select('*')
    .eq('round_id', round.id)
    .order('table_number', { ascending: true })

  if (error || !pairings) return []

  // Get player names from standings
  const { data: standings } = await supabase
    .from('tournament_standings')
    .select('id, player_name')
    .eq('event_id', eventId)

  /* El nombre sale de la FILA de clasificación.
   *
   * Con `user_id`, el nombre de un invitado quedaba en `null` y la pantalla
   * dibujaba «BYE» o «TBD» donde había una persona sentada. */
  const nameMap = new Map((standings || []).map(s => [s.id, s.player_name]))

  return pairings.map(p => ({
    ...p,
    player1_name: p.player1_standing ? nameMap.get(p.player1_standing) || 'Jugador' : null,
    player2_name: p.player2_standing ? nameMap.get(p.player2_standing) || 'Jugador' : null,
  }))
}

export async function getAllRounds(eventId: string): Promise<CloudRound[]> {
  if (!isSupabaseReady()) return []

  const { data, error } = await supabase
    .from('tournament_rounds')
    .select('*')
    .eq('event_id', eventId)
    .order('round_number', { ascending: true })

  if (error || !data) return []
  return data
}

export async function getEventTournamentInfo(code: string): Promise<CloudEvent | null> {
  if (!isSupabaseReady()) return null

  const { data, error } = await supabase
    .from('official_events')
    .select('id, name, code, status, tournament_type, max_rounds, current_round, round_timer_minutes, round_timer_end')
    .eq('code', code.toUpperCase())
    .single()

  if (error || !data) return null
  return data as CloudEvent
}

// ─── Drop Player ────────────────────────────────────────────

export async function dropPlayer(
  eventId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  const { error } = await supabase
    .from('tournament_standings')
    .update({ dropped: true })
    .eq('event_id', eventId)
    .eq('user_id', userId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ─── Finish Tournament ──────────────────────────────────────

/**
 * Cierra el torneo Y REPARTE las estadísticas.
 *
 * Antes esto solo hacía `update official_events set status='finished'`: nadie
 * daba XP, ni subía `tournaments_finished`, ni escribía `tournament_results`.
 * El torneo terminaba y en los perfiles no quedaba rastro — que es justo lo
 * que se notó tras el torneo de Sonsonate del 8/8.
 *
 * Y no se podía arreglar desde el cliente: las políticas de `player_stats` y
 * `tournament_results` son `auth.uid() = user_id`, así que el organizador solo
 * puede escribirse a SÍ MISMO. El intento del tracker local viejo lo demuestra
 * — recorría a todos los jugadores desde el aparato del organizador y los
 * updates ajenos afectaban 0 filas SIN error (PostgREST devuelve éxito con 0
 * filas) mientras los inserts rebotaban dentro de un `catch` vacío. En la base
 * quedó la prueba: de aquel torneo hay UNA fila de resultado, la del propio
 * organizador.
 *
 * Por eso el reparto vive en `cerrar_torneo()`, una función SECURITY DEFINER
 * que comprueba del lado del servidor que quien llama sea el organizador o un
 * admin, hace la transición `<> 'finished'` de forma atómica —llamarla dos
 * veces NO premia dos veces— y escribe todo en una sola transacción.
 */
export async function finishTournament(
  eventId: string
): Promise<{ ok: boolean; error?: string; premiados?: number; aviso?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  const { data, error } = await supabase.rpc('cerrar_torneo', { p_evento: eventId })

  if (error) return { ok: false, error: error.message }

  // La función devuelve su propio veredicto: `ok:false` con motivo cuando
  // quien llama no es el organizador o el torneo ya estaba cerrado.
  const r = data as { ok: boolean; error?: string; premiados?: number; aviso?: string } | null
  if (!r) return { ok: false, error: 'El servidor no respondió al cierre.' }
  if (!r.ok) return { ok: false, error: r.error ?? 'No se pudo cerrar el torneo.' }

  return { ok: true, premiados: r.premiados ?? 0, aviso: r.aviso }
}

// ─── Torneos que quedaron a medias ──────────────────────────

/** Un torneo vencido que necesita que alguien haga algo. */
export interface TorneoPendiente {
  id: string
  /** El panel del torneo se abre por CÓDIGO (/events/dashboard/:code), no por id. */
  code: string
  name: string
  date: string
  status: string
  inscritos: number
  clasificados: number
  premios_en: string | null
  /**
   * `faltan_resultados` — venció y NADIE cargó la clasificación. El torneo se
   *   jugó en la mesa y no quedó registro; hay que cargarlo o los inscritos no
   *   van a ver nada nunca.
   * `falta_repartir` — el cron ya lo cerró y hay clasificación, pero el XP y
   *   los puntos de ranking esperan que un admin los confirme.
   */
  motivo: 'faltan_resultados' | 'falta_repartir'
}

/**
 * Los dos tipos de pendiente, que piden acciones distintas.
 *
 * El cron (`/api/torneos-vencidos`) cierra los vencidos que TIENEN
 * clasificación y deja sin tocar los que no la tienen: cerrar un torneo vacío
 * lo entierra en «Finalizado» sin nada que mostrar. Esta consulta saca los dos
 * grupos para que el panel pueda pedir lo que falta en cada caso.
 */
export async function getTorneosPendientes(): Promise<TorneoPendiente[]> {
  if (!isSupabaseReady()) return []
  const { data, error } = await supabase.rpc('torneos_pendientes')
  if (error || !data) return []
  return data as TorneoPendiente[]
}

/**
 * Reparte XP, puntos de ranking y niveles de un torneo YA cerrado.
 *
 * Existe porque el cron cierra sin premiar: repartir premios es irreversible y
 * no debería pasar sin que nadie mire la clasificación. `premios_en` es el
 * cerrojo — la segunda llamada rebota con un motivo, no premia dos veces.
 */
export async function repartirPremios(
  eventId: string
): Promise<{ ok: boolean; error?: string; premiados?: number }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  const { data, error } = await supabase.rpc('repartir_premios', { p_evento: eventId })
  if (error) return { ok: false, error: error.message }

  const r = data as { ok: boolean; error?: string; premiados?: number } | null
  if (!r) return { ok: false, error: 'El servidor no respondió.' }
  if (!r.ok) return { ok: false, error: r.error ?? 'No se pudieron repartir los premios.' }

  return { ok: true, premiados: r.premiados ?? 0 }
}

// ─── Realtime Subscriptions ─────────────────────────────────

export function subscribeToEvent(
  eventId: string,
  callbacks: {
    onStandingsChange?: () => void
    onPairingsChange?: () => void
    onEventChange?: () => void
  }
) {
  const channels: ReturnType<typeof supabase.channel>[] = []

  if (callbacks.onStandingsChange) {
    const ch = supabase
      .channel(`standings-${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournament_standings', filter: `event_id=eq.${eventId}` },
        () => callbacks.onStandingsChange?.()
      )
      .subscribe()
    channels.push(ch)
  }

  if (callbacks.onPairingsChange) {
    const ch = supabase
      .channel(`pairings-${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournament_pairings', filter: `event_id=eq.${eventId}` },
        () => callbacks.onPairingsChange?.()
      )
      .subscribe()
    channels.push(ch)
  }

  if (callbacks.onEventChange) {
    const ch = supabase
      .channel(`event-${eventId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'official_events', filter: `id=eq.${eventId}` },
        () => callbacks.onEventChange?.()
      )
      .subscribe()
    channels.push(ch)
  }

  // Return unsubscribe function
  return () => {
    channels.forEach(ch => supabase.removeChannel(ch))
  }
}

// ─── Internal Helpers ───────────────────────────────────────

/**
 * Acredita un BYE. Recibe la FILA DE CLASIFICACIÓN, no la cuenta.
 *
 * Buscaba con `.eq('user_id', playerId)`, así que un bye de alguien sin cuenta
 * no acreditaba nada: la consulta no encontraba fila y salía por el `return`
 * en silencio. Por `id` siempre hay exactamente una.
 */
async function applyByeResult(standingId: string) {
  const { data: standing, error } = await supabase
    .from('tournament_standings')
    .select('*')
    .eq('id', standingId)
    .single()

  // §2f: sin mirar `error`, un bye que no se acredita se ve igual que uno que sí.
  if (error || !standing) {
    console.warn('[torneo] BYE sin acreditar, no se encontró la clasificación:', error?.message)
    return
  }

  await supabase
    .from('tournament_standings')
    .update({
      points: standing.points + 3,
      match_wins: standing.match_wins + 1,
      game_wins: standing.game_wins + 2,
      byes: standing.byes + 1,
    })
    .eq('id', standingId)
}

/**
 * Aplica un resultado a la clasificación. Recibe la FILA, no la cuenta.
 *
 * Filtraba por `user_id`, así que el lado invitado nunca recibía la victoria,
 * la derrota ni los juegos: su fila se quedaba congelada en ceros toda la
 * noche, sin un error.
 */
async function updatePlayerStanding(
  standingId: string,
  result: { isWinner: boolean; isDraw: boolean; gameWins: number; gameLosses: number }
) {
  const { data: standing } = await supabase
    .from('tournament_standings')
    .select('*')
    .eq('id', standingId)
    .single()

  if (!standing) return

  const update: Record<string, number> = {
    game_wins: standing.game_wins + result.gameWins,
    game_losses: standing.game_losses + result.gameLosses,
  }

  if (result.isWinner) {
    update.points = standing.points + 3
    update.match_wins = standing.match_wins + 1
  } else if (result.isDraw) {
    update.points = standing.points + 1
    update.match_draws = standing.match_draws + 1
  } else {
    update.match_losses = standing.match_losses + 1
  }

  await supabase
    .from('tournament_standings')
    .update(update)
    .eq('id', standingId)
}

async function recalculateTiebreakers(eventId: string) {
  // Get all standings
  const { data: standings } = await supabase
    .from('tournament_standings')
    .select('*')
    .eq('event_id', eventId)

  if (!standings) return

  /* Por FILA de clasificación. Con `user_id` se saltaba todo pareo donde
   * faltara la cuenta, así que el OMW% de quien enfrentó a un invitado se
   * calculaba sobre menos rivales de los que tuvo — un desempate mal contado
   * cambia el podio y nadie lo nota. */
  const { data: pairings } = await supabase
    .from('tournament_pairings')
    .select('player1_standing, player2_standing')
    .eq('event_id', eventId)

  if (!pairings) return

  // Build opponent map
  const opponentMap = new Map<string, string[]>()
  for (const s of standings) opponentMap.set(s.id, [])
  for (const p of pairings) {
    if (p.player1_standing && p.player2_standing) {
      opponentMap.get(p.player1_standing)?.push(p.player2_standing)
      opponentMap.get(p.player2_standing)?.push(p.player1_standing)
    }
  }

  const standingMap = new Map(standings.map(s => [s.id, s]))

  // Calculate tiebreakers for each player
  for (const s of standings) {
    const opponents = opponentMap.get(s.id) || []
    let omwTotal = 0
    let omwCount = 0

    for (const oppId of opponents) {
      const opp = standingMap.get(oppId)
      if (opp) {
        const rounds = opp.match_wins + opp.match_losses + opp.match_draws
        if (rounds > 0) {
          const raw = opp.points / (rounds * 3)
          omwTotal += Math.max(raw, 0.33)
        } else {
          omwTotal += 0.33
        }
        omwCount++
      }
    }

    const omwPct = omwCount > 0 ? Math.round((omwTotal / omwCount) * 100) / 100 : 0
    const totalGames = s.game_wins + s.game_losses
    const gwPct = totalGames > 0 ? Math.round((s.game_wins / totalGames) * 100) / 100 : 0

    await supabase
      .from('tournament_standings')
      .update({ omw_pct: omwPct, gw_pct: gwPct })
      // Por `id`: con `user_id` el update de un invitado afectaba 0 filas y
      // PostgREST devuelve éxito con 0 filas (§2u).
      .eq('id', s.id)
  }
}

/**
 * Tournament Cloud Service — HOLOCRON SWU
 * Manages cloud-based tournaments via Supabase
 * Supports Swiss and Single Elimination formats
 */

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
  user_id: string
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
}

export interface CloudPairing {
  id: string
  round_id: string
  event_id: string
  table_number: number | null
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
  tournament_type: 'swiss' | 'elimination'
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
    .select('user_id, profiles!event_registrations_user_id_fkey(name)')
    .eq('event_id', eventId)
    .eq('status', 'registered')

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

  // Create standings for each player
  const standings = regs.map((r, idx) => {
    const profile = r.profiles as unknown as { name: string } | null
    return {
      event_id: eventId,
      user_id: r.user_id,
      player_name: profile?.name || `Jugador ${idx + 1}`,
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

  // Get previous pairings to know opponent history
  const { data: prevPairings } = await supabase
    .from('tournament_pairings')
    .select('player1_id, player2_id')
    .eq('event_id', eventId)

  // Build opponent map
  const opponentMap = new Map<string, string[]>()
  for (const s of standings) {
    opponentMap.set(s.user_id, [])
  }
  for (const p of prevPairings || []) {
    if (p.player1_id && p.player2_id) {
      opponentMap.get(p.player1_id)?.push(p.player2_id)
      opponentMap.get(p.player2_id)?.push(p.player1_id)
    }
  }

  // Convert to TournamentPlayer format for swiss.ts
  const players: TournamentPlayer[] = standings.map(s => ({
    id: s.user_id,
    name: s.player_name,
    points: s.points,
    matchWins: s.match_wins,
    matchLosses: s.match_losses,
    matchDraws: s.match_draws,
    gameWins: s.game_wins,
    gameLosses: s.game_losses,
    byes: s.byes,
    opponentIds: opponentMap.get(s.user_id) || [],
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
  const dbPairings = pairings.map((p, idx) => ({
    round_id: round.id,
    event_id: eventId,
    table_number: idx + 1,
    player1_id: p.player1Id,
    player2_id: p.player2Id,
    winner_id: p.player2Id === null ? p.player1Id : null, // Auto-win for byes
    score: p.player2Id === null ? '2-0' : null,
  }))

  const { error: pErr } = await supabase
    .from('tournament_pairings')
    .insert(dbPairings)

  if (pErr) return { ok: false, error: `Error creando emparejamientos: ${pErr.message}` }

  // Update event current round
  await supabase
    .from('official_events')
    .update({ current_round: roundNum, updated_at: new Date().toISOString() })
    .eq('id', eventId)

  // Auto-apply bye results to standings
  for (const p of pairings) {
    if (p.player2Id === null && p.player1Id) {
      await applyByeResult(eventId, p.player1Id)
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

  // Convert to BracketPlayer format
  const bracketPlayers: BracketPlayer[] = standings.map(s => ({
    id: s.user_id,
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
  const dbPairings = pairings.map((p, idx) => ({
    round_id: round.id,
    event_id: eventId,
    table_number: idx + 1,
    player1_id: p.player1Id,
    player2_id: p.player2Id,
    winner_id: p.isBye ? (p.player1Id || p.player2Id) : null,
    score: p.isBye ? 'BYE' : null,
  }))

  const { error: pErr } = await supabase
    .from('tournament_pairings')
    .insert(dbPairings)

  if (pErr) return { ok: false, error: pErr.message }

  // Update event
  await supabase
    .from('official_events')
    .update({ current_round: 1, updated_at: new Date().toISOString() })
    .eq('id', eventId)

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

  // Check all matches have winners
  const incomplete = roundPairings.filter(p => !p.winner_id)
  if (incomplete.length > 0) {
    return { ok: false, error: `Faltan ${incomplete.length} resultados por reportar` }
  }

  // Collect winners
  const winnerIds = roundPairings.map(p => p.winner_id as string)

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

  // Insert next round pairings
  const dbPairings = nextPairings.map((p, idx) => ({
    round_id: nextRound.id,
    event_id: eventId,
    table_number: idx + 1,
    player1_id: p.player1Id,
    player2_id: p.player2Id,
    winner_id: p.isBye ? (p.player1Id || p.player2Id) : null,
    score: p.isBye ? 'BYE' : null,
  }))

  const { error: pErr } = await supabase
    .from('tournament_pairings')
    .insert(dbPairings)

  if (pErr) return { ok: false, error: pErr.message }

  // Update event
  await supabase
    .from('official_events')
    .update({ current_round: nextRoundNum, updated_at: new Date().toISOString() })
    .eq('id', eventId)

  return { ok: true }
}

// ─── Broadcast helpers (global tournament feed) ─────────────

/**
 * Fire-and-forget broadcast — inserts a row in tournament_broadcasts so any
 * client subscribed to the channel gets notified. Silent on failure.
 */
async function broadcast(
  eventId: string,
  eventName: string | null,
  eventCode: string | null,
  type: BroadcastType,
  message: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supabase.from('tournament_broadcasts').insert({
      event_id: eventId,
      event_name: eventName,
      event_code: eventCode,
      type,
      message,
      payload,
    })
  } catch {
    // best-effort, swallow
  }

  // Fire-and-forget Web Push (server-side will reject if caller isn't admin
  // — that's intentional: only admin-driven events broadcast to all
  // participants via push. Player-driven events rely on in-app realtime toasts).
  if (type === 'pairing_set' || type === 'round_complete' || type === 'tournament_finished') {
    void firePushForBroadcast(eventId, eventName, eventCode, type, message, payload)
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
  winnerId: string | null,
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

  // Bye → auto-resolve, no opponent to confirm
  if (!pairing.player2_id) {
    return finalizeResult(pairingId, winnerId, score, reporterId, reporterId)
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
      winner_id: winnerId,
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
      winnerId,
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

  return finalizeResult(pairingId, pairing.winner_id, pairing.score ?? '0-0', pairing.reported_by, confirmerId)
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
  winnerId: string | null,
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
      winner_id: winnerId,
      score,
      reported_by: reporterId,
      reported_at: pairing.reported_at ?? new Date().toISOString(),
      confirmed_by: confirmerId,
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', pairingId)

  if (uErr) return { ok: false, error: uErr.message }

  // Apply to standings
  const [s1, s2] = score.split('-').map(Number).map(n => n || 0)
  if (pairing.player1_id) {
    await updatePlayerStanding(eventId, pairing.player1_id, {
      isWinner: winnerId === pairing.player1_id,
      isDraw: winnerId === null,
      gameWins: s1,
      gameLosses: s2,
    })
  }
  if (pairing.player2_id) {
    await updatePlayerStanding(eventId, pairing.player2_id, {
      isWinner: winnerId === pairing.player2_id,
      isDraw: winnerId === null,
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
      winnerId,
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
export async function reportResult(
  pairingId: string,
  winnerId: string | null,
  score: string,
  reportedBy: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }
  return finalizeResult(pairingId, winnerId, score, reportedBy, reportedBy)
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
    .select('winner_id, player2_id')
    .eq('round_id', currentRound.id)

  const incomplete = (pairings || []).filter(p => p.player2_id !== null && !p.winner_id)
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

export async function startRoundTimer(
  eventId: string,
  minutes: number
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  const endTime = new Date(Date.now() + minutes * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('official_events')
    .update({
      round_timer_minutes: minutes,
      round_timer_end: endTime,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function extendTimer(
  eventId: string,
  extraMinutes: number
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  const { data: event } = await supabase
    .from('official_events')
    .select('round_timer_end')
    .eq('id', eventId)
    .single()

  if (!event?.round_timer_end) return { ok: false, error: 'No hay timer activo' }

  const currentEnd = new Date(event.round_timer_end)
  const newEnd = new Date(currentEnd.getTime() + extraMinutes * 60 * 1000)

  const { error } = await supabase
    .from('official_events')
    .update({
      round_timer_end: newEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)

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
    .select('user_id, player_name')
    .eq('event_id', eventId)

  const nameMap = new Map((standings || []).map(s => [s.user_id, s.player_name]))

  return pairings.map(p => ({
    ...p,
    player1_name: p.player1_id ? nameMap.get(p.player1_id) || 'Jugador' : null,
    player2_name: p.player2_id ? nameMap.get(p.player2_id) || 'Jugador' : null,
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

export async function finishTournament(
  eventId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  const { error } = await supabase
    .from('official_events')
    .update({ status: 'finished', updated_at: new Date().toISOString() })
    .eq('id', eventId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
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

async function applyByeResult(eventId: string, playerId: string) {
  const { data: standing } = await supabase
    .from('tournament_standings')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', playerId)
    .single()

  if (!standing) return

  await supabase
    .from('tournament_standings')
    .update({
      points: standing.points + 3,
      match_wins: standing.match_wins + 1,
      game_wins: standing.game_wins + 2,
      byes: standing.byes + 1,
    })
    .eq('event_id', eventId)
    .eq('user_id', playerId)
}

async function updatePlayerStanding(
  eventId: string,
  playerId: string,
  result: { isWinner: boolean; isDraw: boolean; gameWins: number; gameLosses: number }
) {
  const { data: standing } = await supabase
    .from('tournament_standings')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', playerId)
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
    .eq('event_id', eventId)
    .eq('user_id', playerId)
}

async function recalculateTiebreakers(eventId: string) {
  // Get all standings
  const { data: standings } = await supabase
    .from('tournament_standings')
    .select('*')
    .eq('event_id', eventId)

  if (!standings) return

  // Get all pairings for opponent mapping
  const { data: pairings } = await supabase
    .from('tournament_pairings')
    .select('player1_id, player2_id')
    .eq('event_id', eventId)

  if (!pairings) return

  // Build opponent map
  const opponentMap = new Map<string, string[]>()
  for (const s of standings) opponentMap.set(s.user_id, [])
  for (const p of pairings) {
    if (p.player1_id && p.player2_id) {
      opponentMap.get(p.player1_id)?.push(p.player2_id)
      opponentMap.get(p.player2_id)?.push(p.player1_id)
    }
  }

  const standingMap = new Map(standings.map(s => [s.user_id, s]))

  // Calculate tiebreakers for each player
  for (const s of standings) {
    const opponents = opponentMap.get(s.user_id) || []
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
      .eq('event_id', eventId)
      .eq('user_id', s.user_id)
  }
}

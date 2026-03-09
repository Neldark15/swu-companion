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
  // Joined
  player1_name?: string
  player2_name?: string
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

// ─── Report Match Result ────────────────────────────────────

export async function reportResult(
  pairingId: string,
  winnerId: string | null,
  score: string, // e.g. "2-1"
  reportedBy: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  // Get pairing info
  const { data: pairing, error: pErr } = await supabase
    .from('tournament_pairings')
    .select('*, tournament_rounds!inner(event_id, round_number)')
    .eq('id', pairingId)
    .single()

  if (pErr || !pairing) return { ok: false, error: 'Emparejamiento no encontrado' }

  const round = pairing.tournament_rounds as unknown as { event_id: string; round_number: number }
  const eventId = round.event_id

  // Update pairing
  const { error: uErr } = await supabase
    .from('tournament_pairings')
    .update({ winner_id: winnerId, score, reported_by: reportedBy })
    .eq('id', pairingId)

  if (uErr) return { ok: false, error: uErr.message }

  // Parse score
  const scoreParts = score.split('-').map(Number)
  const s1 = scoreParts[0] || 0
  const s2 = scoreParts[1] || 0

  // Update standings for both players
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

  // Recalculate tiebreakers for all players
  await recalculateTiebreakers(eventId)

  return { ok: true }
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

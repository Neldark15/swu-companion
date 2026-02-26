/**
 * Swiss Tournament Algorithm for SWU Companion
 * - Pair players with similar points
 * - Avoid rematches when possible
 * - Handle byes for odd player counts
 * - Calculate tiebreakers (Opponent Match Win %)
 */

import type { TournamentPlayer, TournamentPairing, TournamentRound } from '../types'

// Suggested rounds based on player count
export function suggestedRounds(playerCount: number): number {
  if (playerCount <= 4) return 3
  if (playerCount <= 8) return 3
  if (playerCount <= 16) return 4
  if (playerCount <= 32) return 5
  if (playerCount <= 64) return 6
  return 7
}

// Sort players by Swiss standing order
export function sortStandings(
  players: TournamentPlayer[],
  allPlayers: TournamentPlayer[],
): TournamentPlayer[] {
  const playerMap = new Map(allPlayers.map((p) => [p.id, p]))

  return [...players].sort((a, b) => {
    // 1. Points (descending)
    if (b.points !== a.points) return b.points - a.points
    // 2. Opponent Match Win % (descending)
    const omwA = opponentMatchWinPct(a, playerMap)
    const omwB = opponentMatchWinPct(b, playerMap)
    if (omwB !== omwA) return omwB - omwA
    // 3. Game Win % (descending)
    const gwA = gameWinPct(a)
    const gwB = gameWinPct(b)
    if (gwB !== gwA) return gwB - gwA
    // 4. Alphabetical fallback
    return a.name.localeCompare(b.name)
  })
}

function opponentMatchWinPct(
  player: TournamentPlayer,
  playerMap: Map<string, TournamentPlayer>,
): number {
  if (player.opponentIds.length === 0) return 0
  let total = 0
  for (const oppId of player.opponentIds) {
    const opp = playerMap.get(oppId)
    if (opp) {
      const rounds = opp.matchWins + opp.matchLosses + opp.matchDraws
      if (rounds > 0) {
        const raw = opp.points / (rounds * 3)
        total += Math.max(raw, 0.33) // Floor at 33%
      } else {
        total += 0.33
      }
    }
  }
  return total / player.opponentIds.length
}

function gameWinPct(player: TournamentPlayer): number {
  const total = player.gameWins + player.gameLosses
  if (total === 0) return 0
  return player.gameWins / total
}

// Generate Swiss pairings for a new round
export function generatePairings(
  players: TournamentPlayer[],
  avoidRematches: boolean,
): TournamentPairing[] {
  const sorted = [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return Math.random() - 0.5 // Randomize within same points
  })

  const paired = new Set<string>()
  const pairings: TournamentPairing[] = []

  // Try to pair players with similar points
  for (let i = 0; i < sorted.length; i++) {
    if (paired.has(sorted[i].id)) continue

    let bestMatch = -1
    let bestScore = -1

    for (let j = i + 1; j < sorted.length; j++) {
      if (paired.has(sorted[j].id)) continue

      // Check rematch
      if (avoidRematches && sorted[i].opponentIds.includes(sorted[j].id)) {
        // Still consider if no better option
        if (bestMatch === -1) {
          bestMatch = j
          bestScore = 0
        }
        continue
      }

      // Prefer closer point totals
      const pointDiff = Math.abs(sorted[i].points - sorted[j].points)
      const score = 100 - pointDiff
      if (score > bestScore) {
        bestScore = score
        bestMatch = j
      }
    }

    if (bestMatch !== -1) {
      pairings.push({
        player1Id: sorted[i].id,
        player2Id: sorted[bestMatch].id,
        result: null,
      })
      paired.add(sorted[i].id)
      paired.add(sorted[bestMatch].id)
    }
  }

  // Handle bye (odd players)
  for (const player of sorted) {
    if (!paired.has(player.id)) {
      pairings.push({
        player1Id: player.id,
        player2Id: null, // bye
        result: null,
      })
      break
    }
  }

  return pairings
}

// Apply a match result to tournament players
export function applyResult(
  players: TournamentPlayer[],
  pairing: TournamentPairing,
  winnerId: string | null,
  score: [number, number],
): TournamentPlayer[] {
  return players.map((p) => {
    const isP1 = p.id === pairing.player1Id
    const isP2 = p.id === pairing.player2Id

    if (!isP1 && !isP2) return p

    const updated = { ...p }

    // Track opponent
    const oppId = isP1 ? pairing.player2Id : pairing.player1Id
    if (oppId && !updated.opponentIds.includes(oppId)) {
      updated.opponentIds = [...updated.opponentIds, oppId]
    }

    // Bye handling
    if (pairing.player2Id === null && isP1) {
      updated.points += 3
      updated.matchWins += 1
      updated.gameWins += 2
      updated.byes += 1
      return updated
    }

    const myScore = isP1 ? score[0] : score[1]
    const oppScore = isP1 ? score[1] : score[0]

    updated.gameWins += myScore
    updated.gameLosses += oppScore

    if (winnerId === p.id) {
      updated.points += 3
      updated.matchWins += 1
    } else if (winnerId === null) {
      updated.points += 1
      updated.matchDraws += 1
    } else {
      updated.matchLosses += 1
    }

    return updated
  })
}

// Check if round is complete
export function isRoundComplete(round: TournamentRound): boolean {
  return round.pairings.every((p) => p.result !== null || p.player2Id === null)
}

// Generate tournament ID
export function generateTournamentId(): string {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

// Create a new player
export function createPlayer(name: string): TournamentPlayer {
  return {
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    points: 0,
    matchWins: 0,
    matchLosses: 0,
    matchDraws: 0,
    gameWins: 0,
    gameLosses: 0,
    byes: 0,
    opponentIds: [],
  }
}

// ═══════════════════════════════════════════════════
// Single Elimination Bracket Algorithm
// ═══════════════════════════════════════════════════

export interface BracketPlayer {
  id: string
  name: string
  seed: number
}

export interface BracketMatch {
  player1Id: string | null
  player2Id: string | null
  winnerId: string | null
  score: string | null
  isBye: boolean
}

// Generate number of rounds needed
export function eliminationRounds(playerCount: number): number {
  return Math.ceil(Math.log2(playerCount))
}

// Generate seeded bracket order (standard tournament seeding)
// For 8 players: [1,8,4,5,2,7,3,6]
export function seedOrder(count: number): number[] {
  if (count <= 1) return [0]
  const rounds = Math.ceil(Math.log2(count))

  let order = [0]
  for (let r = 0; r < rounds; r++) {
    const temp: number[] = []
    const max = Math.pow(2, r + 1) - 1
    for (const seed of order) {
      temp.push(seed)
      temp.push(max - seed)
    }
    order = temp
  }
  return order.filter(s => s < count)
}

// Generate first round pairings with byes
export function generateEliminationPairings(
  players: BracketPlayer[]
): Array<{ player1Id: string | null; player2Id: string | null; isBye: boolean }> {
  const totalRounds = eliminationRounds(players.length)
  const bracketSize = Math.pow(2, totalRounds)

  // Sort by seed
  const sorted = [...players].sort((a, b) => a.seed - b.seed)

  // Place players in seeded positions
  const order = seedOrder(bracketSize)
  const slots: (BracketPlayer | null)[] = new Array(bracketSize).fill(null)

  for (let i = 0; i < sorted.length; i++) {
    slots[order[i]] = sorted[i]
  }

  // Generate pairings (pairs of 2)
  const pairings: Array<{ player1Id: string | null; player2Id: string | null; isBye: boolean }> = []
  for (let i = 0; i < bracketSize; i += 2) {
    const p1 = slots[i]
    const p2 = slots[i + 1]

    if (!p1 && !p2) continue // Empty pair

    pairings.push({
      player1Id: p1?.id || null,
      player2Id: p2?.id || null,
      isBye: !p1 || !p2,
    })
  }

  return pairings
}

// Generate next round from winners
export function generateNextRoundPairings(
  winnerIds: string[]
): Array<{ player1Id: string | null; player2Id: string | null; isBye: boolean }> {
  const pairings: Array<{ player1Id: string | null; player2Id: string | null; isBye: boolean }> = []

  for (let i = 0; i < winnerIds.length; i += 2) {
    const p1 = winnerIds[i] || null
    const p2 = winnerIds[i + 1] || null

    pairings.push({
      player1Id: p1,
      player2Id: p2,
      isBye: !p1 || !p2,
    })
  }

  return pairings
}

// Check if tournament is complete (only 1 match in last round with a winner)
export function isEliminationComplete(
  lastRoundPairings: Array<{ winnerId: string | null }>
): boolean {
  return lastRoundPairings.length === 1 && lastRoundPairings[0].winnerId !== null
}

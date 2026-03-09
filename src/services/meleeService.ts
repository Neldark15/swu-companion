import { db } from './db'
import type { MeleeTournament, MeleeTournamentStats, TournamentFormat } from '../types'

// ─── Melee URL Parsing ───

const MELEE_URL_PATTERN = /melee\.gg\/Tournament\/View\/(\d+)/i

export function parseMeleeUrl(url: string): string | null {
  const match = url.match(MELEE_URL_PATTERN)
  return match ? match[1] : null
}

export function buildMeleeUrl(meleeId: string): string {
  return `https://melee.gg/Tournament/View/${meleeId}`
}

// ─── CRUD Operations ───

export async function saveMeleeTournament(
  data: Omit<MeleeTournament, 'id' | 'createdAt'>,
): Promise<MeleeTournament> {
  const tournament: MeleeTournament = {
    ...data,
    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `m_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: Date.now(),
  }

  // Extract melee ID from URL if provided
  if (tournament.meleeUrl && !tournament.meleeId) {
    const meleeId = parseMeleeUrl(tournament.meleeUrl)
    if (meleeId) tournament.meleeId = meleeId
  }

  await db.meleeTournaments.add(tournament)
  return tournament
}

export async function updateMeleeTournament(
  id: string,
  updates: Partial<MeleeTournament>,
): Promise<void> {
  // Re-parse melee ID if URL changed
  if (updates.meleeUrl) {
    const meleeId = parseMeleeUrl(updates.meleeUrl)
    if (meleeId) updates.meleeId = meleeId
  }
  await db.meleeTournaments.update(id, updates)
}

export async function deleteMeleeTournament(id: string): Promise<void> {
  await db.meleeTournaments.delete(id)
}

export async function getMeleeTournament(id: string): Promise<MeleeTournament | undefined> {
  return db.meleeTournaments.get(id)
}

export async function getMyMeleeTournaments(userId?: string): Promise<MeleeTournament[]> {
  let collection = db.meleeTournaments.orderBy('date').reverse()
  if (userId) {
    collection = db.meleeTournaments.where('userId').equals(userId).reverse()
  }
  return collection.toArray()
}

// ─── Statistics ───

export function calculateMeleeStats(tournaments: MeleeTournament[]): MeleeTournamentStats {
  if (tournaments.length === 0) {
    return {
      totalEvents: 0,
      totalWins: 0,
      totalLosses: 0,
      totalDraws: 0,
      avgStanding: null,
      bestStanding: null,
      topDecks: [],
      byFormat: {},
      eventsByMonth: [],
    }
  }

  let totalWins = 0
  let totalLosses = 0
  let totalDraws = 0
  const standings: number[] = []
  const deckMap = new Map<string, { count: number; standings: number[] }>()
  const formatMap = new Map<string, { events: number; wins: number; losses: number }>()
  const monthMap = new Map<string, number>()

  for (const t of tournaments) {
    totalWins += t.wins
    totalLosses += t.losses
    totalDraws += t.draws

    if (t.standing != null) standings.push(t.standing)

    // Deck tracking
    const deckKey = t.deckName || 'Sin deck'
    const deckEntry = deckMap.get(deckKey) || { count: 0, standings: [] }
    deckEntry.count++
    if (t.standing != null) deckEntry.standings.push(t.standing)
    deckMap.set(deckKey, deckEntry)

    // Format tracking
    const fmtEntry = formatMap.get(t.format) || { events: 0, wins: 0, losses: 0 }
    fmtEntry.events++
    fmtEntry.wins += t.wins
    fmtEntry.losses += t.losses
    formatMap.set(t.format, fmtEntry)

    // Monthly tracking
    const month = t.date.substring(0, 7) // YYYY-MM
    monthMap.set(month, (monthMap.get(month) || 0) + 1)
  }

  const avgStanding = standings.length > 0
    ? Math.round((standings.reduce((a, b) => a + b, 0) / standings.length) * 10) / 10
    : null
  const bestStanding = standings.length > 0 ? Math.min(...standings) : null

  const topDecks = Array.from(deckMap.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      avgStanding: data.standings.length > 0
        ? Math.round((data.standings.reduce((a, b) => a + b, 0) / data.standings.length) * 10) / 10
        : null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const byFormat: Record<string, { events: number; wins: number; losses: number }> = {}
  for (const [fmt, data] of formatMap) byFormat[fmt] = data

  const eventsByMonth = Array.from(monthMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return {
    totalEvents: tournaments.length,
    totalWins,
    totalLosses,
    totalDraws,
    avgStanding,
    bestStanding,
    topDecks,
    byFormat,
    eventsByMonth,
  }
}

// ─── Supabase sync (push to cloud if logged in) ───

export async function syncMeleeTournamentToCloud(
  tournament: MeleeTournament,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/melee_tournaments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: tournament.id,
        user_id: tournament.userId,
        name: tournament.name,
        melee_url: tournament.meleeUrl,
        melee_id: tournament.meleeId,
        date: tournament.date,
        location: tournament.location,
        organizer: tournament.organizer,
        format: tournament.format,
        player_count: tournament.playerCount,
        standing: tournament.standing,
        wins: tournament.wins,
        losses: tournament.losses,
        draws: tournament.draws,
        deck_name: tournament.deckName,
        deck_leader: tournament.deckLeader,
        deck_base: tournament.deckBase,
        notes: tournament.notes,
        tags: tournament.tags,
        recorded_at: new Date(tournament.recordedAt).toISOString(),
        created_at: new Date(tournament.createdAt).toISOString(),
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ─── Tournament Tag Presets ───

export const TOURNAMENT_TAGS = [
  'Planetary Qualifier',
  'Store Showdown',
  'Galactic Championship',
  'League Night',
  'Casual',
  'Online',
  'Regional',
  'Nationals',
] as const

export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  premier: 'Premier',
  sealed: 'Sealed',
  draft: 'Draft',
  twin_suns: 'Twin Suns',
  trilogy: 'Trilogy',
}

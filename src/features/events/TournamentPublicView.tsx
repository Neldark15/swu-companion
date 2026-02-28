/**
 * TournamentPublicView — Public live standings (no auth required)
 * Route: /events/live/:code
 * Optimized for projection / spectators
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  getEventTournamentInfo,
  getStandings,
  getRoundPairings,
  getAllRounds,
  subscribeToEvent,
  type CloudEvent,
  type CloudStanding,
  type CloudPairing,
  type CloudRound,
} from '../../services/tournamentCloud'
import { useUIStore } from '../../hooks/useUIStore'
import { StandingsTable } from './components/StandingsTable'
import { PairingsView } from './components/PairingsView'
import { BracketView } from './components/BracketView'
import { RoundTimer } from './components/RoundTimer'

type PublicTab = 'standings' | 'pairings' | 'bracket'

export default function TournamentPublicView() {
  const { code } = useParams<{ code: string }>()
  const setHideTabBar = useUIStore((s) => s.setHideTabBar)

  const [event, setEvent] = useState<CloudEvent | null>(null)
  const [standings, setStandings] = useState<CloudStanding[]>([])
  const [pairings, setPairings] = useState<CloudPairing[]>([])
  const [rounds, setRounds] = useState<CloudRound[]>([])
  const [activeTab, setActiveTab] = useState<PublicTab>('standings')
  const [loading, setLoading] = useState(true)

  // Hide TabBar on this page
  useEffect(() => {
    setHideTabBar(true)
    return () => setHideTabBar(false)
  }, [setHideTabBar])

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!code) return
    const ev = await getEventTournamentInfo(code)
    if (!ev) {
      setLoading(false)
      return
    }
    setEvent(ev)

    const [s, r] = await Promise.all([
      getStandings(ev.id),
      getAllRounds(ev.id),
    ])
    setStandings(s)
    setRounds(r)

    if (ev.current_round > 0) {
      const p = await getRoundPairings(ev.id, ev.current_round)
      setPairings(p)
    }
    setLoading(false)
  }, [code])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Realtime subscriptions
  useEffect(() => {
    if (!event?.id) return
    const unsub = subscribeToEvent(event.id, {
      onStandingsChange: () => getStandings(event.id).then(setStandings),
      onPairingsChange: () => {
        if (event.current_round > 0) {
          getRoundPairings(event.id, event.current_round).then(setPairings)
        }
      },
      onEventChange: () => {
        if (code) getEventTournamentInfo(code).then(ev => {
          if (ev) {
            setEvent(ev)
            if (ev.current_round > 0) {
              getRoundPairings(ev.id, ev.current_round).then(setPairings)
            }
          }
        })
      },
    })
    return unsub
  }, [event?.id, event?.current_round, code])

  // Build bracket data
  const [pairingsByRound, setPairingsByRound] = useState<Map<number, CloudPairing[]>>(new Map())
  const playerNames = new Map<string, string>()
  standings.forEach(s => playerNames.set(s.user_id, s.player_name))

  useEffect(() => {
    if (!event?.id || event.tournament_type !== 'elimination' || rounds.length === 0) return
    async function loadBracket() {
      const map = new Map<number, CloudPairing[]>()
      for (const r of rounds) {
        const p = await getRoundPairings(event!.id, r.round_number)
        map.set(r.round_number, p)
      }
      setPairingsByRound(map)
    }
    loadBracket()
  }, [event?.id, event?.tournament_type, rounds])

  if (loading) {
    return (
      <div className="min-h-screen bg-swu-bg flex items-center justify-center">
        <div className="text-swu-muted animate-pulse text-lg">Cargando torneo...</div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-swu-bg flex items-center justify-center p-4">
        <div className="text-swu-muted text-center">
          <p className="text-xl">Evento no encontrado</p>
          <p className="text-sm mt-2">Verifique el código del evento</p>
        </div>
      </div>
    )
  }

  const showBracket = event.tournament_type === 'elimination'

  return (
    <div className="min-h-screen bg-swu-bg">
      {/* Header */}
      <div className="bg-swu-surface border-b border-swu-border">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-swu-text">{event.name}</h1>
              <div className="flex items-center gap-2 text-xs text-swu-muted mt-1">
                <span className="uppercase font-bold text-swu-accent">
                  {event.tournament_type === 'swiss' ? 'Suizo' : 'Eliminación'}
                </span>
                <span>·</span>
                <span>Ronda {event.current_round}/{event.max_rounds || '?'}</span>
                <span>·</span>
                <span className={event.status === 'active' ? 'text-green-400' : 'text-yellow-400'}>
                  {event.status === 'active' ? 'EN VIVO' : event.status === 'finished' ? 'FINALIZADO' : 'PENDIENTE'}
                </span>
              </div>
            </div>

            {/* Timer */}
            {event.round_timer_end && (
              <div className="bg-swu-bg rounded-lg px-4 py-2 border border-swu-border">
                <RoundTimer endTime={event.round_timer_end} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-2xl mx-auto px-4 mt-3">
        <div className="flex gap-1 bg-swu-surface rounded-lg p-1 border border-swu-border">
          <button
            onClick={() => setActiveTab('standings')}
            className={`flex-1 py-2 text-sm rounded transition-colors ${
              activeTab === 'standings' ? 'bg-swu-accent/20 text-swu-accent font-bold' : 'text-swu-muted'
            }`}
          >
            Standings
          </button>
          <button
            onClick={() => setActiveTab('pairings')}
            className={`flex-1 py-2 text-sm rounded transition-colors ${
              activeTab === 'pairings' ? 'bg-swu-accent/20 text-swu-accent font-bold' : 'text-swu-muted'
            }`}
          >
            Pairings
          </button>
          {showBracket && (
            <button
              onClick={() => setActiveTab('bracket')}
              className={`flex-1 py-2 text-sm rounded transition-colors ${
                activeTab === 'bracket' ? 'bg-swu-accent/20 text-swu-accent font-bold' : 'text-swu-muted'
              }`}
            >
              Bracket
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 mt-4 pb-8">
        {activeTab === 'standings' && (
          <StandingsTable standings={standings} />
        )}

        {activeTab === 'pairings' && (
          <div>
            <div className="text-xs text-swu-muted mb-3 text-center">
              Ronda {event.current_round}
            </div>
            <PairingsView pairings={pairings} />
          </div>
        )}

        {activeTab === 'bracket' && showBracket && (
          <BracketView
            rounds={rounds}
            pairingsByRound={pairingsByRound}
            playerNames={playerNames}
          />
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-swu-muted pb-4">
        SWU Companion · {event.code}
      </div>
    </div>
  )
}

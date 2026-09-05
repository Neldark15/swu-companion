/**
 * TournamentPublicView — Public live standings (no auth required)
 * Route: /events/live/:code
 * Optimized for projection / spectators
 */

import { etiquetaTipo } from '../../services/tipoTorneo'
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
import { esDeMesas } from '../../services/tipoTorneo'
import { ultimaRonda, getMesasDeRonda, type MesaArmada } from '../../services/mesasService'
import { supabase, isSupabaseReady } from '../../services/supabase'

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
  const [mesas, setMesas] = useState<MesaArmada[]>([])

  /* Las MESAS, que es donde vive la gente en un torneo de mesas.
     Esta pantalla leía solo `tournament_pairings`, que en mesas está vacía:
     con 11 jugadores ya sentados en 3 mesas, la proyección decía «No hay
     emparejamientos». */
  useEffect(() => {
    const id = event?.id
    if (!id || !isSupabaseReady() || !esDeMesas(event.tournament_type)) return
    let vivo = true

    const traer = async () => {
      const ronda = await ultimaRonda(id)
      if (!vivo) return
      setMesas(ronda ? await getMesasDeRonda(ronda.id) : [])
    }
    void traer()

    const canal = supabase
      .channel(`live-mesas-${id}`)
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'tournament_mesas', filter: `event_id=eq.${id}` },
          () => { void traer() })
      .subscribe(estado => {
        if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
          console.warn('[proyección] el canal de mesas no quedó:', estado)
        }
      })

    return () => { vivo = false; void supabase.removeChannel(canal) }
  }, [event?.id, event?.tournament_type])

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
    // Envuelto en una función asíncrona a propósito: llamarlo en seco desde
    // el cuerpo del efecto encadena un render antes de que React pinte.
    void (async () => { await fetchData() })()
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
  /* Llaveado por la FILA de clasificación (`s.id`), que es lo que ahora
   * lleva el pareo. Con `user_id` los invitados colapsaban en la clave `null`
   * y el cuadro les ponía el nombre de otro — o «TBD». Por `id` entran todos. */
  const playerNames = new Map<string, string>()
  standings.forEach(s => playerNames.set(s.id, s.player_name))

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
                <span className="uppercase font-bold text-swu-accent-texto">
                  {etiquetaTipo(event.tournament_type)}
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
              activeTab === 'standings' ? 'bg-swu-accent/20 text-swu-accent-texto font-bold' : 'text-swu-muted'
            }`}
          >
            Standings
          </button>
          <button
            onClick={() => setActiveTab('pairings')}
            className={`flex-1 py-2 text-sm rounded transition-colors ${
              activeTab === 'pairings' ? 'bg-swu-accent/20 text-swu-accent-texto font-bold' : 'text-swu-muted'
            }`}
          >
            Pairings
          </button>
          {showBracket && (
            <button
              onClick={() => setActiveTab('bracket')}
              className={`flex-1 py-2 text-sm rounded transition-colors ${
                activeTab === 'bracket' ? 'bg-swu-accent/20 text-swu-accent-texto font-bold' : 'text-swu-muted'
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
            {esDeMesas(event.tournament_type)
              ? <MesasEnVivo mesas={mesas} />
              : <PairingsView pairings={pairings} />}
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
        HOLOCRON SWU · {event.code}
      </div>
    </div>
  )
}

/**
 * Las mesas, para proyectar.
 *
 * Un torneo de mesas no tiene emparejamientos: la gente vive en
 * `tournament_mesas`. Esta pantalla —la que se pone en la tele del local—
 * leía solo los pareos y por eso decía «No hay emparejamientos» con once
 * personas ya sentadas.
 *
 * Va con letra grande y la vida al costado: se lee de lejos, que es lo único
 * que esta pantalla tiene que lograr.
 */
function MesasEnVivo({ mesas }: { mesas: MesaArmada[] }) {
  if (mesas.length === 0) {
    return (
      <div className="py-8 text-center text-swu-muted">
        Todavía no se sortearon las mesas.
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {mesas.map(m => (
        <li key={m.mesa} className="rounded-2xl border border-swu-border bg-swu-surface p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-swu-amber/15
                             font-mono text-base font-black text-swu-amber">
              {m.mesa}
            </span>
            <span className="text-sm font-bold uppercase tracking-wider text-swu-muted">
              Mesa {m.mesa}
            </span>
            {m.anotada && (
              <span className="ml-auto text-[11px] font-bold text-swu-green">anotada</span>
            )}
          </div>
          <ul className="space-y-1">
            {m.jugadores.map(j => (
              <li key={j.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-lg font-semibold text-swu-text">
                  {/* El puesto delante cuando ya se anotó: en la tele es lo
                      primero que la gente busca. */}
                  {j.puesto ? <span className="mr-2 font-mono text-swu-amber">{j.puesto}º</span> : null}
                  {j.player_name}
                </span>
                {/* «—» y no 0: no haber anotado no es haber quedado en cero. */}
                <span className={`shrink-0 font-mono text-lg font-bold ${
                  j.vida === null ? 'text-swu-muted'
                    : j.vida <= 5 ? 'text-swu-red-texto' : 'text-swu-text'
                }`}>
                  {j.vida === null ? '—' : j.vida}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

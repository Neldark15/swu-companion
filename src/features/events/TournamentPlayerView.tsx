/**
 * TournamentPlayerView — Vista del JUGADOR en un torneo cloud en curso.
 * Route: /events/play/:code
 *
 * El jugador ve:
 * - Su pareja actual con botones Reportar / Confirmar / Disputar
 * - Otras parejas (read-only) con estado en vivo
 * - Standings actualizadas en tiempo real
 * - Toasts cuando: cambia pareja, oponente reporta, resultado se confirma, etc.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, AlertTriangle, Send, Loader2, Trophy,
  Users as UsersIcon, Swords, Hourglass, ShieldAlert,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  getEventTournamentInfo,
  getStandings,
  getRoundPairings,
  getMyPairing,
  isEventParticipant,
  submitPairingResult,
  confirmPairingResult,
  disputePairingResult,
  subscribeToEvent,
  type CloudEvent,
  type CloudStanding,
  type CloudPairing,
} from '../../services/tournamentCloud'
import { useNotificationStore } from '../../services/notificationService'
import { PairingsView } from './components/PairingsView'
import { StandingsTable } from './components/StandingsTable'

type Tab = 'mine' | 'all' | 'standings'

export function TournamentPlayerView() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { supabaseUser, currentProfile } = useAuth()
  const userId = supabaseUser?.id ?? null
  const addNotification = useNotificationStore(s => s.addNotification)

  const [event, setEvent] = useState<CloudEvent | null>(null)
  const [isParticipant, setIsParticipant] = useState<boolean | null>(null)
  const [myPairing, setMyPairing] = useState<CloudPairing | null>(null)
  const [pairings, setPairings] = useState<CloudPairing[]>([])
  const [standings, setStandings] = useState<CloudStanding[]>([])
  const [tab, setTab] = useState<Tab>('mine')
  const [loading, setLoading] = useState(true)
  const [score, setScore] = useState<[number, number]>([2, 0])
  const [submitting, setSubmitting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initial fetch
  const fetchAll = useCallback(async () => {
    if (!code || !userId) {
      setLoading(false)
      return
    }
    const ev = await getEventTournamentInfo(code)
    if (!ev) {
      setLoading(false)
      return
    }
    setEvent(ev)

    const [participating, allPairings, allStandings, mine] = await Promise.all([
      isEventParticipant(ev.id, userId),
      ev.current_round > 0 ? getRoundPairings(ev.id, ev.current_round) : Promise.resolve([]),
      getStandings(ev.id),
      ev.current_round > 0 ? getMyPairing(ev.id, userId, ev.current_round) : Promise.resolve(null),
    ])

    setIsParticipant(participating)
    setPairings(allPairings)
    setStandings(allStandings)
    setMyPairing(mine)
    setLoading(false)
  }, [code, userId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Realtime + in-tournament toasts
  useEffect(() => {
    if (!event?.id || !userId || isParticipant === false) return

    const previousPairingId = myPairing?.id
    const previousConfirmedAt = myPairing?.confirmed_at
    const previousReportedAt = myPairing?.reported_at

    const unsub = subscribeToEvent(event.id, {
      onPairingsChange: async () => {
        // Refresh both my pairing and the full list
        const [newPairings, newMine] = await Promise.all([
          event.current_round > 0 ? getRoundPairings(event.id, event.current_round) : Promise.resolve([]),
          event.current_round > 0 ? getMyPairing(event.id, userId, event.current_round) : Promise.resolve(null),
        ])
        setPairings(newPairings)

        // Toast: new pairing for me (different id from before, or first one)
        if (newMine && newMine.id !== previousPairingId) {
          const opponentName = newMine.player1_id === userId
            ? (newMine.player2_name || 'Sin oponente (BYE)')
            : (newMine.player1_name || 'Oponente')
          addNotification({
            type: 'info',
            title: `Ronda ${event.current_round} — Mesa ${newMine.table_number ?? '?'}`,
            message: `Tu oponente: ${opponentName}`,
            icon: '⚔️',
          })
        }

        // Toast: opponent reported my pairing waiting confirmation
        if (
          newMine &&
          newMine.id === previousPairingId &&
          newMine.reported_at &&
          newMine.reported_at !== previousReportedAt &&
          newMine.reported_by !== userId &&
          !newMine.confirmed_at
        ) {
          addNotification({
            type: 'info',
            title: 'Resultado pendiente',
            message: `Tu oponente reportó ${newMine.score ?? '?-?'} — confirma o disputa`,
            icon: '⚠️',
          })
        }

        // Toast: my pairing confirmed
        if (
          newMine &&
          newMine.id === previousPairingId &&
          newMine.confirmed_at &&
          newMine.confirmed_at !== previousConfirmedAt
        ) {
          addNotification({
            type: 'info',
            title: 'Resultado confirmado',
            message: `Mesa ${newMine.table_number ?? '?'}: ${newMine.score ?? ''}`,
            icon: '✅',
          })
        }

        setMyPairing(newMine)
      },
      onStandingsChange: () => getStandings(event.id).then(setStandings),
      onEventChange: () => {
        if (code) getEventTournamentInfo(code).then(ev => ev && setEvent(ev))
      },
    })
    return unsub
  }, [event?.id, event?.current_round, userId, isParticipant, myPairing?.id, myPairing?.confirmed_at, myPairing?.reported_at, addNotification, code])

  const opponentId = useMemo(() => {
    if (!myPairing || !userId) return null
    return myPairing.player1_id === userId ? myPairing.player2_id : myPairing.player1_id
  }, [myPairing, userId])

  const opponentName = useMemo(() => {
    if (!myPairing) return '—'
    return myPairing.player1_id === userId
      ? (myPairing.player2_name || (opponentId === null ? 'BYE' : 'Oponente'))
      : (myPairing.player1_name || 'Oponente')
  }, [myPairing, userId, opponentId])

  const myState = useMemo<'idle' | 'waiting_opponent' | 'confirm_pending' | 'confirmed' | 'disputed'>(() => {
    if (!myPairing) return 'idle'
    if (myPairing.confirmed_at) return 'confirmed'
    if (myPairing.disputed_at && !myPairing.confirmed_at) return 'disputed'
    if (myPairing.reported_by === userId) return 'waiting_opponent'
    if (myPairing.reported_by && myPairing.reported_by !== userId) return 'confirm_pending'
    return 'idle'
  }, [myPairing, userId])

  // ── Actions ──
  const onSubmit = async () => {
    if (!myPairing || !userId) return
    const [me, opp] = score
    if (me === opp) {
      setError('No se pueden empatar partidos en BO3 (ajusta el marcador)')
      return
    }
    const winnerSelf = me > opp
    const winnerId = winnerSelf ? userId : opponentId
    const scoreStr = `${me}-${opp}`
    setError(null)
    setSubmitting(true)
    const r = await submitPairingResult(myPairing.id, winnerId, scoreStr, userId)
    setSubmitting(false)
    if (!r.ok) {
      setError(r.error ?? 'Error al enviar resultado')
      return
    }
    addNotification({
      type: 'info',
      title: r.needsConfirmation ? 'Resultado enviado' : 'Resultado registrado',
      message: r.needsConfirmation ? `Esperando confirmación de ${opponentName}` : `Mesa ${myPairing.table_number ?? '?'}: ${scoreStr}`,
      icon: r.needsConfirmation ? '⏳' : '✅',
    })
  }

  const onConfirm = async () => {
    if (!myPairing || !userId) return
    setConfirming(true)
    const r = await confirmPairingResult(myPairing.id, userId)
    setConfirming(false)
    if (!r.ok) setError(r.error ?? 'Error al confirmar')
  }

  const onDispute = async () => {
    if (!myPairing || !userId) return
    const reason = prompt('Motivo de disputa (opcional):') ?? undefined
    setConfirming(true)
    const r = await disputePairingResult(myPairing.id, userId, reason || undefined)
    setConfirming(false)
    if (!r.ok) setError(r.error ?? 'Error al disputar')
  }

  // ── Render ──
  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-swu-muted text-sm">
        <Loader2 size={16} className="animate-spin" /> Cargando torneo…
      </div>
    )
  }

  if (!event) {
    return (
      <div className="p-6 text-center space-y-3">
        <ShieldAlert size={32} className="mx-auto text-swu-muted/40" />
        <p className="text-sm text-swu-text">Torneo no encontrado</p>
        <button onClick={() => navigate('/events')} className="text-xs text-swu-accent">Volver a eventos</button>
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-sm text-swu-text">Inicia sesión para entrar al torneo</p>
        <button onClick={() => navigate('/profile')} className="text-xs text-swu-accent">Ir a sesión</button>
      </div>
    )
  }

  if (isParticipant === false) {
    return (
      <div className="p-6 max-w-md mx-auto space-y-3 text-center">
        <ShieldAlert size={28} className="mx-auto text-swu-amber" />
        <p className="text-sm text-swu-text font-semibold">No estás registrado en este torneo</p>
        <p className="text-[11px] text-swu-muted">
          Puedes ver el torneo en modo público, donde verás standings y emparejamientos en vivo sin opciones de reportar.
        </p>
        <button
          onClick={() => navigate(`/events/live/${code}`)}
          className="px-3 py-2 rounded-lg bg-swu-accent/15 text-swu-accent text-xs font-semibold"
        >
          Ver torneo público
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-8 max-w-5xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={() => navigate('/events')} className="flex items-center gap-1 text-xs text-swu-muted">
          <ArrowLeft size={14} /> Eventos
        </button>
        <div className="text-right">
          <h1 className="text-lg font-bold text-swu-text leading-tight">{event.name}</h1>
          <p className="text-[10px] text-swu-muted font-mono">
            {event.tournament_type === 'elimination' ? 'ELIMINACIÓN' : 'SWISS'} · RONDA {event.current_round}/{event.max_rounds ?? '?'} · {event.status.toUpperCase()}
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex bg-swu-surface rounded-lg p-0.5 border border-swu-border w-fit">
        {(['mine', 'all', 'standings'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === t ? 'bg-swu-accent/20 text-swu-accent' : 'text-swu-muted hover:text-swu-text'
            }`}
          >
            {t === 'mine' ? 'Mi mesa' : t === 'all' ? 'Todas' : 'Standings'}
          </button>
        ))}
      </div>

      {/* My pairing tab */}
      {tab === 'mine' && (
        <section className="space-y-3">
          {event.status === 'finished' ? (
            <div className="bg-swu-surface rounded-2xl border border-swu-border p-6 text-center space-y-2">
              <Trophy size={32} className="mx-auto text-swu-accent" />
              <p className="text-sm font-semibold text-swu-text">Torneo terminado</p>
              <p className="text-[11px] text-swu-muted">Mira el ranking final en la pestaña Standings.</p>
            </div>
          ) : !myPairing ? (
            <div className="bg-swu-surface rounded-2xl border border-swu-border p-6 text-center space-y-2">
              <Hourglass size={28} className="mx-auto text-swu-muted/60" />
              <p className="text-sm text-swu-text">
                {event.current_round === 0 ? 'El torneo aún no ha iniciado' : 'Esperando emparejamientos…'}
              </p>
              <p className="text-[11px] text-swu-muted">Te avisamos cuando salgan las parejas.</p>
            </div>
          ) : opponentId === null ? (
            // BYE
            <div className="bg-swu-green/10 border border-swu-green/30 rounded-2xl p-5 text-center space-y-2">
              <CheckCircle2 size={28} className="mx-auto text-swu-green" />
              <p className="text-sm font-bold text-swu-green">BYE — Pase libre</p>
              <p className="text-[11px] text-swu-muted">Recibes 2-0 automático esta ronda.</p>
            </div>
          ) : (
            <div className="bg-swu-surface rounded-2xl border border-swu-border p-5 space-y-4">
              {/* Heading */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-swu-muted">Mesa {myPairing.table_number ?? '?'}</p>
                  <h2 className="text-base font-bold text-swu-text flex items-center gap-2">
                    <Swords size={16} className="text-swu-accent" />
                    vs {opponentName}
                  </h2>
                </div>
                <StateBadge state={myState} />
              </div>

              {/* State-driven body */}
              {myState === 'confirmed' ? (
                <div className="bg-swu-green/10 border border-swu-green/30 rounded-xl p-3 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-swu-green" />
                  <p className="text-xs text-swu-green font-semibold">
                    Resultado confirmado: <span className="font-mono ml-1">{myPairing.score}</span>
                  </p>
                </div>
              ) : myState === 'waiting_opponent' ? (
                <div className="bg-swu-amber/10 border border-swu-amber/30 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-swu-amber font-semibold flex items-center gap-2">
                    <Hourglass size={14} /> Esperando confirmación de {opponentName}
                  </p>
                  <p className="text-[11px] text-swu-muted">
                    Reportaste <span className="font-mono">{myPairing.score}</span>. {opponentName} verá la notificación y confirmará o disputará.
                  </p>
                </div>
              ) : myState === 'confirm_pending' ? (
                <div className="space-y-3">
                  <div className="bg-swu-amber/10 border border-swu-amber/30 rounded-xl p-3 space-y-1">
                    <p className="text-xs font-semibold text-swu-amber">
                      {opponentName} reportó <span className="font-mono">{myPairing.score}</span>
                    </p>
                    <p className="text-[11px] text-swu-muted">¿Es correcto?</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={onConfirm}
                      disabled={confirming}
                      className="flex-1 py-2.5 rounded-lg bg-swu-green text-white text-sm font-bold active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {confirming ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Confirmar
                    </button>
                    <button
                      onClick={onDispute}
                      disabled={confirming}
                      className="flex-1 py-2.5 rounded-lg bg-swu-red/15 text-swu-red text-sm font-bold active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <AlertTriangle size={14} /> Disputar
                    </button>
                  </div>
                </div>
              ) : myState === 'disputed' ? (
                <div className="bg-swu-red/10 border border-swu-red/30 rounded-xl p-3 space-y-1">
                  <p className="text-xs font-semibold text-swu-red flex items-center gap-2">
                    <AlertTriangle size={14} /> Resultado disputado
                  </p>
                  <p className="text-[11px] text-swu-muted">Esperando que el admin lo resuelva.</p>
                </div>
              ) : (
                // idle — show report UI
                <div className="space-y-3">
                  <p className="text-[11px] text-swu-muted">Reporta el marcador final del partido:</p>
                  <div className="flex items-center justify-center gap-4">
                    <ScoreStepper label="Yo" value={score[0]} onChange={(v) => setScore([v, score[1]])} />
                    <span className="text-xl font-bold text-swu-muted">—</span>
                    <ScoreStepper label={opponentName.slice(0, 12)} value={score[1]} onChange={(v) => setScore([score[0], v])} />
                  </div>
                  <button
                    onClick={onSubmit}
                    disabled={submitting}
                    className="w-full py-2.5 rounded-lg bg-swu-accent text-white text-sm font-bold active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Enviar para confirmación
                  </button>
                </div>
              )}

              {error && (
                <div className="bg-swu-red/10 border border-swu-red/30 rounded-lg p-2 text-[11px] text-swu-red">{error}</div>
              )}
            </div>
          )}
        </section>
      )}

      {/* All pairings tab */}
      {tab === 'all' && (
        <section className="space-y-3">
          <div className="text-[10px] uppercase tracking-wider text-swu-muted flex items-center gap-1.5">
            <UsersIcon size={11} /> Ronda {event.current_round} — {pairings.length} mesas
          </div>
          <PairingsView pairings={pairings} currentUserId={userId} />
        </section>
      )}

      {/* Standings tab */}
      {tab === 'standings' && (
        <section className="space-y-3">
          <div className="text-[10px] uppercase tracking-wider text-swu-muted">
            Standings actualizadas en tiempo real
          </div>
          <StandingsTable standings={standings} highlightUserId={userId} />
        </section>
      )}

      {/* Bottom helper */}
      {currentProfile && (
        <p className="text-[10px] text-swu-muted/50 text-center font-mono mt-4">
          Jugando como {currentProfile.name}
        </p>
      )}
    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────

function ScoreStepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-[10px] text-swu-muted truncate max-w-[80px]">{label}</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-7 h-7 rounded-md bg-swu-surface border border-swu-border text-swu-muted hover:text-swu-text"
        >−</button>
        <span className="w-8 text-center text-xl font-extrabold font-mono text-swu-text">{value}</span>
        <button
          onClick={() => onChange(Math.min(2, value + 1))}
          className="w-7 h-7 rounded-md bg-swu-surface border border-swu-border text-swu-muted hover:text-swu-text"
        >+</button>
      </div>
    </div>
  )
}

function StateBadge({ state }: { state: 'idle' | 'waiting_opponent' | 'confirm_pending' | 'confirmed' | 'disputed' }) {
  const map = {
    idle: { text: 'PENDIENTE', cls: 'bg-swu-muted/15 text-swu-muted' },
    waiting_opponent: { text: 'ESPERANDO', cls: 'bg-swu-amber/15 text-swu-amber' },
    confirm_pending: { text: 'CONFIRMA', cls: 'bg-swu-amber/15 text-swu-amber' },
    confirmed: { text: 'CONFIRMADO', cls: 'bg-swu-green/15 text-swu-green' },
    disputed: { text: 'DISPUTADO', cls: 'bg-swu-red/15 text-swu-red' },
  }
  const { text, cls } = map[state]
  return <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full ${cls}`}>{text}</span>
}

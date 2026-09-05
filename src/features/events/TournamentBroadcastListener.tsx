/**
 * TournamentBroadcastListener — escucha el feed global de broadcasts de torneos.
 *
 * Sin UI propia. Solo suscribe al canal `tournament_broadcasts` y dispara
 * toasts via notificationService para los hitos importantes
 * (round_complete, tournament_finished, dispute).
 *
 * Mounted en AppLayout para que esté siempre activo durante navegación
 * en la app principal. Los usuarios que están viendo TournamentPlayerView
 * o TournamentDashboard ya reciben toasts más específicos de su propio
 * canal — el global solo agrega contexto.
 */

import { useEffect, useRef } from 'react'
import { subscribeToBroadcasts, isEventParticipant, type TournamentBroadcast } from '../../services/tournamentCloud'
import { useAuth } from '../../hooks/useAuth'
import { useNotificationStore } from '../../services/notificationService'

const ICON_BY_TYPE: Record<TournamentBroadcast['type'], string> = {
  pairing_set: '🃏',
  result_submitted: '⏳',
  result_confirmed: '✅',
  result_disputed: '⚠️',
  round_complete: '🏁',
  tournament_finished: '🏆',
  announcement: '📣',
}

/* Cuáles se avisan a TODO el mundo con la app abierta.
   `pairing_set` no está acá y no es un olvido: avisarle a toda la comunidad
   los pareos de cada ronda de cada torneo es exactamente el ruido que hizo
   que se apagara. Se trata aparte, abajo: solo a quien juega ESE torneo. */
const GLOBAL_NOTIFY: Record<TournamentBroadcast['type'], boolean> = {
  pairing_set: false,
  result_submitted: false,      // very chatty
  result_confirmed: false,      // very chatty (could be 30+/torneo)
  result_disputed: true,        // worth knowing
  round_complete: true,
  tournament_finished: true,
  announcement: true,           // admin announcements: always notify everyone with app open
}

export function TournamentBroadcastListener() {
  const addNotification = useNotificationStore(s => s.addNotification)
  const { supabaseUser } = useAuth()
  // Dedup by id (RT can occasionally double-fire)
  const seenIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    const unsub = subscribeToBroadcasts((b) => {
      if (seenIds.current.has(b.id)) return
      seenIds.current.add(b.id)
      // Keep set bounded
      if (seenIds.current.size > 500) {
        const arr = Array.from(seenIds.current).slice(-250)
        seenIds.current = new Set(arr)
      }

      const avisar = () => addNotification({
        type: 'info',
        title: b.event_name || 'Torneo',
        message: b.message,
        icon: ICON_BY_TYPE[b.type] ?? '📢',
        // A la pantalla del JUGADOR: ahí ve SU mesa o SU pareo. `/events/live`
        // es la proyección, que sirve para mirar pero no para jugar.
        link: b.event_code ? `/events/play/${b.event_code}` : undefined,
      })

      /* Los pareos se avisan SOLO a quien juega ese torneo.
         Es el aviso que más importa —«ya salieron las mesas»— y estaba
         apagado del todo por ruidoso. Filtrado a los participantes deja de
         serlo: se pregunta si esta persona está inscrita, y solo entonces. */
      if (b.type === 'pairing_set') {
        // Sin sesión no hay a quién preguntarle si juega; sin evento tampoco.
        if (!supabaseUser || !b.event_id) return
        void isEventParticipant(b.event_id, supabaseUser.id).then(juega => {
          if (juega) avisar()
        })
        return
      }

      if (!GLOBAL_NOTIFY[b.type]) return
      avisar()
    })
    return unsub
  }, [addNotification, supabaseUser])

  return null
}

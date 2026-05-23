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
import { subscribeToBroadcasts, type TournamentBroadcast } from '../../services/tournamentCloud'
import { useNotificationStore } from '../../services/notificationService'

const ICON_BY_TYPE: Record<TournamentBroadcast['type'], string> = {
  pairing_set: '🃏',
  result_submitted: '⏳',
  result_confirmed: '✅',
  result_disputed: '⚠️',
  round_complete: '🏁',
  tournament_finished: '🏆',
}

// Which broadcasts surface as global toasts (the rest are silent for non-participants)
const GLOBAL_NOTIFY: Record<TournamentBroadcast['type'], boolean> = {
  pairing_set: false,           // too noisy if every round broadcasts to everyone
  result_submitted: false,      // very chatty
  result_confirmed: false,      // very chatty (could be 30+/torneo)
  result_disputed: true,        // worth knowing
  round_complete: true,
  tournament_finished: true,
}

export function TournamentBroadcastListener() {
  const addNotification = useNotificationStore(s => s.addNotification)
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

      if (!GLOBAL_NOTIFY[b.type]) return

      addNotification({
        type: 'info',
        title: b.event_name || 'Torneo',
        message: b.message,
        icon: ICON_BY_TYPE[b.type] ?? '📢',
        link: b.event_code ? `/events/live/${b.event_code}` : undefined,
      })
    })
    return unsub
  }, [addNotification])

  return null
}

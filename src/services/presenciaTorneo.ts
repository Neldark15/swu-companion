/**
 * Quién está mirando el torneo AHORA.
 *
 * ── Presencia y check-in no son lo mismo ─────────────────────────────
 *
 * Son dos preguntas distintas y el organizador necesita las dos:
 *
 *  · **Presencia** — «¿tiene la app abierta en este momento?». Es esto.
 *  · **Check-in** — «¿llegó al local?». Eso es una fila en la base
 *    (`event_registrations.status`), y sobrevive a que se le apague el
 *    teléfono.
 *
 * Usar la presencia como check-in sería un error caro: un celular en el
 * bolsillo se desconecta y el jugador sigue parado en la tienda. Si el sistema
 * lo diera por ausente, el organizador armaría la ronda sin él.
 *
 * ── Por qué presencia de Realtime y no una tabla ─────────────────────
 *
 * El estado se va solo con quien lo puso —al cerrar la pestaña, al perder la
 * señal—, que es justo lo que significa «conectado». Con una tabla habría que
 * escribir un latido, limpiar los muertos por cron, y aun así quien cierra el
 * navegador de golpe se quedaría «en línea» hasta el próximo barrido.
 *
 * El patrón está copiado de `galaxiaChat.escucharPresencia`, que lleva meses
 * funcionando. Incluido el detalle que lo hace o lo rompe: el `track()` va
 * DENTRO del callback de suscripción.
 */

import { supabase, isSupabaseReady } from './supabase'

export interface Mirando {
  userId: string
  nombre: string
  avatar: string | null
  desde: string
}

/**
 * Se anuncia en el torneo y avisa cada vez que cambia quién está.
 *
 * Lo llaman TODOS los que abren el torneo —jugadores incluidos—, porque para
 * que el organizador vea a alguien, ese alguien tiene que anunciarse. Quien
 * mira sin cuenta se suscribe pero no se anuncia: un anónimo no tiene nombre
 * que mostrar, y contarlo como «jugador conectado» sería inventar gente.
 *
 * Devuelve la función para dejar de escuchar.
 */
export function escucharPresenciaTorneo(
  eventId: string,
  yo: { id: string; nombre: string; avatar: string | null } | null,
  alCambiar: (gente: Mirando[]) => void,
): () => void {
  if (!isSupabaseReady() || !eventId) return () => {}

  const canal = supabase.channel(`torneo-presencia-${eventId}`, {
    config: { presence: { key: yo?.id ?? `anon-${Math.random().toString(36).slice(2)}` } },
  })

  const leer = () => {
    const estado = canal.presenceState<Record<string, unknown>>()
    const gente: Mirando[] = []
    for (const [clave, metas] of Object.entries(estado)) {
      const m = (metas as unknown as Record<string, unknown>[])[0] ?? {}
      // Los anónimos no entran a la lista: no tienen nombre y contarlos como
      // jugadores conectados sería inventar gente.
      if (clave.startsWith('anon-')) continue
      gente.push({
        userId: clave,
        nombre: (m.nombre as string) ?? 'Jugador',
        avatar: (m.avatar as string) ?? null,
        desde: (m.desde as string) ?? '',
      })
    }
    gente.sort((a, b) => a.desde.localeCompare(b.desde))
    alCambiar(gente)
  }

  canal
    .on('presence', { event: 'sync' }, leer)
    .subscribe(estado => {
      // DENTRO del callback: mandarlo antes de que el canal esté unido lo
      // pierde en silencio, y aparecés desconectado para todos menos para vos.
      if (estado === 'SUBSCRIBED' && yo) {
        void canal.track({ nombre: yo.nombre, avatar: yo.avatar, desde: new Date().toISOString() })
      }
    })

  return () => { void supabase.removeChannel(canal) }
}

/**
 * Las inscripciones, EN VIVO.
 *
 * `event_registrations` no estaba en la publicación de tiempo real, así que
 * el panel del organizador solo cambiaba al recargar: armaba la ronda 1 con
 * el conteo viejo y dejaba gente afuera. Ya está publicada; esto la escucha.
 *
 * Los cambios llegan filtrados por la RLS de quien escucha, así que un
 * organizador ve todas las altas y bajas de SU torneo.
 */
export function escucharInscripciones(
  eventId: string,
  alCambiar: () => void,
): () => void {
  if (!isSupabaseReady() || !eventId) return () => {}

  const canal = supabase
    .channel(`torneo-inscritos-${eventId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'event_registrations', filter: `event_id=eq.${eventId}` },
      () => alCambiar(),
    )
    .subscribe(estado => {
      // Un canal roto se ve igual que uno sano si nadie mira el estado.
      if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
        console.warn('[torneo] el canal de inscripciones no quedó:', estado)
      }
    })

  return () => { void supabase.removeChannel(canal) }
}

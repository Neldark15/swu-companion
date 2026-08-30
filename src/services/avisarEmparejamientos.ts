/**
 * Avisarle a cada jugador CONTRA QUIÉN le toca, en su mesa.
 *
 * ── Por qué no sirve un anuncio para todos ───────────────────────────
 *
 * `announcementService` manda UN mensaje a un público. Acá cada persona
 * necesita un texto distinto —el suyo—, porque «ya salieron los pareos» te
 * obliga a abrir la app y buscarte en una lista de doce. «Mesa 3, contra
 * Lemaster89» se resuelve sin abrir nada.
 *
 * Así que es una llamada por jugador. Con 12 son 12 llamadas, y con 64 serían
 * 64: se mandan en tandas para no abrir sesenta conexiones de una.
 *
 * ── Lo que este aviso NO puede hacer, dicho sin vueltas ──────────────
 *
 * El push solo llega a quien lo tenga activado. Medido el día que se armó:
 * de los 12 del primer torneo, **3**. No hay tabla de notificaciones en el
 * servidor —la campana de la app es local de cada aparato—, así que este es
 * el único canal que alcanza a otra persona.
 *
 * Por eso la función DEVUELVE a quién le llegó y a quién no, en vez de un
 * contador. Un «enviados: 12» cuando nueve no tienen push es exactamente el
 * fallo que se ve como éxito (§4d): la organización cree que avisó y en la
 * mesa nadie sabe contra quién juega.
 *
 * Quien no tenga push lo ve igual al abrir la app: los pareos están en el
 * torneo. Este aviso adelanta el trabajo, no lo reemplaza.
 */

import { supabase, isSupabaseReady } from './supabase'

export interface AvisoPareo {
  nombre: string
  userId: string | null
  mesa: number
  rival: string
  /** `false` = no tiene cuenta o no tiene los avisos puestos. */
  alcanzado: boolean
  error?: string
}

export interface ResultadoAviso {
  ok: boolean
  mensaje?: string
  ronda: number
  avisos: AvisoPareo[]
  /** A cuántos les llegó de verdad. */
  llegaron: number
  /** Cuántos van a tener que abrir la app para enterarse. */
  sinPush: number
}

/** De a cuántos a la vez. Sesenta `fetch` simultáneos ahogan al navegador. */
const TANDA = 6

export async function avisarEmparejamientos(eventCode: string): Promise<ResultadoAviso> {
  const vacio: ResultadoAviso = { ok: false, ronda: 0, avisos: [], llegaron: 0, sinPush: 0 }
  if (!isSupabaseReady()) return { ...vacio, mensaje: 'Sin conexión con el servidor' }

  const { data: sesion } = await supabase.auth.getSession()
  const token = sesion?.session?.access_token
  if (!token) return { ...vacio, mensaje: 'Necesitás sesión para avisar.' }

  // El evento y su ronda en curso.
  const { data: ev, error: errEv } = await supabase
    .from('official_events')
    .select('id, name, current_round')
    .eq('code', eventCode)
    .maybeSingle()
  // §2f: supabase-js no lanza ante un error de PostgREST.
  if (errEv) return { ...vacio, mensaje: errEv.message }
  if (!ev) return { ...vacio, mensaje: 'No se encontró ese torneo.' }

  const { data: ronda, error: errRonda } = await supabase
    .from('tournament_rounds')
    .select('id, round_number')
    .eq('event_id', ev.id)
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (errRonda) return { ...vacio, mensaje: errRonda.message }
  if (!ronda) return { ...vacio, mensaje: 'Ese torneo todavía no tiene rondas.' }

  const { data: mesas, error: errMesas } = await supabase
    .from('tournament_pairings')
    .select('table_number, player1_id, player2_id, player1_nombre, player2_nombre')
    .eq('round_id', ronda.id)
    .order('table_number')
  if (errMesas) return { ...vacio, mensaje: errMesas.message }

  // Se aplana a UNA fila por jugador: cada quien con su rival y su mesa.
  const avisos: AvisoPareo[] = []
  for (const m of mesas ?? []) {
    const mesa = m.table_number as number
    // Un `player2` nulo es un BYE, no un rival. Avisar «te toca contra nadie»
    // sería el motor inventando (§3q).
    if (m.player2_nombre) {
      avisos.push({ nombre: m.player1_nombre as string, userId: m.player1_id as string | null,
                    mesa, rival: m.player2_nombre as string, alcanzado: false })
      avisos.push({ nombre: m.player2_nombre as string, userId: m.player2_id as string | null,
                    mesa, rival: m.player1_nombre as string, alcanzado: false })
    }
  }

  const conCuenta = avisos.filter(a => a.userId)
  for (let i = 0; i < conCuenta.length; i += TANDA) {
    await Promise.all(conCuenta.slice(i, i + TANDA).map(async a => {
      try {
        const res = await fetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: `Ronda ${ronda.round_number} · Mesa ${a.mesa}`,
            body: `Te toca contra ${a.rival}.`,
            // A la pantalla del JUGADOR, no al archivo: `/torneos/<code>`
            // filtra `status='finished'` y en pleno torneo caía en «no existe
            // un torneo con ese código».
            link: `/events/play/${eventCode}`,
            // La etiqueta lleva ronda y jugador: dos rondas seguidas son dos
            // avisos distintos, no uno que reemplaza al otro.
            tag: `pareo-${eventCode}-r${ronda.round_number}-${a.userId}`,
            type: 'tournament',
            targets: { userIds: [a.userId] },
          }),
        })
        const json = await res.json().catch(() => ({}))
        // `sent > 0` es lo único que significa que LLEGÓ. Un 200 con cero
        // enviados es alguien sin los avisos puestos, no un éxito.
        a.alcanzado = res.ok && (json.sent ?? 0) > 0
        if (!res.ok) a.error = json.error || `HTTP ${res.status}`
      } catch (e) {
        a.error = e instanceof Error ? e.message : 'falló el envío'
      }
    }))
  }

  const llegaron = avisos.filter(a => a.alcanzado).length
  return {
    ok: true,
    ronda: ronda.round_number as number,
    avisos,
    llegaron,
    sinPush: avisos.length - llegaron,
  }
}

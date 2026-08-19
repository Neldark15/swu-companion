/**
 * El envío de Web Push, en UN solo sitio.
 *
 * El nombre empieza con guion bajo a propósito: Vercel no convierte en función
 * los archivos de `api/` que empiezan así, y por eso este puede exportar
 * ayudantes en vez de un `handler`.
 *
 * ── Por qué no lo llama uno al otro ──────────────────────────────────
 *
 * `/api/send-push` exige `Authorization: Bearer <JWT de usuario>` y comprueba
 * que quien llama sea admin. El cron no tiene usuario: tiene `CRON_SECRET`.
 * Podría fabricarse un JWT de servicio para llamarse a sí mismo por HTTP, pero
 * eso es una vuelta de red y una credencial más para custodiar por un trabajo
 * que ya está hecho acá.
 *
 * Lo que se comparte es lo que de verdad conviene no duplicar: la limpieza de
 * suscripciones muertas. Un endpoint que envía y NO borra los 410 acumula
 * destinatarios fantasma para siempre, y el número de «enviados» empieza a
 * mentir. Con dos copias, la segunda es la que se olvida.
 */

import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@swusv.com'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

/** Sin las dos llaves VAPID no se puede firmar nada. Se comprueba antes de leer suscripciones. */
export function pushConfigurado(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
}

export interface PayloadPush {
  title: string
  body: string
  icon?: string
  link?: string
  tag?: string
  type?: string
}

export interface SuscripcionPush {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface ResultadoPush {
  /** Cuántas llegaron al servicio de push del navegador. */
  enviados: number
  fallidos: number
  /** Suscripciones muertas (410/404) que se borraron en esta corrida. */
  borrados: number
  /** A cuántas se le intentó. `enviados + fallidos`. */
  apuntados: number
}

/**
 * Manda el mismo aviso a todas las suscripciones y limpia las que ya no existen.
 *
 * El TTL de 24 h es a propósito: si el teléfono está apagado a las 8 de la
 * mañana, el aviso espera. Con TTL corto, quien deja el teléfono cargando de
 * noche no se entera nunca — y es justo la gente que menos abre la app.
 */
export async function enviarPush(
  supabase: SupabaseClient,
  subs: SuscripcionPush[],
  payload: PayloadPush,
): Promise<ResultadoPush> {
  if (subs.length === 0) return { enviados: 0, fallidos: 0, borrados: 0, apuntados: 0 }

  const cuerpo = JSON.stringify(payload)

  const uno = async (s: SuscripcionPush) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        cuerpo,
        { TTL: 60 * 60 * 24 },
      )
      return { ok: true as const, id: s.id }
    } catch (e: unknown) {
      const err = e as { statusCode?: number }
      return { ok: false as const, id: s.id, statusCode: err?.statusCode ?? 0 }
    }
  }

  const resultados = await Promise.all(subs.map(uno))
  const enviados = resultados.filter(r => r.ok).length

  // 410 Gone y 404: el navegador tiró esa suscripción (desinstalaron la PWA,
  // borraron los datos del sitio). Reintentarla mañana es gastar por nada.
  const muertas = resultados
    .filter(r => !r.ok && (r.statusCode === 410 || r.statusCode === 404))
    .map(r => r.id)

  let borrados = 0
  if (muertas.length > 0) {
    const { count } = await supabase
      .from('push_subscriptions')
      .delete({ count: 'exact' })
      .in('id', muertas)
    borrados = count ?? 0
  }

  return { enviados, fallidos: resultados.length - enviados, borrados, apuntados: resultados.length }
}

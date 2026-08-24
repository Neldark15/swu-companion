/**
 * AVISA CUANDO UNA TRANSMISIÓN DESTACADA ESTÁ POR EMPEZAR, Y CUANDO EMPIEZA.
 *
 * Pedido de Nel para el «Meta Check-In» de Fantasy Flight: «que programes y
 * mandes notificación cuando comience».
 *
 * ── Dos avisos, no uno ────────────────────────────────────────────────
 *
 * El de arranque es el que se pidió, pero solo, llega tarde: enterarse de que
 * algo YA empezó no da tiempo a nada. Por eso va también uno diez minutos
 * antes, que es el que de verdad hace que alguien llegue. Los dos son opcionales
 * por separado y los dos son idempotentes.
 *
 * ── Idempotente por SELLO, no por «ya corrí» ──────────────────────────
 *
 * El cron corre cada cinco minutos. Sin los sellos `aviso_previo_en` y
 * `aviso_inicio_en`, la misma transmisión mandaría el mismo push doce veces por
 * hora. Se sella ANTES de enviar: si el envío falla a medias, el peor caso es
 * que alguien no reciba el aviso — el peor caso al revés es que TODOS lo
 * reciban doce veces, y eso es cómo se desinstala una app.
 *
 * ── Ventana, para no avisar de algo que ya pasó ───────────────────────
 *
 * Solo se avisa dentro de una ventana alrededor de la hora. Si el cron estuvo
 * caído dos horas, al volver NO manda «está por empezar» de algo que empezó
 * hace rato: sella y calla. Un aviso tarde es peor que ninguno.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createHash, timingSafeEqual } from 'node:crypto'
import { enviarPush, pushConfigurado, type SuscripcionPush } from './_push.js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const CRON_SECRET = process.env.CRON_SECRET

/** Cuántos minutos antes se manda el aviso de «ya casi». */
const ANTES_MIN = 10
/** Cuánto puede llegar tarde un aviso antes de que sea mejor no mandarlo. */
const TOLERANCIA_MIN = 12

function igualSeguro(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

interface Fila {
  id: string
  titulo: string
  canal: string
  empieza_en: string
  aviso_previo_en: string | null
  aviso_inicio_en: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res.status(503).json({ error: 'Supabase service role no configurado' })
  }
  if (!CRON_SECRET) {
    return res.status(503).json({ error: 'CRON_SECRET no configurado' })
  }
  const cabecera = req.headers.authorization || ''
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : null
  if (!token || !igualSeguro(token, CRON_SECRET)) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const ahora = Date.now()
  // Solo lo que empieza en la próxima media hora o empezó en la última: fuera
  // de ahí no hay nada que avisar, y la consulta se queda en una fila o dos.
  const { data, error } = await supabase
    .from('transmisiones')
    .select('id, titulo, canal, empieza_en, aviso_previo_en, aviso_inicio_en')
    .eq('activa', true)
    .gte('empieza_en', new Date(ahora - 60 * 60_000).toISOString())
    .lte('empieza_en', new Date(ahora + 60 * 60_000).toISOString())

  if (error) return res.status(500).json({ error: error.message })

  const filas = (data ?? []) as Fila[]
  if (filas.length === 0) return res.status(200).json({ revisadas: 0, avisos: [] })

  const hayPush = pushConfigurado()
  const { data: subs } = hayPush
    ? await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth')
    : { data: [] }

  const avisos: unknown[] = []

  for (const f of filas) {
    const inicio = new Date(f.empieza_en).getTime()
    if (!Number.isFinite(inicio)) continue

    // ¿Qué toca ahora? Se decide UNA cosa por corrida: si en el mismo tick
    // vencen los dos, manda el de arranque, que es el que importa.
    const faltan = (inicio - ahora) / 60_000
    const tipo: 'inicio' | 'previo' | null =
      !f.aviso_inicio_en && faltan <= 0 && faltan > -TOLERANCIA_MIN ? 'inicio'
      : !f.aviso_previo_en && faltan <= ANTES_MIN && faltan > 0 ? 'previo'
      : null

    // Se sellan los avisos que ya no tienen sentido, para que no queden
    // esperando a dispararse tarde en la próxima corrida.
    const caducados: Record<string, string> = {}
    if (!f.aviso_previo_en && faltan <= 0) caducados.aviso_previo_en = new Date().toISOString()
    if (!f.aviso_inicio_en && faltan <= -TOLERANCIA_MIN) caducados.aviso_inicio_en = new Date().toISOString()

    if (!tipo) {
      if (Object.keys(caducados).length > 0) {
        await supabase.from('transmisiones').update(caducados).eq('id', f.id)
      }
      continue
    }

    // SELLAR ANTES DE ENVIAR. Al revés, un fallo a mitad del envío deja el
    // sello sin poner y la próxima corrida vuelve a mandarle el push a todos
    // los que YA lo recibieron.
    const sello = tipo === 'inicio' ? 'aviso_inicio_en' : 'aviso_previo_en'
    const { error: errSello } = await supabase
      .from('transmisiones')
      .update({ ...caducados, [sello]: new Date().toISOString() })
      .eq('id', f.id)
      .is(sello, null)          // si otra corrida ganó la carrera, no se envía
      .select('id')
      .maybeSingle()

    if (errSello) { avisos.push({ id: f.id, tipo, error: errSello.message }); continue }

    if (!hayPush) { avisos.push({ id: f.id, tipo, push: 'VAPID no configurado' }); continue }

    const push = await enviarPush(supabase, (subs ?? []) as SuscripcionPush[], {
      title: tipo === 'inicio' ? `${f.titulo} — EN VIVO` : `${f.titulo} empieza en ${ANTES_MIN} min`,
      body: tipo === 'inicio'
        ? `${f.canal} está transmitiendo ahora. Miralo desde acá.`
        : `${f.canal}. Entrá a En Vivo y dejalo abierto: arranca solo.`,
      icon: '/icon-192.png',
      link: '/envivo',
      // Un `tag` por transmisión y tipo: dos corridas nunca apilan dos avisos.
      tag: `transmision-${f.id}-${tipo}`,
      type: 'info',
    })
    avisos.push({ id: f.id, tipo, push })
  }

  return res.status(200).json({ revisadas: filas.length, avisos })
}

/**
 * EL SOBRE DIARIO — uno para cada quien, todos los días a las 8:00 de la mañana.
 *
 * ── El horario ───────────────────────────────────────────────────────
 *
 * `0 14 * * *` en vercel.json. Los crons de Vercel corren en UTC y El Salvador
 * es UTC-6 todo el año (no hay horario de verano desde 2006), así que 14:00 UTC
 * son las 8:00 en punto acá. No hay `TZ` que configurar en el cron; si algún
 * día El Salvador adoptara horario de verano, este número hay que moverlo a
 * mano — la función de la base ya calcula el DÍA con la zona correcta, pero la
 * HORA del disparo vive acá.
 *
 * ── Repartir y avisar son dos cosas, y solo una puede fallar del todo ─
 *
 * El reparto es lo que importa: vive entero en `dar_sobre_diario()` y si eso
 * falla se responde 500 para que la corrida se vea rota. El aviso es lo otro, y
 * un fallo suyo NO tumba la respuesta: quedarse sin push es molesto, perder el
 * sobre es peor. Por eso el push va después del reparto y su error se informa
 * en el cuerpo en vez de reventar.
 *
 * ── El aviso solo llega a 4 de 26 ────────────────────────────────────
 *
 * Medido hoy: 26 perfiles, 4 con suscripción de push. O sea que el 85% de la
 * comunidad no se enteraría por acá. Por eso el aviso de verdad lo pinta la
 * app —la franja de Inicio y la campana, que leen `sobres_saldo.diario_en`— y
 * este push es el extra para quien lo tiene activado, no el único camino.
 * Si algún día suben las suscripciones, este endpoint no cambia.
 *
 * ── Correrlo dos veces no regala nada ────────────────────────────────
 *
 * `dar_sobre_diario()` es idempotente por el día (ver `sobre-diario.sql`), así
 * que un reintento de Vercel, un disparo a mano o dos invocaciones simultáneas
 * reparten UNA vez. Lo que sí se repetiría es el push, y por eso lleva `tag`:
 * el navegador reemplaza el aviso anterior en vez de apilar dos.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createHash, timingSafeEqual } from 'node:crypto'
import { enviarPush, pushConfigurado, type SuscripcionPush } from './_push'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const CRON_SECRET = process.env.CRON_SECRET

/** Comparación de tiempo constante: comparar secretos con `===` filtra su largo. */
function igualSeguro(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res.status(503).json({ error: 'Supabase service role no configurado' })
  }
  if (!CRON_SECRET) {
    // Sin secreto no se compara contra `undefined` ni se deja pasar: se corta.
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

  // ── 1. Repartir ──
  const { data, error } = await supabase.rpc('dar_sobre_diario')
  if (error) return res.status(500).json({ error: error.message })

  // La RPC devuelve UNA fila (dia, repartidos); PostgREST la entrega como array.
  const fila = Array.isArray(data) ? data[0] : data
  const repartidos = Number(fila?.repartidos ?? 0)
  const dia = String(fila?.dia ?? '')

  // Cero repartidos es el caso NORMAL de una segunda corrida del mismo día, no
  // un fallo. Y también es la señal de que no hay que avisar: si nadie recibió
  // nada, un push diciendo «ya cayó tu sobre» sería mentira.
  if (repartidos === 0) {
    return res.status(200).json({ dia, repartidos: 0, aviso: 'ya estaba repartido hoy' })
  }

  // ── 2. Avisar ──
  if (!pushConfigurado()) {
    return res.status(200).json({ dia, repartidos, push: 'VAPID no configurado' })
  }

  const { data: subs, error: errSubs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')

  if (errSubs) {
    // El reparto YA se hizo. Se informa el fallo del aviso sin perderlo.
    return res.status(200).json({ dia, repartidos, push: 'error leyendo suscripciones: ' + errSubs.message })
  }

  const push = await enviarPush(supabase, (subs ?? []) as SuscripcionPush[], {
    title: 'Cayó tu sobre diario',
    body: 'Ya está en La Bóveda. Abrilo a ver qué te tocó.',
    icon: '/icon-192.png',
    link: '/sobres',
    // Con `tag` fijo, dos avisos del mismo día se reemplazan en vez de apilarse.
    tag: 'sobre-diario',
    type: 'gift',
  })

  return res.status(200).json({ dia, repartidos, push })
}

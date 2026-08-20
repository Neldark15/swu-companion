/**
 * EL SOBRE DIARIO — TRES con los avisos activados, uno sin ellos, a las 8:00.
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
 * ── Por qué tres, y por qué el push no es el único camino ───────────
 *
 * Tres sobres es el premio por tener los avisos puestos, y `dar_sobre_diario()`
 * lo decide mirando `push_subscriptions` — lo único que el servidor puede
 * comprobar de verdad (que la app esté instalada no se ve desde Postgres; una
 * suscripción sí, y en iOS el push exige estar instalado).
 *
 * Aun así el aviso de verdad lo pinta la app —la franja de Inicio y la campana,
 * que leen `sobres_saldo.diario_en`—, porque este push por definición solo
 * alcanza a quien YA lo tiene activado. Al que le faltan los avisos hay que
 * poder decírselo justamente por otro canal.
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
import { enviarPush, pushConfigurado, type SuscripcionPush } from './_push.js'

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
  const repartidos = Number(fila?.repartidos ?? 0)   // perfiles que cobraron
  const sobres = Number(fila?.sobres ?? 0)           // sobres en total
  const conAvisos = Number(fila?.con_avisos ?? 0)    // cuántos cobraron TRES
  const dia = String(fila?.dia ?? '')

  // Cero repartidos es el caso NORMAL de una segunda corrida del mismo día, no
  // un fallo. Y también es la señal de que no hay que avisar: si nadie recibió
  // nada, un push diciendo «ya cayó tu sobre» sería mentira.
  if (repartidos === 0) {
    return res.status(200).json({ dia, repartidos: 0, sobres: 0, aviso: 'ya estaba repartido hoy' })
  }

  // ── 2. Avisar ──
  if (!pushConfigurado()) {
    return res.status(200).json({ dia, repartidos, sobres, conAvisos, push: 'VAPID no configurado' })
  }

  const { data: subs, error: errSubs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')

  if (errSubs) {
    // El reparto YA se hizo. Se informa el fallo del aviso sin perderlo.
    return res.status(200).json({ dia, repartidos, sobres, conAvisos, push: 'error leyendo suscripciones: ' + errSubs.message })
  }

  // Quien recibe este push TIENE suscripción, y tener suscripción es justo lo
  // que da los tres. Así que acá el número no hay que calcularlo por persona:
  // todo destinatario de este aviso cobró 3.
  const push = await enviarPush(supabase, (subs ?? []) as SuscripcionPush[], {
    title: 'Cayeron tus 3 sobres',
    body: 'Los tenés por dejar los avisos activados. Abrilos en La Bóveda.',
    icon: '/icon-192.png',
    link: '/sobres',
    // Con `tag` fijo, dos avisos del mismo día se reemplazan en vez de apilarse.
    tag: 'sobre-diario',
    type: 'gift',
  })

  return res.status(200).json({ dia, repartidos, sobres, conAvisos, push })
}

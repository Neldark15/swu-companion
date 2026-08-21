/**
 * AVISAR de un pedido del Mercado — al vendedor cuando le llega, y al comprador
 * cuando le responden.
 *
 * ── Por qué un endpoint y no un disparador en la base ────────────────
 *
 * Mandar un Web Push exige firmar con las llaves VAPID, y eso vive en el
 * servidor de Node, no en Postgres (no hay `pg_net` en este proyecto). Así que
 * el cliente toca este timbre y el servidor decide si tiene derecho.
 *
 * ── Quién puede avisar de qué ────────────────────────────────────────
 *
 * No lo decide este archivo: lo deciden `tomar_aviso_pedido` y
 * `tomar_aviso_respuesta`, que comprueban EN LA MISMA SENTENCIA que quien llama
 * sea la parte correcta y que el pedido esté en el estado correcto. Si no
 * devuelven fila, no hay nada que avisar y se responde 200 — para el cliente no
 * es un fallo.
 *
 * Y la marca (`aviso_en` / `aviso_respuesta_en`) va dentro de ese mismo UPDATE,
 * así que se avisa UNA vez: sin eso, quien mandó el pedido podría llamar en
 * bucle y bombardear al vendedor, que es justo lo que invita a hacer un
 * endpoint cuyo destinatario es OTRA persona.
 *
 * ── El push no es el único camino, y no puede serlo ──────────────────
 *
 * Medido: 7 de 27 perfiles tienen suscripción. Este aviso alcanza a uno de cada
 * cuatro. El resto se entera por la franja de Inicio y la pestaña de Pedidos,
 * que leen `pedidos_pendientes()`. Si algún día suben las suscripciones, este
 * archivo no cambia.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { enviarPush, pushConfigurado, type SuscripcionPush } from './_push.js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res.status(503).json({ error: 'Supabase service role no configurado' })
  }

  const cabecera = req.headers.authorization || ''
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : null
  if (!token) return res.status(401).json({ error: 'No autorizado' })

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: usuario, error: errUsuario } = await db.auth.getUser(token)
  if (errUsuario || !usuario.user) return res.status(401).json({ error: 'Sesión inválida' })

  const cuerpo = req.body as { pedidoId?: string; tipo?: string } | undefined
  const pedidoId = cuerpo?.pedidoId
  const tipo = cuerpo?.tipo === 'respuesta' ? 'respuesta' : 'solicitud'
  if (typeof pedidoId !== 'string' || !pedidoId) {
    return res.status(400).json({ error: 'Falta pedidoId' })
  }

  // Las RPC corren con la sesión de quien llama: son ellas las que comprueban
  // el derecho. Se pasa el token del usuario, NO el service role.
  const comoUsuario = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data, error } = await comoUsuario.rpc(
    tipo === 'respuesta' ? 'tomar_aviso_respuesta' : 'tomar_aviso_pedido',
    { p_pedido: pedidoId },
  )
  if (error) return res.status(500).json({ error: error.message })

  const fila = Array.isArray(data) ? data[0] : data
  const aQuien = fila?.avisar_a as string | undefined
  if (!aQuien) {
    // Ya se avisó, o no es tuyo, o el estado no corresponde. No es un fallo.
    return res.status(200).json({ avisado: false })
  }

  if (!pushConfigurado()) return res.status(200).json({ avisado: false, push: 'VAPID ausente' })

  const { data: subs, error: errSubs } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', aQuien)
  if (errSubs) return res.status(200).json({ avisado: false, push: errSubs.message })

  const quien = (fila?.quien as string | undefined) || 'Alguien'
  const cuantas = Number(fila?.cuantas ?? 0)
  const acepto = fila?.acepto === true

  const aviso = tipo === 'respuesta'
    ? {
        title: acepto ? 'Te aceptaron el pedido' : 'Te rechazaron el pedido',
        body: acepto
          ? `${quien} aceptó la venta. Pónganse de acuerdo dónde se ven.`
          : `${quien} no pudo esta vez. Las cartas volvieron al mercado.`,
      }
    : {
        title: 'Te llegó un pedido',
        body: cuantas === 1
          ? `${quien} quiere comprarte una carta. Aceptalo o rechazalo.`
          : `${quien} quiere comprarte ${cuantas} cartas. Aceptalo o rechazalo.`,
      }

  const push = await enviarPush(db, (subs ?? []) as SuscripcionPush[], {
    ...aviso,
    icon: '/icon-192.png',
    link: '/pedidos',
    // Por pedido y por tipo: la solicitud y la respuesta son dos avisos, no uno
    // que se reemplaza a sí mismo.
    tag: `pedido-${tipo}-${pedidoId}`,
    type: 'info',
  })

  return res.status(200).json({ avisado: true, push })
}

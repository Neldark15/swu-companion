/**
 * AVISARLE AL RIVAL que le anotaron una amistosa.
 *
 * ── El agujero que tapa ──────────────────────────────────────────────
 *
 * Medido: de 12 duelos, 8 son contra invitados sin cuenta, 3 están PENDIENTES
 * y solo UNO confirmado. Los pendientes no salen en el perfil de nadie porque
 * solo se publican los confirmados —nadie publica la partida de otro, §3a—,
 * pero al rival no le llegaba NADA cuando se la anotaban. La única señal era
 * abrir la app y encontrarse la franja de Inicio.
 *
 * O sea que la regla de consentimiento estaba bien y el circuito estaba roto:
 * se le pedía permiso a alguien sin decirle que se lo estaban pidiendo.
 *
 * ── Por qué un endpoint propio y no /api/send-push ───────────────────
 *
 * `send-push` solo deja pushear a OTROS si quien llama es admin. Acá quien
 * llama es un jugador cualquiera y el destinatario es otro jugador, así que
 * hace falta una regla distinta: **solo se puede avisar de un duelo del que
 * uno es el creador**, y eso se comprueba del lado del servidor.
 *
 * ── Se avisa UNA vez, y lo decide Postgres ───────────────────────────
 *
 * `tomar_aviso_amistosa()` marca `aviso_en` y devuelve a quién avisar en UNA
 * sentencia, con la condición en el WHERE. Sin eso, quien anotó el duelo podía
 * llamar a este endpoint en bucle y bombardear al rival — que es exactamente
 * la clase de cosa que un endpoint «para avisarle a otro» invita a hacer.
 *
 * Si la RPC no devuelve fila, no hay nada que avisar: o ya se avisó, o quien
 * llama no es el creador, o el duelo no está pendiente. Se responde 200 con
 * `avisado: false`, no un error: para el cliente no es un fallo.
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

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: usuario, error: errUsuario } = await supabase.auth.getUser(token)
  if (errUsuario || !usuario.user) return res.status(401).json({ error: 'Sesión inválida' })

  const dueloId = (req.body as { dueloId?: string } | undefined)?.dueloId
  if (typeof dueloId !== 'string' || !dueloId) {
    return res.status(400).json({ error: 'Falta dueloId' })
  }

  // La RPC comprueba la propiedad del duelo y reclama el aviso de una sola vez.
  const { data, error } = await supabase.rpc('tomar_aviso_amistosa', {
    p_duelo: dueloId,
    p_creador: usuario.user.id,
  })
  if (error) return res.status(500).json({ error: error.message })

  const fila = Array.isArray(data) ? data[0] : data
  const rivalId = fila?.rival_id as string | undefined
  if (!rivalId) {
    // Ya se avisó, o no es tuyo, o no está pendiente. No es un fallo.
    return res.status(200).json({ avisado: false })
  }

  if (!pushConfigurado()) return res.status(200).json({ avisado: false, push: 'VAPID ausente' })

  const { data: subs, error: errSubs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', rivalId)

  if (errSubs) return res.status(200).json({ avisado: false, push: errSubs.message })

  const quien = (fila?.creador_nombre as string | undefined) || 'Alguien'
  const push = await enviarPush(supabase, (subs ?? []) as SuscripcionPush[], {
    title: 'Tenés una amistosa por confirmar',
    body: `${quien} anotó un duelo contra vos. Confirmalo para que cuente en el ranking.`,
    icon: '/icon-192.png',
    link: '/amistosas',
    // Por duelo: dos amistosas distintas del mismo rival son dos avisos.
    tag: `amistosa-${dueloId}`,
    type: 'info',
  })

  return res.status(200).json({ avisado: true, push })
}

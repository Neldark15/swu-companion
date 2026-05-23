/**
 * /api/send-push — Vercel serverless function (Node runtime)
 *
 * POST: enviar Web Push notifications a uno o muchos usuarios.
 *
 * Auth: requiere Authorization: Bearer <JWT> de un usuario autenticado.
 *   - Cualquier usuario puede pushear A SI MISMO (target.userIds = [self])
 *   - Admins pueden pushear a otros usuarios, a participantes de un evento,
 *     o broadcast a todos los suscriptores
 *
 * Body:
 *   {
 *     title: string,
 *     body: string,
 *     icon?: string,
 *     link?: string,
 *     tag?: string,
 *     type?: string,
 *     targets: { userIds?: string[], eventId?: string, allSubscribers?: boolean }
 *   }
 *
 * Env vars requeridos:
 *   - VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 *   - VITE_SUPABASE_URL (used as supabase URL)
 *   - SUPABASE_SERVICE_ROLE_KEY (server-only, bypasses RLS)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

interface PushTargets {
  userIds?: string[]
  eventId?: string
  allSubscribers?: boolean
}

interface PushPayload {
  title: string
  body: string
  icon?: string
  link?: string
  tag?: string
  type?: string
}

interface SendPushBody extends PushPayload {
  targets: PushTargets
}

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@swusv.com'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS for same-origin (Vercel domain only — adjust if needed)
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Config check
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(503).json({ error: 'Push no configurado en el servidor (VAPID ausente)' })
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res.status(503).json({ error: 'Supabase service role no configurado' })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Auth ──
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autorizado' })

  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData.user) return res.status(401).json({ error: 'Token inválido' })
  const callerId = userData.user.id

  // Check admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', callerId)
    .single()
  const isAdmin = profile?.role === 'admin'

  // ── Validate body ──
  const body = req.body as SendPushBody | undefined
  if (!body || !body.title || !body.body || !body.targets) {
    return res.status(400).json({ error: 'Faltan campos: title, body, targets' })
  }

  // Non-admins can only push to themselves
  if (!isAdmin) {
    const onlySelf =
      body.targets.userIds &&
      body.targets.userIds.length === 1 &&
      body.targets.userIds[0] === callerId &&
      !body.targets.eventId &&
      !body.targets.allSubscribers
    if (!onlySelf) {
      return res.status(403).json({ error: 'Solo admins pueden pushear a otros usuarios' })
    }
  }

  // ── Resolve target user IDs ──
  let targetUserIds: string[] = []

  if (body.targets.userIds && body.targets.userIds.length > 0) {
    targetUserIds = [...body.targets.userIds]
  }

  if (body.targets.eventId) {
    const { data: regs } = await supabase
      .from('event_registrations')
      .select('user_id')
      .eq('event_id', body.targets.eventId)
    if (regs) targetUserIds.push(...regs.map(r => r.user_id))
  }

  if (body.targets.allSubscribers) {
    const { data: allSubs } = await supabase.from('push_subscriptions').select('user_id')
    if (allSubs) targetUserIds.push(...allSubs.map(s => s.user_id))
  }

  // Dedupe
  targetUserIds = Array.from(new Set(targetUserIds))
  if (targetUserIds.length === 0) {
    return res.status(200).json({ sent: 0, failed: 0, removed: 0, note: 'Sin destinatarios resueltos' })
  }

  // ── Fetch subscriptions ──
  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_id')
    .in('user_id', targetUserIds)

  if (subsErr) return res.status(500).json({ error: 'Error leyendo suscripciones: ' + subsErr.message })
  if (!subs || subs.length === 0) {
    return res.status(200).json({ sent: 0, failed: 0, removed: 0, note: 'Ninguno de los destinatarios tiene push activado' })
  }

  // ── Build payload ──
  const payload: PushPayload = {
    title: String(body.title).slice(0, 200),
    body: String(body.body).slice(0, 400),
    icon: body.icon || '/icon-192.png',
    link: body.link || '/',
    tag: body.tag,
    type: body.type,
  }
  const payloadJson = JSON.stringify(payload)

  // ── Send all ──
  const sendOne = async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payloadJson,
        { TTL: 60 * 60 * 24 } // 24h max delivery delay
      )
      return { ok: true as const, id: s.id }
    } catch (e: unknown) {
      type WebPushError = { statusCode?: number; message?: string }
      const err = e as WebPushError
      const statusCode = err?.statusCode ?? 0
      return { ok: false as const, id: s.id, statusCode, message: err?.message }
    }
  }

  const results = await Promise.all(subs.map(sendOne))
  const sent = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length

  // Cleanup dead subscriptions (410 Gone, 404 Not Found)
  const deadIds = results
    .filter(r => !r.ok && (r.statusCode === 410 || r.statusCode === 404))
    .map(r => r.id)

  let removed = 0
  if (deadIds.length > 0) {
    const { count } = await supabase
      .from('push_subscriptions')
      .delete({ count: 'exact' })
      .in('id', deadIds)
    removed = count ?? 0
  }

  // TODO: track failure_count for transient errors via RPC for cleanup. Skipped for MVP.

  return res.status(200).json({ sent, failed, removed, targeted: subs.length })
}

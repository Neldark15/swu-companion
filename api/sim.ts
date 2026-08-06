/**
 * /api/sim — puente entre la PWA y el laboratorio de simulación del VPS.
 *
 * El simulador (swusim) vive en el VPS con las 1 324 cartas del Premier en
 * memoria y los 22 mazos reales del Galactic Championship 2026 como rivales.
 * Este proxy existe por tres razones, y las tres son de seguridad:
 *
 *  1. **El token del VPS nunca baja al navegador.** `SWUSIM_TOKEN` solo vive
 *     aquí; el cliente jamás lo ve ni puede extraerlo del bundle.
 *  2. **Detrás de login.** Simular cuesta CPU real (el VPS tiene 2 núcleos y
 *     los comparte con una docena de servicios), así que solo usuarios
 *     autenticados: se verifica el JWT de Supabase en cada llamada.
 *  3. **La cuota del VPS se aplica POR USUARIO.** El id del usuario viaja como
 *     `X-Sim-Cliente`, que es la clave del limitador del lado del simulador
 *     (40 peticiones/minuto). Sin esto, toda la comunidad compartiría una
 *     cuota única por IP de Vercel.
 *
 * ── Contrato ──────────────────────────────────────────────────────────
 *
 * POST { action, ...payload } con Authorization: Bearer <JWT de Supabase>.
 *
 *   action: 'rivales'          → GET  /rivales
 *   action: 'validar'          → POST /validar   { mazo }
 *   action: 'simular'          → POST /simular   { mazo, rival, partidas }
 *   action: 'gauntlet'         → POST /gauntlet  { mazo, partidas } → { trabajo }
 *   action: 'trabajo'          → GET  /trabajo/<id>
 *   action: 'probar'           → POST /probar    { mazo, quita, mete, rival, partidas }
 *
 * Los topes de `partidas` se recortan AQUÍ además de en el VPS: las funciones
 * de Vercel cortan a los ~10 s, así que un `probar` de 2 000 partidas (que el
 * VPS sí aceptaría, ~15 s) moriría a medias con el trabajo ya gastado.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SWUSIM_URL = (process.env.SWUSIM_URL || '').replace(/\/+$/, '')
const SWUSIM_TOKEN = process.env.SWUSIM_TOKEN || ''
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/** id de trabajo del gauntlet, tal como los emite el VPS: "g<epoch>-<n>". */
const RX_TRABAJO = /^g\d{6,14}-\d{1,6}$/

/** Techos por acción (el VPS tiene los suyos; estos son los del proxy). */
const TOPE_PARTIDAS: Record<string, number> = {
  simular: 1500,
  probar: 1000,   // /probar corre DOS simulaciones (antes y después)
  gauntlet: 500,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  if (!SWUSIM_URL || !SWUSIM_TOKEN) {
    return res.status(503).json({ error: 'El laboratorio no está configurado en el servidor.' })
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res.status(503).json({ error: 'Supabase service role no configurado.' })
  }

  // ── Login obligatorio ──
  const authHeader = req.headers.authorization || ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!jwt) return res.status(401).json({ error: 'Inicia sesión para usar el laboratorio.' })

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
  if (userErr || !userData.user) {
    return res.status(401).json({ error: 'Sesión inválida o caducada.' })
  }
  const userId = userData.user.id

  // ── Enrutar la acción ──
  const body = (req.body ?? {}) as Record<string, unknown>
  const action = String(body.action || '')

  let metodo: 'GET' | 'POST' = 'POST'
  let ruta = ''
  let payload: Record<string, unknown> | null = null

  switch (action) {
    case 'rivales':
      metodo = 'GET'; ruta = '/rivales'
      break
    case 'trabajo': {
      const id = String(body.id || '')
      if (!RX_TRABAJO.test(id)) return res.status(400).json({ error: 'Id de trabajo inválido.' })
      metodo = 'GET'; ruta = `/trabajo/${id}`
      break
    }
    case 'validar':
      ruta = '/validar'
      payload = { mazo: body.mazo }
      break
    case 'simular':
    case 'gauntlet':
    case 'probar': {
      ruta = `/${action}`
      const tope = TOPE_PARTIDAS[action]
      const pedidas = Number(body.partidas) || tope
      payload = {
        mazo: body.mazo,
        partidas: Math.max(50, Math.min(pedidas, tope)),
      }
      if (action !== 'gauntlet' && body.rival != null) payload.rival = String(body.rival)
      if (action === 'probar') {
        payload.quita = Array.isArray(body.quita) ? body.quita.slice(0, 12) : []
        payload.mete = Array.isArray(body.mete) ? body.mete.slice(0, 12) : []
      }
      break
    }
    default:
      return res.status(400).json({ error: `Acción desconocida: «${action}»` })
  }

  // ── Reenviar al VPS ──
  try {
    const control = new AbortController()
    const temporizador = setTimeout(() => control.abort(), 25_000)
    const r = await fetch(SWUSIM_URL + ruta, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        'X-Sim-Token': SWUSIM_TOKEN,
        'X-Sim-Cliente': userId,
      },
      body: metodo === 'POST' ? JSON.stringify(payload) : undefined,
      signal: control.signal,
    })
    clearTimeout(temporizador)
    const datos = await r.json().catch(() => ({ error: 'Respuesta ilegible del simulador.' }))
    return res.status(r.status).json(datos)
  } catch (e) {
    const abortado = e instanceof Error && e.name === 'AbortError'
    return res.status(abortado ? 504 : 502).json({
      error: abortado
        ? 'El simulador tardó demasiado. Prueba con menos partidas.'
        : 'No se pudo hablar con el simulador. Reintenta en un momento.',
    })
  }
}

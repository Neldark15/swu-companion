/**
 * Libera las reservas del Mercado que se quedaron colgadas.
 *
 * Una reserva le bloquea la carta a TODA la comunidad, así que no puede durar
 * para siempre: 48 h sin que el vendedor responda, y 7 días desde que aceptó
 * sin que ninguno de los dos cierre. El pedido NO se borra — queda `vencido` en
 * el historial de ambos, porque un pedido que desaparece es peor que uno que
 * dice que venció.
 *
 * Todo eso vive en `vencer_pedidos()`; acá solo está la puerta. `17 13 * * *`
 * son las 7:17 de la mañana en El Salvador (UTC-6 todo el año), y el minuto no
 * choca con los otros crons (:07, :23, :00, :31).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createHash, timingSafeEqual } from 'node:crypto'

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
  if (!CRON_SECRET) return res.status(503).json({ error: 'CRON_SECRET no configurado' })

  const cabecera = req.headers.authorization || ''
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : null
  if (!token || !igualSeguro(token, CRON_SECRET)) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await db.rpc('vencer_pedidos')
  if (error) return res.status(500).json({ error: error.message })

  const fila = Array.isArray(data) ? data[0] : data
  return res.status(200).json({
    sinRespuesta: Number(fila?.vencidos_sin_respuesta ?? 0),
    sinCerrar: Number(fila?.vencidos_sin_cerrar ?? 0),
  })
}

/**
 * Cierre automático de torneos vencidos.
 *
 * Un torneo que ya se jugó se quedaba `open` para siempre porque nadie lo
 * cerraba. Este cron lo hace, pero SIN repartir premios: el reparto de XP,
 * puntos de ranking y subidas de nivel queda a un toque de un admin desde el
 * panel, con la clasificación a la vista.
 *
 * ── La distinción que hace todo el trabajo ───────────────────────────
 *
 * No todos los vencidos son iguales:
 *
 *   · CON clasificación → el torneo se llevó dentro de la app. Se cierra.
 *   · SIN clasificación → se jugó en la mesa y no quedó registro. Cerrarlo lo
 *     enterraría: pasaría a «Finalizado» sin nada que mostrar y los inscritos
 *     desaparecerían de la vista. A esos NO se los toca; se cuentan y se
 *     reportan para que alguien cargue lo que pasó.
 *
 * Toda esa lógica vive en `vencer_torneos()` (SECURITY DEFINER, ejecutable solo
 * por el service role) y no acá: el endpoint es la puerta, no la regla.
 *
 * ── La puerta ────────────────────────────────────────────────────────
 *
 * `Authorization: Bearer ${CRON_SECRET}`, el mismo esquema que /api/meta-ingesta.
 * Sin `CRON_SECRET` definida no hay puerta que abrir y se responde 503: es
 * preferible que el cron falle ruidosamente a que quede abierto.
 *
 * ── El horario ───────────────────────────────────────────────────────
 *
 * `23 11 * * *` en vercel.json: 11:23 UTC son las 5:23 de la mañana en El
 * Salvador. La gracia de `vencer_torneos()` es de doce horas, así que un torneo
 * que empezó a las 3 de la tarde vence a las 3 de la mañana y esta corrida lo
 * agarra la misma madrugada. Una vez al día alcanza: no hay nada que ganar
 * cerrando un torneo tres horas antes.
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

  const { data, error } = await supabase.rpc('vencer_torneos')

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  // `sin_resultados` es el número que importa mirar: si crece, hay torneos
  // jugándose fuera de la app y sus participantes no van a ver nada.
  return res.status(200).json(data)
}

/**
 * /api/tcg-prices — proxy de solo lectura a tcgcsv.com
 *
 * ── Por qué existe ────────────────────────────────────────────────────
 *
 * tcgcsv.com responde 200 pero NO manda `Access-Control-Allow-Origin`, así
 * que el navegador bloquea la petición: desde la app daba `Failed to fetch`.
 * Resultado: la función de precios nunca funcionó para NINGÚN set, y
 * `card_prices` quedó en 0 filas desde su creación.
 *
 * (Aparte de esto, el mapa de sets tenía las claves mal —'SOP' y 'ALT' en vez
 * de SEC y LAW, y faltaba ASH—, arreglado en pricing.ts. Eran dos problemas
 * distintos apilados: con el mapa arreglado igual no llegaba nada.)
 *
 * ── Por qué es un proxy CERRADO ───────────────────────────────────────
 *
 * Un proxy que reenvía cualquier URL es un problema de seguridad: se lo puede
 * usar para atacar a terceros desde el dominio de uno, o para alcanzar la red
 * interna. Acá solo se admite la categoría 79 (SWU), un `groupId` numérico de
 * una lista fija, y dos recursos: `products` y `prices`. Cualquier otra cosa
 * responde 400 sin tocar la red.
 *
 * ── Caché ─────────────────────────────────────────────────────────────
 *
 * El archivo de productos pesa ~1.2 MB y los precios cambian una vez al día.
 * `s-maxage` deja que la CDN de Vercel lo sirva sin volver al origen, así que
 * 16 usuarios consultando precios generan una descarga, no dieciséis.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

/** Categoría de Star Wars: Unlimited en TCGPlayer. */
const SWU_CATEGORY = 79

/**
 * Los grupos que la app pide. Tiene que coincidir con SET_GROUP_MAP de
 * src/services/pricing.ts — si se agrega una expansión allá, va también acá.
 */
const ALLOWED_GROUPS = new Set([
  23405, // SOR — Spark of Rebellion
  23488, // SHD — Shadows of the Galaxy
  23597, // TWI — Twilight of the Republic
  23956, // JTL — Jump to Lightspeed
  24279, // LOF — Legends of the Force
  24387, // SEC — Secrets of Power
  24572, // LAW — A Lawless Time
  24660, // ASH — Ashes of the Empire
  24622, // TS26 — Twin Suns
])

const ALLOWED_RESOURCES = new Set(['products', 'prices'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Solo GET' })
  }

  const groupId = Number(req.query.group)
  const resource = String(req.query.resource ?? '')

  if (!Number.isInteger(groupId) || !ALLOWED_GROUPS.has(groupId)) {
    return res.status(400).json({ error: 'group no permitido' })
  }
  if (!ALLOWED_RESOURCES.has(resource)) {
    return res.status(400).json({ error: 'resource debe ser products o prices' })
  }

  const url = `https://tcgcsv.com/tcgplayer/${SWU_CATEGORY}/${groupId}/${resource}`

  try {
    // Sin timeout, una caída de tcgcsv dejaría la función colgada hasta que
    // Vercel la corte, gastando el presupuesto de ejecución.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)
    // tcgcsv rechaza con 401 cualquier petición sin `User-Agent`, y el fetch
    // de Node no manda uno (curl sí, por eso a mano funcionaba y desde Vercel
    // no). Identificarse es además lo correcto con un servicio gratuito.
    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'swu-companion/1.0 (+https://www.swusv.com)',
        Accept: 'application/json',
      },
    })
    clearTimeout(timeout)

    if (!upstream.ok) {
      return res.status(502).json({ error: `tcgcsv respondió ${upstream.status}` })
    }

    const data = await upstream.json()

    // 6 h en la CDN + 24 h sirviendo el valor viejo mientras revalida: un
    // precio de ayer es infinitamente mejor que un guion.
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400')
    return res.status(200).json(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error desconocido'
    return res.status(502).json({ error: `No se pudo consultar tcgcsv: ${msg}` })
  }
}

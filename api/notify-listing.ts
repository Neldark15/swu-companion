/**
 * /api/notify-listing — avisar que alguien puso cartas en venta.
 *
 * ── Por qué no lo hace el cliente ─────────────────────────────────────
 *
 * `/api/send-push` solo deja pushear a TODOS si quien llama es admin, y con
 * razón: es el vector de spam más obvio de la app. Pero avisar de una carta
 * nueva en venta es legítimo y lo hace cualquiera. Así que va por acá, donde
 * el servidor puede poner las condiciones que el cliente no puede saltarse.
 *
 * ── Las dos condiciones ───────────────────────────────────────────────
 *
 * 1. **Se agrupa.** Publicar las 30 cartas de un sobre mandaría 30
 *    notificaciones a las 16 personas de la comunidad. Nadie aguanta eso: lo
 *    primero que hace es apagar las notificaciones, y ahí se pierde el canal
 *    para siempre —incluido el de los torneos, que es el que de verdad
 *    importa—. Un aviso por vendedor por hora, diciendo cuántas cartas puso.
 *
 * 2. **Se verifica.** El servidor lee las publicaciones reales del vendedor
 *    en la base; el cliente no manda ni el texto ni la cuenta. Si no publicó
 *    nada, no hay aviso que mandar.
 *
 * ── A quién le llega qué ──────────────────────────────────────────────
 *
 * A todos —que es lo que se pidió— pero el MENSAJE cambia: si la carta está
 * en tu lista de buscadas, el aviso lo dice y te lleva directo a ella. Esa es
 * la notificación que nadie silencia; «alguien publicó algo» es ruido.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@swusv.com'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

/** Un aviso por vendedor por hora. */
const ESPERA_MS = 60 * 60 * 1000
/** Solo cuentan las publicaciones recientes: no se re-anuncia el catálogo viejo. */
const VENTANA_MS = 2 * 60 * 60 * 1000

interface Suscripcion {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(503).json({ error: 'Push no configurado en el servidor' })
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res.status(503).json({ error: 'Supabase service role no configurado' })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Quién llama ──
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autorizado' })

  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData.user) return res.status(401).json({ error: 'Token inválido' })
  const vendedor = userData.user.id

  // ── Freno: un aviso por hora ──
  const { data: ultimo } = await supabase
    .from('listing_alerts')
    .select('sent_at')
    .eq('seller_id', vendedor)
    .maybeSingle()

  if (ultimo?.sent_at && Date.now() - new Date(ultimo.sent_at).getTime() < ESPERA_MS) {
    // No es un error: la persona publicó otra carta dentro de la misma hora y
    // el aviso anterior ya la cubre. Se responde 200 para que el cliente no
    // muestre un fallo por algo que funcionó como debe.
    return res.status(200).json({ enviado: false, motivo: 'ya se avisó hace poco' })
  }

  // ── Qué publicó de verdad. El cliente no manda nada de esto. ──
  const desde = new Date(Date.now() - VENTANA_MS).toISOString()
  const { data: publicadas } = await supabase
    .from('collection')
    .select('card_id, sale_price, listed_at')
    .eq('user_id', vendedor)
    .eq('for_sale', true)
    .gte('listed_at', desde)
    .order('listed_at', { ascending: false })

  const cartas = publicadas ?? []
  if (cartas.length === 0) {
    return res.status(200).json({ enviado: false, motivo: 'no hay publicaciones recientes' })
  }

  const { data: perfilVendedor } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', vendedor)
    .single()
  const nombre = perfilVendedor?.name ?? 'Alguien'

  // ── A quién ──
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
  const destinos = (subs ?? []).filter(s => s.user_id !== vendedor) as Suscripcion[]
  if (destinos.length === 0) {
    return res.status(200).json({ enviado: false, motivo: 'nadie suscrito' })
  }

  // ── Quién estaba buscando alguna de estas cartas ──
  const idsCartas = cartas.map(c => c.card_id)
  const { data: deseos } = await supabase
    .from('wishlist')
    .select('user_id, card_id')
    .in('card_id', idsCartas)

  const buscadaPor = new Map<string, string>()
  for (const d of deseos ?? []) {
    // Si alguien busca varias, alcanza con nombrar una.
    if (!buscadaPor.has(d.user_id as string)) {
      buscadaPor.set(d.user_id as string, d.card_id as string)
    }
  }

  // Los nombres de las cartas salen de la app, no de la base: se manda el id
  // y el service worker abre la ficha. Para el TEXTO hace falta el nombre, y
  // eso lo tiene el cliente — así que lo manda como pista y se usa solo si
  // coincide con una carta realmente publicada.
  const pista = (req.body as { cardName?: string; cardId?: string } | undefined) ?? {}
  const nombreCarta =
    pista.cardId && idsCartas.includes(pista.cardId) && typeof pista.cardName === 'string'
      ? pista.cardName.slice(0, 80)
      : null

  const n = cartas.length
  const generico = {
    title: `${nombre} puso cartas en venta`,
    body: n === 1
      ? (nombreCarta ? `${nombreCarta} — mirá en Contrabando` : 'Mirá en Contrabando')
      : `${n} cartas nuevas en Contrabando`,
    link: '/explore',
  }

  let enviados = 0
  let fallidos = 0
  const muertas: string[] = []

  await Promise.all(destinos.map(async s => {
    const buscada = buscadaPor.get(s.user_id)
    const carga = buscada
      ? {
          title: 'Una carta que buscabas está en venta',
          body: nombreCarta && pista.cardId === buscada
            ? `${nombre} publicó ${nombreCarta}`
            : `${nombre} publicó una carta de tu lista de buscadas`,
          link: `/cards/${buscada}`,
        }
      : generico

    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ ...carga, tag: `venta-${vendedor}`, type: 'venta' }),
      )
      enviados++
    } catch (e) {
      fallidos++
      // 404/410 = el navegador tiró la suscripción. Guardarla es basura que
      // se reintenta para siempre.
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) muertas.push(s.id)
    }
  }))

  if (muertas.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', muertas)
  }

  await supabase
    .from('listing_alerts')
    .upsert({ seller_id: vendedor, sent_at: new Date().toISOString(), card_count: n })

  return res.status(200).json({
    enviado: true,
    cartas: n,
    enviados,
    fallidos,
    suscripcionesBorradas: muertas.length,
    conBusqueda: buscadaPor.size,
  })
}

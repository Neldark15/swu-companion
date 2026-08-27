/**
 * Recordatorio de «forjá tu sable», por push y UNA SOLA VEZ por persona.
 *
 * Medido el día que se armó: **4 de 41 cuentas** tienen sable forjado. El
 * Taller lleva días abierto para todos y casi nadie entró, así que el aviso
 * vale la pena — pero una vez.
 *
 * ── NO tiene entrada en `vercel.json`, y es a propósito ──────────────
 *
 * Esto NO es un cron: se dispara a mano cuando se quiere. Mandarle un aviso a
 * gente real es una decisión de producto, no algo que deba pasar solo porque
 * el código se desplegó. Si algún día se quiere periódico, es una línea en
 * `crons` — pero entonces hay que releer si el mensaje sigue siendo cierto.
 *
 * ── Las tres reglas que se heredan de los avisos que ya existen ──────
 *
 * 1. **Se sella ANTES de enviar** (§4d). El peor caso así es que alguien no
 *    reciba el aviso; al revés es que lo reciba doce veces, que es cómo se
 *    desinstala una app. Con la fila puesta, una segunda corrida no manda nada.
 * 2. **Solo a quien NO tiene sable.** Recordarle forjar a quien ya forjó no es
 *    un aviso, es ruido — y delata que el sistema no mira lo que dice mirar.
 * 3. **Las suscripciones muertas las limpia `enviarPush`** con los 410/404,
 *    igual que el sobre diario. No se duplica esa lógica acá.
 *
 * El push alcanza a un tercio de la comunidad, así que NO es el único canal:
 * el recordatorio de verdad vive en el perfil (`AvisoForjaSable`), pegado a la
 * barra de XP que cambia al forjar, y en Ajustes donde antes se elegía el
 * color de la hoja a mano.
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
    return res.status(503).json({ error: 'CRON_SECRET no configurado' })
  }

  const cabecera = req.headers.authorization || ''
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : null
  if (!token || !igualSeguro(token, CRON_SECRET)) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  /* `?ensayo=1` cuenta a quién le tocaría y NO manda nada. Existe porque la
     única forma de comprobar a quién alcanza un envío es contarlo antes: una
     vez enviado ya no se puede deshacer. */
  const ensayo = String(req.query.ensayo ?? '') === '1'

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Quiénes: tienen push, NO tienen sable, y no se les avisó todavía ──
  const [{ data: subs, error: errSubs }, { data: conSable, error: errSable }, { data: yaAvisados, error: errAvisados }] =
    await Promise.all([
      supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth, user_id'),
      supabase.from('sable_diseno').select('user_id'),
      supabase.from('sable_recordatorio').select('user_id'),
    ])

  // §2f: supabase-js NO lanza ante un error de PostgREST. Sin mirar `error`,
  // una lista vacía por fallo se ve idéntica a «no hay nadie a quien avisar».
  if (errSubs) return res.status(500).json({ error: 'suscripciones: ' + errSubs.message })
  if (errSable) return res.status(500).json({ error: 'diseños: ' + errSable.message })
  if (errAvisados) return res.status(500).json({ error: 'avisados: ' + errAvisados.message })

  const forjaron = new Set((conSable ?? []).map(f => f.user_id as string))
  const avisados = new Set((yaAvisados ?? []).map(f => f.user_id as string))

  /* Una persona puede tener VARIOS aparatos suscritos. Se agrupa por cuenta
     para no mandarle el mismo aviso tres veces a la misma persona por tener
     el teléfono, la tablet y la compu. */
  const porPersona = new Map<string, SuscripcionPush[]>()
  for (const s of subs ?? []) {
    const uid = s.user_id as string | null
    if (!uid || forjaron.has(uid) || avisados.has(uid)) continue
    const lista = porPersona.get(uid) ?? []
    lista.push({ id: s.id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth } as SuscripcionPush)
    porPersona.set(uid, lista)
  }

  const personas = [...porPersona.keys()]
  if (ensayo) {
    return res.status(200).json({
      ensayo: true, personas: personas.length,
      aparatos: [...porPersona.values()].reduce((n, l) => n + l.length, 0),
      conSable: forjaron.size, yaAvisados: avisados.size,
    })
  }
  if (personas.length === 0) {
    return res.status(200).json({ enviados: 0, aviso: 'no queda nadie a quien avisar' })
  }
  if (!pushConfigurado()) {
    return res.status(503).json({ error: 'VAPID no configurado' })
  }

  // ── El sello va PRIMERO (§4d) ──
  const { error: errSello } = await supabase
    .from('sable_recordatorio')
    .insert(personas.map(user_id => ({ user_id })))
  if (errSello) {
    return res.status(500).json({ error: 'no se pudo sellar, no se envía nada: ' + errSello.message })
  }

  const resultado = await enviarPush(
    supabase,
    [...porPersona.values()].flat(),
    {
      title: 'Tu sable te espera',
      body: 'Forjá el tuyo en el Taller Kyber y tu barra de XP toma la empuñadura y el color de tu cristal.',
      link: '/sable',
      tag: 'sable-recordatorio',
    },
  )

  return res.status(200).json({ personas: personas.length, ...resultado })
}

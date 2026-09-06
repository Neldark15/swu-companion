/**
 * EL RELOJ DE LA LIGA.
 *
 * `liga_vencidas()` estaba escrita desde el primer día —sella por silencio lo
 * reportado que nadie confirmó, y manda a la cola del árbitro lo que nadie
 * jugó— y **no la llamaba nadie**: cero archivos de liga en `api/`, cero
 * entradas de liga entre los seis crons de `vercel.json`. El `plazoTexto()`
 * que la pantalla ya pintaba era un reloj sin maquinaria.
 *
 * ── El orden importa, y es uno solo ──────────────────────────────────
 *
 * Primero `liga_avisos()`, después `liga_vencidas()`. Al revés, una partida
 * podría quedar sellada por silencio en la misma corrida en que se le avisa a
 * la persona que la confirme: el aviso llegaría a pedir algo que ya no se
 * puede hacer. `liga_avisos` además ignora todo lo que ya venció, así que las
 * dos guardas apuntan al mismo sitio desde los dos lados.
 *
 * ── UN aviso por persona y por corrida ───────────────────────────────
 *
 * Alguien con tres partidas abiertas recibiría tres notificaciones seguidas, y
 * tres notificaciones seguidas de la misma app se leen como una sola cosa:
 * ruido. Se manda **una**, la más urgente, y el resto se cuenta («y 2 más»).
 * El push es un codazo; el detalle está en la pantalla, que es adonde lleva.
 *
 * El orden de urgencia no es de gusto:
 *   1. `silencio`  — ya pasó y no lo podés deshacer. Es lo único que hay que
 *                    saber sí o sí.
 *   2. `ultima`    — te quedan horas para decir «no fue así».
 *   3. `confirmar` — te quedan días.
 *   4. `jugar`     — andá a jugarla.
 *
 * ── Y el push NO puede ser el único camino ───────────────────────────
 *
 * Medido para `/envivo` (§4d): 13 de 39 cuentas tienen push activado. Un aviso
 * que solo viaja por push llega a un tercio de la comunidad. Lo que cubre al
 * resto es la franja de la pantalla de la liga, que lee el MISMO hecho —el
 * estado de la partida— así que si este cron no corrió, la app tampoco anuncia
 * nada. Sin ese segundo canal, esto sería un reloj para los que ya estaban
 * mirando la hora.
 *
 * ── La puerta ────────────────────────────────────────────────────────
 *
 * `Authorization: Bearer ${CRON_SECRET}`, igual que los otros cinco. Sin
 * secreto no hay puerta que abrir y se responde 503: es preferible que el cron
 * falle ruidosamente a que quede abierto.
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

type Tipo = 'silencio' | 'ultima' | 'confirmar' | 'jugar'

interface Aviso {
  user_id: string
  tipo: Tipo
  jornada: number | null
  dias: number | null
  rival: string | null
  code: string | null
}

/** Menor número = más urgente. */
const URGENCIA: Record<Tipo, number> = { silencio: 0, ultima: 1, confirmar: 2, jugar: 3 }

/**
 * El texto de cada aviso.
 *
 * Dice SIEMPRE qué hacer y cuánto queda. «Tenés una partida pendiente» no es
 * un aviso: es un recordatorio de que existe una app.
 */
function redactar(a: Aviso, extras: number): { title: string; body: string } {
  const rival = a.rival ?? 'tu rival'
  const j = a.jornada != null ? `Jornada ${a.jornada}` : 'Tu partida'
  const mas = extras > 0 ? ` · y ${extras} ${extras === 1 ? 'partida más' : 'partidas más'}` : ''

  switch (a.tipo) {
    case 'silencio':
      return {
        title: 'Se cerró tu partida de la liga',
        body: `${j}: pasó el plazo sin tu respuesta, así que el resultado de ${rival} quedó firme.${mas}`,
      }
    case 'ultima': {
      const cuando = a.dias === 0 ? 'HOY' : a.dias === 1 ? 'mañana' : `en ${a.dias} días`
      return {
        title: 'Última llamada para confirmar',
        body: `${j}: ${rival} reportó el marcador y el plazo vence ${cuando}. Si no respondés, queda firme.${mas}`,
      }
    }
    case 'confirmar':
      return {
        title: 'Te toca confirmar un resultado',
        body: `${j}: ${rival} reportó el marcador. Confirmalo o decí que no fue así.${mas}`,
      }
    default: {
      const cuando = a.dias === 0 ? 'hoy' : a.dias === 1 ? 'mañana' : `en ${a.dias} días`
      return {
        title: 'Tu jornada está por vencer',
        body: `${j} contra ${rival}: vence ${cuando} y todavía no la jugaron.${mas}`,
      }
    }
  }
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

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  /* 1 · Los avisos ANTES del plazo. El sello vive dentro del WHERE del UPDATE
     de la propia función, así que lo que vuelve acá es —por construcción— lo
     que esta corrida ganó: dos corridas simultáneas reparten en vez de
     duplicar (§4d). */
  const { data: avisos, error: eAvisos } = await supabase.rpc('liga_avisos')
  if (eAvisos) return res.status(500).json({ error: eAvisos.message, paso: 'avisos' })

  /* 2 · El plazo. Va DESPUÉS: si sellara primero, el paso 1 podría pedirle a
     alguien que confirme algo que acaba de quedar firme. */
  const { data: vencidas, error: eVencidas } = await supabase.rpc('liga_vencidas')
  if (eVencidas) return res.status(500).json({ error: eVencidas.message, paso: 'vencidas' })

  const filas: Aviso[] = [
    ...((avisos ?? []) as Aviso[]),
    ...((vencidas ?? []) as Array<{ rival_user_id: string; tipo: string }>).map(v => ({
      user_id: v.rival_user_id,
      tipo: 'silencio' as Tipo,
      jornada: null, dias: null, rival: null, code: null,
    })),
  ].filter(a => a.user_id)

  const resumen = {
    avisos: (avisos ?? []).length,
    selladas: (vencidas ?? []).length,
    personas: new Set(filas.map(a => a.user_id)).size,
    enviados: 0, sin_push: 0,
  }

  if (filas.length === 0 || !pushConfigurado()) {
    // Sin push configurado el reloj IGUAL corrió: sellar es su trabajo
    // principal, avisar es el segundo. Se informa para que se note.
    return res.status(200).json({ ...resumen, push: pushConfigurado() ? 'sin destinatarios' : 'no configurado' })
  }

  // Una sola lectura de suscripciones para todos los destinatarios.
  const { data: subs, error: eSubs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_id')
    .in('user_id', [...new Set(filas.map(a => a.user_id))])
  if (eSubs) return res.status(500).json({ ...resumen, error: eSubs.message, paso: 'suscripciones' })

  const porPersona = new Map<string, SuscripcionPush[]>()
  for (const s of (subs ?? []) as Array<SuscripcionPush & { user_id: string }>) {
    const lista = porPersona.get(s.user_id) ?? []
    lista.push({ id: s.id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })
    porPersona.set(s.user_id, lista)
  }

  // Agrupar por persona y quedarse con la más urgente.
  const deCadaUno = new Map<string, Aviso[]>()
  for (const a of filas) {
    const lista = deCadaUno.get(a.user_id) ?? []
    lista.push(a)
    deCadaUno.set(a.user_id, lista)
  }

  for (const [userId, suyos] of deCadaUno) {
    const destinos = porPersona.get(userId)
    if (!destinos || destinos.length === 0) { resumen.sin_push++; continue }

    suyos.sort((x, y) => URGENCIA[x.tipo] - URGENCIA[y.tipo])
    const principal = suyos[0]
    const { title, body } = redactar(principal, suyos.length - 1)

    const r = await enviarPush(supabase, destinos, {
      title,
      body,
      link: principal.code ? `/liga/${principal.code}` : '/profile',
      // Un `tag` por persona: si llegaran dos corridas el mismo día, el sistema
      // reemplaza el aviso en vez de apilar dos globos que dicen lo mismo.
      tag: 'liga-reloj',
      type: 'liga',
    })
    resumen.enviados += r.enviados
  }

  return res.status(200).json(resumen)
}

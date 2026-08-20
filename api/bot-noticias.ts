/**
 * EL BOT DE NOTICIAS — mira el catálogo y avisa cuando entran cartas nuevas.
 *
 * ── Lo que este bot NO hace, y es lo más importante ──────────────────
 *
 * No inventa nada. No hay una sola línea de texto generada por una IA acá: los
 * títulos y resúmenes son plantillas con huecos rellenados por campos literales
 * del catálogo. Eso no es tacañería, es estructural — no existe ningún punto
 * del sistema donde algo pueda alucinar una carta que no existe.
 *
 * Tampoco dice «spoiler» ni «revelada hoy». No hay ninguna fuente que diga
 * cuándo se reveló una carta: el único campo candidato del API oficial trae el
 * mismo valor centinela en 4.840 de 9.185 cartas. Lo que este bot sabe, y lo
 * único que afirma, es que el catálogo de api.swuapi.com incorporó cartas que
 * antes no tenía. Se dice con esas palabras y con la fuente al lado.
 *
 * ── Por qué la foto propia y no `?since=` ────────────────────────────
 *
 * Medido contra el API: `?since=ayer` devuelve 8.661 de 9.185 filas y CERO son
 * cartas nuevas — el scraper de swuapi reescribe casi todo el catálogo en cada
 * corrida, así que `updated_at` no distingue nada. Un bot que diffee por ahí
 * publicaría 8.661 novedades falsas por día.
 *
 * ── Y por qué se cuenta la CARTA y no la lámina ──────────────────────
 *
 * El catálogo son 9.185 impresiones de ~2.300 cartas. El 27 de junio entraron
 * 838 filas que eran variantes Hyperspace y Prestige de cartas ya conocidas:
 * sin el filtro `variantType === 'Standard'` el bot habría publicado 838
 * «cartas nuevas» que no lo eran. La clave es (nombre|subtítulo).
 *
 * ── Todo entra como BORRADOR ─────────────────────────────────────────
 *
 * `published: false` explícito, porque `news.published` viene DEFAULT true. El
 * modo de fallo de un bot honesto no es que el dato sea falso: es que la frase
 * alrededor lo sea. Eso solo lo ve una persona, y son unas pocas notas al mes.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, timingSafeEqual } from 'node:crypto'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const CRON_SECRET = process.env.CRON_SECRET
/** Freno de emergencia sin volver a desplegar: se pone en 1 y el bot se calla. */
const APAGADO = process.env.BOT_NOTICIAS_OFF === '1'

/**
 * La identidad del bot. `news.author_id` es NOT NULL pero NO tiene clave
 * foránea, así que el bot puede firmar con lo suyo sin crear una cuenta.
 *
 * Va CLAVADA acá y no se lee jamás del cuerpo de la petición: este endpoint
 * escribe con service_role, que se salta la RLS entera. Si el autor viniera de
 * afuera, cualquiera que adivinara el secreto podría publicar firmando como una
 * persona de verdad.
 */
const AUTOR_BOT = '00000000-0000-4000-8000-000000000b07'

/** Fuente. Es un API de la comunidad, el mismo del que ya vive toda la app. */
const EXPORT = 'https://api.swuapi.com/export/all'

/**
 * Piso de cordura. Si el API devuelve menos que esto, algo se rompió de su lado
 * y NO se toca la foto: sin este control, una respuesta parcial haría que la
 * próxima corrida viera como «nuevas» todas las que faltaron. Es la misma
 * lección del centinela de completitud del catálogo local (CLAUDE.md §2c),
 * donde `count < 2000` dejaba pasar una descarga cortada en 4.500.
 */
const MINIMO_CREIBLE = 8000

interface CartaExport {
  name?: string
  subtitle?: string | null
  setCode?: string
  variantType?: string
}

/** Comparación de tiempo constante: comparar secretos con `===` filtra su largo. */
function igualSeguro(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

/** La identidad de una CARTA, no de una impresión. */
function claveDe(c: CartaExport): string {
  return `${(c.name ?? '').trim().toLowerCase()}|${(c.subtitle ?? '').trim().toLowerCase()}`
}

async function bitacora(
  db: SupabaseClient,
  fila: { fuente: string; vistos?: number; nuevos?: number; publico?: string; error?: string },
) {
  // La bitácora nunca puede tumbar la corrida: se anota y si falla, mala suerte.
  await db.from('bot_corridas').insert(fila).then(undefined, () => {})
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
  if (APAGADO) return res.status(200).json({ apagado: true })

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── 1. Bajar el catálogo ──
  let cartas: CartaExport[]
  try {
    const r = await fetch(EXPORT, {
      headers: { 'User-Agent': 'swu-companion/1.0 (+https://swusv.com)' },
    })
    if (!r.ok) throw new Error(`el API respondió ${r.status}`)
    const cuerpo = (await r.json()) as { cards?: CartaExport[] }
    cartas = cuerpo.cards ?? []
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await bitacora(db, { fuente: 'swuapi:export', error: msg })
    return res.status(200).json({ ok: false, error: msg })
  }

  if (cartas.length < MINIMO_CREIBLE) {
    // Ni se publica ni se toca la foto. Ver MINIMO_CREIBLE.
    const msg = `respuesta corta: ${cartas.length} cartas`
    await bitacora(db, { fuente: 'swuapi:export', vistos: cartas.length, error: msg })
    return res.status(200).json({ ok: false, error: msg })
  }

  // ── 2. Quedarse con las CARTAS, no con las láminas ──
  const porClave = new Map<string, CartaExport>()
  for (const c of cartas) {
    if (c.variantType !== 'Standard') continue
    const k = claveDe(c)
    if (k === '|') continue
    if (!porClave.has(k)) porClave.set(k, c)
  }

  // ── 3. Contra la foto ──
  const { data: foto, error: errFoto } = await db.from('bot_catalogo_foto').select('clave')
  if (errFoto) {
    await bitacora(db, { fuente: 'swuapi:export', error: errFoto.message })
    return res.status(500).json({ error: errFoto.message })
  }
  const conocidas = new Set((foto ?? []).map(f => f.clave as string))

  // La PRIMERA corrida siembra y no publica. Sin esto, el estreno del bot sería
  // una noticia diciendo que entraron 2.300 cartas de golpe.
  const primeraVez = conocidas.size === 0
  const nuevas = [...porClave.entries()].filter(([k]) => !conocidas.has(k))

  if (nuevas.length > 0) {
    const filas = nuevas.map(([clave, c]) => ({ clave, set_code: c.setCode ?? null }))
    // De a 500 para no mandar 2.300 filas en una sentencia.
    for (let i = 0; i < filas.length; i += 500) {
      const { error } = await db.from('bot_catalogo_foto').upsert(filas.slice(i, i + 500))
      if (error) {
        await bitacora(db, { fuente: 'swuapi:export', error: 'sembrando: ' + error.message })
        return res.status(500).json({ error: error.message })
      }
    }
  }

  if (primeraVez) {
    await bitacora(db, {
      fuente: 'swuapi:export', vistos: porClave.size, nuevos: 0,
      publico: `siembra inicial de ${nuevas.length}, sin publicar`,
    })
    return res.status(200).json({ sembrado: nuevas.length, publicado: null })
  }

  if (nuevas.length === 0) {
    await bitacora(db, { fuente: 'swuapi:export', vistos: porClave.size, nuevos: 0 })
    return res.status(200).json({ nuevas: 0, publicado: null })
  }

  // ── 4. La nota, una por set ──
  const porSet = new Map<string, number>()
  for (const [, c] of nuevas) {
    const s = c.setCode ?? '¿?'
    porSet.set(s, (porSet.get(s) ?? 0) + 1)
  }

  const hoy = new Date().toISOString().slice(0, 10)
  const escritas: string[] = []

  for (const [set, cuantas] of porSet) {
    const nota = {
      author_id: AUTOR_BOT,
      title: cuantas === 1
        ? `Una carta nueva de ${set} en el catálogo`
        : `${cuantas} cartas nuevas de ${set} en el catálogo`,
      // Se dice EXACTAMENTE lo que se sabe: que el catálogo las incorporó. No
      // que FFG las reveló hoy — eso el bot no lo sabe y no hay dónde mirarlo.
      summary: cuantas === 1
        ? `El catálogo de cartas incorporó una carta de ${set} que antes no estaba. Ya se puede buscar en la app.`
        : `El catálogo de cartas incorporó ${cuantas} cartas de ${set} que antes no estaban. Ya se pueden buscar en la app.`,
      tag: 'Catálogo',
      tag_color: '#f5a524',
      // Adonde de verdad sirve ir: el buscador filtrado por ese set.
      url: `/cards?set=${encodeURIComponent(set)}`,
      kind: 'news',
      // Explícito: `published` viene DEFAULT true en esta tabla.
      published: false,
      // Idempotencia. Un reintento de Vercel choca contra el índice único y no
      // duplica la noticia delante de la comunidad.
      fuente_ref: `swuapi:cartas:${set}:${hoy}`,
    }

    const { error } = await db.from('news').insert(nota)
    // 23505 es el choque contra el índice único, o sea «ya estaba»: no es fallo.
    if (error && error.code !== '23505') {
      await bitacora(db, { fuente: 'swuapi:export', error: error.message })
      return res.status(500).json({ error: error.message })
    }
    if (!error) escritas.push(`${set}:${cuantas}`)
  }

  await bitacora(db, {
    fuente: 'swuapi:export', vistos: porClave.size, nuevos: nuevas.length,
    publico: escritas.join(', ') || 'nada (ya estaban)',
  })

  return res.status(200).json({ nuevas: nuevas.length, borradores: escritas })
}

/**
 * El chat de a dos, montado sobre la misma sala que el resto del chat.
 *
 * ── Lo que ya existía y NO se rehizo ─────────────────────────────────
 *
 * Los mensajes, los adjuntos de carta y de mazo, el borrado suave, la
 * moderación de admin, el tiempo real y las marcas de leído viven en
 * `galaxiaChat.ts` y en `galaxia_mensajes`. Una conversación privada es un
 * ALCANCE más (`dm`), no un sistema aparte.
 *
 * ── Por qué la conversación tiene fila propia ────────────────────────
 *
 * Porque el ámbito no da: el CHECK `ambito_coherente` lo topa en 64 caracteres
 * y un par de uuids con separador son 73. Medido.
 *
 * Y salió mejor: la fila es donde cuelga el bloqueo, y es lo que permite listar
 * «mis conversaciones» sin recorrer todos los mensajes.
 *
 * ── El otro NO se puede deducir del ámbito ───────────────────────────
 *
 * El ámbito es el uuid OPACO de la sala, así que el cliente no puede sacar de
 * ahí con quién está hablando. Por eso `misConversaciones` resuelve el nombre y
 * el avatar y los devuelve ya puestos.
 */

import { supabase, isSupabaseReady } from './supabase'
import { estadoDeSalas, claveSala, type Sala } from './galaxiaChat'

export interface Conversacion {
  id: string
  /** La otra persona, ya resuelta. */
  otro: { id: string; name: string; avatar: string | null }
  /** Quién cortó, si alguien cortó. */
  bloqueadaPor: string | null
  creadaEn: string
  /**
   * Cuántos mensajes del OTRO no he leído. Sale de la misma marca de lectura
   * que usan las salas de país y de tienda (`galaxia_lecturas`), no de un
   * contador propio: dos formas de contar lo mismo terminan discrepando, y
   * `SalaChat` ya marca leído al abrir cualquier sala, incluida esta.
   */
  noLeidos: number
  /** El último mensaje, para que la lista sea un buzón y no un directorio. */
  ultimo: { cuerpo: string; en: string; mio: boolean; id: string } | null
}

export type Resultado<T> = { ok: true; datos: T } | { ok: false; mensaje: string }

/** La sala que entiende `SalaChat`, a partir de una conversación. */
export function salaDe(c: Conversacion): Sala {
  return {
    alcance: 'dm',
    ambito: c.id,
    titulo: c.otro.name,
    detalle: 'Conversación privada',
  }
}

/** La sala del chat de un PEDIDO. Mismo mecanismo, otro alcance. */
export function salaDePedido(pedidoId: string, conQuien: string): Sala {
  return {
    alcance: 'pedido',
    ambito: pedidoId,
    titulo: conQuien,
    detalle: 'Sobre este pedido',
  }
}

/**
 * Mis conversaciones, con la otra persona ya resuelta.
 *
 * La RLS ya limita a las mías (`a = auth.uid() or b = auth.uid()`), así que acá
 * no se filtra nada: filtrar en el cliente lo que la base ya filtró es cómo se
 * escriben dos reglas que un día dejan de coincidir.
 */
export async function misConversaciones(miId: string): Promise<Resultado<Conversacion[]>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }
  if (!miId) return { ok: true, datos: [] }

  const { data, error } = await supabase
    .from('conversaciones')
    .select('id, a, b, bloqueada_por, creada_en')
    .order('creada_en', { ascending: false })
  // `supabase-js` no lanza en errores de PostgREST: hay que mirar `error`.
  if (error) return { ok: false, mensaje: error.message }

  const filas = (data ?? []) as { id: string; a: string; b: string; bloqueada_por: string | null; creada_en: string }[]
  if (filas.length === 0) return { ok: true, datos: [] }

  const otros = [...new Set(filas.map(f => (f.a === miId ? f.b : f.a)))]
  const ids = filas.map(f => f.id)

  // Tres viajes en paralelo, no uno por conversación: los perfiles, el último
  // mensaje de cada sala y las marcas de lectura.
  const [perfilesRes, ultimosRes, estado] = await Promise.all([
    supabase.from('profiles').select('id, name, avatar').in('id', otros),
    supabase
      .from('galaxia_mensajes')
      .select('id, ambito, cuerpo, creado_en, autor_id')
      .eq('alcance', 'dm')
      .in('ambito', ids)
      .is('borrado_en', null)
      .order('creado_en', { ascending: false }),
    estadoDeSalas(miId, filas.map(f => ({
      alcance: 'dm' as const, ambito: f.id, titulo: '', detalle: '',
    }))),
  ])

  const mapa = new Map((perfilesRes.data ?? []).map(p => [p.id as string, p as Conversacion['otro']]))

  // Vienen ordenados de más nuevo a más viejo, así que el PRIMERO de cada
  // ámbito es el último mensaje. Se queda el primero que se ve y se ignora el
  // resto: es un `distinct on` hecho en el cliente, sin una segunda consulta.
  const ultimos = new Map<string, Conversacion['ultimo']>()
  for (const m of (ultimosRes.data ?? []) as { id: string; ambito: string; cuerpo: string; creado_en: string; autor_id: string }[]) {
    if (ultimos.has(m.ambito)) continue
    ultimos.set(m.ambito, { cuerpo: m.cuerpo, en: m.creado_en, mio: m.autor_id === miId, id: m.id })
  }

  const datos = filas.map(f => {
    const otroId = f.a === miId ? f.b : f.a
    const e = estado.get(claveSala('dm', f.id))
    return {
      id: f.id,
      otro: mapa.get(otroId) ?? { id: otroId, name: 'Alguien', avatar: null },
      bloqueadaPor: f.bloqueada_por,
      creadaEn: f.creada_en,
      // Una conversación silenciada no suma al globo, igual que en las salas
      // de país: silenciar tiene que significar lo mismo en todas partes.
      noLeidos: e && !e.silenciada ? e.sinLeer : 0,
      ultimo: ultimos.get(f.id) ?? null,
    }
  })

  // Lo que espera respuesta va arriba; después, lo más reciente. El orden por
  // fecha de CREACIÓN dejaba abajo una conversación vieja con un mensaje nuevo.
  datos.sort((x, y) =>
    (y.noLeidos > 0 ? 1 : 0) - (x.noLeidos > 0 ? 1 : 0) ||
    ((y.ultimo?.en ?? y.creadaEn) < (x.ultimo?.en ?? x.creadaEn) ? -1 : 1))

  return { ok: true, datos }
}

/**
 * Cuántos mensajes privados me esperan, en total.
 *
 * Lo usa la franja de Inicio, que es el ÚNICO camino real para la mayoría:
 * medido hoy, de los 28 perfiles solo 8 tienen avisos push, y los tres
 * fundadores de México, España y Argentina tienen CERO. Un mensaje que solo
 * avisa por push no le llega a ninguno de ellos.
 */
export async function mensajesSinLeer(miId: string): Promise<number> {
  const r = await misConversaciones(miId)
  if (!r.ok) return 0
  return r.datos.reduce((n, c) => n + c.noLeidos, 0)
}

/**
 * Abre (o recupera) la conversación con alguien.
 *
 * Idempotente del lado del servidor por el único del par ordenado: llamarla dos
 * veces, o que la abran los dos a la vez, devuelve LA MISMA.
 */
export async function abrirConversacion(otroId: string): Promise<Resultado<string>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }
  const { data, error } = await supabase.rpc('abrir_conversacion', { p_otro: otroId })
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true, datos: data as string }
}

/**
 * Corta o reabre una conversación.
 *
 * Cortar NO borra el historial: el bloqueado sigue leyendo lo que ya se
 * dijeron. Borrárselo le quitaría a quien bloquea la prueba de lo que pasó.
 */
export async function bloquearConversacion(
  convId: string, bloquear: boolean,
): Promise<Resultado<null>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }
  const { error } = await supabase.rpc('bloquear_conversacion', {
    p_conv: convId, p_bloquear: bloquear,
  })
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true, datos: null }
}

/**
 * El carrito y los pedidos del Mercado.
 *
 * ── Este módulo NO decide nada ───────────────────────────────────────
 *
 * Todas las reglas viven en las RPC del servidor: quién puede reservar, cuánto
 * queda, quién acepta, quién cierra. Acá solo se llama y se traduce el error.
 *
 * Y no es prolijidad: la RLS de `collection` no deja que un comprador toque la
 * fila del vendedor, y —medido— un `select ... for update` desde el cliente
 * devuelve las filas ajenas VACÍAS sin dar error. Cualquier cuenta hecha acá
 * sería mentira.
 *
 * ── El estado `carrito` no reserva ───────────────────────────────────
 *
 * Esa es toda la diferencia entre poner algo en el carrito y bloquearle la
 * carta a alguien. Reservan `enviado` y `aceptado`.
 */

import { supabase, isSupabaseReady } from './supabase'

export type EstadoPedido =
  | 'carrito' | 'enviado' | 'aceptado' | 'rechazado'
  | 'completado' | 'cancelado' | 'vencido'

export interface LineaPedido {
  cardId: string
  cantidad: number
  precioUnitario: number | null
}

export interface Pedido {
  id: string
  compradorId: string
  vendedorId: string
  estado: EstadoPedido
  venueId: string | null
  enviadoEn: string | null
  respondidoEn: string | null
  cerradoEn: string | null
  motivo: string | null
  lineas: LineaPedido[]
  /** Resuelto aparte: PostgREST no une a `profiles` sin configurarlo. */
  otro?: { id: string; name: string; avatar: string | null } | null
}

export type Resultado<T> = { ok: true; datos: T } | { ok: false; mensaje: string }

const COLUMNAS = 'id, comprador_id, vendedor_id, estado, venue_id, enviado_en, respondido_en, cerrado_en, motivo, pedido_lineas(card_id, cantidad, precio_unitario)'

interface FilaCruda {
  id: string
  comprador_id: string
  vendedor_id: string
  estado: string
  venue_id: string | null
  enviado_en: string | null
  respondido_en: string | null
  cerrado_en: string | null
  motivo: string | null
  pedido_lineas: { card_id: string; cantidad: number; precio_unitario: number | null }[] | null
}

function vistaDe(f: FilaCruda): Pedido {
  return {
    id: f.id,
    compradorId: f.comprador_id,
    vendedorId: f.vendedor_id,
    estado: f.estado as EstadoPedido,
    venueId: f.venue_id,
    enviadoEn: f.enviado_en,
    respondidoEn: f.respondido_en,
    cerradoEn: f.cerrado_en,
    motivo: f.motivo,
    lineas: (f.pedido_lineas ?? []).map(l => ({
      cardId: l.card_id, cantidad: l.cantidad, precioUnitario: l.precio_unitario,
    })),
  }
}

/** El total de un pedido. Con el precio congelado si ya se envió. */
export function totalDe(p: Pedido, precioActual?: (cardId: string) => number | null): number {
  return p.lineas.reduce((s, l) => {
    const u = l.precioUnitario ?? precioActual?.(l.cardId) ?? 0
    return s + u * l.cantidad
  }, 0)
}

/** Cuántas unidades hay reservadas por vendedor+carta, en UNA sola consulta. */
export async function reservasDelMercado(): Promise<Map<string, number>> {
  const m = new Map<string, number>()
  if (!isSupabaseReady()) return m
  const { data, error } = await supabase.rpc('mercado_reservas')
  // `supabase-js` no lanza en errores de PostgREST: hay que mirar `error`.
  if (error || !data) return m
  for (const r of data as { vendedor_id: string; card_id: string; reservadas: number }[]) {
    m.set(`${r.vendedor_id}|${r.card_id}`, r.reservadas)
  }
  return m
}

export function claveReserva(vendedorId: string, cardId: string): string {
  return `${vendedorId}|${cardId}`
}

/** Mis pedidos, del lado que sea. La RLS ya limita a los míos. */
export async function misPedidos(): Promise<Resultado<Pedido[]>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }
  const { data, error } = await supabase
    .from('pedidos').select(COLUMNAS).order('updated_at', { ascending: false })
  if (error) return { ok: false, mensaje: error.message }

  const pedidos = ((data ?? []) as unknown as FilaCruda[]).map(vistaDe)
  // El nombre de la otra parte, de un viaje para todos.
  const otros = [...new Set(pedidos.flatMap(p => [p.compradorId, p.vendedorId]))]
  if (otros.length > 0) {
    const { data: perfiles } = await supabase
      .from('profiles').select('id, name, avatar').in('id', otros)
    const mapa = new Map((perfiles ?? []).map(p => [p.id as string, p as { id: string; name: string; avatar: string | null }]))
    const { data: sesion } = await supabase.auth.getSession()
    const yo = sesion.session?.user.id
    for (const p of pedidos) {
      p.otro = mapa.get(p.compradorId === yo ? p.vendedorId : p.compradorId) ?? null
    }
  }
  return { ok: true, datos: pedidos }
}

/** Agrega al carrito. No reserva: solo anota la intención. */
export async function agregarAlCarrito(
  vendedorId: string, cardId: string, cantidad = 1,
): Promise<Resultado<string>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }
  const { data, error } = await supabase.rpc('carrito_agregar', {
    p_vendedor: vendedorId, p_card: cardId, p_cantidad: cantidad,
  })
  // El mensaje del servidor se enseña TAL CUAL: «no quedan tantas: hay 2
  // disponibles» dice qué hacer, y un «no se pudo» genérico no.
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true, datos: data as string }
}

/** Cambia la cantidad de una línea. Con 0 la quita, y si el carrito queda vacío se va. */
export async function ponerEnCarrito(
  vendedorId: string, cardId: string, cantidad: number,
): Promise<Resultado<null>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }
  const { error } = await supabase.rpc('carrito_poner', {
    p_vendedor: vendedorId, p_card: cardId, p_cantidad: cantidad,
  })
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true, datos: null }
}

export interface ProblemaEnvio {
  card_id: string
  que: 'retirada' | 'sin_stock'
  pediste?: number
  quedan?: number
}

/**
 * Manda el pedido al vendedor.
 *
 * Puede devolver `ok: false` CON problemas y eso NO es un fallo de red: es que
 * el vendedor cambió algo mientras el carrito dormía. Se devuelven las líneas
 * afectadas para poder decir cuál, en vez de un «no se pudo» que obliga a
 * adivinar.
 */
export async function enviarPedido(
  pedidoId: string, venueId?: string | null,
): Promise<Resultado<{ total: number }> & { problemas?: ProblemaEnvio[] }> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }
  const { data, error } = await supabase.rpc('enviar_pedido', {
    p_pedido: pedidoId, p_venue: venueId ?? null,
  })
  if (error) return { ok: false, mensaje: error.message }
  const r = data as { ok: boolean; total?: number; problemas?: ProblemaEnvio[] }
  if (!r.ok) {
    return { ok: false, mensaje: 'Algo cambió mientras tanto', problemas: r.problemas ?? [] }
  }
  return { ok: true, datos: { total: Number(r.total ?? 0) } }
}

/** El vendedor acepta o rechaza. Solo el vendedor: lo comprueba el servidor. */
export async function responderPedido(
  pedidoId: string, acepta: boolean, motivo?: string,
): Promise<Resultado<null>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }
  const { error } = await supabase.rpc('responder_pedido', {
    p_pedido: pedidoId, p_acepta: acepta, p_motivo: motivo ?? null,
  })
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true, datos: null }
}

/**
 * Cierra el trato. LOS DOS pueden.
 *
 * Se ven el sábado en la tienda, se dan la carta, y lo marca el que se acuerde.
 * Si solo pudiera el comprador, un vendedor con un comprador olvidadizo no
 * tendría forma de desbloquear su propia carta.
 */
export async function cerrarPedido(pedidoId: string, hecho = true): Promise<Resultado<null>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }
  const { error } = await supabase.rpc('cerrar_pedido', { p_pedido: pedidoId, p_hecho: hecho })
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true, datos: null }
}

export async function cancelarPedido(pedidoId: string): Promise<Resultado<null>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }
  const { error } = await supabase.rpc('cancelar_pedido', { p_pedido: pedidoId })
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true, datos: null }
}

/** Los estados que siguen vivos: ocupan la bandeja y bloquean cartas. */
export const VIVOS: EstadoPedido[] = ['carrito', 'enviado', 'aceptado']

export const ROTULO: Record<EstadoPedido, string> = {
  carrito: 'En el carrito',
  enviado: 'Esperando al vendedor',
  aceptado: 'Aceptado — falta cerrarlo',
  rechazado: 'Rechazado',
  completado: 'Completado',
  cancelado: 'Cancelado',
  vencido: 'Vencido',
}

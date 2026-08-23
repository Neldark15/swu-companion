/**
 * prestamos — quién tiene qué carta tuya, y a quién le debés vos.
 *
 * ── Qué ES y qué NO es ────────────────────────────────────────────────
 *
 * Es un RECORDATORIO, no un cambio de dueño. No toca `collection`: la carta
 * sigue siendo de quien la prestó. Si la moviera, una devolución mal anotada
 * le borraría cartas de la colección a alguien.
 *
 * ── Nada se escribe desde el cliente ──────────────────────────────────
 *
 * `prestamos` tiene UNA policy y es de SELECT. Todo lo que escribe pasa por
 * RPC `security definer`. No es ceremonia: un `insert` con policy dejaría al
 * cliente elegir `estado`, o sea escribir un préstamo ya «devuelto» — o
 * «disputado» en nombre del otro—, que es justo lo que los permisos
 * asimétricos de `cerrar_prestamo` cuidan.
 *
 * ── Permisos asimétricos, a propósito ─────────────────────────────────
 *
 *   cancelar  → SOLO quien presta (es deshacer una anotación propia)
 *   disputar  → SOLO quien recibe (es decir «eso no me lo prestaste»)
 *   devuelto  → LOS DOS (se ven el sábado y lo marca el que se acuerde; si
 *               solo pudiera uno, el otro se queda con un recordatorio que no
 *               puede apagar)
 *
 * ── Y quien recibe puede NO tener cuenta ──────────────────────────────
 *
 * `recibe_id` es nullable y siempre hay `recibe_nombre`. En una comunidad de
 * 38 que se conocen en persona, prestarle una carta a alguien que todavía no
 * se registró es lo normal, no un borde. Cuando SÍ tiene cuenta, el nombre lo
 * pone el servidor desde su perfil: es un dato sobre otra persona, y esa fila
 * la ve ella.
 */

import { supabase, isSupabaseReady } from './supabase'

export type EstadoPrestamo = 'activo' | 'devuelto' | 'disputado' | 'cancelado'

export interface Prestamo {
  id: string
  presta_id: string
  recibe_id: string | null
  recibe_nombre: string
  card_id: string
  cantidad: number
  nota: string | null
  estado: EstadoPrestamo
  prestado_en: string
  devolver_en: string | null
  cerrado_en: string | null
}

export interface PrestamoConLado extends Prestamo {
  /** `presté` = la carta es mía. `recibí` = la tengo yo y no es mía. */
  lado: 'presté' | 'recibí'
  /** Ya pasó la fecha de devolución y sigue activo. */
  vencido: boolean
}

export type Resultado<T> = { ok: true; datos: T } | { ok: false; mensaje: string }

const SIN_CONEXION = 'Sin conexión al servidor'

const CAMPOS =
  'id, presta_id, recibe_id, recibe_nombre, card_id, cantidad, nota, estado, prestado_en, devolver_en, cerrado_en'

/**
 * Todos los préstamos donde estoy metido, de los dos lados.
 *
 * La RLS ya filtra por `presta_id = auth.uid() or recibe_id = auth.uid()`, así
 * que no hace falta pedirlo acá — y pedirlo igual sería una segunda copia de
 * la misma regla, que es como se separan (§3c).
 */
export async function listarPrestamos(miId: string): Promise<PrestamoConLado[]> {
  if (!isSupabaseReady() || !miId) return []

  const { data, error } = await supabase
    .from('prestamos')
    .select(CAMPOS)
    .order('estado')             // 'activo' antes que 'cancelado'/'devuelto'
    .order('prestado_en', { ascending: false })

  // §2f: supabase-js NO lanza ante un error de PostgREST. Sin mirar `error`,
  // un fallo se vería exactamente igual que «no tenés préstamos».
  if (error) { console.warn('[prestamos] no se pudieron leer:', error.message); return [] }
  if (!data) return []

  const hoy = new Date().toISOString().slice(0, 10)
  return (data as Prestamo[]).map(p => ({
    ...p,
    lado: p.presta_id === miId ? 'presté' : 'recibí',
    vencido: p.estado === 'activo' && !!p.devolver_en && p.devolver_en < hoy,
  }))
}

export interface DatosPrestamo {
  cardId: string
  cantidad: number
  /** Nombre libre. Se IGNORA si viene `recibeId`: ahí manda el perfil. */
  recibeNombre: string
  recibeId?: string | null
  devolverEn?: string | null
  nota?: string | null
}

export async function prestarCarta(d: DatosPrestamo): Promise<Resultado<string>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: SIN_CONEXION }

  const { data, error } = await supabase.rpc('prestar_carta', {
    p_card_id: d.cardId,
    p_cantidad: d.cantidad,
    p_recibe_nombre: d.recibeNombre,
    p_recibe_id: d.recibeId ?? null,
    p_devolver_en: d.devolverEn || null,
    p_nota: d.nota || null,
  })

  if (error) return { ok: false, mensaje: error.message }
  return { ok: true, datos: data as string }
}

export async function cerrarPrestamo(
  id: string,
  como: 'devuelto' | 'disputado' | 'cancelado',
): Promise<Resultado<true>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: SIN_CONEXION }
  const { error } = await supabase.rpc('cerrar_prestamo', { p_prestamo: id, p_como: como })
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true, datos: true }
}

export interface Pendientes { lesDebo: number; meDeben: number; vencidos: number }

/**
 * Los tres contadores, calculados en el servidor.
 *
 * Se podrían derivar de `listarPrestamos`, y a propósito no se hace: la
 * campana y la casilla de Inicio los quieren sin bajarse la lista entera.
 */
export async function contarPendientes(): Promise<Pendientes> {
  const vacio = { lesDebo: 0, meDeben: 0, vencidos: 0 }
  if (!isSupabaseReady()) return vacio

  const { data, error } = await supabase.rpc('prestamos_pendientes')
  if (error) { console.warn('[prestamos] contadores:', error.message); return vacio }

  // Devuelve TABLE(...), o sea un arreglo de una fila.
  const f = (Array.isArray(data) ? data[0] : data) as
    { les_debo: number; me_deben: number; vencidos: number } | undefined
  if (!f) return vacio
  return { lesDebo: f.les_debo ?? 0, meDeben: f.me_deben ?? 0, vencidos: f.vencidos ?? 0 }
}

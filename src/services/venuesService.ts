/**
 * venuesService — sedes de juego.
 *
 * Una sede es el lugar físico donde se juega: la tienda, su dirección y su
 * teléfono. Cada administrador registra LA SUYA, la personaliza, y los torneos
 * que organiza quedan ligados a ella.
 *
 * ── Dónde vive de verdad la regla de «una sola» ───────────────────────
 *
 * En la base, con `unique(owner_id)`. Este módulo la respeta y da mensajes
 * claros, pero no es quien la hace cumplir: una interfaz se puede saltar y una
 * restricción de Postgres no. Lo mismo con «solo un admin puede crear»: la
 * política de RLS mira el rol en la tabla de perfiles, no un campo que mande
 * el cliente.
 *
 * ── Las imágenes van a Storage ────────────────────────────────────────
 *
 * Y no como data URL en una columna: un banner en base64 son cientos de KB
 * viajando en cada consulta de la lista de sedes. Cada quien escribe dentro de
 * una carpeta con su propio uid, que es lo que impide pisarle el banner a otro.
 */

import { supabase, isSupabaseReady } from './supabase'

export type AcentoSede = 'cyan' | 'amber' | 'green' | 'red' | 'purple'

export const ACENTOS: { valor: AcentoSede; label: string }[] = [
  { valor: 'cyan', label: 'Cian' },
  { valor: 'amber', label: 'Ámbar' },
  { valor: 'green', label: 'Verde' },
  { valor: 'red', label: 'Rojo' },
  { valor: 'purple', label: 'Violeta' },
]

export interface Sede {
  id: string
  owner_id: string
  name: string
  address: string
  phone: string | null
  city: string | null
  notes: string | null
  description: string | null
  banner_url: string | null
  logo_url: string | null
  accent: AcentoSede
  schedule: string | null
  instagram: string | null
  whatsapp: string | null
  maps_url: string | null
  created_at: string
  updated_at: string
}

/** Lo que se puede escribir. El dueño y las fechas los pone el servidor. */
export type SedeEditable = Omit<Sede, 'id' | 'owner_id' | 'created_at' | 'updated_at'>

const COLUMNAS =
  'id, owner_id, name, address, phone, city, notes, description, banner_url, logo_url, accent, schedule, instagram, whatsapp, maps_url, created_at, updated_at'

/** Todas las sedes, para el visor público. */
export async function listarSedes(): Promise<Sede[]> {
  if (!isSupabaseReady()) return []
  const { data, error } = await supabase
    .from('venues')
    .select(COLUMNAS)
    .order('name')
  if (error) {
    console.warn('[Sedes] listar:', error.message)
    return []
  }
  return (data ?? []) as Sede[]
}

export async function getSede(id: string): Promise<Sede | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase.from('venues').select(COLUMNAS).eq('id', id).maybeSingle()
  if (error) {
    console.warn('[Sedes] get:', error.message)
    return null
  }
  return (data as Sede) ?? null
}

/** La sede del administrador que está usando la app, si ya la creó. */
export async function miSede(userId: string): Promise<Sede | null> {
  if (!isSupabaseReady() || !userId) return null
  const { data, error } = await supabase
    .from('venues').select(COLUMNAS).eq('owner_id', userId).maybeSingle()
  if (error) {
    console.warn('[Sedes] miSede:', error.message)
    return null
  }
  return (data as Sede) ?? null
}

export interface Resultado {
  ok: boolean
  sede?: Sede
  error?: string
}

/**
 * Traduce el error de Postgres a algo que se pueda leer.
 *
 * Sin esto, chocar con la restricción de unicidad mostraba
 * «duplicate key value violates unique constraint "venues_owner_id_key"»,
 * que no le dice nada a nadie.
 */
function traducir(codigo: string | undefined, mensaje: string): string {
  if (codigo === '23505') return 'Ya tenés una sede registrada. Solo se permite una por administrador.'
  if (codigo === '42501') return 'Solo los administradores pueden crear una sede.'
  if (codigo === '23514') {
    if (/phone/.test(mensaje)) return 'El teléfono tiene un formato raro. Usá solo números, espacios y +.'
    if (/maps_url/.test(mensaje)) return 'El enlace del mapa tiene que ser de Google Maps y empezar con https://'
    if (/instagram/.test(mensaje)) return 'El usuario de Instagram solo puede llevar letras, números, punto y guion bajo.'
    if (/whatsapp/.test(mensaje)) return 'El WhatsApp tiene que ser solo números, con o sin +.'
    if (/name/.test(mensaje)) return 'El nombre de la tienda tiene entre 2 y 80 caracteres.'
    if (/address/.test(mensaje)) return 'La dirección tiene entre 4 y 200 caracteres.'
    return 'Algún dato no cumple el formato esperado.'
  }
  return mensaje
}

export async function crearSede(userId: string, datos: SedeEditable): Promise<Resultado> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión con el servidor.' }
  const { data, error } = await supabase
    .from('venues')
    .insert({ ...datos, owner_id: userId })
    .select(COLUMNAS)
    .single()
  if (error) return { ok: false, error: traducir(error.code, error.message) }
  return { ok: true, sede: data as Sede }
}

export async function actualizarSede(id: string, datos: Partial<SedeEditable>): Promise<Resultado> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión con el servidor.' }
  const { data, error } = await supabase
    .from('venues')
    .update(datos)
    .eq('id', id)
    .select(COLUMNAS)
    .single()
  if (error) return { ok: false, error: traducir(error.code, error.message) }
  return { ok: true, sede: data as Sede }
}

export async function borrarSede(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión con el servidor.' }
  const { error } = await supabase.from('venues').delete().eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

// ─── Imágenes ─────────────────────────────────────────────────────────

const MAX_BYTES = 3 * 1024 * 1024
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

/**
 * Sube el banner o el logo y devuelve su URL pública.
 *
 * El nombre lleva la marca de tiempo para saltar la caché del CDN: reusando
 * el mismo nombre, cambiar el banner no se veía hasta que el navegador
 * decidiera soltarlo.
 */
export async function subirImagen(
  userId: string,
  archivo: File,
  tipo: 'banner' | 'logo' | 'evento',
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión con el servidor.' }
  if (!TIPOS.includes(archivo.type)) {
    return { ok: false, error: 'Tiene que ser una imagen JPG, PNG, WebP o AVIF.' }
  }
  if (archivo.size > MAX_BYTES) {
    return { ok: false, error: `La imagen pesa ${(archivo.size / 1048576).toFixed(1)} MB y el máximo son 3 MB.` }
  }

  const ext = archivo.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  // La carpeta ES el uid: es lo que la política de Storage exige para dejar
  // escribir, y lo que impide tocar la carpeta de otro.
  const ruta = `${userId}/${tipo}-${Date.now()}.${ext}`

  const { error } = await supabase.storage.from('sedes').upload(ruta, archivo, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) return { ok: false, error: error.message }

  const { data } = supabase.storage.from('sedes').getPublicUrl(ruta)
  return { ok: true, url: data.publicUrl }
}

/** Borra una imagen anterior. Falla en silencio: es limpieza, no algo crítico. */
export async function borrarImagen(url: string | null): Promise<void> {
  if (!url || !isSupabaseReady()) return
  const m = /\/sedes\/(.+)$/.exec(url)
  if (!m) return
  await supabase.storage.from('sedes').remove([m[1]]).catch(() => {})
}

// ─── Torneos de una sede ──────────────────────────────────────────────

export interface EventoDeSede {
  id: string
  name: string
  date: string | null
  format: string
  status: string
  max_players: number
}

/** Los torneos ligados a una sede, del más próximo al más viejo. */
export async function eventosDeSede(venueId: string): Promise<EventoDeSede[]> {
  if (!isSupabaseReady()) return []
  const { data, error } = await supabase
    .from('official_events')
    .select('id, name, date, format, status, max_players')
    .eq('venue_id', venueId)
    .order('date', { ascending: false })
    .limit(50)
  if (error) {
    console.warn('[Sedes] eventos:', error.message)
    return []
  }
  return (data ?? []) as EventoDeSede[]
}

/**
 * blogService — artículos, análisis de mazos y de cartas.
 *
 * Distinto de `news`, que son avisos cortos con fecha. Acá el contenido ES el
 * producto: texto largo, con formato, imágenes y cartas incrustadas.
 *
 * Escriben los administradores; lee cualquiera, con sesión o sin ella. Eso
 * está en las políticas de la tabla, no acá: una comprobación en el cliente
 * es una sugerencia, no un permiso.
 */

import { supabase, isSupabaseReady } from './supabase'

export type BlogKind = 'articulo' | 'analisis-mazo' | 'analisis-carta' | 'guia'

export const KIND_LABEL: Record<BlogKind, string> = {
  'articulo': 'Artículo',
  'analisis-mazo': 'Análisis de mazo',
  'analisis-carta': 'Análisis de carta',
  'guia': 'Guía',
}

export const KIND_TONE: Record<BlogKind, string> = {
  'articulo': 'text-swu-cyan',
  'analisis-mazo': 'text-swu-amber',
  'analisis-carta': 'text-swu-green',
  'guia': 'text-swu-coral',
}

export interface BlogPost {
  id: string
  author_id: string
  slug: string
  title: string
  excerpt: string
  content: string
  cover_url: string | null
  tags: string[]
  kind: BlogKind
  published: boolean
  featured: boolean
  published_at: string | null
  views: number
  created_at: string
  updated_at: string
  /** Se rellena aparte: PostgREST no une por FK sin configurarlo. */
  author?: { name: string; avatar: string } | null
}

/**
 * Slug a partir del título.
 *
 * Se quitan los acentos porque la restricción de la base solo acepta
 * `[a-z0-9-]`, y porque una URL con acentos se copia mal por WhatsApp —que es
 * por donde se va a compartir esto.
 */
export function slugificar(titulo: string): string {
  return titulo
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

/**
 * Minutos de lectura.
 *
 * 200 palabras por minuto es la cifra que usan los medios para prosa en
 * castellano. Se redondea hacia arriba y nunca baja de 1: «0 min» no informa.
 */
export function minutosDeLectura(contenido: string): number {
  const palabras = contenido.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(palabras / 200))
}

async function conAutores(posts: BlogPost[]): Promise<BlogPost[]> {
  const ids = [...new Set(posts.map(p => p.author_id))]
  if (ids.length === 0) return posts
  const { data } = await supabase
    .from('profiles')
    .select('id, name, avatar')
    .in('id', ids)
  const mapa = new Map((data ?? []).map(p => [p.id as string, p as { name: string; avatar: string }]))
  return posts.map(p => ({ ...p, author: mapa.get(p.author_id) ?? null }))
}

export async function listarPublicados(limite = 30): Promise<BlogPost[]> {
  if (!isSupabaseReady()) return []
  // supabase-js NO lanza ante un error de PostgREST: hay que mirar `error`.
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(limite)
  if (error || !data) return []
  return conAutores(data as BlogPost[])
}

export async function listarTodos(): Promise<BlogPost[]> {
  if (!isSupabaseReady()) return []
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error || !data) return []
  return conAutores(data as BlogPost[])
}

export async function leerPorSlug(slug: string): Promise<BlogPost | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error || !data) return null
  const [conAutor] = await conAutores([data as BlogPost])
  return conAutor
}

/** Suma una lectura. Va por función del servidor: dar UPDATE de `views` al
 *  cliente sería dar UPDATE de toda la fila. */
export async function sumarVista(slug: string): Promise<void> {
  if (!isSupabaseReady()) return
  await supabase.rpc('blog_sumar_vista', { post_slug: slug })
}

export async function guardar(
  post: Partial<BlogPost> & { title: string; author_id: string },
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión al servidor' }

  const slug = post.slug?.trim() || slugificar(post.title)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3) {
    return { ok: false, error: 'El título no da una dirección válida. Escribí algo más largo.' }
  }

  const fila = {
    author_id: post.author_id,
    slug,
    title: post.title.trim(),
    excerpt: (post.excerpt ?? '').trim(),
    content: post.content ?? '',
    cover_url: post.cover_url || null,
    tags: post.tags ?? [],
    kind: post.kind ?? 'articulo',
    published: post.published ?? false,
    featured: post.featured ?? false,
  }

  const { error } = post.id
    ? await supabase.from('blog_posts').update(fila).eq('id', post.id)
    : await supabase.from('blog_posts').insert(fila)

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Ya hay un artículo con esa dirección. Cambiá el título.' }
    }
    return { ok: false, error: error.message }
  }
  return { ok: true, slug }
}

export async function borrar(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión al servidor' }
  const { error } = await supabase.from('blog_posts').delete().eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

// ── Imágenes ─────────────────────────────────────────────────────────

/** Lo que acepta el bucket. Se comprueba acá para dar un mensaje entendible
 *  en vez de dejar que falle la subida con un error de Storage. */
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
const MAX_BYTES = 5 * 1024 * 1024

/**
 * Sube una imagen del artículo y devuelve su URL pública.
 *
 * El nombre del archivo NO se toma del que subió la persona: un nombre con
 * `../` o con caracteres raros se convierte en una ruta dentro del bucket.
 * Se genera uno propio y se conserva solo la extensión.
 */
export async function subirImagen(
  archivo: File,
  userId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión al servidor' }

  if (!TIPOS.includes(archivo.type)) {
    return { ok: false, error: 'Solo JPG, PNG, WEBP, AVIF o GIF.' }
  }
  if (archivo.size > MAX_BYTES) {
    const mb = (archivo.size / 1024 / 1024).toFixed(1)
    return { ok: false, error: `La imagen pesa ${mb} MB y el máximo son 5 MB.` }
  }

  const ext = (archivo.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const nombre = `${userId}/${crypto.randomUUID()}.${ext || 'jpg'}`

  const { error } = await supabase.storage.from('blog').upload(nombre, archivo, {
    contentType: archivo.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) return { ok: false, error: error.message }

  const { data } = supabase.storage.from('blog').getPublicUrl(nombre)
  return { ok: true, url: data.publicUrl }
}

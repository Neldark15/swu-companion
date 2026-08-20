/**
 * Subida del logo y el fondo de cada cabina.
 *
 * Los archivos viven en el bucket `stream-marca` bajo `<CODE>/…`. Ese primer
 * segmento NO es decorativo: la política de Storage lo lee con
 * `storage.foldername(name)[1]` y comprueba que quien sube opera ESA cabina.
 * Así un operador no puede cambiarle el logo a otra sede.
 *
 * Lectura pública porque el overlay las consume desde OBS, sin sesión.
 */

import { supabase } from './supabase'

const BUCKET = 'stream-marca'
/** El bucket rechaza más de 3 MB; se avisa antes de gastar la subida. */
const MAX_BYTES = 3 * 1024 * 1024
const TIPOS = ['image/png', 'image/webp', 'image/jpeg', 'image/avif']

export type TipoMarca = 'logo' | 'fondo'

export async function subirImagenMarca(
  code: string,
  tipo: TipoMarca,
  archivo: File
): Promise<string> {
  if (!TIPOS.includes(archivo.type)) {
    throw new Error('Formato no admitido. Usá PNG, WEBP, JPG o AVIF.')
  }
  if (archivo.size > MAX_BYTES) {
    throw new Error(`La imagen pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB. El máximo es 3 MB.`)
  }

  const ext = archivo.name.split('.').pop()?.toLowerCase() ?? 'png'
  // Nombre nuevo en cada subida: si se reusara la ruta, el CDN seguiría
  // sirviendo la imagen vieja y el operador creería que no se guardó.
  const ruta = `${code}/${tipo}-${Date.now()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(ruta, archivo, {
    cacheControl: '3600',
    upsert: false,
  })

  // §2f: supabase-js no lanza; sin mirar `error` la subida fallida se vería
  // igual que una exitosa y el logo nunca aparecería.
  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta)
  return data.publicUrl
}

/** Borra una imagen anterior. Silencioso: que falle no debe romper el guardado. */
export async function borrarImagenMarca(url: string): Promise<void> {
  const marca = `/${BUCKET}/`
  const i = url.indexOf(marca)
  if (i === -1) return
  const ruta = url.slice(i + marca.length).split('?')[0]
  await supabase.storage.from(BUCKET).remove([ruta])
}

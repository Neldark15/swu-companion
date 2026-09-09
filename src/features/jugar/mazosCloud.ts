import { supabase } from '../../services/supabase'
import { db } from '../../services/db'
import { loadFullDatabase } from '../../services/swuApi'
import { convertirMazo, leerMazoGuardado } from './mazos'
import { objeto } from './tipos'
import type { MazoOnline } from './tipos'

export interface OpcionMazo { id: string; nombre: string; listo: MazoOnline | null; error?: string }

export async function obtenerTokenJuego(usuarioId: string): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error('No pudimos recuperar tu sesión. Revisá la conexión e intentá de nuevo.')
  if (!data.session || data.session.user.id !== usuarioId) throw new Error('Para jugar online necesitás iniciar sesión con tu cuenta de HOLOCRON.')
  return data.session.access_token
}

export async function cargarMazosPropios(usuarioId: string): Promise<OpcionMazo[]> {
  await obtenerTokenJuego(usuarioId)
  // Dexie contiene una caché compartida: la lista de mazos sale de la cuenta
  // autenticada. Un mazo local todavía sin sincronizar puede importarse explícitamente.
  const filas: unknown[] = []
  const pagina = 200
  for (let desde = 0; ; desde += pagina) {
    const { data, error } = await supabase.from('decks').select('id,name,format,data')
      .eq('user_id', usuarioId).order('id').range(desde, desde + pagina - 1)
    if (error) throw new Error('No pudimos cargar tus mazos guardados. Podés reintentar o importar un JSON.')
    filas.push(...(data ?? []))
    if (!data || data.length < pagina) break
  }
  await obtenerTokenJuego(usuarioId)
  if (!filas.length) return []
  // Un catálogo parcial puede tener algunas cartas y carecer de la impresión
  // Standard. loadFullDatabase comprueba el centinela de integridad antes de red.
  await loadFullDatabase()
  const catalogo = await db.cards.toArray()
  if (!catalogo.length) throw new Error('No pudimos cargar el catálogo para identificar las cartas de tus mazos. Reintentá con conexión.')
  return filas.flatMap<OpcionMazo>(valor => {
    const fila = objeto(valor)
    if (!fila || typeof fila.id !== 'string' || fila.format !== 'premier') return []
    const nombre = typeof fila.name === 'string' ? fila.name : 'Mazo guardado'
    try {
      const datos = objeto(fila.data)
      const mazo = convertirMazo(leerMazoGuardado({ ...datos, format: fila.format }), catalogo)
      return [{ id: fila.id, nombre, listo: { id: fila.id, nombre, mazo } }]
    } catch (error) {
      return [{ id: fila.id, nombre, listo: null,
        error: error instanceof Error ? error.message : 'No pudimos identificar todas las cartas.' }]
    }
  })
}

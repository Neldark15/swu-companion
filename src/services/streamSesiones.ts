/**
 * Las transmisiones (una por sede) y quién puede operar cada una.
 *
 * La regla de acceso es UNA y explícita: **se opera lo que se tiene asignado**.
 * Ser admin de la app ya no alcanza para escribir un marcador — hay que estar
 * en `stream_operadores` de ESA transmisión. Así el operador de Sonsonate no
 * puede tocar el marcador de San Salvador, ni al revés.
 *
 * Efecto secundario bueno: un operador NO necesita ser admin. Se puede dejar
 * a alguien manejar el marcador sin darle poder para crear torneos ni mandar
 * avisos a toda la comunidad.
 */

import { supabase } from './supabase'

export interface SesionStream {
  code: string
  nombre: string
  sede: string | null
  activa: boolean
}

export interface OperadorStream {
  userId: string
  nombre: string
}

/** Todas las transmisiones activas. Lectura pública. */
export async function listarSesiones(): Promise<SesionStream[]> {
  // §2f: supabase-js NO lanza. Sin mirar `error`, un fallo se ve igual que
  // «no hay transmisiones» y el selector saldría vacío sin explicar por qué.
  const { data, error } = await supabase
    .from('stream_sesiones')
    .select('code, nombre, sede, activa')
    .eq('activa', true)
    .order('nombre')

  if (error) throw new Error(error.message)

  return (data ?? []).map(s => ({
    code: s.code as string,
    nombre: (s.nombre as string) ?? s.code,
    sede: (s.sede as string | null) ?? null,
    activa: s.activa !== false,
  }))
}

/**
 * Los códigos que ESTA persona puede operar.
 *
 * Se consulta por `user_id` y no se cruza con la lista de sesiones: la RLS ya
 * limita lo que se ve, y pedir solo lo propio deja la intención explícita.
 */
export async function misSesiones(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('stream_operadores')
    .select('code')
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  return (data ?? []).map(o => o.code as string)
}

/** Con quién se comparte cabina en una transmisión. */
export async function operadoresDe(code: string): Promise<OperadorStream[]> {
  const { data, error } = await supabase
    .from('stream_operadores')
    .select('user_id, profiles:user_id(name)')
    .eq('code', code)

  if (error) throw new Error(error.message)

  return (data ?? []).map(o => {
    // §1: los joins de Supabase devuelven ARRAY aunque la relación sea 1:1.
    const perfil = o.profiles as { name?: string } | { name?: string }[] | null
    const uno = Array.isArray(perfil) ? perfil[0] : perfil
    return {
      userId: o.user_id as string,
      nombre: uno?.name ?? 'Sin nombre',
    }
  })
}

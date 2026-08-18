/**
 * El chat de La Galaxia — cuatro alcances, una sola tabla.
 *
 * Una sala es un par (alcance, ámbito): `global/∅`, `continente/CA`,
 * `pais/SV`, `tienda/<uuid de la sede>`. Ese par es la clave, y quién pertenece
 * a cada sala lo decide la BASE (`galaxia_pertenece`), no este archivo: si la
 * pertenencia se resolviera acá, cualquiera podría escribir en `pais:CO`
 * diciendo ser de Colombia. Verificado contra producción — 6 de 6 intentos de
 * suplantación rebotan en RLS.
 *
 * Por qué las salas se calculan y no se listan de una tabla: no hay «salas»
 * que crear ni administrar. Tu sala de país es tu país. Una tabla de salas
 * sería un segundo sitio donde la verdad puede desincronizarse del perfil.
 */

import { supabase, isSupabaseReady } from './supabase'
import { getCountryByCode, getContinentById } from '../data/regions'

export type AlcanceSala = 'global' | 'continente' | 'pais' | 'tienda'

export interface Sala {
  alcance: AlcanceSala
  /** `null` solo en global. */
  ambito: string | null
  /** Cómo se llama en pantalla. */
  titulo: string
  /** Una línea que dice de qué va la sala. */
  detalle: string
}

export interface MensajeGalaxia {
  id: string
  autorId: string
  cuerpo: string
  creadoEn: string
  borrado: boolean
  /** Se resuelven aparte, contra `profiles`. */
  autorNombre: string
  autorAvatar: string
}

export type Resultado<T> = { ok: true; datos: T } | { ok: false; mensaje: string }

/** La clave con la que se identifica una sala en memoria y en la marca de lectura. */
export function claveSala(alcance: AlcanceSala, ambito: string | null): string {
  return `${alcance}:${ambito ?? ''}`
}

/**
 * Las salas de una persona, de la más cercana a la más lejana.
 *
 * El orden NO es decorativo: la tienda es donde se organiza jugar el sábado y
 * global es donde se mira de vez en cuando. Lo que se abre por defecto es lo
 * primero de esta lista que tenga gente.
 */
export function salasDe(
  pais: string | null,
  continente: string | null,
  tiendas: Array<{ id: string; nombre: string }>,
): Sala[] {
  const salas: Sala[] = []

  for (const t of tiendas) {
    salas.push({
      alcance: 'tienda', ambito: t.id,
      titulo: t.nombre,
      detalle: 'Quienes han jugado un torneo acá',
    })
  }

  if (pais) {
    const c = getCountryByCode(pais)
    salas.push({
      alcance: 'pais', ambito: pais,
      titulo: c ? `${c.flag} ${c.name}` : pais,
      detalle: 'Toda la comunidad de tu país',
    })
  }

  if (continente) {
    const c = getContinentById(continente)
    salas.push({
      alcance: 'continente', ambito: continente,
      titulo: c ? c.name : continente,
      detalle: 'Tu región del mundo',
    })
  }

  salas.push({
    alcance: 'global', ambito: null,
    titulo: 'La Galaxia',
    detalle: 'Todo el mundo, en todos los idiomas',
  })

  return salas
}

const COLUMNAS = 'id, autor_id, cuerpo, creado_en, borrado_en'

/** Los últimos mensajes de una sala, del más viejo al más nuevo (orden de lectura). */
export async function leerSala(
  alcance: AlcanceSala,
  ambito: string | null,
  tope = 80,
): Promise<Resultado<MensajeGalaxia[]>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión.' }

  // Se piden los ÚLTIMOS (creado_en desc) y se dan vuelta acá. Pedirlos
  // ascendentes con un límite daría los PRIMEROS mensajes de la historia, que
  // no es lo que nadie quiere ver al abrir un chat.
  let q = supabase
    .from('galaxia_mensajes')
    .select(COLUMNAS)
    .eq('alcance', alcance)
    .order('creado_en', { ascending: false })
    .limit(tope)

  q = ambito === null ? q.is('ambito', null) : q.eq('ambito', ambito)

  // Gotcha 2f: sin mirar el error, un fallo de RLS se ve igual que una sala
  // vacía — y «no hay mensajes» es justo la mentira más creíble en un chat nuevo.
  const { data, error } = await q
  if (error) {
    console.warn('[galaxia] no se pudo leer la sala:', error.message)
    return { ok: false, mensaje: 'No se pudo abrir la sala.' }
  }

  const filas = (data ?? []).reverse()
  if (filas.length === 0) return { ok: true, datos: [] }

  const autores = [...new Set(filas.map(f => f.autor_id))]
  const { data: perfiles, error: e2 } = await supabase
    .from('profiles').select('id, name, avatar').in('id', autores)
  if (e2) console.warn('[galaxia] no se pudieron resolver los autores:', e2.message)
  const mapa = new Map((perfiles ?? []).map(p => [p.id, p]))

  return {
    ok: true,
    datos: filas.map(f => {
      const p = mapa.get(f.autor_id)
      return {
        id: f.id,
        autorId: f.autor_id,
        // Un mensaje retirado deja su hueco: borrarlo de la lista rompe el
        // hilo para quien lo estaba leyendo.
        cuerpo: f.borrado_en ? '' : f.cuerpo,
        creadoEn: f.creado_en,
        borrado: !!f.borrado_en,
        autorNombre: p?.name ?? 'Alguien',
        autorAvatar: p?.avatar ?? '',
      }
    }),
  }
}

/** Manda un mensaje. La sala se valida en la base, no acá. */
export async function enviar(
  alcance: AlcanceSala,
  ambito: string | null,
  autorId: string,
  cuerpo: string,
): Promise<Resultado<null>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión.' }
  const texto = cuerpo.trim()
  if (!texto) return { ok: false, mensaje: 'El mensaje está vacío.' }
  if (texto.length > 1000) return { ok: false, mensaje: 'Máximo 1000 caracteres.' }

  const { error } = await supabase
    .from('galaxia_mensajes')
    .insert({ autor_id: autorId, alcance, ambito, cuerpo: texto })
  if (error) {
    console.warn('[galaxia] no se pudo enviar:', error.message)
    // El 42501 de RLS aquí significa una cosa concreta y decible.
    return {
      ok: false,
      mensaje: error.code === '42501'
        ? 'No perteneces a esta sala.'
        : 'No se pudo enviar el mensaje.',
    }
  }
  return { ok: true, datos: null }
}

/** Retira un mensaje propio (o cualquiera, si sos admin). No lo elimina. */
export async function retirar(id: string, quien: string): Promise<Resultado<null>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión.' }
  const { error } = await supabase
    .from('galaxia_mensajes')
    .update({ borrado_en: new Date().toISOString(), borrado_por: quien })
    .eq('id', id)
  if (error) {
    console.warn('[galaxia] no se pudo retirar:', error.message)
    return { ok: false, mensaje: 'No se pudo retirar el mensaje.' }
  }
  return { ok: true, datos: null }
}

/**
 * Escucha una sala. Devuelve la función para dejar de escuchar.
 *
 * El filtro del servidor es por `alcance`; el ámbito se comprueba acá porque
 * `postgres_changes` no admite dos condiciones. Con cuatro alcances el
 * desperdicio es mínimo, y el mensaje que no es de tu sala se descarta antes
 * de tocar el estado.
 */
export function escucharSala(
  alcance: AlcanceSala,
  ambito: string | null,
  alLlegar: (id: string) => void,
): () => void {
  if (!isSupabaseReady()) return () => {}

  const canal = supabase
    .channel(`galaxia-${claveSala(alcance, ambito)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'galaxia_mensajes', filter: `alcance=eq.${alcance}` },
      payload => {
        const fila = payload.new as { id: string; ambito: string | null }
        if ((fila.ambito ?? null) !== ambito) return
        alLlegar(fila.id)
      },
    )
    .subscribe()

  return () => { void supabase.removeChannel(canal) }
}

/** Cuántos mensajes hay sin leer por sala, y cuáles están silenciadas. */
export interface EstadoSala {
  sinLeer: number
  silenciada: boolean
}

export async function estadoDeSalas(
  userId: string,
  salas: Sala[],
): Promise<Map<string, EstadoSala>> {
  const salida = new Map<string, EstadoSala>()
  if (!isSupabaseReady() || salas.length === 0) return salida

  const { data: marcas } = await supabase
    .from('galaxia_lecturas')
    .select('alcance, ambito, leido_en, silenciada')
    .eq('user_id', userId)
  const porClave = new Map(
    (marcas ?? []).map(m => [claveSala(m.alcance as AlcanceSala, m.ambito || null), m]),
  )

  // Una consulta por sala. Con cuatro salas es barato, y `head: true` no trae
  // ni una fila: solo el conteo.
  await Promise.all(salas.map(async s => {
    const clave = claveSala(s.alcance, s.ambito)
    const marca = porClave.get(clave)
    let q = supabase
      .from('galaxia_mensajes')
      .select('id', { count: 'exact', head: true })
      .eq('alcance', s.alcance)
      .is('borrado_en', null)
    q = s.ambito === null ? q.is('ambito', null) : q.eq('ambito', s.ambito)
    if (marca?.leido_en) q = q.gt('creado_en', marca.leido_en)

    const { count } = await q
    salida.set(clave, { sinLeer: count ?? 0, silenciada: !!marca?.silenciada })
  }))

  return salida
}

/** Marca la sala como leída hasta ahora. */
export async function marcarLeida(
  userId: string, alcance: AlcanceSala, ambito: string | null,
): Promise<void> {
  if (!isSupabaseReady()) return
  await supabase.from('galaxia_lecturas').upsert({
    user_id: userId, alcance, ambito: ambito ?? '',
    leido_en: new Date().toISOString(),
  }, { onConflict: 'user_id,alcance,ambito' })
}

/** Silencia o desilencia una sala. */
export async function silenciar(
  userId: string, alcance: AlcanceSala, ambito: string | null, valor: boolean,
): Promise<void> {
  if (!isSupabaseReady()) return
  await supabase.from('galaxia_lecturas').upsert({
    user_id: userId, alcance, ambito: ambito ?? '', silenciada: valor,
  }, { onConflict: 'user_id,alcance,ambito' })
}

/**
 * SECTORES — la app deja de ser «de El Salvador» y pasa a tener zonas.
 *
 * Un sector es un PAÍS. Cada quien entra viendo el suyo, y puede cambiar de
 * sector para mirar cómo va otra comunidad. Es la diferencia entre una app
 * nacional y una app que sirve a varias comunidades sin mezclarlas.
 *
 * ── Por qué el país y no una tabla de «zonas» ────────────────────────
 *
 * Porque el país YA está: vive en `profiles.settings->>'country'` como código
 * ISO-2, y las 23 cuentas lo tienen puesto. Inventar una tabla `zonas` con sus
 * ids, su alta y su asignación sería crear una segunda verdad para un dato que
 * ya existe y que además la gente entiende sin explicación.
 *
 * Si algún día una comunidad no cabe en un país —una ciudad muy grande, o una
 * región que cruza fronteras— se agrega ENTONCES, con el caso real en la mano.
 * Hoy sería adivinar.
 *
 * ── La regla que sostiene todo: sector activo ≠ mi país ──────────────
 *
 * Son dos cosas distintas y confundirlas rompe la función:
 *
 *  · **Mi país** es un dato del perfil. No cambia porque yo mire otra zona.
 *  · **El sector activo** es qué estoy mirando AHORA. Arranca en mi país.
 *
 * Ninguna pantalla debe filtrar por «mi país»: todas filtran por el SECTOR
 * ACTIVO. Si alguna usa el país del perfil, cambiar de sector no la va a
 * afectar y el explorador quedará a medias — que es peor que no tenerlo,
 * porque la persona cree que está viendo Colombia y está viendo El Salvador.
 */

import { supabase, isSupabaseReady } from './supabase'
import { CONTINENTS } from '../data/regions'

/** Código ISO-2 del país. `null` = todavía no se sabe. */
export type Sector = string

/** Un sector con gente adentro. */
export interface SectorInfo {
  /** ISO-2, p. ej. `SV`. */
  codigo: Sector
  nombre: string
  bandera: string
  /** Continente al que pertenece, para agrupar el selector. */
  continente: string
  /** Cuántas cuentas hay. Es lo que hace que un sector exista o no. */
  jugadores: number
}

/** Índice plano de todos los países que la app conoce. Se arma una vez. */
const PAISES = new Map<string, { nombre: string; bandera: string; continente: string }>(
  CONTINENTS.flatMap(c =>
    c.countries.map(p => [p.code, { nombre: p.name, bandera: p.flag, continente: c.id }] as const),
  ),
)

/** Los datos de un país por su código. `null` si no está en el catálogo. */
export function datosDePais(codigo: Sector | null | undefined) {
  return codigo ? PAISES.get(codigo) ?? null : null
}

/** Nombre legible de un sector, con bandera. Para títulos y chips. */
export function etiquetaSector(codigo: Sector | null | undefined): string {
  const d = datosDePais(codigo)
  return d ? `${d.bandera} ${d.nombre}` : 'Toda la galaxia'
}

/**
 * Los sectores que EXISTEN, o sea los países con al menos una cuenta.
 *
 * No se lista el catálogo entero de países: un selector con 190 opciones donde
 * 188 están vacías no es un explorador, es un formulario. Mostrar solo donde
 * hay gente convierte la lista en un mapa de la comunidad real — y de paso
 * hace evidente cuándo una zona nueva empieza a crecer.
 *
 * Cuenta sobre `profiles`, que es público por RLS para las columnas que se
 * exponen. Si falla, devuelve lista vacía Y lo dice: quien llama decide si
 * muestra «no se pudo cargar» o se queda con el sector propio.
 */
export async function sectoresConGente(): Promise<{ ok: boolean; sectores: SectorInfo[] }> {
  if (!isSupabaseReady()) return { ok: false, sectores: [] }

  // `settings` es jsonb y PostgREST no agrupa por una clave interna, así que el
  // conteo se hace acá. Son decenas de filas, no miles: traer la columna y
  // contar en memoria es más simple que una RPC, y no hay que mantener una
  // función más en la base.
  const { data, error } = await supabase.from('profiles').select('settings')

  // Gotcha 2f: sin mirar `error`, una caída se ve igual que «no hay nadie».
  if (error) {
    console.warn('[sectores] no se pudieron contar los jugadores:', error.message)
    return { ok: false, sectores: [] }
  }

  const cuenta = new Map<string, number>()
  for (const fila of data ?? []) {
    const s = fila.settings as { country?: unknown } | null
    const c = typeof s?.country === 'string' ? s.country : null
    // Un país que no está en el catálogo se ignora en vez de inventarle
    // nombre: preferimos no mostrarlo a mostrar «undefined» con una bandera
    // en blanco.
    if (c && PAISES.has(c)) cuenta.set(c, (cuenta.get(c) ?? 0) + 1)
  }

  const sectores = [...cuenta.entries()]
    .map(([codigo, jugadores]) => {
      const d = PAISES.get(codigo)!
      return { codigo, jugadores, nombre: d.nombre, bandera: d.bandera, continente: d.continente }
    })
    // El más poblado primero: es el que más probablemente se quiere visitar.
    .sort((a, b) => b.jugadores - a.jugadores || a.nombre.localeCompare(b.nombre))

  return { ok: true, sectores }
}

/**
 * Los ids de perfil de un sector.
 *
 * Es el ladrillo con el que cualquier pantalla se acota: se piden los ids del
 * sector y se filtra la consulta propia con `.in('user_id', ids)`.
 *
 * NO es lo más eficiente posible —lo ideal sería una columna `country` en cada
 * tabla y un índice— pero funciona HOY sin migrar nada y sin duplicar el país
 * en seis tablas, que es donde empiezan las incoherencias. Cuando una zona
 * pase de unos cientos de cuentas, conviene medir y decidir; con 23 cuentas,
 * optimizar esto sería resolver un problema que no existe.
 */
export async function perfilesDelSector(sector: Sector): Promise<{ ok: boolean; ids: string[] }> {
  if (!isSupabaseReady()) return { ok: false, ids: [] }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, settings')
    .eq('settings->>country', sector)

  if (error) {
    console.warn('[sectores] no se pudieron leer los perfiles del sector:', error.message)
    return { ok: false, ids: [] }
  }
  return { ok: true, ids: (data ?? []).map(p => p.id as string) }
}

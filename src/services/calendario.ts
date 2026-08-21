/**
 * El CALENDARIO — la misma fuente que los torneos, mirada por mes.
 *
 * ── Por qué no hay tabla propia ──────────────────────────────────────
 *
 * Los eventos ya viven en `official_events`, con su fecha, su sede y su
 * organizador. Un calendario con su propia tabla sería un segundo lugar donde
 * existe «el torneo del sábado», y en cuanto alguien edite uno de los dos, la
 * comunidad tendría dos respuestas distintas a la misma pregunta. Es
 * exactamente lo que documenta §3c de CLAUDE.md sobre las 14 tablas de
 * posiciones.
 *
 * Esto es una VISTA. Si el torneo se edita desde el panel, el calendario ya lo
 * refleja porque es la misma fila.
 *
 * ── El mes se pide por rango, no entero ──────────────────────────────
 *
 * Y el rango se calcula en hora de El Salvador: un evento del sábado a las 3
 * p.m. es `21:00Z`, así que preguntar por el mes en UTC mete el último día del
 * mes anterior y pierde el último del mes en curso.
 */

import { supabase, isSupabaseReady } from './supabase'
import { inicioDelDiaSVenUTC, diaCalendarioSV } from './horaSV'
import type { AcentoSede } from './venuesService'

export interface EventoCalendario {
  id: string
  code: string
  name: string
  description: string | null
  date: string
  location: string | null
  status: 'open' | 'active' | 'finished' | 'cancelled'
  format: string | null
  maxPlayers: number | null
  imageUrl: string | null
  sede: { id: string; name: string; city: string | null; accent: AcentoSede; bannerUrl: string | null } | null
  /** El día SV en que cae, «2026-08-22». La clave con que se agrupa en la rejilla. */
  dia: string
}

interface FilaCruda {
  id: string
  code: string
  name: string
  description: string | null
  date: string
  location: string | null
  status: string
  format: string | null
  max_players: number | null
  image_url: string | null
  venues: { id: string; name: string; city: string | null; accent: string; banner_url: string | null } | null
}

/** Primer instante del mes (en SV) que contiene a `ancla`, y el del siguiente. */
export function rangoDelMes(ancla: Date): { desde: Date; hasta: Date } {
  const dia = diaCalendarioSV(ancla)
  const [a, m] = dia.split('-').map(Number)
  // Se arma el día 1 como texto y se convierte con el helper de zona: hacerlo
  // con `new Date(a, m-1, 1)` usaría la zona del teléfono, que para alguien
  // viajando no es la de El Salvador.
  const primero = `${a}-${String(m).padStart(2, '0')}-01`
  const sigA = m === 12 ? a + 1 : a
  const sigM = m === 12 ? 1 : m + 1
  const primeroSig = `${sigA}-${String(sigM).padStart(2, '0')}-01`
  return {
    desde: inicioDelDiaSVenUTC(`${primero}T12:00:00Z`),
    hasta: inicioDelDiaSVenUTC(`${primeroSig}T12:00:00Z`),
  }
}

/**
 * Los eventos de un mes, con su sede resuelta.
 *
 * La unión con `venues` es una FK declarada, así que PostgREST la resuelve sin
 * un segundo viaje. Ojo: aunque la relación es 1:1 lógica, PostgREST devuelve
 * el objeto —no un array— porque el lado «uno» es el que tiene la clave.
 */
export async function eventosDelMes(ancla: Date): Promise<EventoCalendario[]> {
  if (!isSupabaseReady()) return []
  const { desde, hasta } = rangoDelMes(ancla)

  const { data, error } = await supabase
    .from('official_events')
    .select('id, code, name, description, date, location, status, format, max_players, image_url, venues(id, name, city, accent, banner_url)')
    .gte('date', desde.toISOString())
    .lt('date', hasta.toISOString())
    .order('date')

  // `supabase-js` no lanza en errores de PostgREST: hay que mirar `error`.
  if (error) {
    console.warn('[calendario] no se pudieron leer los eventos:', error.message)
    return []
  }

  return ((data ?? []) as unknown as FilaCruda[]).map(f => {
    // Aunque la FK es 1:1, si alguien la re-declara como 1:N esto llega array.
    const v = Array.isArray(f.venues) ? f.venues[0] : f.venues
    return {
      id: f.id,
      code: f.code,
      name: f.name,
      description: f.description,
      date: f.date,
      location: f.location,
      status: (f.status as EventoCalendario['status']) ?? 'open',
      format: f.format,
      maxPlayers: f.max_players,
      imageUrl: f.image_url,
      sede: v ? { id: v.id, name: v.name, city: v.city, accent: (v.accent as AcentoSede) ?? 'cyan', bannerUrl: v.banner_url } : null,
      dia: diaCalendarioSV(f.date),
    }
  })
}

/** Agrupa por día SV. La rejilla pinta un punto por sede distinta de cada día. */
export function porDia(eventos: EventoCalendario[]): Map<string, EventoCalendario[]> {
  const m = new Map<string, EventoCalendario[]>()
  for (const e of eventos) {
    const l = m.get(e.dia)
    if (l) l.push(e)
    else m.set(e.dia, [e])
  }
  return m
}

/**
 * Las casillas de la rejilla del mes, incluida la resaca del mes anterior y del
 * siguiente para que las seis filas estén siempre completas.
 *
 * La semana arranca en DOMINGO, que es como se leen los calendarios en El
 * Salvador. Con lunes primero, el sábado —que es el día que importa acá— cae
 * en la última columna y se lee peor.
 */
export function casillasDelMes(ancla: Date): { dia: string; delMes: boolean }[] {
  const [a, m] = diaCalendarioSV(ancla).split('-').map(Number)
  const primero = new Date(Date.UTC(a, m - 1, 1))
  const arranque = primero.getUTCDay()
  const diasDelMes = new Date(Date.UTC(a, m, 0)).getUTCDate()

  const casillas: { dia: string; delMes: boolean }[] = []
  // 42 = 6 semanas. Fijo a propósito: si la rejilla cambiara de alto entre
  // meses, pasar de mes daría un brinco de ~50 px a mitad del gesto — el mismo
  // problema que ya se arregló en las hojas del álbum (§3i).
  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(a, m - 1, 1 + (i - arranque)))
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    casillas.push({ dia: iso, delMes: i >= arranque && i < arranque + diasDelMes })
  }
  return casillas
}

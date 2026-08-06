/**
 * Cliente del laboratorio de simulación (/api/sim).
 *
 * Todo pasa por el proxy de Vercel: aquí no hay tokens del VPS ni URLs del
 * simulador — solo el JWT de la sesión de Supabase, que el proxy exige.
 *
 * ── Cómo viaja un mazo ────────────────────────────────────────────────
 *
 * El simulador identifica cartas por NOMBRE («Título | Subtítulo») o por id
 * SWUDB («LOF_009»). Los mazos de la app guardan ambas cosas en cada línea
 * (name, subtitle, setCode), así que se mandan por nombre, que sobrevive a
 * cualquier diferencia de numeración. Si el nombre es ambiguo o la carta no
 * existe en el Premier actual, el simulador responde con un error en español
 * que se muestra tal cual: es más útil que cualquier traducción nuestra.
 */

import { supabase } from '../../services/supabase'
import type { Deck } from '../../types'

/** Mazo en el formato del simulador. */
export interface MazoSim {
  leader: string
  base: string
  main: string[]
}

/**
 * Lo que acepta el simulador: el formato estructurado o texto pegado tal cual
 * (una lista SWUDB exportada, por ejemplo). El texto lo interpreta el VPS,
 * que sabe resolver nombres parciales e ids y explica qué línea no entendió.
 */
export type MazoEnvio = MazoSim | { texto: string }

export interface InformeValidar {
  legal: boolean
  problemas: string[]
  total: number
  minimo: number
  aspectos_disponibles: string[]
  penalizaciones: { carta: string; aspectos: string[]; sobrecoste: number }[]
  curva: Record<string, number>
  unidades: number
  eventos: number
  mejoras: number
  sentinel: number
  unicas_coste4: number
  sinergias?: {
    satisfechas: { carta: string; copias: number; pide: string; hay: number; umbral: number }[]
    huerfanas: { carta: string; copias: number; pide: string; hay: number; umbral: number }[]
    aviso: string
  }
}

export interface ResultadoRival {
  rival: string
  win: number
  rondas: number
  lider: string
}

export interface EstadoTrabajo {
  estado: 'en cola' | 'corriendo' | 'listo' | 'error'
  hechos: number
  total: number
  resultados: ResultadoRival[]
  media?: number
  error?: string | null
}

export interface RivalInfo {
  slug: string
  lider: string
  base: string
  jugador?: string
  record?: string
}

export class ErrorSim extends Error {}

/** Deck de la app → mazo del simulador. Lanza si faltan líder o base. */
export function deckAMazo(deck: Deck): MazoSim {
  const lider = deck.leaders[0]
  if (!lider) throw new ErrorSim('El mazo no tiene líder.')
  if (!deck.base) throw new ErrorSim('El mazo no tiene base.')
  const nombre = (c: { name: string; subtitle: string | null }) =>
    c.subtitle ? `${c.name} | ${c.subtitle}` : c.name
  return {
    leader: nombre(lider),
    base: nombre(deck.base),
    main: deck.mainDeck.map((c) => `${c.quantity}x ${nombre(c)}`),
  }
}

async function llamar<T>(cuerpo: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const jwt = data.session?.access_token
  if (!jwt) throw new ErrorSim('Inicia sesión para usar el laboratorio.')

  const r = await fetch('/api/sim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(cuerpo),
  })
  const datos = await r.json().catch(() => null)
  if (!r.ok || !datos) {
    throw new ErrorSim(datos?.error || `El laboratorio no respondió (HTTP ${r.status}).`)
  }
  return datos as T
}

export const simApi = {
  rivales: () => llamar<{ rivales: RivalInfo[] }>({ action: 'rivales' }),
  validar: (mazo: MazoEnvio) => llamar<InformeValidar>({ action: 'validar', mazo }),
  gauntlet: (mazo: MazoEnvio, partidas = 400) =>
    llamar<{ trabajo: string; total: number }>({ action: 'gauntlet', mazo, partidas }),
  trabajo: (id: string) => llamar<EstadoTrabajo>({ action: 'trabajo', id }),
  probar: (mazo: MazoEnvio, quita: string[], mete: string[], partidas = 800) =>
    llamar<{ antes: number; despues: number; delta: number; partidas: number }>(
      { action: 'probar', mazo, quita, mete, partidas },
    ),
}

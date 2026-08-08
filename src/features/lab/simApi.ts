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

/**
 * Un emparejamiento medido a fondo, CON su margen de error.
 *
 * Es la única respuesta del simulador que trae el error real de la medición,
 * y por eso existe esta acción aparte: el guantelete corre 400 partidas por
 * rival (±4,9 puntos) y no dice cuánto se equivoca. Verificado contra el
 * servicio vivo: `{win: 45.9, margen95: 2.5, rondas: 7.1}`.
 *
 * `margen95` viaja siempre junto a `win` en la UI. Un win rate sin su margen
 * es una opinión con formato de dato.
 */
export interface ResultadoSimular {
  rival: string
  win: number
  /** Margen de error al 95 %, en puntos porcentuales. */
  margen95: number
  rondas: number
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

/* ── Una partida, jugada a jugada ────────────────────────────────────── */

/**
 * Un evento del desarrollo de la partida.
 *
 * Es una unión discriminada por `t` porque los campos NO son intercambiables:
 * un `ataca` contra la base trae `vida_restante` y uno contra una unidad trae
 * `recibe`. Dejarlo como un saco de opcionales invitaba a leer el campo
 * equivocado sin que el compilador dijera nada.
 *
 * `lado` es 'A' (el mazo que se está probando) o 'B' (el rival), siempre.
 */
export type EventoPartida =
  | { t: 'inicio'; empieza: Lado; a: LadoInicial; b: LadoInicial }
  /** `rec_a`/`rec_b`: recursos con los que arranca cada lado. Los motores
   *  anteriores no los mandaban — opcionales para poder leer partidas viejas. */
  | { t: 'ronda'; n: number; rec_a?: number; rec_b?: number }
  /** Una carta se juega. `coste` es el IMPRESO, no el que se pagó; `gasto` es
   *  el ACUMULADO de la ronda tras pagar esta carta (los gastos sin evento
   *  propio —épicas, habilidades— se recogen en la siguiente jugada). */
  | { t: 'juega'; lado: Lado; carta: string; coste: number; gasto?: number; tipo: TipoCarta; desde: 'mano' | 'recursos'; arena?: Arena }
  | { t: 'entra'; lado: Lado; carta: string; arena: Arena; lider: boolean; poder: number; hp: number }
  /** La unidad deja el campo SIN morir: rebote, captura, control robado. */
  | { t: 'sale'; lado: Lado; carta: string; causa: string }
  | { t: 'muere'; lado: Lado; carta: string; causa: string }
  /** `escudo: true` = el escudo se comió el golpe entero y el daño no entró. */
  | { t: 'dano'; lado: Lado; carta: string; n: number; causa: string; escudo: boolean; resto: number }
  /** El libro mayor de la vida de la base. Ver la nota de abajo. */
  | { t: 'base'; lado: Lado; delta: number; vida: number }
  | { t: 'ataca'; lado: Lado; atacante: string; objetivo: 'base'; arena: Arena; dano: number; vida_restante: number }
  | { t: 'ataca'; lado: Lado; atacante: string; objetivo: string; arena: Arena; dano: number; recibe: number; sentinel: boolean }
  | { t: 'captura'; lado: Lado; carta: string }
  | { t: 'adjunta'; lado: Lado; mejora: string; sobre: string; hostil: boolean; piloto: boolean; poder: number; hp: number }
  | { t: 'despliega_lider'; lado: Lado; carta: string; gratis: boolean }
  | { t: 'fin'; ganador: Lado; rondas: number; por: string; base_a: number; base_b: number }

export type Lado = 'A' | 'B'
export type Arena = 'tierra' | 'espacio'
export type TipoCarta = 'unidad' | 'evento' | 'mejora' | 'otra'
export interface LadoInicial { lider: string; base: string; vida: number }

/** Lo mínimo para dibujar una carta: `id` resuelve la imagen. */
export interface FichaCarta {
  /** Id SWUDB, «ASH_112». `null` si la carta no tiene set/número. */
  id: string | null
  /** 'Leader' va APAISADO en la mesa. */
  tipo: string
  coste: number | null
  poder: number | null
  hp: number | null
  arenas: string[]
  aspectos: string[]
  unica: boolean
}

/**
 * Una partida completa del simulador, lista para reproducir.
 *
 * ── Dos cosas que hay que saber para no leerla mal ──
 *
 * 1. **`base` es el libro mayor de la vida.** Aparece en CADA cambio, venga de
 *    donde venga (combate, Overwhelm, indirecto, Restore, curaciones, mazo
 *    vacío). La suma de sus `delta` cuadra con `base_a`/`base_b` por
 *    construcción — verificado sobre 396 partidas. El `dano` de un `ataca`
 *    contra la base son los MISMOS puntos que el `base` que lo acompaña: es la
 *    narración del mismo hecho, no un segundo golpe. **No sumar los dos.**
 *
 * 2. **`cartas` puede no tener una entrada.** Las fichas generadas en mesa
 *    (X-Wing, TIE Fighter, Mandalorian, Spy) no siempre son cartas del pool.
 *    Dibujar por nombre cuando falte; nunca dar el `id` por hecho.
 */
export interface PartidaNarrada {
  rival: string
  semilla: number
  n: number
  empieza: Lado
  ganador: Lado
  rondas: number
  base_a: number
  base_b: number
  eventos: EventoPartida[]
  /** La narración en texto, la misma que imprime la CLI. Sirve de subtítulo. */
  log: string[]
  cartas: Record<string, FichaCarta>
  lider_a: string
  base_a_carta: string
  lider_b: string
  base_b_carta: string
  /** Lo que tardó el motor, en ms. Lo reporta el propio VPS. */
  ms: number
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
  /**
   * Qué sets conoce el motor.
   *
   * La app tiene la base COMPLETA —9.057 impresiones, 28 sets— y el simulador
   * solo el Premier vigente (1.324 cartas). Sin preguntarle, el buscador de
   * mejoras proponía cambios con cartas rotadas y el motor los rechazaba
   * DESPUÉS del viaje: «Clone Deserter no existe en el Premier actual».
   * Medido: 3.720 filas de la base están fuera del pool, el 41 %.
   *
   * Se pregunta en vez de escribir los 5 códigos acá porque la rotación
   * cambia: el día que salga un set nuevo, el motor lo sabe y esta lista se
   * actualiza sola.
   */
  pool: () => llamar<{ sets: string[]; cartas: number }>({ action: 'pool' }),
  validar: (mazo: MazoEnvio) => llamar<InformeValidar>({ action: 'validar', mazo }),
  gauntlet: (mazo: MazoEnvio, partidas = 400) =>
    llamar<{ trabajo: string; total: number }>({ action: 'gauntlet', mazo, partidas }),
  trabajo: (id: string) => llamar<EstadoTrabajo>({ action: 'trabajo', id }),
  /**
   * Un solo emparejamiento, a fondo. El tope del proxy son 1500 partidas
   * (`api/sim.ts`), que es lo que hace falta para que `margen95` baje a ~2,5.
   */
  simular: (mazo: MazoEnvio, rival: string, partidas = 1500) =>
    llamar<ResultadoSimular>({ action: 'simular', mazo, rival, partidas }),
  /**
   * `rival` es opcional en el contrato del proxy —si no va, el simulador usa
   * el suyo por defecto—, pero la UI SIEMPRE lo manda: un delta sin decir
   * contra quién se midió no se puede repetir ni discutir.
   */
  probar: (mazo: MazoEnvio, quita: string[], mete: string[], partidas = 1000, rival?: string) =>
    llamar<{ antes: number; despues: number; delta: number; partidas: number }>(
      { action: 'probar', mazo, quita, mete, partidas, ...(rival ? { rival } : {}) },
    ),
  /**
   * UNA partida contra un rival, jugada a jugada — lo que come la mesa 3D.
   *
   * Es la MISMA partida que corre dentro de una tanda de `simular`, no una
   * recreación: con la misma `semilla`, `n` selecciona la partida n-ésima de
   * esa tanda (empieza A si `n` es par). Así «ver» un emparejamiento y
   * «medirlo» hablan del mismo objeto, y subir `n` da otra partida real de la
   * misma medición en vez de una tirada suelta sin relación.
   *
   * Medido contra el VPS: 3-4 ms de motor, respuesta de 20-32 KB. Es barato:
   * no hay que tratarlo como un gauntlet ni ponerle barra de progreso.
   */
  partida: (mazo: MazoEnvio, rival: string, semilla = 31337, n = 0) =>
    llamar<PartidaNarrada>({ action: 'partida', mazo, rival, semilla, n }),
}

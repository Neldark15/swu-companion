/**
 * tipoTorneo — el vocabulario de «cómo se estructura un torneo».
 *
 * ── Por qué existe este archivo ───────────────────────────────────────
 *
 * La lista de tipos estaba COPIADA en dos pantallas de creación
 * (`AdminEventCreatePage` y `CreateEventPage`) y la unión de tipos estaba
 * escrita a mano en cinco servicios más. Agregar un tipo significaba
 * acordarse de siete sitios, y olvidarse de uno deja la opción existiendo
 * en una pantalla y no en la otra — que es exactamente cómo empieza una
 * duplicación que se separa (§3c).
 *
 * ── El eje que NO es este ─────────────────────────────────────────────
 *
 * `tournament_type` dice cómo se ESTRUCTURA el torneo. `format` dice con
 * qué mazo se juega (`premier`, `twin_suns`, `draft`…). Son ejes
 * distintos: por eso el tipo multijugador se llama **`mesas`** y no
 * `twin_suns`, aunque hoy solo se use para Twin Suns. Si se llamaran
 * igual, la misma fila tendría `format='twin_suns'` y
 * `tournament_type='twin_suns'` significando cosas distintas.
 */

export type TipoTorneo = 'swiss' | 'elimination' | 'mesas'

export interface OpcionTipo {
  value: TipoTorneo
  label: string
  desc: string
}

export const TIPOS_TORNEO: OpcionTipo[] = [
  { value: 'swiss', label: 'Suizo', desc: 'Todos juegan, ranking por puntos' },
  { value: 'elimination', label: 'Eliminación', desc: 'Bracket directo, pierdes y sales' },
  { value: 'mesas', label: 'Mesas', desc: 'Multijugador: 3 o 4 por mesa (Twin Suns)' },
]

const ETIQUETAS: Record<TipoTorneo, string> = {
  swiss: 'Suizo',
  elimination: 'Eliminación',
  mesas: 'Mesas',
}

/**
 * El nombre visible de un tipo.
 *
 * Existe para reemplazar los ternarios binarios que había repartidos por
 * las pantallas. Eran peores que un error: `TournamentPublicView` rotulaba
 * como «Eliminación» todo lo que no fuera suizo y `TournamentPlayerView`
 * rotulaba «SWISS» todo lo que no fuera eliminación, así que un tipo nuevo
 * se anunciaba con DOS nombres distintos y los dos falsos, en el mismo
 * torneo.
 *
 * Un valor desconocido se devuelve tal cual: preferible ver el código
 * crudo que una etiqueta inventada.
 */
export function etiquetaTipo(t: string | null | undefined): string {
  if (!t) return '—'
  return ETIQUETAS[t as TipoTorneo] ?? t
}

/** ¿Es uno de los tipos que conocemos? Para validar lo que viene de fuera. */
export function esTipoValido(t: unknown): t is TipoTorneo {
  return typeof t === 'string' && t in ETIQUETAS
}

/** Los torneos de mesas no se operan con el tablero 1v1. */
export function esDeMesas(t: string | null | undefined): boolean {
  return t === 'mesas'
}

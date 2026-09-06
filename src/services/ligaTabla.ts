/**
 * LA TABLA DE POSICIONES DE LA LIGA — pura, sin red.
 *
 * ── Por qué vive suelta y no dentro de `ligaService` ─────────────────
 *
 * Porque `ligaService` importa `supabase`, y eso significa que para PROBAR el
 * reparto de puntos había que levantar medio backend. El repo ya pagó esa
 * lección: el sorteo de misiones tenía un sesgo de 2,3× que nadie vio durante
 * meses, y el propio CLAUDE.md dice que estar pegado a `supabase` «es LA RAZÓN
 * de que no se viera nunca» (§3n). Lo mismo con las mesas: `services/mesas.ts`
 * es puro por el mismo motivo.
 *
 * De esta tabla salen los ascensos de tier. Es de las cosas del repo donde un
 * error se ve exactamente igual que un acierto: números plausibles, orden
 * plausible, cero errores en consola. Ya tuvo dos bugs así.
 *
 * Se prueba con `npm run liga`.
 */

export type EstadoPartida =
  | 'programada' | 'reportada' | 'confirmada' | 'disputada'
  | 'vencida' | 'wo_local' | 'wo_visita' | 'anulada'
  /* La Fase 0 agregó 'sin_jugar' al CHECK de la base porque `liga_cerrar` y
     `liga_cerrar_temporada` lo ESCRIBEN — y el tipo del cliente no se enteró.
     `rotuloDe` termina en `ROTULO[m.estado]`, que para un estado desconocido da
     `undefined`, y la línea siguiente lee `.clase` de ahí: TypeError y pantalla
     en blanco para TODA la liga. El `as` de `verLiga` es lo que impide que
     TypeScript lo cace — el servidor puede mandar lo que quiera. */
  | 'sin_jugar'


export interface PartidaLiga {
  id: string
  grupoId: string
  jornada: number
  localPlaza: string
  visitaPlaza: string
  vl: number
  vv: number
  estado: EstadoPartida
  /** 'acuerdo' los dos firmaron · 'silencio' el rival no contestó · 'laudo' lo resolvió la organización. */
  origen: 'acuerdo' | 'silencio' | 'laudo' | null
  venceEl: string | null
  vod: string | null
  reportadaPor: string | null
}

/** Una fila de la tabla de posiciones, COMPUTADA de las partidas (§2y). */
export interface PlazaLiga {
  id: string
  grupoId: string
  nombre: string
  lider: string | null
  base: string | null
  estado: 'activa' | 'abandonada' | 'anulada'
  esMia: boolean
  /** ISO alpha-2, o null. Se copia a la plaza al armar los grupos: es «dónde
   *  estaba cuando arrancó ESTA temporada», no dónde está hoy. */
  pais?: string | null
}

export interface FilaTabla {
  plazaId: string
  nombre: string
  /** Para la bandera. Viaja desde la plaza, que la congeló al arrancar la temporada. */
  pais?: string | null
  lider: string | null
  esMia: boolean
  abandonada: boolean
  jugadas: number
  ganadas: number
  perdidas: number
  puntos: number
  difGames: number
  gamesGanados: number
}

/** Los únicos estados que cuentan. Lista BLANCA: lo que no está, no suma. */
const CUENTAN = new Set(['confirmada', 'wo_local', 'wo_visita'])

/**
 * La tabla de un GRUPO. Se computa, nunca se almacena (§2y).
 *
 * ── Los dos defectos que tenía, y por qué ninguno daba error ─────────
 *
 * 1. **Filtraba con lista NEGRA** (`estado === 'programada' || 'sin_jugar'`).
 *    Cualquier estado nuevo contaba por omisión — y ahora hay cinco más
 *    (reportada, disputada, vencida, anulada). Una partida que nadie confirmó
 *    habría sumado puntos.
 * 2. **El `else` le daba la victoria y 3 puntos a la VISITA en cada empate.**
 *    Y un 0-0 es exactamente el estado de una partida sin marcador: medido,
 *    8 de los 10 duelos reales de producción están así (§3a).
 *
 * Las dos producen una tabla plausible y equivocada, en público, sin una sola
 * excepción. Ahora la lista es BLANCA y el empate es su propia rama.
 *
 * ── Y quien abandona no borra lo que ya jugó ─────────────────────────
 *
 * Antes `if (!local || !visita) continue` hacía desaparecer el resultado del
 * que SÍ jugó y ganó. En una liga de 24 era ruido; en una de 120 con abandono
 * normal del 30 % son ~140 encuentros evaporados. La plaza abandonada se
 * queda en el mapa con bandera y se filtra al PINTAR, no al sumar.
 */


export function tablaDe(
  plazas: PlazaLiga[],
  partidas: PartidaLiga[],
  grupoId?: string,
): FilaTabla[] {
  const filas = new Map<string, FilaTabla>()
  for (const p of plazas) {
    if (grupoId && p.grupoId !== grupoId) continue
    filas.set(p.id, {
      plazaId: p.id, nombre: p.nombre, pais: p.pais ?? null, lider: p.lider, esMia: p.esMia,
      abandonada: p.estado !== 'activa',
      jugadas: 0, ganadas: 0, perdidas: 0, puntos: 0, difGames: 0, gamesGanados: 0,
    })
  }

  for (const m of partidas) {
    if (grupoId && m.grupoId !== grupoId) continue
    if (!CUENTAN.has(m.estado)) continue
    const local = filas.get(m.localPlaza)
    const visita = filas.get(m.visitaPlaza)
    if (!local || !visita) continue

    const vl = m.estado === 'wo_visita' ? 2 : m.estado === 'wo_local' ? 0 : m.vl
    const vv = m.estado === 'wo_local' ? 2 : m.estado === 'wo_visita' ? 0 : m.vv

    local.jugadas++; visita.jugadas++
    local.gamesGanados += vl; visita.gamesGanados += vv
    local.difGames += vl - vv; visita.difGames += vv - vl

    if (vl > vv) { local.ganadas++; local.puntos += 3; visita.perdidas++ }
    else if (vv > vl) { visita.ganadas++; visita.puntos += 3; local.perdidas++ }
    // Empate: un BO3 no puede terminar empatado, así que un marcador igual es
    // una partida SIN marcador. No se le regala la victoria a nadie — cuenta
    // como jugada y punto. Antes esta rama no existía y la ganaba la visita.
  }

  const orden = [...filas.values()]
  return orden.sort((a, b) =>
    b.puntos - a.puntos ||
    // ENFRENTAMIENTO DIRECTO. En un round-robin de grupo dos empatados SIEMPRE
    // jugaron entre sí exactamente una vez, así que está siempre definido.
    // Terminar en `localeCompare` está bien para pintar y sería un escándalo
    // para ascender.
    directo(a, b, partidas) ||
    b.difGames - a.difGames ||
    b.gamesGanados - a.gamesGanados ||
    a.nombre.localeCompare(b.nombre))
}

/** −1 si `a` le ganó a `b`, 1 si perdió, 0 si no se cruzaron o no cuenta. */
function directo(a: FilaTabla, b: FilaTabla, partidas: PartidaLiga[]): number {
  for (const m of partidas) {
    if (!CUENTAN.has(m.estado)) continue
    const esEste =
      (m.localPlaza === a.plazaId && m.visitaPlaza === b.plazaId) ||
      (m.localPlaza === b.plazaId && m.visitaPlaza === a.plazaId)
    if (!esEste) continue
    const vl = m.estado === 'wo_visita' ? 2 : m.estado === 'wo_local' ? 0 : m.vl
    const vv = m.estado === 'wo_local' ? 2 : m.estado === 'wo_visita' ? 0 : m.vv
    if (vl === vv) return 0
    const ganoLocal = vl > vv
    const aEsLocal = m.localPlaza === a.plazaId
    return ganoLocal === aEsLocal ? -1 : 1
  }
  return 0
}

/* ══════════════════════════════════════════════════════════════════════
   MIS PARTIDAS ABIERTAS

   Vive acá y no en `ligaService` por la misma razón que `tablaDe`: ese módulo
   importa `supabase`, y lo que está pegado a la red no se puede probar en Node
   (§3n). El orden de urgencia es exactamente el tipo de regla que se rompe sin
   hacer ruido — una tarjeta arriba y una lista abajo discrepando sobre cuál
   partida es la importante se ve como una app confundida, no como un bug.

   Es GENÉRICA en el grupo a propósito: a esta función no le importa qué más
   lleva un grupo (tier, orden, fechas), solo sus plazas y sus partidas. Así no
   hay que arrastrar `GrupoLiga` —y con él media capa de servicios— hasta acá.
   ══════════════════════════════════════════════════════════════════════ */

export interface GrupoMinimo {
  plazas: PlazaLiga[]
  partidas: PartidaLiga[]
}

export interface PartidaAbierta<G extends GrupoMinimo = GrupoMinimo> {
  partida: PartidaLiga
  grupo: G
  rival: PlazaLiga
  miPlaza: PlazaLiga
  /** Alguien reportó y falta MI palabra. Es lo único que se puede resolver hoy. */
  esperaMiRespuesta: boolean
}

/** Los tres estados en los que una partida todavía puede cambiar. */
const ABIERTAS = new Set<EstadoPartida>(['programada', 'reportada', 'vencida'])

/**
 * TODAS mis partidas abiertas, de la más urgente a la menos.
 *
 * Antes solo existía «la próxima», una sola tarjeta. Con grupos de 8 son
 * **siete partidas por persona** y una jornada dura días: quien tenía dos sin
 * jugar y una esperando su confirmación veía una, resolvía esa, y las otras dos
 * seguían invisibles hasta la siguiente visita. Un plazo que corre sobre algo
 * que no se ve es exactamente lo que el reloj vino a arreglar.
 *
 * El orden NO es por jornada:
 *   1. lo que espera mi respuesta — se puede cerrar ahora mismo, y si no se
 *      cierra el reloj lo sella en contra;
 *   2. lo vencido — ya se atoró y hay que reclamarlo;
 *   3. el resto, por jornada.
 */
export function misPartidasAbiertas<G extends GrupoMinimo>(
  l: { grupos: G[] },
): Array<PartidaAbierta<G>> {
  const salida: Array<PartidaAbierta<G>> = []
  for (const g of l.grupos) {
    const mia = g.plazas.find(p => p.esMia)
    if (!mia) continue
    for (const m of g.partidas) {
      if (m.localPlaza !== mia.id && m.visitaPlaza !== mia.id) continue
      if (!ABIERTAS.has(m.estado)) continue
      const rivalId = m.localPlaza === mia.id ? m.visitaPlaza : m.localPlaza
      const rival = g.plazas.find(p => p.id === rivalId)
      // Sin rival en la lista no se puede dibujar la fila sin inventar un nombre.
      if (!rival) continue
      salida.push({
        partida: m, grupo: g, rival, miPlaza: mia,
        esperaMiRespuesta: m.estado === 'reportada' && m.reportadaPor !== mia.id,
      })
    }
  }
  const peso = (a: PartidaAbierta<G>) =>
    a.esperaMiRespuesta ? 0 : a.partida.estado === 'vencida' ? 1 : 2
  return salida.sort((a, b) => peso(a) - peso(b) || a.partida.jornada - b.partida.jornada)
}

/**
 * La más urgente de las mías, o `null`.
 *
 * DELEGA a propósito: la regla de qué es «lo más urgente» existe una sola vez.
 */
export function miProximaPartida<G extends GrupoMinimo>(
  l: { grupos: G[] },
): PartidaAbierta<G> | null {
  return misPartidasAbiertas(l)[0] ?? null
}


/* ══════════════════════════════════════════════════════════════════════
   EL REPARTO EN GRUPOS

   Vive acá —puro, sin React ni supabase— porque es aritmética que falla en
   silencio: un reparto malo devuelve bloques perfectamente plausibles y el
   error recién aparece cuando el servidor rechaza, **con el primer grupo ya
   escrito**. `liga_armar_grupos` valida y devuelve, no lanza, así que el
   rollback no existe: queda un grupo huérfano, el reintento choca contra
   `liga_grupos_temporada_id_tier_orden_key` (23505) y no hay `liga_borrar_grupo`
   en el esquema. Se destraba desde el SQL Editor.
   ══════════════════════════════════════════════════════════════════════ */

/** Lo que el servidor acepta por grupo. Está en `liga_armar_grupos`. */
export const GRUPO_MIN = 4
export const GRUPO_MAX = 12

/**
 * Cuántos grupos, y de qué tamaño, para `n` personas con un objetivo de `tamano`.
 *
 * La versión anterior cortaba de `tamano` en `tamano` y solo fusionaba el
 * sobrante si quedaba en **menos de 2**. Con grupos de 8: n=10 daba `[8,2]` y
 * n=11 daba `[8,3]` — los dos rechazados. Falla en n = 10, 11, 18, 19, 26, 27,
 * 34, 35 y 42: **nueve de las treinta y nueve poblaciones posibles**, y con 42
 * cuentas en la app la franja de 10-11 no es la cola, es lo más probable.
 *
 * Ahora se elige el NÚMERO de grupos y se reparte parejo. `tamano` deja de ser
 * un corte y pasa a ser un objetivo: con 10 personas y objetivo 8, un grupo de
 * 10 es mejor liga que uno de 8 y uno de 2 — y es la única opción legal.
 *
 * Devuelve `[]` si no se puede repartir sin romper el mínimo, y quien llama
 * tiene que decirlo en pantalla en vez de mandar algo que va a rebotar.
 */
export function tamanosDeGrupo(n: number, tamano: number): number[] {
  if (n < GRUPO_MIN) return []
  const objetivo = Math.max(GRUPO_MIN, Math.min(GRUPO_MAX, tamano))
  let g = Math.max(1, Math.round(n / objetivo))
  // Que ningún grupo quede por debajo del mínimo ni por encima del máximo.
  g = Math.min(g, Math.floor(n / GRUPO_MIN))
  g = Math.max(g, Math.ceil(n / GRUPO_MAX))
  if (g < 1) return []
  const base = Math.floor(n / g)
  const resto = n % g
  const salida = Array.from({ length: g }, (_, i) => base + (i < resto ? 1 : 0))
  // Red de seguridad: si por lo que sea algo quedó fuera de rango, se avisa
  // devolviendo vacío en vez de mandar un reparto que el servidor va a rechazar.
  return salida.every(s => s >= GRUPO_MIN && s <= GRUPO_MAX) ? salida : []
}

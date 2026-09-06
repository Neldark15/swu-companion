/**
 * El núcleo de la proyección: cuánto mide cada cosa y en qué orden va.
 *
 * Acá no hay React ni Supabase a propósito. Todo lo que decide el TAMAÑO de la
 * letra y el REPARTO de los nombres vive en funciones puras, porque es lo único
 * de esta pantalla que se puede probar sin encender un televisor.
 *
 * ── El supuesto físico, declarado ────────────────────────────────────
 *
 * Televisor de referencia de 55" 16:9 = 1218 mm de ancho. Sobre un lienzo de
 * 1920 px, 1 px = 0,634 mm. La RESOLUCIÓN no cambia nada: una tele de 720p de
 * 55" mide los mismos milímetros que una 4K de 55". Lo que manda es el ancho
 * físico, y por eso existe `?pantalla=chica` para las de 43" (952 mm), que son
 * comunes en tienda.
 *
 * Regla de lectura usada para fijar los cuerpos: la altura de MAYÚSCULA tiene
 * que ser ≈ distancia/160 para leer cómodo, y ≈ distancia/206 para reconocer
 * una palabra que uno ya está buscando. La mayúscula de Inter es 0,727 em.
 * A 4 metros: cómodo = 25 mm = 55 px de cuerpo; búsqueda = 19,4 mm = 42 px.
 *
 * ── La regla que ordena todo lo demás ────────────────────────────────
 *
 * PRIMERO se fija el piso legible y DESPUÉS se cuenta cuántas filas caben.
 * Nunca al revés. Si no caben, se cambia de escalón o se pagina; jamás se
 * achica la letra para que entre uno más. Un nombre que no se lee ocupa el
 * mismo lugar que uno que sí y no sirve para nada.
 */

import type { CloudStanding } from '../../../services/tournamentCloud'

/** Un peldaño de densidad. Los píxeles son enteros y están escritos a mano. */
export interface Escalon {
  /** Desde cuántas personas aplica. */
  desde: number
  cols: number
  filas: number
  /** Cuerpo del nombre en el directorio. */
  nombrePx: number
  chapaPx: number
  chapaAncho: number
  /** 0 = no se dibuja el chip de puesto (no hay ancho para él). */
  chipPx: number
  chipAncho: number
  /** 0 = no se dibuja la vida (solo cabe en el escalón más ancho). */
  vidaPx: number
  vidaAncho: number
  /** Cuántos caracteres del nombre entran, ya descontados chip, vida y chapa. */
  maxCaracteres: number
}

/**
 * La tabla de densidad.
 *
 * ── Por qué es una tabla y no una fórmula ────────────────────────────
 *
 * Lo elegante sería `font-size: 4cqh` y que el navegador reparta. Lo elegante
 * acá es peligroso: si el Chromium viejo de una smart TV no entiende
 * `container-type`, la declaración se descarta EN SILENCIO y el cuerpo cae al
 * heredado — o sea, la pantalla se apaga tipográficamente justo en el aparato
 * donde más probable es que pase, y sin ningún error que lo delate.
 *
 * Seis filas escritas a mano no fallan en ningún navegador que sepa sumar.
 */
export const ESCALONES: Escalon[] = [
  { desde:  0, cols: 2, filas:  6, nombrePx: 63, chapaPx: 56, chapaAncho: 150, chipPx: 34, chipAncho: 84, vidaPx: 60, vidaAncho: 96, maxCaracteres: 14 },
  { desde: 13, cols: 3, filas:  7, nombrePx: 54, chapaPx: 50, chapaAncho: 128, chipPx: 30, chipAncho: 72, vidaPx:  0, vidaAncho:  0, maxCaracteres: 11 },
  { desde: 22, cols: 3, filas:  9, nombrePx: 42, chapaPx: 42, chapaAncho: 118, chipPx: 30, chipAncho: 64, vidaPx:  0, vidaAncho:  0, maxCaracteres: 14 },
  { desde: 28, cols: 4, filas:  9, nombrePx: 42, chapaPx: 40, chapaAncho: 100, chipPx:  0, chipAncho:  0, vidaPx:  0, vidaAncho:  0, maxCaracteres: 12 },
  { desde: 37, cols: 4, filas: 11, nombrePx: 44, chapaPx: 40, chapaAncho: 100, chipPx:  0, chipAncho:  0, vidaPx:  0, vidaAncho:  0, maxCaracteres: 12 },
]

/** Arriba de esto el directorio pagina. Es el techo honesto de la pantalla. */
export const TOPE_SIN_PAGINAR = 44

export function escalonPara(n: number, pantallaChica = false): Escalon {
  /* En una tele de 43" (952 mm) cada píxel mide 22% menos que en una de 55"
     (1218 mm), así que hace falta letra MÁS GRANDE — o sea BAJAR de escalón,
     que es hacia menos columnas.
     
     Se hace fingiendo que hay MENOS gente, no más. La primera versión
     multiplicaba por 1,45 y conseguía justo lo contrario: en la tele chica
     elegía la disposición más apretada, con la letra más chica, que es el
     único sitio donde no se podía. Se vio en el banco comparando las dos.
     
     La consecuencia es que se pagina antes, y está aceptada: vale más leer
     media sala que no leer a nadie. */
  const efectivo = pantallaChica ? Math.max(1, Math.round(n * 0.68)) : n
  let elegido = ESCALONES[0]
  for (const e of ESCALONES) if (efectivo >= e.desde) elegido = e
  return elegido
}

/** Capacidad de un escalón: cuántas personas caben sin paginar. */
export function capacidad(e: Escalon): number {
  return e.cols * e.filas
}

/**
 * El nombre, acortado sin bajar el tamaño de letra.
 *
 * ── Por qué NUNCA se achica la letra ─────────────────────────────────
 *
 * Lo intuitivo es encoger el nombre largo para que quepa. Pero mezclar cuerpos
 * dentro de una columna deja la línea base dentada, y eso destruye justo la
 * exploración vertical que hace que un directorio se pueda barrer con la vista.
 * Vale más «Nelson M.» a 44 px que «Nelson Martínez» a 31.
 *
 * ── Y por qué recibe los ya usados ───────────────────────────────────
 *
 * Porque en una comunidad chica hay homónimos. Si «Nelson Martínez» y «Nelson
 * Meléndez» se acortan los dos a «Nelson M.», la pantalla muestra dos veces el
 * mismo nombre y quien los busca no sabe cuál es su mesa. El segundo pasa a
 * «Nelson M. R.» — se estira hasta que vuelve a ser único.
 */
export function nombreCorto(nombre: string, max: number, yaUsados?: Set<string>): string {
  const limpio = (nombre ?? '').trim().replace(/\s+/g, ' ')
  if (!limpio) return '—'

  const libre = (c: string) => !yaUsados || !yaUsados.has(c)
  const tomar = (c: string) => { yaUsados?.add(c); return c }

  if (limpio.length <= max && libre(limpio)) return tomar(limpio)

  const partes = limpio.split(' ')
  if (partes.length > 1) {
    const pila = partes[0]

    // 1. Inicial de cada apellido, sumando de a uno:
    //    «Nelson Martínez Portillo» → «Nelson M.» → «Nelson M. P.»
    for (let i = 1; i < partes.length; i++) {
      const cand = [pila, ...partes.slice(1, i + 1).map(p => p[0].toUpperCase() + '.')].join(' ')
      if (cand.length <= max && libre(cand)) return tomar(cand)
    }

    /* 2. Si la inicial ya la tiene otro, se ESTIRA el apellido en vez de
     *    rendirse: «Nelson Mar.» y «Nelson Mel.» se distinguen de un vistazo
     *    a cuatro metros. Este paso es el que evita el resultado feo de caer
     *    al nombre de pila solo, que en una pantalla se lee como si fuera
     *    otra persona —más corto que el de al lado y sin apellido—. */
    const apellido = partes[1]
    for (let corte = 2; corte <= apellido.length; corte++) {
      const cand = `${pila} ${apellido.slice(0, corte)}.`
      if (cand.length <= max && libre(cand)) return tomar(cand)
    }

    // 3. El nombre de pila solo. Último recurso antes de recortar.
    if (pila.length <= max && libre(pila)) return tomar(pila)
  }

  /* Último recurso. El puntito suspensivo es la peor opción y por eso es la
     última: no dice nada sobre quién es la persona. */
  const cortado = limpio.slice(0, Math.max(1, max - 1)) + '…'
  return tomar(cortado)
}

/** La letra bajo la que se agrupa un nombre. Lo que no empieza por A-Z cae en «#». */
export function inicial(nombre: string): string {
  const n = (nombre ?? '').trim()
  if (!n) return '#'
  const c = n
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // «Ávila» → «Avila»
    .toUpperCase()[0]
  return c >= 'A' && c <= 'Z' ? c : '#'
}

/** Orden alfabético de verdad: sin tildes para agrupar, con locale para ordenar. */
export function ordenAlfabetico<T extends { player_name: string }>(gente: T[]): T[] {
  return [...gente].sort((a, b) =>
    a.player_name.localeCompare(b.player_name, 'es', { sensitivity: 'base' }))
}

export interface Columna<T> {
  gente: T[]
  /** «A – F», o «A» a secas si el grupo tuvo que partirse. */
  rango: string
}

/**
 * Reparte a la gente en columnas SIN partir un grupo de letra.
 *
 * ── Por qué importa tanto ────────────────────────────────────────────
 *
 * La cabecera «A – F» es lo que hace posible el escalón chico: descarta dos
 * tercios de la pantalla antes de que la persona lea una sola palabra. Pero
 * solo funciona si es VERDAD. Si los «M» quedaron repartidos entre la columna
 * que dice «G – M» y la que dice «M – Z», la cabecera pasó de ser un atajo a
 * ser una trampa, y quien se llama Mejía mira la columna equivocada.
 *
 * Por eso se reparte por GRUPO y no por cantidad, aceptando columnas
 * desparejas. Solo si un único grupo no cabe entero en una columna se lo parte,
 * y entonces las dos cabeceras muestran la misma letra para que se note.
 */
export function repartirEnColumnas<T extends { player_name: string }>(
  gente: T[],
  cols: number,
  filas: number,
): Array<Columna<T>> {
  const ordenada = ordenAlfabetico(gente)

  // Agrupar por inicial, conservando el orden.
  const grupos: Array<{ letra: string; gente: T[] }> = []
  for (const p of ordenada) {
    const l = inicial(p.player_name)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.letra === l) ultimo.gente.push(p)
    else grupos.push({ letra: l, gente: [p] })
  }

  const columnas: Array<Columna<T>> = []
  let actual: T[] = []
  let letras: string[] = []

  const cerrar = () => {
    if (!actual.length) return
    const a = letras[0]
    const b = letras[letras.length - 1]
    columnas.push({ gente: actual, rango: a === b ? a : `${a} – ${b}` })
    actual = []
    letras = []
  }

  for (const g of grupos) {
    // Un grupo más grande que una columna entera: no queda otra que partirlo.
    if (g.gente.length > filas) {
      cerrar()
      for (let i = 0; i < g.gente.length; i += filas) {
        columnas.push({ gente: g.gente.slice(i, i + filas), rango: g.letra })
      }
      continue
    }
    /* Cabe entero. Se abre columna nueva si no entra acá Y todavía quedan
       columnas por usar; si ya no quedan, se apretuja, porque dejar gente
       afuera es peor que una columna despareja. */
    if (actual.length + g.gente.length > filas && columnas.length < cols - 1) cerrar()
    actual.push(...g.gente)
    letras.push(g.letra)
  }
  cerrar()

  return columnas
}

/**
 * La llave con la que se cruza una persona entre tablas.
 *
 * `tournament_mesas` NO tiene clave foránea contra `tournament_standings`, y un
 * tercio de la sala juega SIN CUENTA. Cruzar por `user_id` a secas mete a todos
 * esos en la misma casilla `null` del Map y les da la mesa de cualquiera.
 *
 * Es la misma llave que usa el servidor en `guardar_puestos_mesa`.
 */
export function clavePersona(userId: string | null, nombre: string): string {
  return userId ?? 'n:' + (nombre ?? '').trim().toLowerCase()
}

/**
 * Los puestos de la clasificación, con empates compartiendo ordinal.
 *
 * ── Por qué el empate comparte y no se desempata ─────────────────────
 *
 * En un torneo de mesas `omw_pct` y `gw_pct` son 0 para TODOS, así que el
 * desempate fino no desempata nada y el orden termina decidido por lo que
 * quedó de último en el array. Coronar a alguien por eso es inventar un
 * resultado. Dos personas con los mismos puntos comparten el «1º» y la sala
 * entiende perfectamente lo que significa.
 */
export function puestoDenso(
  gente: CloudStanding[],
  conDesempate: boolean,
): Map<string, number> {
  const orden = [...gente].sort((a, b) =>
    b.points - a.points ||
    (conDesempate ? b.omw_pct - a.omw_pct || b.gw_pct - a.gw_pct : 0))

  const puestos = new Map<string, number>()
  let puesto = 0
  let anterior: string | null = null

  for (const p of orden) {
    const firma = conDesempate ? `${p.points}|${p.omw_pct}|${p.gw_pct}` : `${p.points}`
    if (firma !== anterior) { puesto++; anterior = firma }
    puestos.set(p.id, puesto)
  }
  return puestos
}

/**
 * El orden de la clasificación FINAL.
 *
 * `puesto` manda cuando existe, porque lo fijó una persona mirando la mesa.
 * Quien no lo tiene va después, ordenado por lo que dice la tabla. El 32767 es
 * para que los nulos caigan al final sin comparar contra `null`.
 */
export function ordenFinal(gente: CloudStanding[]): CloudStanding[] {
  return [...gente].sort((a, b) =>
    (a.puesto ?? 32767) - (b.puesto ?? 32767) ||
    b.points - a.points ||
    b.omw_pct - a.omw_pct ||
    b.gw_pct - a.gw_pct ||
    a.player_name.localeCompare(b.player_name, 'es'))
}

/**
 * reproductor — la partida del simulador convertida en estados de mesa.
 *
 * Sin three.js, sin React y sin red: entra la lista de eventos que devuelve
 * `/partida` y sale «cómo se ve la mesa después del evento número k». Todo lo
 * que dibuja `MesaEscena` sale de aquí, así que esto se puede probar solo — y
 * se prueba, en `reproductor.test.ts`, contra 6 partidas reales del motor.
 *
 * ── Por qué se recalcula desde cero en vez de deshacer ────────────────
 *
 * `estadoEn(p, k)` pliega los k primeros eventos empezando de la mesa vacía.
 * Lo alternativo —guardar el estado e ir aplicando y DESaplicando— exige que
 * cada evento sepa invertirse, y «des-morir» una unidad significa recordar
 * dónde estaba, con cuánto daño y con qué mejoras encima. Ese es el sitio
 * donde un reproductor se corrompe: se retrocede tres pasos, se avanza cinco
 * y la mesa ya no es la que era.
 *
 * El coste de plegar es de verdad despreciable: medido sobre las 6 partidas de
 * la prueba, el estado final de una partida de 213 eventos sale en 0,05 ms. Ir
 * y volver por toda la partida cuesta menos que un fotograma.
 *
 * ── El libro mayor de la vida se CALCULA, no se copia ─────────────────
 *
 * Cada evento `base` trae `delta` y `vida`. Copiar `vida` haría que la mesa
 * coincidiera siempre con el motor por definición, y la prueba de que
 * coinciden no probaría nada. Así que la vida se acumula con `delta` y `vida`
 * queda de contraste: si alguna vez discrepan, `descuadre` se enciende y la
 * pantalla lo dice en vez de enseñar un número inventado.
 *
 * Verificado sobre 61 partidas y 6 100 eventos: 0 descuadres.
 *
 * ── Lo que los eventos NO distinguen, y cómo se resuelve ──────────────
 *
 * Los eventos identifican a las unidades por NOMBRE, y en la mesa puede haber
 * varias copias de la misma carta — medido: hasta **5 copias vivas a la vez**
 * en las partidas de prueba. Cuando llega «Battlefield Marine recibe 3», el
 * motor sabe cuál, y nosotros no.
 *
 * No se resuelve a cara o cruz: el evento `dano` trae `resto`, la vida que le
 * queda a la unidad DESPUÉS del golpe. Con eso, la copia buena es la que
 * cumple `resto_actual − n === resto`, que casi siempre es una sola. Solo
 * cuando ninguna cuadra (o cuadran varias) se cae en la primera, que es el
 * orden en que el motor las tiene en su lista.
 */

import type { PartidaNarrada, EventoPartida, Lado, Arena } from '../lab/simApi'

/* ── Lo que hay en la mesa ───────────────────────────────────────────── */

/**
 * Una unidad en el campo.
 *
 * `uid` es la identidad que NO tiene el evento: se asigna al entrar y sirve
 * para que la escena 3D siga a la misma carta entre un estado y el siguiente.
 * Es estable porque el plegado es determinista: `estadoEn(p, 40)` da siempre
 * los mismos uid.
 */
export interface UnidadMesa {
  uid: number
  nombre: string
  lado: Lado
  arena: Arena
  lider: boolean
  /**
   * Poder de entrada más lo que sumen las mejoras.
   *
   * **No es el poder efectivo de este instante.** El motor aplica auras de
   * líder y modificadores de combate que nunca anuncia: contrastado contra el
   * daño declarado en 881 ataques a base, coincide el 80,1 % de las veces y
   * la diferencia va en los dos sentidos (de −6 a +6). Por eso la carta
   * enseña este número —el que se puede sostener— y el golpe de verdad se ve
   * en la cifra que sale flotando al atacar, que sí es la real.
   */
  poder: number
  /** Vida máxima conocida, mejoras incluidas. Es un SUELO: ver `resto`. */
  hp: number
  /** Vida que le queda. La dice el motor en cada `dano`; no se deduce. */
  resto: number
  mejoras: string[]
  /** Lleva encima una mejora del RIVAL (Condemn y compañía). */
  condenada: boolean
  /**
   * Atacó en esta ronda, así que está girada.
   *
   * **Es una deducción, no un dato.** El motor no anuncia los agotamientos:
   * esto sale de que atacar agota, que es la regla, y se limpia en cada
   * evento `ronda`. Las unidades que se agotan por una habilidad («Action
   * [Exhaust]: …») no se ven, así que el indicador se queda CORTO — nunca de
   * más. Se dibuja igual porque una carta girada es la señal más legible de
   * la mesa y acertar en los ataques ya cubre la mayoría.
   */
  agotado: boolean
  /** Índice del evento que la puso en mesa: la escena anima su entrada. */
  entroEn: number
}

/** Un lado de la mesa: su base, su líder y lo que tiene desplegado. */
export interface LadoMesa {
  lider: string
  base: string
  /**
   * Vida de la base. **Puede ser negativa**: el motor deja que el último
   * golpe pase de cero y solo recorta al informar el resultado. Para pintar,
   * usar `vidaVisible`.
   */
  vida: number
  vidaInicial: number
  liderDesplegado: boolean
  /**
   * Las unidades EN EL ORDEN DEL MOTOR (su propia lista `unidades`). El orden
   * importa: es el criterio de desempate cuando hay copias de la misma carta.
   */
  unidades: UnidadMesa[]
  /** Cartas rivales capturadas por este lado, por nombre. */
  capturadas: string[]
}

/** A quién mira la cámara en este paso. `'base'` es la base del otro lado. */
export interface Foco {
  actor: number | null
  objetivo: number | 'base' | null
  lado: Lado | null
}

export interface EstadoMesa {
  /** Cuántos eventos se aplicaron. 0 = la mesa antes de empezar. */
  indice: number
  ronda: number
  a: LadoMesa
  b: LadoMesa
  /** El evento que se acaba de aplicar. Es lo que la escena anima. */
  ultimo: EventoPartida | null
  /** Protagonistas del último evento, ya resueltos a uid. */
  foco: Foco
  /**
   * Unidades que el último evento sacó del campo.
   *
   * Existen un solo paso: sin esto la carta desaparecería de golpe y no habría
   * nada que animar cayendo.
   */
  salientes: UnidadMesa[]
  fin: { ganador: Lado; por: string } | null
  /**
   * La vida acumulada dejó de cuadrar con la que dice el motor.
   *
   * No debería encenderse nunca (0 casos en 61 partidas). Si se enciende, la
   * mesa está contando otra partida y la pantalla tiene que decirlo.
   */
  descuadre: boolean
}

/** La vida que se PINTA: el motor deja bajar de cero, el marcador no. */
export function vidaVisible(l: LadoMesa): number {
  return Math.max(0, l.vida)
}

/** Las unidades de una arena, en el orden del motor. */
export function enArena(l: LadoMesa, arena: Arena): UnidadMesa[] {
  return l.unidades.filter((u) => u.arena === arena)
}

/* ── El plegado ──────────────────────────────────────────────────────── */

interface Interno extends EstadoMesa {
  proximoUid: number
}

function ladoVacio(lider: string, base: string, vida: number): LadoMesa {
  return { lider, base, vida, vidaInicial: vida, liderDesplegado: false, unidades: [], capturadas: [] }
}

/**
 * La mesa antes del primer evento.
 *
 * Las vidas se siembran del evento `inicio` —que es el evento 0— para que en
 * el índice 0 ya se vean las dos bases con su vida de partida en vez de dos
 * ceros que saltan al 30 en cuanto se da un paso.
 */
function estadoInicial(p: PartidaNarrada): Interno {
  const ini = p.eventos.find((e) => e.t === 'inicio')
  return {
    indice: 0,
    ronda: 0,
    a: ladoVacio(p.lider_a, p.base_a_carta, ini ? ini.a.vida : 0),
    b: ladoVacio(p.lider_b, p.base_b_carta, ini ? ini.b.vida : 0),
    ultimo: null,
    foco: { actor: null, objetivo: null, lado: null },
    salientes: [],
    fin: null,
    descuadre: false,
    proximoUid: 1,
  }
}

function elLado(e: Interno, lado: Lado): LadoMesa {
  return lado === 'A' ? e.a : e.b
}

const otro = (lado: Lado): Lado => (lado === 'A' ? 'B' : 'A')

/**
 * Cuál de las copias de una carta es la que nombra el evento.
 *
 * `prefiere` es la pista dura del propio evento (ver la cabecera del archivo).
 * Sin pista o con empate se devuelve la primera, que es el orden de la lista
 * del motor. Medido sobre 6 100 eventos: la pista de `resto` resuelve el
 * 100 % de los `dano` con copias múltiples que la primera-por-orden habría
 * podido atribuir mal.
 */
function buscarUnidad(
  l: LadoMesa,
  nombre: string,
  prefiere?: (u: UnidadMesa) => boolean,
): UnidadMesa | null {
  const copias = l.unidades.filter((u) => u.nombre === nombre)
  if (copias.length === 0) return null
  if (copias.length === 1 || !prefiere) return copias[0]
  return copias.find(prefiere) ?? copias[0]
}

/** Aplica UN evento sobre el estado. Muta: solo lo llama `estadoEn`. */
function aplicar(e: Interno, ev: EventoPartida, indice: number) {
  e.foco = { actor: null, objetivo: null, lado: null }
  e.salientes = []

  switch (ev.t) {
    case 'inicio': {
      e.a.vida = ev.a.vida; e.a.vidaInicial = ev.a.vida; e.a.lider = ev.a.lider; e.a.base = ev.a.base
      e.b.vida = ev.b.vida; e.b.vidaInicial = ev.b.vida; e.b.lider = ev.b.lider; e.b.base = ev.b.base
      break
    }

    case 'ronda':
      e.ronda = ev.n
      // Empieza la ronda: todo el mundo endereza.
      for (const u of [...e.a.unidades, ...e.b.unidades]) u.agotado = false
      break

    case 'juega':
      // Solo marca de quién es el turno: la unidad aparece con su `entra`, y
      // los eventos y las mejoras se ven en `adjunta` o en el daño que hacen.
      e.foco = { actor: null, objetivo: null, lado: ev.lado }
      break

    case 'entra': {
      const l = elLado(e, ev.lado)
      const u: UnidadMesa = {
        uid: e.proximoUid++,
        nombre: ev.carta,
        lado: ev.lado,
        arena: ev.arena,
        lider: ev.lider,
        poder: ev.poder,
        hp: ev.hp,
        resto: ev.hp,
        mejoras: [],
        condenada: false,
        agotado: false,
        entroEn: indice,
      }
      l.unidades.push(u)
      e.foco = { actor: u.uid, objetivo: null, lado: ev.lado }
      break
    }

    case 'sale':
    case 'muere': {
      const l = elLado(e, ev.lado)
      // Al morir se prefiere una copia sin vida: el `dano` letal llegó justo
      // antes y la dejó en 0. Es la misma pista de `resto`, aplicada al revés.
      const u = buscarUnidad(l, ev.carta, ev.t === 'muere' ? (x) => x.resto <= 0 : undefined)
      if (u) {
        l.unidades = l.unidades.filter((x) => x !== u)
        e.salientes = [u]
        e.foco = { actor: u.uid, objetivo: null, lado: ev.lado }
      }
      break
    }

    case 'dano': {
      const l = elLado(e, ev.lado)
      // Con escudo el golpe no entra y `resto` no cambia; sin escudo, la copia
      // buena es la que llega justo a `resto` restando `n`.
      const u = buscarUnidad(l, ev.carta, (x) =>
        ev.escudo ? x.resto === ev.resto : x.resto - ev.n === ev.resto)
      if (u) {
        u.resto = ev.resto
        // `entra` es una FOTO del momento de entrar, no un techo: el motor
        // aplica auras de líder y constantes que refresca al empezar cada
        // ronda, y esos refuerzos no se vuelven a anunciar. Medido sobre 61
        // partidas: 98 veces el motor declara más vida restante de la que
        // creíamos que cabía (Han Solo entra con 1 de vida y aguanta con 2).
        // Cuando eso pasa, la cuenta mala es la nuestra — se sube el techo en
        // vez de recortar el dato, que sería pintar la unidad más débil de lo
        // que está.
        if (u.resto > u.hp) u.hp = u.resto
        e.foco = { actor: null, objetivo: u.uid, lado: ev.lado }
      }
      break
    }

    case 'base': {
      const l = elLado(e, ev.lado)
      l.vida += ev.delta
      // El contraste, no la copia. Ver la cabecera.
      if (l.vida !== ev.vida) e.descuadre = true
      e.foco = { actor: null, objetivo: 'base', lado: ev.lado }
      break
    }

    case 'ataca': {
      const mio = elLado(e, ev.lado)
      // Se prefiere una que aún no haya atacado: en una ronda cada unidad
      // ataca una vez, así que entre dos copias la enderezada es la que va.
      const atacante = buscarUnidad(mio, ev.atacante, (x) => !x.agotado)
      if (atacante) atacante.agotado = true
      if (ev.objetivo === 'base') {
        e.foco = { actor: atacante?.uid ?? null, objetivo: 'base', lado: ev.lado }
      } else {
        // El defensor está en el OTRO lado. Se prefiere la copia que aún puede
        // recibir el golpe: la que ya está en 0 se está muriendo.
        const suyo = elLado(e, otro(ev.lado))
        const def = buscarUnidad(suyo, ev.objetivo, (x) => x.resto > 0)
        e.foco = { actor: atacante?.uid ?? null, objetivo: def?.uid ?? null, lado: ev.lado }
      }
      break
    }

    case 'captura': {
      // `lado` es quien CAPTURA; la unidad ya salió del campo rival con su
      // propio `sale` (causa «captura») en el evento anterior.
      elLado(e, ev.lado).capturadas.push(ev.carta)
      e.foco = { actor: null, objetivo: null, lado: ev.lado }
      break
    }

    case 'adjunta': {
      // Una mejora HOSTIL la juega un lado y se pega a una unidad del OTRO.
      const destino = elLado(e, ev.hostil ? otro(ev.lado) : ev.lado)
      const u = buscarUnidad(destino, ev.sobre)
      if (u) {
        u.mejoras.push(ev.mejora)
        u.poder += ev.poder
        u.hp += ev.hp
        u.resto += ev.hp
        if (ev.hostil) u.condenada = true
        e.foco = { actor: null, objetivo: u.uid, lado: ev.lado }
      }
      break
    }

    case 'despliega_lider': {
      // El líder entra al campo con el `entra` que viene justo detrás; esto
      // solo apaga su carta de la zona de líder.
      elLado(e, ev.lado).liderDesplegado = true
      e.foco = { actor: null, objetivo: null, lado: ev.lado }
      break
    }

    case 'fin':
      e.fin = { ganador: ev.ganador, por: ev.por }
      break
  }
}

/** Cuántos pasos tiene la partida. El índice va de 0 a este número. */
export function totalPasos(p: PartidaNarrada): number {
  return p.eventos.length
}

/**
 * La mesa después de aplicar los `hasta` primeros eventos.
 *
 * `hasta = 0` es la mesa servida y sin jugar; `hasta = totalPasos(p)` es el
 * final. Fuera de rango se recorta en vez de fallar: los controles de la
 * pantalla llaman a esto con lo que sea que tenga el estado de React.
 */
export function estadoEn(p: PartidaNarrada, hasta: number): EstadoMesa {
  const limite = Math.max(0, Math.min(Math.trunc(hasta) || 0, p.eventos.length))
  const e = estadoInicial(p)
  for (let i = 0; i < limite; i++) aplicar(e, p.eventos[i], i)
  e.indice = limite
  e.ultimo = limite > 0 ? p.eventos[limite - 1] : null
  return e
}

/* ── Los controles ───────────────────────────────────────────────────── */

export function avanzar(p: PartidaNarrada, indice: number): number {
  return Math.min(indice + 1, p.eventos.length)
}

/** `_p` no se usa: va en la firma para que los tres controles se llamen igual. */
export function retroceder(_p: PartidaNarrada, indice: number): number {
  return Math.max(indice - 1, 0)
}

/** Las rondas que de verdad se jugaron, en orden. */
export function rondasDe(p: PartidaNarrada): number[] {
  const out: number[] = []
  for (const ev of p.eventos) if (ev.t === 'ronda') out.push(ev.n)
  return out
}

/**
 * El índice donde EMPIEZA una ronda.
 *
 * Devuelve el índice del propio evento `ronda` más uno, o sea la mesa con esa
 * ronda ya anunciada. Si la ronda no existe se queda donde está: es mejor no
 * moverse que saltar a un sitio cualquiera.
 */
export function irARonda(p: PartidaNarrada, ronda: number, actual = 0): number {
  const i = p.eventos.findIndex((e) => e.t === 'ronda' && e.n === ronda)
  return i < 0 ? actual : i + 1
}

/**
 * En qué ronda cae un índice. Para el rótulo del control deslizante, que se
 * mueve por eventos y tiene que decir en qué ronda va.
 */
export function rondaEn(p: PartidaNarrada, indice: number): number {
  let r = 0
  const limite = Math.max(0, Math.min(indice, p.eventos.length))
  for (let i = 0; i < limite; i++) {
    const ev = p.eventos[i]
    if (ev.t === 'ronda') r = ev.n
  }
  return r
}

/* ── El relato ───────────────────────────────────────────────────────── */

/**
 * Una línea en español de lo que acaba de pasar.
 *
 * No es `partida.log`: ese registro tiene sus propias líneas, en su propio
 * ritmo, y no hay forma de casarlas una a una con los eventos (el motor
 * escribe una línea de texto cada varias jugadas). Esto se deriva del evento
 * que se está viendo, así que el subtítulo y la mesa siempre hablan de lo
 * mismo.
 *
 * `mi` es cómo se llama el lado A en la pantalla —el mazo que se está
 * probando— para no obligar a nadie a acordarse de que «A» es el suyo.
 */
export function frase(ev: EventoPartida | null, mi = 'Tu mazo', suyo = 'Rival'): string {
  if (!ev) return 'Mesa servida. Dale a reproducir.'
  const quien = (l: Lado) => (l === 'A' ? mi : suyo)
  switch (ev.t) {
    case 'inicio': return `Empieza ${quien(ev.empieza)}.`
    case 'ronda': return `Ronda ${ev.n}`
    case 'juega': return `${quien(ev.lado)} juega ${ev.carta} (${ev.coste})`
    case 'entra': return `${ev.carta} entra en ${ev.arena}`
    case 'sale': return `${ev.carta} deja el campo (${ev.causa})`
    case 'muere': return `${ev.carta} muere (${ev.causa})`
    case 'dano': return ev.escudo
      ? `El escudo de ${ev.carta} para el golpe`
      : `${ev.carta} recibe ${ev.n} (le quedan ${ev.resto})`
    case 'base': return ev.delta < 0
      ? `Base de ${quien(ev.lado)}: ${ev.delta} → ${Math.max(0, ev.vida)}`
      : `Base de ${quien(ev.lado)}: +${ev.delta} → ${ev.vida}`
    // Se discrimina por `vida_restante`, NO por `objetivo === 'base'`: la
    // variante contra unidad declara `objetivo: string`, que incluye la cadena
    // «base», así que comparar el valor no estrecha nada y TypeScript sigue
    // sin dejar leer `recibe`. La presencia del campo sí discrimina.
    case 'ataca': return 'vida_restante' in ev
      ? `${ev.atacante} ataca la base de ${quien(ev.lado === 'A' ? 'B' : 'A')} (${ev.dano})`
      : `${ev.atacante} ataca a ${ev.objetivo} (${ev.dano} por ${ev.recibe})`
    case 'captura': return `${quien(ev.lado)} captura ${ev.carta}`
    case 'adjunta': return ev.hostil
      ? `${ev.mejora} cae sobre ${ev.sobre} (unidad rival)`
      : `${ev.mejora} se adjunta a ${ev.sobre}`
    case 'despliega_lider': return `${quien(ev.lado)} despliega a ${ev.carta}${ev.gratis ? ' (gratis)' : ''}`
    case 'fin': return `Gana ${quien(ev.ganador)} en ${ev.rondas} rondas — ${ev.por}`
  }
}

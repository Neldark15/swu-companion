/**
 * Pruebas del reproductor, contra partidas REALES del motor.
 *
 * No hay corredor de pruebas en este repo (ni vitest ni jest), así que esto es
 * un programa: se ejecuta y o pasa en silencio o lanza. Sin dependencias
 * nuevas y sin tocar `package.json`.
 *
 *     npx tsx src/features/mesa/reproductor.test.ts
 *
 * La prueba que importa es la primera: **la vida de las bases al final tiene
 * que ser la que dice el motor**. Si el reproductor y el motor no coinciden,
 * la mesa está enseñando una partida que no ocurrió. Y no vale copiar el
 * campo `vida` de cada evento: la vida se acumula sumando `delta` (ver
 * `reproductor.ts`), así que la coincidencia es una medición, no una
 * tautología.
 */

import { PARTIDAS } from './partidas.fixture'
import {
  estadoEn, totalPasos, avanzar, retroceder, irARonda, rondaEn, rondasDe,
  vidaVisible, enArena, frase,
  type EstadoMesa, type UnidadMesa,
} from './reproductor'
import type { PartidaNarrada, EventoPartida } from '../lab/simApi'

let fallos = 0
let comprobaciones = 0

function ok(cond: boolean, que: string) {
  comprobaciones++
  if (!cond) { fallos++; console.error('  FALLA: ' + que) }
}

function igual(a: unknown, b: unknown, que: string) {
  comprobaciones++
  if (a !== b) { fallos++; console.error(`  FALLA: ${que} — esperaba ${String(b)}, salió ${String(a)}`) }
}

const nombre = (p: PartidaNarrada, i: number) => `#${i} vs ${p.rival} (${p.eventos.length} ev)`

/* ── 1 · El libro mayor de la vida ───────────────────────────────────── */

function pruebaVida() {
  console.log('1 · vida de las bases al final == la que dice el motor')
  PARTIDAS.forEach((p, i) => {
    const fin = estadoEn(p, totalPasos(p))
    igual(vidaVisible(fin.a), p.base_a, `${nombre(p, i)}: base A`)
    igual(vidaVisible(fin.b), p.base_b, `${nombre(p, i)}: base B`)
    ok(!fin.descuadre, `${nombre(p, i)}: sin descuadre en ningún paso intermedio`)
    igual(fin.fin?.ganador, p.ganador, `${nombre(p, i)}: ganador`)
  })
}

/**
 * El mismo cuadre, pero paso a paso: cada `ataca` contra la base declara la
 * vida que deja, y tiene que ser la que el reproductor tiene en ese instante.
 * Es la comprobación que cazaría un doble descuento — el error natural aquí,
 * porque el `dano` de un `ataca` a la base son los MISMOS puntos que el evento
 * `base` que lo acompaña.
 */
function pruebaVidaPasoAPaso() {
  console.log('2 · cada «ataca a la base» cuadra con la vida en ese instante')
  let mirados = 0
  PARTIDAS.forEach((p, i) => {
    p.eventos.forEach((ev, k) => {
      // `'vida_restante' in ev` y no `objetivo === 'base'`: ver la nota de
      // `frase()` en reproductor.ts — la otra variante declara `objetivo` como
      // string y la comparación no estrecha el tipo.
      if (ev.t !== 'ataca' || !('vida_restante' in ev)) return
      // El `base` que anota el golpe sale ANTES del `ataca`, así que en el
      // estado justo después del `ataca` la vida ya está descontada.
      const est = estadoEn(p, k + 1)
      const victima = ev.lado === 'A' ? est.b : est.a
      mirados++
      igual(victima.vida, ev.vida_restante, `${nombre(p, i)} ev ${k}: vida tras el ataque`)
    })
  })
  console.log(`   (${mirados} ataques a base contrastados)`)
}

/* ── 2 · Ninguna unidad se pierde ni se inventa ──────────────────────── */

function pruebaTablero() {
  console.log('3 · el tablero cuadra en TODOS los índices (entra − muere − sale)')
  PARTIDAS.forEach((p, i) => {
    let vivosA = 0, vivosB = 0, huerfanos = 0
    for (let k = 0; k < p.eventos.length; k++) {
      const ev = p.eventos[k]
      if (ev.t === 'entra') { if (ev.lado === 'A') vivosA++; else vivosB++ }
      if (ev.t === 'muere' || ev.t === 'sale') { if (ev.lado === 'A') vivosA--; else vivosB-- }
      const est = estadoEn(p, k + 1)
      if (est.a.unidades.length !== vivosA || est.b.unidades.length !== vivosB) huerfanos++
      // Una salida que no encuentra a quién sacar deja `salientes` vacío.
      if ((ev.t === 'muere' || ev.t === 'sale') && est.salientes.length === 0) huerfanos++
    }
    igual(huerfanos, 0, `${nombre(p, i)}: índices con el tablero descuadrado`)
    ok(vivosA >= 0 && vivosB >= 0, `${nombre(p, i)}: nunca hay unidades negativas`)
  })
}

/**
 * Los uid no se renumeran.
 *
 * La escena 3D sigue a cada carta por su uid entre un paso y el siguiente. Si
 * el plegado reasignara identidades, cada paso destruiría y recrearía las
 * mallas: se perdería toda animación y se reventaría el rendimiento sin que
 * ninguna otra prueba se enterara.
 */
function pruebaIdentidad() {
  console.log('4 · los uid son estables entre pasos consecutivos')
  PARTIDAS.forEach((p, i) => {
    let churn = 0
    let antes = new Map<number, string>()
    for (let k = 0; k <= p.eventos.length; k++) {
      const est = estadoEn(p, k)
      const ahora = new Map<number, string>()
      for (const u of [...est.a.unidades, ...est.b.unidades]) ahora.set(u.uid, u.nombre + '|' + u.lado)
      for (const [uid, quien] of ahora) {
        const previo = antes.get(uid)
        if (previo !== undefined && previo !== quien) churn++
      }
      antes = ahora
    }
    igual(churn, 0, `${nombre(p, i)}: uid reutilizados para otra carta`)
  })
}

/* ── 3 · La pista de `resto` desambigua las copias ───────────────────── */

/**
 * Cuando hay varias copias de la misma carta en mesa, el evento no dice cuál.
 * Esto mide dos cosas: que la copia elegida queda con el `resto` que declara
 * el motor, y CUÁNTAS veces la regla ingenua (la primera de la lista) habría
 * elegido otra.
 */
function pruebaCopias() {
  console.log('5 · desambiguación por `resto` cuando hay copias')
  let conCopias = 0, distintaQueIngenua = 0, sinCuadrar = 0, danos = 0
  PARTIDAS.forEach((p) => {
    p.eventos.forEach((ev, k) => {
      if (ev.t !== 'dano') return
      danos++
      const previo = estadoEn(p, k)
      const lado = ev.lado === 'A' ? previo.a : previo.b
      const copias = lado.unidades.filter((u) => u.nombre === ev.carta)
      if (copias.length === 0) return
      if (copias.length > 1) {
        conCopias++
        const elegida = copias.find((u) => ev.escudo ? u.resto === ev.resto : u.resto - ev.n === ev.resto)
        if (elegida && elegida !== copias[0]) distintaQueIngenua++
        if (!elegida) sinCuadrar++
      }
      const post = estadoEn(p, k + 1)
      const ladoPost = ev.lado === 'A' ? post.a : post.b
      ok(ladoPost.unidades.some((u) => u.nombre === ev.carta && u.resto === ev.resto),
        `daño en ${ev.carta}: alguna copia queda con resto ${ev.resto}`)
    })
  })
  console.log(`   ${danos} daños · ${conCopias} con copias múltiples · ` +
    `${distintaQueIngenua} donde la pista eligió otra que la primera · ${sinCuadrar} sin cuadrar`)
}

/* ── 4 · Los controles ───────────────────────────────────────────────── */

function pruebaControles() {
  console.log('6 · avanzar / retroceder / ir a ronda')
  PARTIDAS.forEach((p, i) => {
    const n = totalPasos(p)
    igual(avanzar(p, n), n, `${nombre(p, i)}: avanzar tope`)
    igual(retroceder(p, 0), 0, `${nombre(p, i)}: retroceder suelo`)
    igual(avanzar(p, retroceder(p, 5)), 5, `${nombre(p, i)}: ida y vuelta`)
    igual(estadoEn(p, -3).indice, 0, `${nombre(p, i)}: índice negativo se recorta`)
    igual(estadoEn(p, n + 99).indice, n, `${nombre(p, i)}: índice pasado se recorta`)

    for (const r of rondasDe(p)) {
      const idx = irARonda(p, r)
      igual(rondaEn(p, idx), r, `${nombre(p, i)}: ir a la ronda ${r} cae en la ronda ${r}`)
    }
    igual(irARonda(p, 999, 42), 42, `${nombre(p, i)}: ronda inexistente no mueve`)
  })
}

/* ── 5 · Cobertura del esquema ───────────────────────────────────────── */

const TIPOS: EventoPartida['t'][] = [
  'inicio', 'ronda', 'juega', 'entra', 'sale', 'muere', 'dano',
  'base', 'ataca', 'captura', 'adjunta', 'despliega_lider', 'fin',
]

function pruebaCobertura() {
  console.log('7 · las 13 clases de evento salen en el fixture y todas se aplican')
  const vistos = new Set<string>()
  for (const p of PARTIDAS) for (const ev of p.eventos) vistos.add(ev.t)
  for (const t of TIPOS) ok(vistos.has(t), `el fixture contiene un evento «${t}»`)
  for (const t of vistos) ok((TIPOS as string[]).includes(t), `«${t}» es un tipo conocido`)

  // Y que `frase()` responda algo a todos, sin caerse ni devolver vacío.
  let vacias = 0
  for (const p of PARTIDAS) for (const ev of p.eventos) if (!frase(ev).trim()) vacias++
  igual(vacias, 0, 'frases vacías')
  ok(frase(null).length > 0, 'frase del estado inicial')
}

/* ── 6 · Coherencia de lo que dibuja la escena ───────────────────────── */

function pruebaEscena() {
  console.log('8 · lo que consume la escena: arenas, mejoras, foco')
  PARTIDAS.forEach((p, i) => {
    let arenaMala = 0, resolvioAtacante = 0, ataques = 0, restoRaro = 0
    for (let k = 1; k <= p.eventos.length; k++) {
      const ev = p.eventos[k - 1]
      const est = estadoEn(p, k)
      for (const l of [est.a, est.b]) {
        const t = enArena(l, 'tierra'), e = enArena(l, 'espacio')
        if (t.length + e.length !== l.unidades.length) arenaMala++
        for (const u of l.unidades) if (u.resto > u.hp || u.resto < 0) restoRaro++
      }
      if (ev.t === 'ataca') {
        ataques++
        if (est.foco.actor !== null) resolvioAtacante++
      }
    }
    igual(arenaMala, 0, `${nombre(p, i)}: unidades fuera de sus dos arenas`)
    igual(restoRaro, 0, `${nombre(p, i)}: resto fuera de [0, hp]`)
    ok(resolvioAtacante === ataques,
      `${nombre(p, i)}: atacante resuelto a uid en los ${ataques} ataques (salieron ${resolvioAtacante})`)
  })
}

/* ── 7 · Coste ───────────────────────────────────────────────────────── */

function pruebaCoste() {
  console.log('9 · coste de plegar')
  const p = PARTIDAS.reduce((a, b) => (a.eventos.length > b.eventos.length ? a : b))
  const n = totalPasos(p)
  // Calentar.
  for (let i = 0; i < 20; i++) estadoEn(p, n)
  const t0 = performance.now()
  const VUELTAS = 200
  for (let i = 0; i < VUELTAS; i++) estadoEn(p, n)
  const porPliegue = (performance.now() - t0) / VUELTAS

  // Recorrer la partida ENTERA paso a paso, que es lo que hace reproducirla.
  const t1 = performance.now()
  for (let k = 0; k <= n; k++) estadoEn(p, k)
  const recorrido = performance.now() - t1

  console.log(`   partida de ${n} eventos: ${porPliegue.toFixed(3)} ms por pliegue completo, ` +
    `${recorrido.toFixed(1)} ms el recorrido entero (${n + 1} pliegues)`)
  ok(porPliegue < 5, `un pliegue cuesta menos de 5 ms (salió ${porPliegue.toFixed(3)})`)
}

/* ── Informe ─────────────────────────────────────────────────────────── */

function resumen() {
  const evs = PARTIDAS.reduce((n, p) => n + p.eventos.length, 0)
  console.log(`\nfixture: ${PARTIDAS.length} partidas, ${evs} eventos`)
  for (const p of PARTIDAS) {
    const fin: EstadoMesa = estadoEn(p, totalPasos(p))
    const vivas = (u: UnidadMesa[]) => u.length
    console.log(`  vs ${p.rival.padEnd(22)} ${String(p.eventos.length).padStart(3)} ev · ` +
      `gana ${p.ganador} · bases ${vidaVisible(fin.a)}/${vidaVisible(fin.b)} · ` +
      `quedan ${vivas(fin.a.unidades)}v${vivas(fin.b.unidades)}`)
  }
}

console.log('── reproductor de la mesa 3D ──\n')
pruebaVida()
pruebaVidaPasoAPaso()
pruebaTablero()
pruebaIdentidad()
pruebaCopias()
pruebaControles()
pruebaCobertura()
pruebaEscena()
pruebaCoste()
resumen()

console.log(`\n${comprobaciones} comprobaciones, ${fallos} fallos`)
if (fallos > 0) throw new Error(`${fallos} comprobaciones fallaron`)
console.log('todo cuadra.')

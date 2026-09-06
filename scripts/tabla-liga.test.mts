/**
 * La tabla de posiciones de la liga.
 *
 * ── Por qué esta prueba no es opcional ───────────────────────────────
 *
 * `tablaDe()` ya tuvo DOS bugs silenciosos en público, los dos documentados en
 * su propio código:
 *
 *   · los estados que cuentan eran una lista NEGRA, así que un estado nuevo
 *     entraba a la tabla solo;
 *   · un marcador igualado le regalaba la victoria a la visita, porque la
 *     rama del empate no existía.
 *
 * Los dos se ven idénticos a una tabla correcta desde afuera: números
 * plausibles, orden plausible, cero errores. Y de esta tabla salen los
 * ascensos de tier. Es exactamente el sitio donde una prueba vale más que
 * leer el código con cuidado.
 *
 *   npx tsx scripts/tabla-liga.test.mts
 */

import { tablaDe, misPartidasAbiertas, miProximaPartida, tamanosDeGrupo, GRUPO_MIN, GRUPO_MAX } from '../src/services/ligaTabla.ts'
import type { PlazaLiga, PartidaLiga, EstadoPartida } from '../src/services/ligaTabla.ts'

let fallos = 0
function ok(cond: boolean, que: string, detalle = '') {
  if (cond) { console.log(`  ✓ ${que}`); return }
  fallos++
  console.log(`  ✗ ${que}${detalle ? ' — ' + detalle : ''}`)
}

const G = 'g1'
const plaza = (id: string, estado: PlazaLiga['estado'] = 'activa'): PlazaLiga => ({
  id, grupoId: G, nombre: id, lider: null, base: null, estado, esMia: false,
})
const partida = (
  local: string, visita: string, vl: number, vv: number,
  estado: EstadoPartida = 'confirmada', jornada = 1,
): PartidaLiga => ({
  id: `${local}-${visita}-${jornada}`, grupoId: G, jornada,
  localPlaza: local, visitaPlaza: visita, vl, vv, estado,
  origen: 'acuerdo', venceEl: null, vod: null, reportadaPor: null,
})

const porNombre = (filas: ReturnType<typeof tablaDe>) => filas.map(f => f.nombre).join(' ')

// ── El puntaje ─────────────────────────────────────────────────────────
console.log('\nPuntaje')
{
  const t = tablaDe([plaza('A'), plaza('B')], [partida('A', 'B', 2, 1)], G)
  const a = t.find(f => f.nombre === 'A')!
  const b = t.find(f => f.nombre === 'B')!
  ok(a.puntos === 3 && b.puntos === 0, 'ganar da 3 y perder 0')
  ok(a.ganadas === 1 && b.perdidas === 1, 'se anota la victoria y la derrota')
  ok(a.jugadas === 1 && b.jugadas === 1, 'la partida cuenta para los dos')
  ok(a.difGames === 1 && b.difGames === -1, 'la diferencia de games es simétrica')
}

// ── Los walkover: el marcador de la tabla NO es el de la fila ─────────
console.log('\nWalkover')
{
  // Un wo_local es que ganó la VISITA. El marcador guardado da igual: el
  // motor lo reescribe a 0-2. Si esto se rompe, un walkover reparte puntos
  // al que no se presentó y nadie lo nota.
  const t = tablaDe([plaza('A'), plaza('B')], [partida('A', 'B', 9, 9, 'wo_local')], G)
  const a = t.find(f => f.nombre === 'A')!
  const b = t.find(f => f.nombre === 'B')!
  ok(b.puntos === 3 && a.puntos === 0, 'wo_local: los 3 puntos son de la VISITA')
  ok(b.gamesGanados === 2 && a.gamesGanados === 0, 'y el marcador se sella 0-2')
}
{
  const t = tablaDe([plaza('A'), plaza('B')], [partida('A', 'B', 9, 9, 'wo_visita')], G)
  const a = t.find(f => f.nombre === 'A')!
  ok(a.puntos === 3 && a.gamesGanados === 2, 'wo_visita: los 3 son del LOCAL, 2-0')
}

// ── El empate, que es el bug que ya ocurrió ───────────────────────────
console.log('\nMarcador igualado')
{
  // Un BO3 no puede terminar empatado, así que 0-0 es una partida SIN
  // marcador. Antes esta rama no existía y `vv > vl` era falso, `vl > vv`
  // también, y la visita se llevaba la victoria por descarte.
  const t = tablaDe([plaza('A'), plaza('B')], [partida('A', 'B', 0, 0)], G)
  const a = t.find(f => f.nombre === 'A')!
  const b = t.find(f => f.nombre === 'B')!
  ok(a.puntos === 0 && b.puntos === 0, 'un 0-0 no le da puntos a NADIE')
  ok(a.ganadas === 0 && b.ganadas === 0, 'y no le da la victoria a la visita')
  ok(a.jugadas === 1 && b.jugadas === 1, 'pero cuenta como jugada')
}

// ── Lista BLANCA de estados ────────────────────────────────────────────
console.log('\nQué estados cuentan')
{
  const noCuentan: EstadoPartida[] = ['programada', 'reportada', 'disputada', 'vencida', 'anulada']
  let limpio = true
  for (const e of noCuentan) {
    const t = tablaDe([plaza('A'), plaza('B')], [partida('A', 'B', 2, 0, e)], G)
    if (t.some(f => f.jugadas > 0 || f.puntos > 0)) { limpio = false; console.log(`      ← «${e}» entró a la tabla`) }
  }
  ok(limpio, 'programada, reportada, disputada, vencida y anulada NO cuentan')

  /* La lista es BLANCA, no negra: un estado inventado tampoco entra. Es la
     diferencia entre un estado nuevo que aparece solo en la tabla y uno que
     hay que agregar a propósito. */
  const t = tablaDe([plaza('A'), plaza('B')],
                    [partida('A', 'B', 2, 0, 'inventado' as EstadoPartida)], G)
  ok(t.every(f => f.jugadas === 0), 'un estado que no existe tampoco entra (lista blanca)')
}

// ── El desempate por enfrentamiento directo ────────────────────────────
console.log('\nDesempate')
{
  /* A y B empatan a 3 puntos y a diferencia de games. En un round-robin
     jugaron entre sí exactamente una vez, así que el directo SIEMPRE está
     definido — y tiene que mandar sobre el abecedario. */
  const t = tablaDe(
    [plaza('Ana'), plaza('Beto'), plaza('Caro')],
    [
      partida('Beto', 'Ana', 2, 0, 'confirmada', 1),   // Beto le ganó a Ana
      partida('Ana', 'Caro', 2, 0, 'confirmada', 2),
      partida('Beto', 'Caro', 0, 2, 'confirmada', 3),
    ], G)
  const ana = t.find(f => f.nombre === 'Ana')!
  const beto = t.find(f => f.nombre === 'Beto')!
  ok(ana.puntos === beto.puntos, `Ana y Beto empatan a puntos (${ana.puntos})`)
  ok(t.findIndex(f => f.nombre === 'Beto') < t.findIndex(f => f.nombre === 'Ana'),
     'y Beto va arriba porque le ganó el directo, no por el abecedario',
     porNombre(t))
}

// ── La plaza abandonada ────────────────────────────────────────────────
console.log('\nAbandono')
{
  const t = tablaDe(
    [plaza('A'), plaza('B', 'abandonada')],
    [partida('A', 'B', 2, 0)], G)
  const b = t.find(f => f.nombre === 'B')!
  ok(b !== undefined, 'quien abandona SIGUE en la tabla')
  ok(b.abandonada === true, 'y queda marcado')
  ok(b.jugadas === 1, 'lo que ya jugó no se borra: los puntos que repartió valen')
}

// ── El filtro por grupo ────────────────────────────────────────────────
console.log('\nGrupos')
{
  const otra: PlazaLiga = { ...plaza('Z'), grupoId: 'g2' }
  const cruzada: PartidaLiga = { ...partida('A', 'Z', 2, 0), grupoId: 'g2' }
  const t = tablaDe([plaza('A'), plaza('B'), otra], [partida('A', 'B', 2, 0), cruzada], G)
  ok(t.length === 2, 'la tabla de un grupo no trae plazas de otro')
  ok(t.find(f => f.nombre === 'A')!.jugadas === 1,
     'ni cuenta partidas de otro grupo', `jugadas=${t.find(f => f.nombre === 'A')!.jugadas}`)
}

// ── Una partida contra alguien que no está ─────────────────────────────
console.log('\nDatos incompletos')
{
  // Puede pasar si una plaza se anuló: la partida queda apuntando a un id que
  // ya no está en la lista. Tiene que ignorarse, no reventar.
  const t = tablaDe([plaza('A')], [partida('A', 'fantasma', 2, 0)], G)
  ok(t.length === 1 && t[0].jugadas === 0, 'una partida contra alguien que no está se ignora')
  ok(tablaDe([], [], G).length === 0, 'un grupo vacío da una tabla vacía, no un error')
}


// ── Mis partidas abiertas, y su ORDEN ──────────────────────────────────
console.log('\nMis partidas abiertas')
{
  /* El orden es lo único que hace útil esta lista, y es lo que se rompe sin
     hacer ruido: una lista mal ordenada sigue teniendo todas las filas. */
  const yo = { ...plaza('Yo'), esMia: true }
  const grupo = {
    plazas: [yo, plaza('Rival1'), plaza('Rival2'), plaza('Rival3'), plaza('Rival4')],
    partidas: [
      // jornada 1, ya cerrada: no es «abierta»
      partida('Yo', 'Rival1', 2, 0, 'confirmada', 1),
      // jornada 2, sin jugar
      partida('Yo', 'Rival2', 0, 0, 'programada', 2),
      // jornada 3, vencida
      partida('Yo', 'Rival3', 0, 0, 'vencida', 3),
      // jornada 4: la reportó el RIVAL y falta mi palabra → la más urgente
      { ...partida('Rival4', 'Yo', 2, 1, 'reportada', 4), reportadaPor: 'Rival4' },
    ],
  }
  const lista = misPartidasAbiertas({ grupos: [grupo] })

  ok(lista.length === 3, 'una partida confirmada NO es una partida abierta',
     `devolvió ${lista.length}`)
  ok(lista[0].partida.jornada === 4 && lista[0].esperaMiRespuesta,
     'lo que espera MI respuesta va primero, aunque sea la jornada más alta',
     lista.map(a => a.partida.jornada).join(','))
  ok(lista[1].partida.estado === 'vencida',
     'después lo vencido: ya se atoró y hay que reclamarlo')
  ok(lista[2].partida.jornada === 2, 'y al final el resto, por jornada')
  ok(lista.every(a => a.rival.nombre !== 'Yo'), 'el rival nunca soy yo')
  ok(miProximaPartida({ grupos: [grupo] })?.partida.jornada === 4,
     'miProximaPartida DELEGA: devuelve la primera de la lista')
}
{
  // Si la reporté YO, no espera mi respuesta: espera la del otro.
  const yo = { ...plaza('Yo'), esMia: true }
  const grupo = {
    plazas: [yo, plaza('Otro')],
    partidas: [{ ...partida('Yo', 'Otro', 2, 0, 'reportada', 1), reportadaPor: 'Yo' }],
  }
  const l = misPartidasAbiertas({ grupos: [grupo] })
  ok(l.length === 1 && !l[0].esperaMiRespuesta,
     'la que reporté yo sigue abierta pero NO espera mi respuesta')
}
{
  // Sin plaza mía en el grupo no hay nada mío que mostrar.
  const grupo = { plazas: [plaza('A'), plaza('B')], partidas: [partida('A', 'B', 0, 0, 'programada')] }
  ok(misPartidasAbiertas({ grupos: [grupo] }).length === 0,
     'un grupo donde no juego no aporta partidas')
  ok(miProximaPartida({ grupos: [] }) === null, 'sin grupos devuelve null, no revienta')
}
{
  // Rival que no está en la lista de plazas: se ignora, no se inventa.
  const yo = { ...plaza('Yo'), esMia: true }
  const grupo = { plazas: [yo], partidas: [partida('Yo', 'fantasma', 0, 0, 'programada')] }
  ok(misPartidasAbiertas({ grupos: [grupo] }).length === 0,
     'una partida contra alguien que no está en el grupo se ignora')
}


// ── El reparto en grupos ───────────────────────────────────────────────
console.log('\nReparto en grupos')
{
  /* La versión anterior cortaba de `tamano` en `tamano` y solo fusionaba el
     sobrante si era MENOR a 2: con grupos de 8, n=10 daba [8,2] y n=11 daba
     [8,3]. Los dos los rechaza el servidor (exige 4 a 12) — y el rechazo llega
     DESPUÉS de escribir el primer grupo, que deja la temporada trabada.
     Estas son las nueve poblaciones que fallaban. */
  const rotas = [10, 11, 18, 19, 26, 27, 34, 35, 42]
  let malas: string[] = []
  for (const n of rotas) {
    const t = tamanosDeGrupo(n, 8)
    const suma = t.reduce((a, b) => a + b, 0)
    if (t.length === 0 || suma !== n || t.some(x => x < GRUPO_MIN || x > GRUPO_MAX)) {
      malas.push(`${n}→[${t}]`)
    }
  }
  ok(malas.length === 0,
     'las nueve poblaciones que trababan el armado ahora reparten legal',
     malas.join(' '))

  // Y TODAS las poblaciones de 4 a 200, con los tamaños que la app permite.
  const fallos: string[] = []
  for (let objetivo = 4; objetivo <= 12; objetivo++) {
    for (let n = GRUPO_MIN; n <= 200; n++) {
      const t = tamanosDeGrupo(n, objetivo)
      if (t.length === 0) { fallos.push(`vacío n=${n} obj=${objetivo}`); continue }
      if (t.reduce((a, b) => a + b, 0) !== n) fallos.push(`suma n=${n} obj=${objetivo} [${t}]`)
      if (t.some(x => x < GRUPO_MIN || x > GRUPO_MAX)) fallos.push(`rango n=${n} obj=${objetivo} [${t}]`)
    }
  }
  ok(fallos.length === 0,
     'de 4 a 200 personas y con cualquier tamaño objetivo, todo grupo cae entre 4 y 12',
     fallos.slice(0, 4).join(' · '))

  // Parejo: entre el grupo más grande y el más chico nunca hay más de 1.
  let desparejo = ''
  for (let n = GRUPO_MIN; n <= 200; n++) {
    const t = tamanosDeGrupo(n, 8)
    if (t.length && Math.max(...t) - Math.min(...t) > 1) desparejo = `n=${n} [${t}]`
  }
  ok(desparejo === '', 'el reparto es parejo: nunca más de 1 de diferencia', desparejo)

  ok(tamanosDeGrupo(3, 8).length === 0, 'con menos de 4 no se puede armar, y se dice devolviendo vacío')
  ok(tamanosDeGrupo(0, 8).length === 0, 'con nadie tampoco revienta')
  ok(JSON.stringify(tamanosDeGrupo(10, 8)) === '[10]',
     'con 10 y objetivo 8 hace UN grupo de 10, no [8,2]', JSON.stringify(tamanosDeGrupo(10, 8)))
  ok(JSON.stringify(tamanosDeGrupo(16, 8)) === '[8,8]',
     'con 16 y objetivo 8 hace dos de 8', JSON.stringify(tamanosDeGrupo(16, 8)))
  ok(JSON.stringify(tamanosDeGrupo(13, 8)) === '[7,6]',
     'con 13 reparte 7 y 6, no 8 y 5', JSON.stringify(tamanosDeGrupo(13, 8)))
}

console.log(fallos === 0
  ? '\n✅ la tabla de la liga reparte bien\n'
  : `\n❌ ${fallos} cosa(s) que la tabla hace mal\n`)
process.exit(fallos === 0 ? 0 : 1)

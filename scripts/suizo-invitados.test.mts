/**
 * ¿El suizo empareja bien con invitados? Se prueba el ALGORITMO con la misma
 * forma de datos que le pasa `tournamentCloud` ahora: id = fila de
 * clasificación (único siempre), no user_id (null para invitados).
 */
import { generatePairings } from '../src/services/swiss'
import type { TournamentPlayer } from '../src/services/swiss'

const N = 8
const SIN_CUENTA = new Set([3, 5, 6])   // 3 de 8, como el torneo del 8/8

const hacer = (usarUserId: boolean): TournamentPlayer[] =>
  Array.from({ length: N }, (_, i) => ({
    id: (usarUserId ? (SIN_CUENTA.has(i) ? null : `user-${i}`) : `standing-${i}`) as string,
    name: `Jugador ${i}`,
    points: 0, matchWins: 0, matchLosses: 0, matchDraws: 0,
    gameWins: 0, gameLosses: 0, byes: 0, opponentIds: [],
  }))

let fallos = 0
const ok = (t: string, c: boolean, extra = '') => {
  if (!c) { fallos++; console.log(`  FALLO  ${t} ${extra}`) } else console.log(`  ok     ${t} ${extra}`)
}

for (const [etiqueta, usarUserId] of [['ANTES (llave = user_id)', true], ['AHORA (llave = fila)', false]] as const) {
  console.log(`\n${etiqueta}`)
  const jugadores = hacer(usarUserId)
  const mesas = generatePairings(jugadores, true)
  const sentados = new Set<string>()
  let byes = 0
  for (const m of mesas) {
    if (m.player1Id) sentados.add(String(m.player1Id))
    if (m.player2Id) sentados.add(String(m.player2Id))
    else byes++
  }
  const esperados = usarUserId ? new Set(jugadores.map(j => String(j.id))).size : N
  console.log(`  mesas: ${mesas.length} · sentados distintos: ${sentados.size} · byes: ${byes}`)
  if (!usarUserId) {
    ok('los 8 quedan sentados', sentados.size === N, `(${sentados.size}/${N})`)
    ok('4 mesas, ningún bye', mesas.length === 4 && byes === 0, `(${mesas.length} mesas, ${byes} byes)`)
    ok('nadie repetido', mesas.every(m => m.player1Id !== m.player2Id))
  } else {
    console.log(`  → con user_id solo caben ${esperados} identidades distintas para ${N} personas`)
    ok('esto DEBE fallar: se pierden jugadores', sentados.size < N, `(solo ${sentados.size} de ${N})`)
  }
}

// Segunda ronda: ¿evita revanchas entre invitados?
console.log('\nSEGUNDA RONDA (evitar revanchas)')
const j2 = hacer(false)
const r1 = generatePairings(j2, true)
for (const m of r1) {
  if (!m.player2Id) continue
  j2.find(p => p.id === m.player1Id)!.opponentIds.push(String(m.player2Id))
  j2.find(p => p.id === m.player2Id)!.opponentIds.push(String(m.player1Id))
}
const r2 = generatePairings(j2, true)
const revanchas = r2.filter(m => m.player2Id &&
  j2.find(p => p.id === m.player1Id)!.opponentIds.includes(String(m.player2Id)))
ok('cero revanchas en la ronda 2', revanchas.length === 0, `(${revanchas.length})`)
const sent2 = new Set(r2.flatMap(m => [m.player1Id, m.player2Id].filter(Boolean).map(String)))
ok('los 8 vuelven a quedar sentados', sent2.size === N, `(${sent2.size}/${N})`)

console.log(fallos === 0 ? `\n${'='.repeat(42)}\nTODAS PASAN` : `\n${fallos} FALLOS`)
process.exit(fallos ? 1 : 0)

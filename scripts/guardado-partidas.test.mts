import assert from 'node:assert/strict'
import { crearGuardadorPartidas } from '../src/services/guardadoPartidas.ts'
import type { MatchState } from '../src/types/index.ts'

const partida: MatchState = {
  id: 'partida-local', mode: 'twin_suns',
  players: Array.from({ length: 4 }, (_, i) => ({ name: `J${i + 1}`, baseHp: 30, baseMaxHp: 30, baseName: `Base ${i + 1}`, baseImageUrl: '/base.webp', leaderDeployed: false, leaderDamage: 0, resources: 0, shieldTokens: 0, experienceTokens: 0 })),
  gameScore: { games: [], finalScore: [0, 0] }, currentGame: 1, initiativeHolder: 0, createdAt: 1, updatedAt: 1, isActive: true,
}
let liberarPrimera: () => void = () => {}
const primera = new Promise<void>(resolve => { liberarPrimera = resolve })
const escritas: MatchState[] = []
const guardar = crearGuardadorPartidas(async m => {
  if (!escritas.length) await primera
  escritas.push(m)
}, () => 50)
const inicial = guardar(partida)
partida.players[0].baseHp = 15
const golpe = guardar(partida)
const fin = guardar({ ...partida, isActive: false })
await Promise.resolve()
assert.equal(escritas.length, 0, 'La segunda escritura espera a la primera')
liberarPrimera()
await Promise.all([inicial, golpe, fin])
assert.deepEqual(escritas.map(m => m.players[0].baseHp), [30, 15, 15], 'Las instantáneas no se modifican después de encolarlas')
assert.deepEqual(escritas.map(m => m.isActive), [true, true, false], 'Un guardado lento no reabre una partida terminada')
assert.equal(escritas.at(-1)?.players.length, 4)
assert.equal(escritas.at(-1)?.players[0].baseName, 'Base 1')
assert.equal(escritas.at(-1)?.createdAt, 1)
assert.equal(escritas.at(-1)?.updatedAt, 50)

let falla = true
const recuperables: MatchState[] = []
const guardarConFallo = crearGuardadorPartidas(async m => {
  if (falla) throw new Error('Sin espacio')
  recuperables.push(m)
})
await assert.rejects(guardarConFallo(partida), /Sin espacio/)
falla = false
await guardarConFallo({ ...partida, isActive: false })
assert.equal(recuperables.length, 1, 'Un error no bloquea futuros reintentos')
assert.equal(recuperables[0].isActive, false)
console.log('Guardado de partidas: orden, instantáneas independientes, estado final y recuperación tras error correctos.')

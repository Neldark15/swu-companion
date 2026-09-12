import assert from 'node:assert/strict'
import {
  cambiarVida, crearMesa, deshacer, leerMesa, puedeTomarFicha, siguienteRonda, tomarFicha,
} from '../src/features/calculadora/estadoCalculadora.ts'

const bases = [
  { nombre: '  Ahsoka  ', maxVida: 25 },
  { nombre: 'Vader', maxVida: 30 },
  { nombre: 'Han', maxVida: 35 },
  { nombre: 'Leia', maxVida: 30 },
]
const premier = crearMesa('premier', bases.slice(0, 2))
const twin = crearMesa('twin-suns', bases)
const [a, b, c, d] = twin.jugadores.map(j => j.id)
assert.equal(premier.jugadores[0].nombre, 'Ahsoka')
assert.deepEqual(twin.jugadores.map(j => j.vida), [25, 30, 35, 30])
assert.equal(crearMesa('twin-suns', bases.slice(0, 3)).jugadores.length, 3)
assert.equal(crearMesa('premier', [{ nombre: ' ', maxVida: 1 }, { nombre: 'x'.repeat(80), maxVida: 999 }]).jugadores[0].nombre, 'Jugador 1')
for (const numero of [0, -1, 1000, NaN, Infinity, 30.5]) {
  assert.throws(() => crearMesa('premier', [{ nombre: 'A', maxVida: numero }, bases[1]]), RangeError)
}
assert.throws(() => crearMesa('premier', bases), RangeError)
assert.throws(() => crearMesa('twin-suns', bases.slice(0, 2)), RangeError)

let herida = cambiarVida(premier, a, -10)
assert.equal(herida.jugadores[0].vida, 15)
assert.equal(premier.jugadores[0].vida, 25, 'El estado original debe ser inmutable')
assert.deepEqual(deshacer(herida), premier)
assert.equal(cambiarVida(herida, 'inexistente', -1), herida)
for (const delta of [0, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  assert.equal(cambiarVida(herida, a, delta), herida, `Delta inválido ${delta}`)
}
assert.equal(cambiarVida(herida, a, Number.MAX_SAFE_INTEGER).jugadores[0].vida, 25)
herida = cambiarVida(herida, a, -999)
assert.equal(herida.jugadores[0].vida, 0)
assert.match(herida.historial.at(-1)!.descripcion, /15 de daño/, 'El historial refleja el cambio real y no un daño por debajo de cero')
assert.equal(cambiarVida(herida, a, -1), herida, 'No se sigue dañando una base eliminada')
assert.equal(tomarFicha(herida, a, 'iniciativa'), herida)
assert.equal(cambiarVida(herida, a, 3), herida, 'Una base eliminada no puede curarse')
assert.equal(deshacer(herida).jugadores[0].vida, 15, 'Deshacer permite corregir una eliminación accidental')

assert.equal(tomarFicha(premier, a, 'blast'), premier)
assert.equal(tomarFicha(premier, a, 'plan'), premier)
const iniciativa = tomarFicha(premier, a, 'iniciativa')
assert.equal(iniciativa.fichas.iniciativa, a)
assert.equal(tomarFicha(iniciativa, b, 'iniciativa'), iniciativa, 'Una ficha reclamada no se puede robar durante la ronda')
assert.equal(tomarFicha(iniciativa, a, 'iniciativa'), iniciativa)
const rondaPremier = siguienteRonda(iniciativa)
assert.equal(rondaPremier.fichas.iniciativa, a, 'La iniciativa conserva su dueño al cambiar de ronda')
assert.deepEqual(rondaPremier.reclamadas, [])
assert.equal(tomarFicha(rondaPremier, b, 'iniciativa').fichas.iniciativa, b, 'Se puede reclamar la iniciativa en la nueva ronda')
assert.deepEqual(deshacer(rondaPremier), iniciativa)

let mesa = tomarFicha(twin, a, 'blast')
assert.deepEqual(mesa.jugadores, twin.jugadores, 'Blast es un marcador manual; no aplica efectos')
assert.match(mesa.historial.at(-1)!.descripcion, /Explosión/)
assert.equal(puedeTomarFicha(mesa, a, 'plan'), false)
assert.equal(tomarFicha(mesa, a, 'iniciativa'), mesa, 'Cada jugador toma una sola ficha por ronda')
mesa = tomarFicha(mesa, b, 'iniciativa')
mesa = tomarFicha(mesa, c, 'plan')
assert.equal(tomarFicha(mesa, d, 'plan'), mesa)
assert.equal(mesa.ronda, 1, 'El contador nunca decide automáticamente cuándo acaba la ronda')
const rondaTwin = siguienteRonda(mesa)
assert.deepEqual(rondaTwin.fichas, { iniciativa: b, blast: null, plan: null })
assert.deepEqual(deshacer(rondaTwin), mesa, 'Deshacer recupera dueños y reclamos de las tres fichas')
const duenioTomaBlast = tomarFicha(rondaTwin, b, 'blast')
assert.equal(duenioTomaBlast.fichas.iniciativa, b)
assert.equal(puedeTomarFicha(duenioTomaBlast, a, 'iniciativa'), true)
assert.equal(puedeTomarFicha(duenioTomaBlast, b, 'iniciativa'), false)
assert.equal(tomarFicha(duenioTomaBlast, a, 'iniciativa').fichas.iniciativa, a)
assert.deepEqual(deshacer(twin), twin)

const eliminadoConIniciativa = cambiarVida(mesa, b, -30)
assert.deepEqual(eliminadoConIniciativa.fichas, { iniciativa: null, blast: a, plan: c }, 'CR 11.3.4: eliminar al dueño devuelve la iniciativa disponible')
assert.deepEqual(eliminadoConIniciativa.reclamadas, ['blast', 'plan'])
assert.equal(puedeTomarFicha(eliminadoConIniciativa, d, 'iniciativa'), true)
assert.equal(puedeTomarFicha(eliminadoConIniciativa, a, 'iniciativa'), false, 'Liberar iniciativa no permite tomar dos contadores en la ronda')
assert.equal(tomarFicha(eliminadoConIniciativa, d, 'iniciativa').fichas.iniciativa, d)
assert.deepEqual(deshacer(eliminadoConIniciativa), mesa, 'Deshacer el KO recupera base, iniciativa y reclamo')
const eliminadoConDosFichas = cambiarVida(duenioTomaBlast, b, -30)
assert.deepEqual(eliminadoConDosFichas.fichas, { iniciativa: null, blast: b, plan: null }, 'Al eliminar al dueño de iniciativa anterior + Explosión solo se libera iniciativa')
assert.deepEqual(eliminadoConDosFichas.reclamadas, ['blast'])
assert.equal(puedeTomarFicha(eliminadoConDosFichas, a, 'blast'), false)
assert.deepEqual(deshacer(eliminadoConDosFichas), duenioTomaBlast)
assert.deepEqual(leerMesa(JSON.stringify(eliminadoConIniciativa)), eliminadoConIniciativa)
assert.deepEqual(leerMesa(JSON.stringify(eliminadoConDosFichas)), eliminadoConDosFichas)

let larga = twin
for (let i = 0; i < 140; i++) larga = cambiarVida(larga, a, i % 2 === 0 ? -1 : 1)
assert.equal(larga.historial.length, 100)
assert.ok(larga.historial.every(h => !('historial' in h.anterior)), 'Los snapshots no anidan historial')
assert.deepEqual(leerMesa(JSON.stringify(larga)), larga)
for (let i = 0; i < 100; i++) larga = deshacer(larga)
assert.equal(larga.historial.length, 0)
assert.equal(larga.jugadores[0].vida, 25)
assert.equal(deshacer(larga), larga)
assert.equal(siguienteRonda({ ...twin, ronda: 9999 }).ronda, 9999)
assert.deepEqual(leerMesa(JSON.stringify(duenioTomaBlast)), duenioTomaBlast)
assert.deepEqual(leerMesa(JSON.stringify(mesa)), mesa)

for (const invalido of [null, '', '{', 'null', '[]', '{}', '"mesa"', ' '.repeat(1_000_001)]) {
  assert.equal(leerMesa(invalido), null)
}
const guardar = (valor: unknown) => leerMesa(JSON.stringify(valor))
for (const vida of [-1, 26, 1.5, NaN, Infinity, '20', null]) {
  assert.equal(guardar({ ...twin, jugadores: [{ ...twin.jugadores[0], vida }, ...twin.jugadores.slice(1)] }), null)
}
for (const ronda of [0, 10000, 1.5, '1', null]) assert.equal(guardar({ ...twin, ronda }), null)
assert.equal(guardar({ ...twin, jugadores: [twin.jugadores[0], ...twin.jugadores.slice(0, 3)] }), null)
assert.equal(guardar({ ...twin, fichas: { ...twin.fichas, iniciativa: 'inexistente' } }), null)
assert.equal(guardar({ ...twin, fichas: {} }), null)
assert.equal(guardar({ ...twin, reclamadas: ['desconocida'] }), null)
assert.equal(guardar({ ...twin, reclamadas: ['iniciativa'] }), null)
assert.equal(guardar({ ...twin, fichas: { ...twin.fichas, blast: a } }), null)
assert.equal(guardar({ ...mesa, reclamadas: ['blast', 'blast'] }), null)
assert.equal(guardar({ ...mesa, fichas: { iniciativa: a, blast: a, plan: c } }), null)
assert.equal(guardar({ ...mesa, jugadores: mesa.jugadores.map(j => j.id === b ? { ...j, vida: 0 } : j) }), null, 'Un guardado no puede devolver iniciativa a un jugador eliminado')
assert.equal(guardar({ ...premier, fichas: { iniciativa: null, blast: a, plan: null }, reclamadas: ['blast'] }), null)
assert.equal(guardar({ ...mesa, historial: Array(101).fill(mesa.historial[0]) }), null)
assert.equal(guardar({ ...mesa, historial: [{ descripcion: ' ', anterior: twin }] }), null)
assert.equal(guardar({ ...mesa, historial: [{ descripcion: 'Corrupto', anterior: {} }] }), null)
assert.equal(guardar({ ...mesa, historial: [{ descripcion: 'Corrupto', anterior: { ...twin, ronda: 2 } }] }), null)
assert.equal(guardar({ ...mesa, historial: [{ descripcion: 'Corrupto', anterior: { ...twin, jugadores: twin.jugadores.map(j => ({ ...j, maxVida: 999 })) } }] }), null)
assert.equal(guardar({ ...mesa, historial: [{ descripcion: 'Corrupto', anterior: { ...twin, jugadores: [{ ...twin.jugadores[0], vida: null }, ...twin.jugadores.slice(1)] } }] }), null)
const camposExtra = guardar({ ...mesa, secreto: 'descartado', historial: mesa.historial.map(h => ({ ...h, anterior: { ...h.anterior, historial: [{ sorpresa: 'descartado' }] } })) })
assert.deepEqual(camposExtra, mesa, 'La carga reconstruye únicamente campos validados; no conserva datos recursivos extra')

console.log('Calculadora: límites, fichas, rondas, deshacer y guardados corruptos verificados.')

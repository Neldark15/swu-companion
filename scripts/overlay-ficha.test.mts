/**
 * El contrato de la ficha de jugador del overlay.
 *
 * La prueba que importa es la ultima: una ESCENA desconocida colapsa a
 * 'pronto' y una ficha desconocida no toca nada. Por eso presentar a un
 * jugador es un CAMPO y no una escena — con escena, un OBS con la PWA sin
 * actualizar mostraria la pantalla de espera a mitad de partida (§2g).
 */
import { normalizarEstado, ESTADO_INICIAL } from '../src/types/stream'

let fallos = 0
const ok = (c: boolean, q: string) => { if (!c) { fallos++; console.log('FALLA:', q) } else console.log('  ok ·', q) }

// 1. Estado VIEJO (sin ficha) → null, y la escena NO se toca.
const viejo = normalizarEstado({ ...ESTADO_INICIAL, escena: 'juego', ficha: undefined })
ok(viejo.ficha === null, 'un estado sin ficha da null')
ok(viejo.escena === 'juego', 'la escena sobrevive intacta')

// 2. Ficha sin nombre → se descarta entera (no una tarjeta en blanco al aire).
ok(normalizarEstado({ ficha: { sub: 'PUENTE 3', datos: [] } }).ficha === null, 'sin nombre no hay ficha')

// 3. Un cliente manipulado no puede mandar veinte filas de datos.
const veinte = normalizarEstado({
  ficha: { nombre: 'Alejo', datos: Array.from({ length: 20 }, (_, i) => ({ rotulo: 'R' + i, valor: String(i) })) },
})
ok(veinte.ficha?.datos.length === 4, `los datos se topan en 4 (llegaron ${veinte.ficha?.datos.length})`)

// 4. Basura en los datos no revienta ni deja filas vacías.
const sucia = normalizarEstado({ ficha: { nombre: 'A', datos: [null, 7, { rotulo: 'X' }, { valor: 'Y' }] } })
ok(sucia.ficha?.datos.length === 2, `la basura se filtra (quedaron ${sucia.ficha?.datos.length})`)

// 5. `hasta` no numérico → 0, o sea ya vencida: nunca queda pegada al aire.
ok(normalizarEstado({ ficha: { nombre: 'A', hasta: 'siempre' } }).ficha?.hasta === 0, 'un hasta invalido vence de inmediato')

// 6. LO QUE DE VERDAD IMPORTA (§2g): una ficha que un overlay VIEJO no
//    entiende no puede cambiarle la escena. Se simula el normalizador viejo
//    ignorando el campo: la escena tiene que seguir siendo la misma.
const conFicha = normalizarEstado({ escena: 'juego', ficha: { nombre: 'Alejo', hasta: 9e12 } })
ok(conFicha.escena === 'juego', 'con ficha puesta la escena sigue en juego')
ok(normalizarEstado({ escena: 'inventada' }).escena === 'pronto', 'una ESCENA desconocida si colapsa (por eso ficha es campo)')

console.log(fallos === 0 ? '\nTODO PASA' : `\n${fallos} FALLAS`)
process.exit(fallos === 0 ? 0 : 1)

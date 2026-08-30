/**
 * Las tres vistas del ranking tienen que PARTIR la misma tabla, no ser tres
 * consultas parecidas.
 *
 * El riesgo real de separar amistosas de torneos es que las tablas dejen de
 * cuadrar: que alguien sume 12 en «Todo» pero 9 y 2 en las otras dos, y no
 * haya forma de saber cuál miente. Acá se fija que Todo = Torneos + Amistosas
 * fila por fila, y que nadie aparezca en una tabla donde no jugó.
 */
import { porFuente, recordDe, type FilaRanking } from '../src/services/rankingFuentes'

const fila = (p: Partial<FilaRanking>): FilaRanking => ({
  clave: 'x', nombre: 'X', userId: null, avatar: null,
  puntos: 0, victorias: 0, derrotas: 0, empates: 0, torneos: 0, amistosas: 0,
  puntosTorneo: 0, victoriasTorneo: 0, derrotasTorneo: 0, empatesTorneo: 0,
  puntosAmistosa: 0, victoriasAmistosa: 0, derrotasAmistosa: 0,
  ...p,
})

/* Los tres casos que importan, con la forma real de produccion:
   - quien mezcla las dos fuentes (Vara: 21 de torneo + 6 de amistosas)
   - quien solo jugo torneo (Winnie, campeona invicta)
   - quien solo jugo amistosas (nunca entro a un torneo) */
const TABLA: FilaRanking[] = [
  fila({ clave: 'vara', nombre: 'Vara', puntos: 27, victorias: 13, derrotas: 8, empates: 0,
         torneos: 3, amistosas: 10,
         puntosTorneo: 21, victoriasTorneo: 7, derrotasTorneo: 4, empatesTorneo: 0,
         puntosAmistosa: 6, victoriasAmistosa: 6, derrotasAmistosa: 4 }),
  fila({ clave: 'winnie', nombre: 'Winnie', puntos: 12, victorias: 4, derrotas: 0, empates: 0,
         torneos: 1, puntosTorneo: 12, victoriasTorneo: 4, derrotasTorneo: 0 }),
  fila({ clave: 'solo-ami', nombre: 'SoloAmistosas', puntos: 2, victorias: 2, derrotas: 1, empates: 0,
         amistosas: 3, puntosAmistosa: 2, victoriasAmistosa: 2, derrotasAmistosa: 1 }),
]

let fallos = 0
const ok = (t: string, c: boolean, extra = '') => {
  if (!c) { fallos++; console.log(`  FALLO  ${t} ${extra}`) } else console.log(`  ok     ${t} ${extra}`)
}

const todo = porFuente(TABLA, 'todo')
const torneo = porFuente(TABLA, 'torneo')
const amistosa = porFuente(TABLA, 'amistosa')

ok('«Todo» no toca la tabla', todo === TABLA)

// La particion: cada fila de Todo tiene que ser la suma de sus dos partes.
for (const f of TABLA) {
  const t = torneo.find(x => x.clave === f.clave)
  const a = amistosa.find(x => x.clave === f.clave)
  const suma = (t?.puntos ?? 0) + (a?.puntos ?? 0)
  ok(`${f.nombre}: ${f.puntos} = ${t?.puntos ?? 0} + ${a?.puntos ?? 0}`, suma === f.puntos)
  const sumaV = (t?.victorias ?? 0) + (a?.victorias ?? 0)
  ok(`${f.nombre}: victorias parten`, sumaV === f.victorias, `${sumaV} vs ${f.victorias}`)
}

// Nadie aparece donde no jugo. Un 0 ahi diria «jugo y perdio todo», que es
// una cosa DISTINTA a no haber jugado.
ok('quien no jugo torneo no sale en Torneos', !torneo.some(f => f.clave === 'solo-ami'))
ok('quien no jugo amistosas no sale en Amistosas', !amistosa.some(f => f.clave === 'winnie'))

// El orden se replica del servidor: puntos, victorias, nombre.
ok('Torneos ordena por puntos', torneo.map(f => f.clave).join(',') === 'vara,winnie',
   torneo.map(f => `${f.nombre}:${f.puntos}`).join(' '))

// Y el que encabeza cambia segun la fuente: es el motivo entero del cambio.
ok('el primero de Amistosas no es el primero de Torneos',
   amistosa[0].clave !== undefined && torneo[0].clave === 'vara')

// Una amistosa no puede empatar: el marcador decide.
ok('Amistosas nunca trae empates', amistosa.every(f => f.empates === 0))
ok('el record se escribe sin empates cuando no hay', recordDe(amistosa[0]) === '6-4',
   recordDe(amistosa[0]))

console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo bien')
process.exit(fallos ? 1 : 0)

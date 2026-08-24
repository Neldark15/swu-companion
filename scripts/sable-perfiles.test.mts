/**
 * ¿Las 64 combinaciones de mango son dibujables?
 *
 *   npx tsx scripts/sable-perfiles.test.mts
 *
 * `LatheGeometry` no avisa cuando el perfil está mal: gira lo que le den y el
 * resultado es una malla con anillos NEGROS (normal invertida) o pinchada (radio
 * 0 en el medio). No hay error en consola, no hay excepción — solo un sable que
 * se ve mal, y solo en la combinación concreta que lo provoca.
 *
 * Con 4 emisores × 4 cuerpos × 4 pomos son 64 mangos. Mirarlos de a uno en el
 * navegador es exactamente el trabajo que este guion hace en un segundo, y
 * además cubre las combinaciones que a nadie se le ocurriría probar a mano.
 *
 * Corrélo al agregar una pieza.
 */

import {
  perfilDeSable, perfilValido, piezasDeSable, IDS_CONOCIDOS, COLORES, POR_DEFECTO,
  perfilDePieza, asientoDe, radioEn, mallasDeHerrajes, MATERIALES,
} from '../src/features/sable/partesSable.ts'

let fallos = 0
const problemas: string[] = []

const ESPERADAS =
  IDS_CONOCIDOS.emisor.length * IDS_CONOCIDOS.cuerpo.length * IDS_CONOCIDOS.pomo.length
console.log(`\n── Las ${ESPERADAS} combinaciones de mango ──`)
let medidas = 0
for (const emisor of IDS_CONOCIDOS.emisor) {
  for (const cuerpo of IDS_CONOCIDOS.cuerpo) {
    for (const pomo of IDS_CONOCIDOS.pomo) {
      const { puntos, alto } = perfilDeSable({ emisor, cuerpo, pomo, color: 'col_azul' })
      medidas++
      const malos = perfilValido(puntos)
      if (malos.length) {
        fallos++
        problemas.push(`  ✗ ${emisor} + ${cuerpo} + ${pomo}\n      ${malos.join('\n      ')}`)
      }
      // Un mango tiene que medir algo razonable: si una pieza devolviera 0 de
      // alto, el perfil seguiría siendo «válido» y el sable saldría achatado.
      if (alto < 15 || alto > 40) {
        fallos++
        problemas.push(`  ✗ ${emisor} + ${cuerpo} + ${pomo}: alto fuera de rango (${alto})`)
      }
    }
  }
}
// Un verde que no midió nada es el peor resultado posible porque parece el
// mejor. Es el fallo que ya tuvieron el DetectorChoques (§2z) y el guion de
// contraste de la credencial (§3x).
if (medidas !== ESPERADAS) {
  console.log(`\n❌ se midieron ${medidas} combinaciones y deberían ser ${ESPERADAS} — este resultado no dice nada\n`)
  process.exit(1)
}
console.log(problemas.length ? problemas.join('\n') : `  ✓ ${medidas} mangos, todos dibujables`)

/* Las piezas SUELTAS (las de la vista explotada) además van CERRADAS: tapa a
   cada extremo, o el sable se ve hueco al abrirse. Se validan aparte porque las
   tapas solo existen acá — el perfil pegado no las lleva. */
console.log('\n── Las piezas sueltas, cerradas y dibujables ──')
let piezasMal = 0
for (const emisor of IDS_CONOCIDOS.emisor) {
  for (const cuerpo of IDS_CONOCIDOS.cuerpo) {
    for (const pomo of IDS_CONOCIDOS.pomo) {
      for (const sp of piezasDeSable({ emisor, cuerpo, pomo, color: 'col_azul' })) {
        const malos = perfilValido(sp.puntos)
        const abre = sp.puntos[0][0] !== 0 || sp.puntos[sp.puntos.length - 1][0] !== 0
        if (malos.length || abre) {
          piezasMal++
          if (piezasMal <= 5) console.log(`  ✗ ${sp.clave} en ${emisor}+${cuerpo}+${pomo}: ${abre ? 'quedó ABIERTA' : malos[0]}`)
        }
      }
    }
  }
}
if (piezasMal) { fallos += piezasMal }
else console.log('  ✓ todas cerradas por los dos extremos')

/* ── LOS HERRAJES ──
   Un botón, un cable o una aleta se pegan ENCIMA de la pieza, y fallan de tres
   maneras que no dan ningún error: FLOTANDO (separados del metal, satélites),
   ENTERRADOS (dentro del metal, invisibles) o TAPADOS (una costilla vecina más
   alta que ellos se los come). Las tres se ven horrible y ninguna revienta.

   Acá se comprueban las tres con los números, sobre las 30 piezas, en un
   segundo. Mirarlas de a una en el navegador es el trabajo que esto ahorra —y
   además cubre la pieza que nadie iba a girar hasta el ángulo justo. */
console.log('\n── Los herrajes: ni flotando, ni enterrados, ni tapados ──')
const TOPE_MALLAS = 6
let piezasVistas = 0, herrajesVistos = 0, mallasPeor = 0
for (const tipo of ['emisor', 'cuerpo', 'pomo'] as const) {
  for (const id of IDS_CONOCIDOS[tipo]) {
    const { puntos, alto, material, herrajes } = perfilDePieza(tipo, id)
    piezasVistas++

    if (!(material in MATERIALES)) {
      fallos++; console.log(`  ✗ ${id}: material desconocido «${material}»`)
    }

    const mallas = mallasDeHerrajes(herrajes)
    if (mallas > mallasPeor) mallasPeor = mallas
    // Techo de mallas POR PIEZA: tres piezas en pantalla por sable, así que el
    // peor caso son 3×TOPE llamadas de dibujo extra. Sin techo, «un remache más»
    // se repite treinta veces y el teléfono de gama baja lo paga sin avisar.
    if (mallas > TOPE_MALLAS) {
      fallos++
      console.log(`  ✗ ${id}: ${mallas} mallas de herraje, el techo es ${TOPE_MALLAS}`)
    }

    for (const h of herrajes) {
      herrajesVistos++
      const donde = `${id} · ${h.tipo} y=${h.y}`
      if (!(h.y >= 0 && h.y <= 1)) {
        fallos++; console.log(`  ✗ ${donde}: la altura tiene que ir de 0 a 1`)
        continue
      }
      if (!(h.material in MATERIALES)) {
        fallos++; console.log(`  ✗ ${donde}: material desconocido «${h.material}»`)
      }
      const { apoyo, dentro, fuera, sombra } = asientoDe(puntos, h, alto)
      if (![apoyo, dentro, fuera, sombra].every(Number.isFinite)) {
        fallos++; console.log(`  ✗ ${donde}: el asiento no da un número`)
        continue
      }
      if (dentro >= apoyo) {
        fallos++
        console.log(`  ✗ ${donde}: FLOTA — su cara interna (${dentro.toFixed(2)}) no llega al apoyo (${apoyo.toFixed(2)})`)
      }
      if (fuera <= apoyo) {
        fallos++
        console.log(`  ✗ ${donde}: ENTERRADO — su cara externa (${fuera.toFixed(2)}) no sale del metal (${apoyo.toFixed(2)})`)
      }
      if (fuera < sombra) {
        fallos++
        console.log(`  ✗ ${donde}: EN UN POZO — sale a ${fuera.toFixed(2)} y las paredes de al lado piden ${sombra.toFixed(2)} para verlo`)
      }
    }
  }
}
if (piezasVistas !== 30) {
  console.log(`\n❌ se revisaron ${piezasVistas} piezas y el catálogo tiene 30 — este resultado no dice nada\n`)
  process.exit(1)
}
if (!fallos) {
  console.log(`  ✓ ${herrajesVistos} herrajes en ${piezasVistas} piezas, todos apoyados y visibles`)
  console.log(`  ✓ la pieza más cargada lleva ${mallasPeor} mallas (techo ${TOPE_MALLAS})`)
}

console.log('\n── Caídas y coherencia ──')
function comprobar(nombre: string, ok: boolean, detalle = ''): void {
  if (ok) console.log(`  ✓ ${nombre}`)
  else { fallos++; console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ''}`) }
}

// Un id que este deploy no conoce NO puede reventar: la PWA instalada tarda en
// actualizarse (§2g) y puede recibir de la base una pieza que aún no sabe dibujar.
const raro = perfilDeSable({ emisor: 'x', cuerpo: 'y', pomo: 'z', color: 'w' })
comprobar('un id desconocido cae al de fábrica sin reventar',
  perfilValido(raro.puntos).length === 0 && raro.alto > 15)

comprobar('el diseño de fábrica es dibujable',
  perfilValido(perfilDeSable(POR_DEFECTO).puntos).length === 0)

comprobar('hay 6 colores de hoja', Object.keys(COLORES).length === 6,
  `hay ${Object.keys(COLORES).length}`)

comprobar('cada color trae núcleo y halo distintos',
  Object.values(COLORES).every(c => c.nucleo !== c.halo && /^#[0-9a-f]{6}$/i.test(c.nucleo) && /^#[0-9a-f]{6}$/i.test(c.halo)))

comprobar('el color de fábrica existe en la tabla de colores',
  POR_DEFECTO.color in COLORES)

// El perfil TIENE que empezar y terminar cerrado o el mango se ve como un tubo.
const p = perfilDeSable(POR_DEFECTO).puntos
comprobar('el mango cierra abajo (radio 0 en el primer punto)', p[0][0] === 0,
  `arranca en radio ${p[0][0]}`)

console.log(fallos === 0
  ? `\n✅ ${ESPERADAS} mangos + ${Object.keys(COLORES).length} colores · TODO PASA\n`
  : `\n❌ ${fallos} fallo(s)\n`)
process.exit(fallos === 0 ? 0 : 1)

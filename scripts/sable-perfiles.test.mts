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
  perfilDeSable, perfilValido, IDS_CONOCIDOS, COLORES, POR_DEFECTO,
} from '../src/features/sable/partesSable.ts'

let fallos = 0
const problemas: string[] = []

console.log('\n── Las 64 combinaciones de mango ──')
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
if (medidas !== 64) {
  console.log(`\n❌ se midieron ${medidas} combinaciones y deberían ser 64 — este resultado no dice nada\n`)
  process.exit(1)
}
console.log(problemas.length ? problemas.join('\n') : `  ✓ ${medidas} mangos, todos dibujables`)

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
  ? `\n✅ 64 mangos + ${Object.keys(COLORES).length} colores · TODO PASA\n`
  : `\n❌ ${fallos} fallo(s)\n`)
process.exit(fallos === 0 ? 0 : 1)

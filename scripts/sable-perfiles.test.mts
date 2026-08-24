/**
 * ¿Todas las combinaciones de mango son dibujables, y sus herrajes se ven?
 *
 *   npx tsx scripts/sable-perfiles.test.mts
 *
 * `LatheGeometry` no avisa cuando el perfil está mal: gira lo que le den y el
 * resultado es una malla con anillos NEGROS (normal invertida) o pinchada (radio
 * 0 en el medio). No hay error en consola, no hay excepción — solo un sable que
 * se ve mal, y solo en la combinación concreta que lo provoca.
 *
 * Lo mismo con los herrajes: un botón puede quedar flotando, enterrado o en el
 * fondo de un pozo, y las tres cosas se construyen sin quejarse.
 *
 * Las cuentas se DERIVAN del catálogo, nunca se cablean: este archivo ya dijo
 * «64 combinaciones» mucho después de que fueran 990, y un número quemado
 * vuelve verde una prueba que dejó de cubrir lo que se agregó.
 *
 * Corrélo al agregar una pieza.
 */

import {
  perfilDeSable, perfilValido, piezasDeSable, IDS_CONOCIDOS, COLORES, POR_DEFECTO,
  perfilDePieza, asientoDe, radioEn, mallasDeHerrajes, MATERIALES, emite,
  type MaterialId,
} from '../src/features/sable/partesSable.ts'
import { semillaDe } from '../src/features/sable/cristalTres.ts'

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
let conBrillo = 0, destellos = 0
/* Techo de mallas de herraje POR PIEZA. Tres piezas en pantalla por sable, así
   que el peor caso son 3×TOPE llamadas de dibujo extra: con 8, unas 24, que
   sumadas a la escena (hoja, pedestal, estrellas, alma) quedan bajo las 40 que
   el estudio de rendimiento marcó como techo seguro en gama baja.

   Subió de 6 a 8 al entrar los destellos: una fila de puntitos titilando pide
   entre 5 y 8 para leerse como chispa, y con 6 quedaban ralos. Sin techo, «un
   remache más» se repite treinta veces y el teléfono lo paga sin avisar. */
const TOPE_MALLAS = 8
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
      if (emite(h.material as MaterialId)) conBrillo++
      if (h.tipo === 'destello') {
        destellos++
        /* Un destello suelto no es un destello: es un punto. La gracia está en
           que la FILA corra alrededor del eje, y con menos de tres no se lee
           ninguna secuencia. */
        if (h.vueltas < 3) {
          fallos++
          console.log(`  ✗ ${donde}: ${h.vueltas} destello(s) — con menos de 3 no se lee la secuencia`)
        }
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
/* El conteo se DERIVA del catálogo, no se cablea: un «30» quemado volvería
   verde una prueba que dejó de cubrir las piezas nuevas — el mismo fallo que
   ya tuvo el «64» de las combinaciones. Lo que se comprueba es que se haya
   revisado ALGO y que coincida con lo que el catálogo dice tener. */
const ENCATALOGO =
  IDS_CONOCIDOS.emisor.length + IDS_CONOCIDOS.cuerpo.length + IDS_CONOCIDOS.pomo.length
if (piezasVistas !== ENCATALOGO || piezasVistas === 0) {
  console.log(`\n❌ se revisaron ${piezasVistas} piezas y el catálogo tiene ${ENCATALOGO} — este resultado no dice nada\n`)
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

comprobar('hay 16 colores de hoja', Object.keys(COLORES).length === 16,
  `hay ${Object.keys(COLORES).length}`)

/* Dos cristales que se parecen demasiado son dos piezas que nadie distingue en
   una miniatura de 44 px — y una de las dos es plata gastada al pedo. Se mide
   la distancia de tono en el espacio del propio hex: si dos halos están a menos
   de 28 de distancia euclídea en RGB, la tienda tiene un duplicado. */
{
  const halos = Object.entries(COLORES).map(([id, c]) => {
    const n = parseInt(c.halo.slice(1), 16)
    return { id, r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
  })
  let masCerca = Infinity, par = ''
  for (let i = 0; i < halos.length; i++) {
    for (let j = i + 1; j < halos.length; j++) {
      const d = Math.hypot(halos[i].r - halos[j].r, halos[i].g - halos[j].g, halos[i].b - halos[j].b)
      if (d < masCerca) { masCerca = d; par = `${halos[i].id} vs ${halos[j].id}` }
    }
  }
  comprobar(`los cristales se distinguen entre sí (el par más cercano: ${par}, ${masCerca.toFixed(0)})`,
    masCerca >= 28)
}

/* Y la ROCA: cada color tiene su forma, y siempre la misma. Sin esto, una
   semilla mal derivada daría el mismo cristal para todos —o peor, uno distinto
   en cada render, que rompería el caché de la foto del mango. */
{
  const semillas = Object.keys(COLORES).map(semillaDe)
  comprobar('cada cristal tiene su propia semilla', new Set(semillas).size === semillas.length)
  comprobar('la semilla es estable entre llamadas',
    Object.keys(COLORES).every(id => semillaDe(id) === semillaDe(id)))
}

/* ── EL CRISTAL A LA VISTA ──
   Los herrajes sintéticos de la ventana no están en el catálogo, así que el
   barrido de arriba no los toca: se validan acá, sobre TODOS los cuerpos, con
   el mismo asiento. Una ventana que flote o quede en un pozo en un solo cuerpo
   es exactamente el bug que nadie encontraría a mano. */
console.log('\n── La ventana del cristal, en todos los cuerpos ──')
let ventanasMal = 0
for (const cuerpo of IDS_CONOCIDOS.cuerpo) {
  const sueltas = piezasDeSable({
    emisor: 'emi_estandar', cuerpo, pomo: 'pom_plano', color: 'col_azul', cristalVisto: true,
  })
  const sp = sueltas.find(x => x.clave === 'cuerpo')!
  const gema = sp.herrajes.find(h => h.tipo === 'gema' && h.material === 'plasma')
  if (!gema) { ventanasMal++; console.log(`  ✗ ${cuerpo}: la ventana no se agregó`); continue }
  const { apoyo, dentro, fuera, sombra } = asientoDe(sp.perfil, gema, sp.alto)
  if (dentro >= apoyo || fuera <= apoyo || fuera < sombra) {
    ventanasMal++
    console.log(`  ✗ ${cuerpo}: ventana mal apoyada (dentro ${dentro.toFixed(2)}, fuera ${fuera.toFixed(2)}, apoyo ${apoyo.toFixed(2)}, sombra ${sombra.toFixed(2)})`)
  }
}
if (ventanasMal) fallos += ventanasMal
else console.log(`  ✓ la ventana asienta en los ${IDS_CONOCIDOS.cuerpo.length} cuerpos`)

/* Y la cadena de acabados: por-pieza le gana al global, y el global al propio. */
{
  const base = { emisor: 'emi_estandar', cuerpo: 'cue_liso', pomo: 'pom_plano', color: 'col_azul' }
  const conGlobal = piezasDeSable({ ...base, acabado: 'jade' })
  const conAmbos = piezasDeSable({ ...base, acabado: 'jade', acabadoCuerpo: 'cuero' })
  comprobar('el acabado global repinta las tres piezas',
    conGlobal.every(p => p.material === 'jade'))
  comprobar('el acabado por pieza le gana al global',
    conAmbos.find(p => p.clave === 'cuerpo')!.material === 'cuero'
    && conAmbos.find(p => p.clave === 'emisor')!.material === 'jade')
  comprobar('un acabado inventado cae al material propio',
    piezasDeSable({ ...base, acabadoPomo: 'inventado' }).find(p => p.clave === 'pomo')!.material === 'acero')
}

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

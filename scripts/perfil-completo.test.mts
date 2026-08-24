/**
 * ¿El aviso de «completá tu perfil» pide lo que debe?
 *
 *   npx tsx scripts/perfil-completo.test.mts
 *
 * ── Por qué existe ────────────────────────────────────────────────────
 *
 * La credencial —la pieza de identidad más vista de la app, y la única que se
 * exporta a PNG y se comparte por fuera (§3b)— NO estaba en el catálogo de
 * `perfilCompleto.ts`. El aviso pedía bio, planeta y aspectos y nunca la
 * mencionaba. Medido sobre los 38 perfiles el 2026-08-23: lo que el aviso pide
 * ronda las 14-15 personas (aspectos 15, planeta 14, bio 14) y lo que no pide
 * se queda atrás (tema de credencial 12, apodo 8, vitrina 0).
 *
 * Al agregarla aparecieron DOS trampas que este guion fija para que no
 * vuelvan:
 *
 *  1. **El reparto asistente / fuera del asistente estaba cableado por
 *     NOMBRE** (`f !== 'cartas'`). Un pedido nuevo caía por descarte dentro del
 *     asistente —que no sabe resolverlo— y el paso salía en blanco. Ahora sale
 *     de `enElAsistente`, y acá se comprueba que TODO faltante caiga en
 *     exactamente uno de los dos lados.
 *  2. **Todo lo que no está en el asistente necesita `ruta`.** El botón «Ir a
 *     personalizar» mandaba siempre a `/profile`; con dos pendientes distintos,
 *     uno de los dos habría llevado al sitio equivocado sin decir nada.
 */

import {
  calcularCompletitud, CATALOGO, ORDEN,
  type EstadoPerfil, type Faltante,
} from '../src/services/perfilCompleto.ts'
import type { Personalizacion } from '../src/services/profileCustomService.ts'

let fallos = 0
function comprobar(nombre: string, ok: boolean, detalle = ''): void {
  if (ok) { console.log(`  ✓ ${nombre}`) }
  else { fallos++; console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ''}`) }
}

const VACIA: Personalizacion = {
  showcase_cards: [], favorite_aspects: [], banner_card_id: null,
  accent: null, planet_name: null,
} as unknown as Personalizacion

const lleno: Personalizacion = {
  ...VACIA,
  favorite_aspects: ['Vigilance'],
  planet_name: 'Mundo',
  banner_card_id: 'abc',
} as unknown as Personalizacion

const base: EstadoPerfil = {
  pais: 'SV', bio: 'hola', personalizacion: lleno, credencialElegida: true,
}

console.log('\n── El catálogo es coherente ──')

comprobar('ORDEN cubre exactamente las claves de CATALOGO',
  ORDEN.length === Object.keys(CATALOGO).length &&
  ORDEN.every(f => f in CATALOGO),
  `ORDEN=${ORDEN.length} CATALOGO=${Object.keys(CATALOGO).length}`)

// Trampa 2: sin `ruta`, el botón manda a `/profile` por descarte.
const sinRuta = ORDEN.filter(f => !CATALOGO[f].enElAsistente && !CATALOGO[f].ruta)
comprobar('todo lo que NO está en el asistente tiene ruta propia',
  sinRuta.length === 0, `sin ruta: ${sinRuta.join(', ')}`)

// Trampa 1: el reparto tiene que ser una partición, sin huérfanos.
const dentro = ORDEN.filter(f => CATALOGO[f].enElAsistente)
const fuera = ORDEN.filter(f => !CATALOGO[f].enElAsistente)
comprobar('el reparto asistente/fuera es una partición',
  dentro.length + fuera.length === ORDEN.length &&
  dentro.every(f => !fuera.includes(f)),
  `dentro=${dentro.join(',')} fuera=${fuera.join(',')}`)

console.log('\n── La credencial se pide, y deja de pedirse ──')

const sinCred = calcularCompletitud({ ...base, credencialElegida: false })
comprobar('sin elegir credencial, se reporta como faltante',
  sinCred.faltantes.some(f => f.id === 'credencial'),
  `faltantes=${sinCred.faltantes.map(f => f.id).join(',')}`)
comprobar('…y el perfil NO cuenta como completo', !sinCred.completo)

const conCred = calcularCompletitud(base)
comprobar('al elegirla, desaparece del pedido',
  !conCred.faltantes.some(f => f.id === 'credencial'))
comprobar('…y con todo lo demás puesto, el perfil queda completo',
  conCred.completo, `faltan=${conCred.faltantes.map(f => f.id).join(',')}`)

console.log('\n── Las reglas que ya existían siguen en pie ──')

comprobar('mientras carga (personalizacion null) NO se pide nada',
  calcularCompletitud({ ...base, personalizacion: null, credencialElegida: false }).completo)

comprobar('«cartas» se cumple SOLO con la vitrina',
  !calcularCompletitud({
    ...base,
    personalizacion: { ...lleno, banner_card_id: null, showcase_cards: ['x'] } as unknown as Personalizacion,
  }).faltantes.some(f => f.id === 'cartas'))

const vacio = calcularCompletitud({
  pais: null, bio: null, personalizacion: VACIA, credencialElegida: false,
})
comprobar('un perfil recién creado pide TODO',
  vacio.faltantes.length === ORDEN.length && vacio.porcentaje === 0,
  `pide ${vacio.faltantes.length}/${ORDEN.length}, ${vacio.porcentaje}%`)

const faltaUno: Faltante[] = vacio.faltantes.map(f => f.id)
comprobar('y los pide en el orden del catálogo',
  JSON.stringify(faltaUno) === JSON.stringify(ORDEN),
  `${faltaUno.join(',')} vs ${ORDEN.join(',')}`)

console.log(fallos === 0
  ? `\n✅ ${ORDEN.length} pedidos en el catálogo · TODO PASA\n`
  : `\n❌ ${fallos} fallo(s)\n`)
process.exit(fallos === 0 ? 1 - 1 : 1)

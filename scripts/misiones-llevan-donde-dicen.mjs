#!/usr/bin/env node
/**
 * Comprueba que el botón de una misión lleve A LA PANTALLA DONDE SE HACE.
 *
 * Es la otra mitad de la regla del §3n. Aquel arreglo fue que cada misión
 * dijera DÓNDE se hace, porque «publicar algo en el muro» usaba una palabra
 * que no existía en ninguna pantalla y ni Nel —que construyó la app— sabía
 * cumplirla. Pero decirlo no alcanza: el destino se pudre solo.
 *
 * Y se pudrió. La Trivia vivía DENTRO del perfil (`TriviaSection`); cuando se
 * mudó a `/trivia`, las cinco misiones de trivia se quedaron apuntando a
 * `/profile`. El botón te dejaba en una pantalla sin trivia — una tarea
 * imposible otra vez, ahora por el destino en vez de por el llamador. Lo mismo
 * «Enviar 1 regalo», que mandaba a La Galaxia cuando los regalos se envían
 * desde Espionaje.
 *
 * Un destino equivocado NO FALLA: navega, pinta algo, y quien lo tocó cree que
 * no encontró la sección. Por eso hace falta comprobarlo.
 *
 * Tres cruces:
 *   1. toda `ruta` existe de verdad en el router,
 *   2. cada `objectiveType` va a la pantalla donde se cumple,
 *   3. `donde` es el nombre TAL COMO SE LEE EN EL MENÚ, que es lo que exige
 *      el §3n — así una pantalla renombrada también salta acá.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = new URL('..', import.meta.url).pathname
const leer = p => readFileSync(join(RAIZ, p), 'utf8')

const app = leer('src/App.tsx')
const cat = leer('src/services/misionesCatalogo.ts')
const menus = leer('src/components/layout/SideNav.tsx') + leer('src/components/layout/MoreNav.tsx')

const rutasDelRouter = new Set(
  [...app.matchAll(/path="([^"]*)"/g)].map(m => m[1]).filter(p => p !== '*'),
)

/** El nombre que el menú le da a cada ruta. `id:` en SideNav, `to:` en MoreNav. */
const nombreDeRuta = new Map(
  [...menus.matchAll(/(?:id|to):\s*'([^']+)',\s*label:\s*'([^']+)'/g)].map(m => [m[1], m[2]]),
)

/**
 * Dónde se cumple cada objetivo. Se deriva del OBJETIVO y no del nombre de la
 * misión: los nombres son de fantasía («Archivos Jedi» es la trivia) y no
 * pueden decidir un destino.
 */
const DONDE_SE_HACE = {
  trivia_respondida: '/trivia',
  sobre_abierto: '/sobres',
  deck_created: '/decks',
  mazo_compartido: '/decks',
  card_favorited: '/cards',
  carta_agregada: '/cards',
  carta_deseada: '/explore',
  carta_en_venta: '/collection',
  match_played: '/contador',
  match_won: '/contador',
  amistosa_registrada: '/amistosas',
  gift_sent: '/espionaje',
  community_post: '/community',
  muro_publicado: '/community',
  post_apoyado: '/community',
  chat_enviado: '/community',
  chat_message: '/community',
  dia_visitado: '/',
}

const filas = [...cat.matchAll(
  /\{\s*id:\s*'([^']+)'[^}]*?ruta:\s*'([^']*)'[^}]*?donde:\s*'([^']*)'[^}]*?description:\s*'([^']*)'[^}]*?objectiveType:\s*'([^']*)'/g,
)].map(m => ({ id: m[1], ruta: m[2], donde: m[3], desc: m[4], obj: m[5] }))

// Una lectura vacía se parece muchísimo a que todo está bien (§3x): se planta.
if (filas.length < 40) {
  console.error(`✗ solo se leyeron ${filas.length} misiones. El formato del catálogo cambió y esta prueba no está midiendo nada.`)
  process.exit(1)
}

const fallos = []

for (const f of filas) {
  if (!rutasDelRouter.has(f.ruta)) {
    fallos.push(`${f.id}: manda a ${f.ruta}, que no existe en el router`)
    continue
  }
  const esperada = DONDE_SE_HACE[f.obj]
  if (!esperada) {
    fallos.push(`${f.id}: el objetivo «${f.obj}» no está en DONDE_SE_HACE. Agregalo acá en el mismo commit.`)
  } else if (f.ruta !== esperada) {
    fallos.push(`${f.id} «${f.desc}» manda a ${f.ruta} y se hace en ${esperada}`)
  }
  const enElMenu = nombreDeRuta.get(f.ruta)
  if (enElMenu && f.donde !== enElMenu) {
    fallos.push(`${f.id}: dice «${f.donde}» pero el menú la llama «${enElMenu}»`)
  }
}

console.log(`misiones con destino: ${filas.length}`)
if (fallos.length) {
  console.error(`\n✗ ${fallos.length} problema(s):`)
  for (const f of fallos) console.error(`   ${f}`)
  process.exit(1)
}
console.log('✓ todas llevan a la pantalla donde se hacen, con el nombre del menú')

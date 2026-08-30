#!/usr/bin/env node
/**
 * ¿Torneos sigue siendo UNA sola puerta?
 *
 *   node scripts/torneos-una-sola-puerta.mjs
 *
 * «Próximos Eventos» y «Torneos» eran dos pantallas para el mismo trabajo, y
 * el menú las ofrecía como si fueran cosas distintas. Al fusionarlas quedaron
 * tres cosas que se rompen calladas y que ninguna prueba de tipos ve:
 *
 *  1. Que alguien vuelva a agregar una entrada de menú a la pantalla vieja.
 *  2. Que la redirección de `/events` se escriba con comodín. `/events/*` se
 *     traga join, create, lobby, play, dashboard, live, tournament y melee:
 *     el enlace de invitación de WhatsApp (`/events/join?code=`) dejaría de
 *     abrir, y el tablero de un torneo en curso también.
 *  3. Que se caiga alguna de esas subrutas sin que nadie lo note.
 */
import { readFileSync, existsSync } from 'node:fs'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const raiz = new URL('..', import.meta.url).pathname
const leer = (p) => readFileSync(join(raiz, p), 'utf8')

let fallos = 0
const ok = (t, c, extra = '') => {
  if (!c) { fallos++; console.log(`  FALLO  ${t} ${extra}`) } else console.log(`  ok     ${t} ${extra}`)
}

const app = leer('src/App.tsx')

// 1. La pantalla vieja no existe y nadie la importa.
ok('EventsPage.tsx ya no existe', !existsSync(join(raiz, 'src/features/events/EventsPage.tsx')))

const fuentes = []
;(function recorrer(dir) {
  for (const n of readdirSync(join(raiz, dir))) {
    const rel = `${dir}/${n}`
    if (statSync(join(raiz, rel)).isDirectory()) recorrer(rel)
    else if (/\.tsx?$/.test(n)) fuentes.push(rel)
  }
})('src')

const importan = fuentes.filter(f => /features\/events\/EventsPage/.test(leer(f)))
ok('nadie importa EventsPage', importan.length === 0, importan.join(', '))

// 2. La redirección es EXACTA. Un comodín acá es el fallo caro.
ok('/events redirige', /path="\/events"\s+element=\{<Navigate to="\/torneos\?t=proximos" replace \/>\}/.test(app))
ok('la redirección NO usa comodín', !/path="\/events\/\*"/.test(app))

// 3. Las subrutas que cuelgan de /events siguen declaradas. Son las que abre
//    un enlace ya repartido o alguien a mitad de un torneo.
for (const sub of ['/events/join', '/events/create', '/events/tournament', '/events/lobby/:code',
                   '/events/play/:code', '/events/dashboard/:code', '/events/live/:code',
                   '/events/melee']) {
  ok(`sigue viva ${sub}`, app.includes(`path="${sub}"`))
}

// 4. Una sola entrada por menú hacia la pantalla de torneos, y ninguna a la vieja.
for (const menu of ['src/components/layout/SideNav.tsx', 'src/components/layout/MoreNav.tsx',
                    'src/features/home/HomePage.tsx', 'src/features/home/BancoConsola.tsx']) {
  const s = leer(menu)
  ok(`${menu.split('/').pop()}: sin «Próximos Eventos»`, !s.includes('Próximos Eventos'))
  // Se cuentan las entradas de NAVEGACIÓN a /torneos, no las menciones.
  const aTorneos = [...s.matchAll(/(?:to|id):\s*'\/torneos'/g)].length
  ok(`${menu.split('/').pop()}: una sola entrada a /torneos`, aTorneos <= 1, `hay ${aTorneos}`)
}

// 5. El rótulo de escritorio: /events/melee tiene que resolverse ANTES que
//    /events, o «Torneos de Melee» es inalcanzable por prefijo.
const header = leer('src/components/layout/Header.tsx')
const iMelee = header.indexOf("startsWith('/events/melee')")
const iEvents = header.indexOf("startsWith('/events')")
ok('el rótulo de Melee gana al de /events', iMelee !== -1 && iMelee < iEvents,
   `melee@${iMelee} events@${iEvents}`)

console.log(fallos ? `\n${fallos} fallo(s)` : '\nuna sola puerta')
process.exit(fallos ? 1 : 0)

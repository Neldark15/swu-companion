#!/usr/bin/env node
/**
 * ¿El torneo en vivo sigue conectado?
 *
 *   node scripts/torneo-en-vivo.mjs
 *
 * Las seis cosas de este flujo se rompen SIN ERROR, y por eso ninguna se
 * reportó nunca sola: un reloj que cuenta contra el aparato equivocado se ve
 * perfecto en cada pantalla por separado, un aviso que no se guarda no deja
 * rastro, y un canal sobre una tabla que no publica se suscribe contento y no
 * dispara jamás.
 *
 * Esta guarda fija los cuatro puntos donde volvería a soltarse.
 *
 * OJO con el chequeo de tipos de este repo: `npx tsc --noEmit` a secas usa el
 * tsconfig raíz, que es de solo referencias (`"files": []`) y NO REVISA NADA —
 * sale 0 siempre. El chequeo de verdad es `npm run build` (`tsc -b`).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = new URL('..', import.meta.url).pathname
const leer = (p) => readFileSync(join(raiz, p), 'utf8')

let fallos = 0
const ok = (t, c, extra = '') => {
  if (!c) { fallos++; console.log(`  FALLO  ${t} ${extra}`) } else console.log(`  ok     ${t} ${extra}`)
}

/* Se miran los comentarios aparte del código: una regla que se cumple porque
   la palabra aparece en un comentario no mide nada, y una que FALLA por eso
   es peor —hace desconfiar de la guarda entera—. */
const sinComentarios = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const nube = leer('src/services/tournamentCloud.ts')
const reloj = leer('src/features/events/components/RoundTimer.tsx')
const jugador = leer('src/features/events/TournamentPlayerView.tsx')
const migracion = leer('supabase/migrations/torneo-en-vivo-canieria.sql')

// 1. El plazo lo ancla el SERVIDOR. Un `Date.now()` acá devuelve el fallo en
//    el que el teléfono adelantado del organizador acorta la ronda de todos.
ok('el reloj lo arranca la base', nube.includes("rpc('arrancar_reloj'"))
ok('estirar el reloj lo hace la base', nube.includes("rpc('estirar_reloj'"))
ok('nadie ancla el plazo con Date.now()',
   !/round_timer_end:\s*(new Date\(Date\.now|endTime)/.test(nube))

// 2. El reloj se MIDE contra la hora del servidor.
ok('RoundTimer cuenta con la hora del servidor', reloj.includes('ahora()'))
ok('RoundTimer no cuenta con Date.now()', !sinComentarios(reloj).includes('Date.now()'))

// 3. Publicar una ronda arranca su reloj. Un paso que hay que acordarse de
//    dar es un paso que un día no se da.
// Solo los sitios que PUBLICAN una ronda: no la declaración del tipo ni el
// `current_round: 0` de la siembra, que no arranca ninguna ronda.
const arranques = [...nube.matchAll(/\.update\(\{ current_round:/g)].length
const relojes = [...nube.matchAll(/arrancarRelojDeRonda\(eventId\)/g)].length
ok('cada ronda que se publica arranca su reloj', arranques === relojes,
   `${arranques} rondas · ${relojes} relojes`)

// 4. El aviso in-app no puede ser mudo: estuvo con CERO filas en la historia
//    del sistema porque el error nunca se miraba.
ok('el aviso in-app mira su error', /bErr/.test(nube))
ok('no quedó el catch vacío del broadcast',
   !/\}\s*catch\s*\{\s*\n\s*\/\/ best-effort, swallow/.test(nube))

// 5. El que juega ve el reloj. Estaba solo en el panel del admin.
ok('el jugador ve el reloj de la ronda', jugador.includes('<RoundTimer'))

// 6. Las tablas que tienen que avisar, avisan. Sin esto todo lo demás se
//    suscribe sin error y no dispara nunca.
for (const t of ['official_events', 'event_registrations']) {
  ok(`${t} publica cambios`, migracion.includes(`add table public.${t}`))
}
ok('registrations con REPLICA IDENTITY FULL (o las bajas no llegan)',
   migracion.includes('replica identity full'))

console.log(fallos ? `\n${fallos} fallo(s)` : '\nel torneo en vivo sigue conectado')
process.exit(fallos ? 1 : 0)

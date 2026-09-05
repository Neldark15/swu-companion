#!/usr/bin/env node
/**
 * ¿Alguien volvió a pedir `profiles` por una clave foránea que no existe?
 *
 *   node scripts/embebidos-de-perfil.mjs
 *
 * EL FALLO QUE FIJA. En PostgREST, `profiles!algo(name)` significa «traeme el
 * perfil siguiendo esa relación». Si la tabla NO tiene clave foránea hacia
 * `public.profiles`, el enlace no se puede resolver y la consulta ENTERA
 * falla — no la parte del perfil: entera.
 *
 * Y en esta app casi todas esas consultas terminan en `if (error) return []`,
 * así que el fallo se ve exactamente igual que «no hay datos». Vivió así:
 *   · el lobby mostraba la sala vacía con cinco inscritos adentro
 *   · sembrar el torneo decía «se necesitan al menos 2 jugadores» con cinco
 *   · el ranking global de torneos salía vacío
 *   · los regalos recibidos salían vacíos
 *
 * LA TRAMPA es que varias de estas tablas apuntan a `auth.users`, y sus claves
 * se LLAMAN `<tabla>_user_id_fkey`, que parece exactamente la que haría falta.
 *
 * Verificado contra pg_constraint el 05/09/2026.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const raiz = new URL('..', import.meta.url).pathname

/** Tablas cuya única clave foránea de persona apunta a `auth.users`. */
const NO_PUEDEN = ['event_registrations', 'gifts', 'tournament_results']
/** Tablas que SÍ apuntan a `public.profiles`: ahí el embebido es correcto. */
const SI_PUEDEN = ['player_stats', 'monthly_xp']

const archivos = []
;(function recorrer(dir) {
  for (const n of readdirSync(join(raiz, dir))) {
    const rel = `${dir}/${n}`
    if (statSync(join(raiz, rel)).isDirectory()) recorrer(rel)
    else if (/\.tsx?$/.test(n)) archivos.push(rel)
  }
})('src')

let fallos = 0
for (const f of archivos) {
  const texto = readFileSync(join(raiz, f), 'utf8')
  // Se quitan los comentarios: esta guarda explica el fallo EN comentarios, y
  // una regla que se dispara con su propia explicación no sirve para nada.
  const codigo = texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  /* Un embebido de PostgREST es `profiles!algo(` o `profiles!inner(`.
     `profiles!:` es otra cosa: la declaración de la tabla de Dexie con el `!`
     de asignación definitiva de TypeScript. Sin acotarlo, la guarda avisaba
     sobre un archivo que no habla con el servidor.
     Y va SIN `/g` para la comprobación: un regex global recuerda dónde
     quedó, así que `.test()` deja el índice avanzado y el `matchAll` de abajo
     arranca a mitad del archivo. Se usan dos, uno para preguntar y otro para
     recorrer. */
  if (!/profiles!\s*[a-z_]*\s*\(/.test(codigo)) continue

  /* De qué tabla es cada embebido: se busca el `.from('...')` MÁS CERCANO
     hacia atrás. Un intento anterior trataba de casar la consulta entera con
     una sola expresión regular y no detectaba nada — o sea que era una guarda
     que no podía fallar, justo lo que esta guarda existe para evitar. */
  for (const emb of [...codigo.matchAll(/profiles!\s*[a-z_]*\s*\(/g)]) {
    const antes = codigo.slice(0, emb.index)
    const froms = [...antes.matchAll(/\.from\('([a-z_]+)'\)/g)]
    const tabla = froms.length ? froms[froms.length - 1][1] : '(no se supo)'

    if (NO_PUEDEN.includes(tabla)) {
      fallos++
      console.log(`  FALLO  ${f}: «${tabla}» no tiene clave foránea a profiles — el embebido rompe la consulta entera`)
    } else if (SI_PUEDEN.includes(tabla)) {
      console.log(`  ok     ${f}: «${tabla}» sí apunta a profiles`)
    } else {
      fallos++
      console.log(`  ojo    ${f}: «${tabla}» no está en ninguna de las dos listas. Comprobá su clave foránea antes de embeber.`)
    }
  }
}

console.log(fallos ? `\n${fallos} embebido(s) que romperían su consulta` : '\nningún embebido de perfil roto')
process.exit(fallos ? 1 : 0)

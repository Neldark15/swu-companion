#!/usr/bin/env node
/**
 * ¿La foto de perfil sobrevive a reinstalar la app?
 *
 *   node scripts/foto-de-perfil.mjs
 *
 * Nel: «las fotos de perfil no las guarda si se borra la app y luego se vuelve
 * a poner en inicio como app, o si me deslogueo».
 *
 * LA CAUSA fue que había DOS caminos que crean el perfil local y solo UNO
 * preguntaba por la foto a la nube. El de iniciar sesión leía `name, avatar`;
 * el de restaurar la sesión —el que corre justo al reinstalar— armaba el
 * perfil con `user_metadata` y caía en el emoji por defecto.
 *
 * Y no era cosmético: apenas la persona tocaba algo del perfil, ese emoji se
 * sincronizaba a la nube y PISABA la foto de verdad. Reinstalar te borraba la
 * foto del servidor.
 *
 * Esta guarda fija que los dos caminos sigan preguntando lo mismo, en un solo
 * lugar, y que el guardado no vuelva a ser mudo.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = new URL('..', import.meta.url).pathname
const leer = (p) => readFileSync(join(raiz, p), 'utf8')

let fallos = 0
const ok = (t, c, extra = '') => {
  if (!c) { fallos++; console.log(`  FALLO  ${t} ${extra}`) } else console.log(`  ok     ${t} ${extra}`)
}

const auth = leer('src/hooks/useAuth.ts')
const sync = leer('src/services/sync.ts')

// 1. Un solo lugar donde se arma el perfil desde la nube.
ok('existe el armador único', auth.includes('async function perfilDeLaNube'))

// 2. Los DOS caminos lo usan. Es el fallo original: uno preguntaba y el otro no.
const usos = [...auth.matchAll(/await perfilDeLaNube\(user\)/g)].length
ok('los dos caminos preguntan a la nube', usos >= 2, `${usos} usos`)

// 3. Nadie vuelve a armar el perfil a mano desde user_metadata: ese era el
//    camino que ponía el emoji por defecto encima de la foto.
ok('nadie arma el perfil con user_metadata a secas',
   !/avatar:\s*user\.user_metadata\?\.avatar\s*\|\|\s*'🎯'/.test(
     auth.replace(/async function perfilDeLaNube[\s\S]*?\n\}/, '')))

// 4. El guardado mira su error. supabase-js NO lanza, así que un try/catch
//    alrededor no atrapa nada y una foto que no se guarda se ve igual que una
//    guardada.
ok('el guardado mira el error de PostgREST', /const \{ error \} = await supabase\.from\('profiles'\)\.upsert/.test(sync))
ok('el guardado devuelve si se pudo', /Promise<\{ ok: boolean; mensaje\?: string \}>/.test(sync))

// 5. Quien guarda ESPERA el resultado, no lo tira.
ok('updateProfile no descarta el guardado', !auth.includes('.catch(() => {})\n        }\n      },'))
ok('updateProfile devuelve el resultado', /return await syncProfileToCloud\(/.test(auth))

console.log(fallos ? `\n${fallos} fallo(s)` : '\nla foto sobrevive')
process.exit(fallos ? 1 : 0)

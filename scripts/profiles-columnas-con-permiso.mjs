#!/usr/bin/env node
/**
 * Las columnas de `profiles` que el cliente PIDE, para cotejarlas con las que
 * tiene permiso de leer.
 *
 * Existe porque esta clase de bug ya mordió dos veces:
 *   · §4i — `planet_rings` y `planet_moons` se agregaron sin grant y la
 *     personalización del planeta no guardaba, en silencio.
 *   · 2026-08-27 — `blog_autor` se agregó sin grant de SELECT. Como
 *     `getPermisos()` la pide JUNTO con `role`, la consulta entera moría con
 *     42501, el rol nunca se resolvía y los admins perdían el panel.
 *
 * Lo que hace difícil verlo es que el error habla de la TABLA, no de la
 * columna («permission denied for table profiles»), y que quien llama trata el
 * fallo como «no se pudo averiguar» —que es lo correcto— así que no hay ni un
 * mensaje rojo en ningún lado.
 *
 * El script no puede consultar la base (no hay service role en local), así que
 * hace la mitad que sí puede: junta las columnas de TODOS los `.select()` sobre
 * `profiles` y escupe la consulta lista para pegar en el SQL Editor. Una
 * columna que salga en esa consulta es una columna sin permiso.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = new URL('../src', import.meta.url).pathname
const cols = new Set()
let selects = 0

function recorrer(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { recorrer(p); continue }
    if (!/\.(ts|tsx)$/.test(e.name)) continue
    const s = readFileSync(p, 'utf8')
    for (const m of s.matchAll(/from\(\s*'profiles'\s*\)[\s\S]{0,200}?\.select\(\s*[`'"]([^`'"]+)[`'"]/g)) {
      selects++
      for (let c of m[1].split(',')) {
        c = c.trim().replace(/\s*:.*/, '').replace(/\(.*/, '').trim()
        if (c === '*') { cols.add('*'); continue }
        if (/^[a-z_][a-z0-9_]*$/.test(c)) cols.add(c)
      }
    }
  }
}
recorrer(SRC)

// Una lectura vacía se parece muchísimo a que todo está bien (§3x).
if (selects === 0 || cols.size < 5) {
  console.error(`✗ solo se encontraron ${selects} select() y ${cols.size} columnas. El patrón cambió y esto no está midiendo nada.`)
  process.exit(1)
}

const lista = [...cols].filter(c => c !== '*').sort()
console.log(`${selects} select() sobre profiles · ${lista.length} columnas distintas\n`)
console.log('Pegá esto en el SQL Editor. Lo que devuelva son columnas SIN permiso:\n')
console.log(`with pedidas(col) as (values
${lista.map(c => `  ('${c}')`).join(',\n')}
)
select p.col
from pedidas p
where not exists (
  select 1 from information_schema.column_privileges g
   where g.table_schema='public' and g.table_name='profiles'
     and g.column_name = p.col and g.grantee='authenticated'
     and g.privilege_type='SELECT')
order by p.col;`)

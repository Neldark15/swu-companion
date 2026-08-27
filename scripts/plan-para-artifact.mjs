#!/usr/bin/env node
/**
 * Genera la versión «cuerpo suelto» de un plan para publicarlo como Artifact.
 *
 * LA FUENTE ÚNICA ES `public/planes/*.html`, el documento completo que sirve
 * swusv.com. El Artifact es una COPIA para compartir fuera de la app, y el
 * publicador envuelve el archivo en su propio `<!doctype>…<head>…<body>`, así
 * que necesita el contenido sin esa cáscara.
 *
 * Existe para que las dos no se separen. Editar el documento en dos lados es
 * el §3c del proyecto: dos respuestas a la misma pregunta, y la que ve la
 * comunidad no es la que uno editó.
 *
 *   node scripts/plan-para-artifact.mjs liga-puente3
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const RAIZ = new URL('..', import.meta.url).pathname
const nombre = process.argv[2]
if (!nombre) {
  console.error('uso: node scripts/plan-para-artifact.mjs <nombre-del-plan>')
  process.exit(1)
}

const origen = join(RAIZ, 'public/planes', `${nombre}.html`)
const doc = readFileSync(origen, 'utf8')

const titulo = (doc.match(/<title>(.*?)<\/title>/s) || [])[1] || nombre
// El `·` y lo que sigue es la firma del documento suelto; el Artifact lleva
// solo el nombre, que es como se lee en la galería.
const tituloCorto = titulo.split('·')[0].trim()
const enlaces = (doc.match(/<link [^>]*>/g) || []).filter(l => l.includes('fonts.'))
const estilo = (doc.match(/<style>[\s\S]*?<\/style>/) || [])[0] || ''
const cuerpo = (doc.match(/<body>([\s\S]*)<\/body>/) || [])[1] || ''

if (!cuerpo.trim()) {
  console.error('✗ no se encontró <body> con contenido. ¿Cambió el formato del documento?')
  process.exit(1)
}

const salida = [`<title>${tituloCorto}</title>`, ...enlaces, estilo, cuerpo.trim(), ''].join('\n')
// FUERA de `public/`: es un intermedio para publicar, no algo que la app
// tenga que servir. Adentro se colaba al `dist` en cada build.
const destino = join(tmpdir(), `${nombre}.artifact.html`)
writeFileSync(destino, salida)
console.log(`✓ ${destino}`)
console.log(`  ${salida.length} bytes · título «${tituloCorto}»`)

/** Cámara simulada: pasa fotogramas por el reconocedor real contra el índice publicado. */
import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { db } from '../src/services/db/index.ts'
import { reconocerPorArte } from '../src/services/cardScanner.ts'
import { hashDeImagen, buscarPorArte, cargarIndice } from '../src/services/cardHash.ts'

Object.defineProperty(globalThis, 'document', { value: { createElement: () => createCanvas(1, 1) } })
const bytes = await readFile(new URL('../public/card-hashes.bin', import.meta.url))
globalThis.fetch = async () => new Response(bytes)
const fixtureDir = new URL('./fixtures/escaner/', import.meta.url)
const cartas = JSON.parse(await readFile(new URL('cartas.json', fixtureDir), 'utf8'))
await db.cards.bulkPut(cartas)
const indice = (await cargarIndice())!
let bien = 0
const fallos: string[] = []
const tiempos: number[] = []
for (const carta of cartas) {
  const img = await loadImage(new URL(carta.imagen, fixtureDir).pathname)
  // Sanidad del fixture: el índice de referencia identifica la imagen completa.
  const referencia = createCanvas(img.width, img.height)
  referencia.getContext('2d').drawImage(img, 0, 0)
  const directo = buscarPorArte(hashDeImagen(referencia, { x: 0, y: 0, w: img.width, h: img.height }), indice)
  assert.equal(directo?.mejor.id, carta.id, 'Fixture e índice no coinciden')
  assert.equal((await reconocerPorArte(referencia, img.width, img.height, 'foto'))?.card.id, carta.id, 'Foto recortada se reconoce sin OCR')
  for (const [ancho, alto] of [[1280, 720], [640, 480], [720, 1280], [1080, 1920]]) {
    // Una carta física conserva proporción aunque el móvil cambie de orientación.
    const proporcion = ['Leader', 'Base'].includes(carta.type) ? 400 / 286 : 286 / 400
    const h = Math.min(alto * .80, ancho * .84 / proporcion)
    const w = h * proporcion
    const marco = { x: (ancho - w) / 2, y: (alto - h) / 2, w, h }
    for (const ajuste of [{ nombre: 'centrada', escala: 1, dx: 0 },
      { nombre: '3% menor', escala: .97, dx: 0 },
      { nombre: '3% mayor', escala: 1.03, dx: 0 },
      { nombre: '2% desplazada', escala: 1, dx: .02 }]) {
    const foto = createCanvas(ancho, alto)
    const ctx = foto.getContext('2d')
    ctx.fillStyle = '#484544'; ctx.fillRect(0, 0, ancho, alto)
    ctx.drawImage(img, marco.x + marco.w * ((1-ajuste.escala)/2 + ajuste.dx),
      marco.y + marco.h * (1-ajuste.escala)/2, marco.w*ajuste.escala, marco.h*ajuste.escala)
    const inicio = performance.now()
    const leido = await reconocerPorArte(foto, ancho, alto)
    tiempos.push(performance.now() - inicio)
    if (leido?.card.id === carta.id) bien++
    else fallos.push(`${carta.type} ${ancho}x${alto} ${ajuste.nombre}: ${leido?.card.name ?? 'no reconoce'}`)
    }
  }
}
for (const [ancho, alto] of [[1280, 720], [720, 1280]]) {
  const vacio = createCanvas(ancho, alto)
  const ctx = vacio.getContext('2d'); ctx.fillStyle = '#484544'; ctx.fillRect(0, 0, ancho, alto)
  assert.equal(await reconocerPorArte(vacio, ancho, alto), null, 'No identificar una mesa vacía')
}
await db.delete()
console.log(`${bien}/80 cartas encuadradas reconocidas; mediana ${tiempos.sort((a,b)=>a-b)[40].toFixed(1)} ms (ordenador, fotogramas simulados).`)
console.log(fallos.join('\n'))
assert.equal(fallos.length, 0, 'Al colocar la carta dentro de un marco físico debe reconocerla por imagen sin OCR')

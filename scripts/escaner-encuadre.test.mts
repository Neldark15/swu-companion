import assert from 'node:assert/strict'
import { marcosDeCamara, bandaDelMarco } from '../src/services/encuadreEscaner.ts'
import { buscarPorArte, BYTES_HASH } from '../src/services/cardHash.ts'
for (const [w,h] of [[1920,1080],[1280,720],[640,480],[390,844],[720,1280]]) {
  const marcos = marcosDeCamara(w,h)
  for (let i=0;i<marcos.length;i++) {
    const m=marcos[i], ratio=i===0?286/400:400/286
    assert.ok(Math.abs(m.w*w/(m.h*h)-ratio)<1e-10)
    const pie=bandaDelMarco(m)
    assert.ok(pie.x>=m.x && pie.x+pie.w<=m.x+m.w && pie.y>=m.y && pie.y+pie.h<=m.y+m.h)
  }
}
assert.deepEqual(marcosDeCamara(0,720), [])
// Dos artes diferentes a igual distancia NO equivalen a ilustración repetida.
const a=new Uint8Array(BYTES_HASH); a[0]=1
const b=new Uint8Array(BYTES_HASH); b[0]=2
const hashes=new Uint8Array(BYTES_HASH*2); hashes.set(a); hashes.set(b,BYTES_HASH)
assert.equal(buscarPorArte(new Uint8Array(BYTES_HASH), {ids:['a','b'],hashes})?.confiable,false)
// Dos impresiones del MISMO hash sí pueden proponerse como alternativas.
hashes.set(a,BYTES_HASH)
assert.equal(buscarPorArte(a,{ids:['a','b'],hashes})?.confiable,true)
console.log('✓ Encuadre físico, franja del pie y ambigüedad entre ilustraciones')

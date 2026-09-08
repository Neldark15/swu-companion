import assert from 'node:assert/strict'
import { FOV_KYBER, INCLINACION_CAMARA, medirEncuadreKyber } from '../src/features/sable/encuadreKyber.ts'

// Proyectar puntos reales de un cilindro, en lugar de repetir la fórmula de fit.
const tan = Math.tan(FOV_KYBER * Math.PI / 360)
const cos = Math.cos(INCLINACION_CAMARA), sin = Math.sin(INCLINACION_CAMARA)
for (const aspecto of [360 / 300, 390 / 420, 344 / 290, 1.9]) {
  for (const punta of [13, 22.2, 93]) {
    for (let a = 0; a <= Math.PI * 2; a += 0.17) {
      for (let b = -1.5; b <= 1.5; b += 0.3) {
        const eje = { x: Math.sin(a) * Math.cos(b), y: Math.cos(a) * Math.cos(b), z: Math.sin(b) }
        const fondo = -13, radio = 5
        const fit = medirEncuadreKyber({ fondo, punta, radio, aspecto, eje })
        assert.ok(Number.isFinite(fit.distancia))
        // Una base perpendicular al eje para recorrer ambas tapas.
        const u = { x: Math.cos(a), y: -Math.sin(a), z: 0 }
        const v = { x: eje.y * u.z - eje.z * u.y, y: eje.z * u.x - eje.x * u.z, z: eje.x * u.y - eje.y * u.x }
        for (const extremo of [fondo, punta]) {
          for (let t = 0; t < Math.PI * 2; t += 0.31) {
            const along = extremo - fit.medio
            const x = eje.x * along + radio * (u.x * Math.cos(t) + v.x * Math.sin(t))
            const y = eje.y * along + radio * (u.y * Math.cos(t) + v.y * Math.sin(t))
            const z = eje.z * along + radio * (u.z * Math.cos(t) + v.z * Math.sin(t))
            const camY = y * cos - z * sin
            const profundidad = fit.distancia - (y * sin + z * cos)
            assert.ok(profundidad > 2, 'Todos los extremos quedan delante del plano cercano')
            assert.ok(Math.abs(x / (profundidad * tan * aspecto)) < 1, 'No recorta ancho')
            assert.ok(Math.abs(camY / (profundidad * tan)) < 1, 'No recorta altura')
          }
        }
      }
    }
  }
}
const base = { fondo: -13, radio: 3, aspecto: 390 / 420, eje: { x: 0, y: 1, z: 0 } }
assert.ok(medirEncuadreKyber({ ...base, punta: 17 }).distancia < medirEncuadreKyber({ ...base, punta: 93 }).distancia * 0.5, 'Detalle conserva un mango apreciable con la hoja encendida')
console.log('Encuadre Kyber: extremos visibles en móvil/escritorio, rotaciones y despiece; detalle amplía el mango.')

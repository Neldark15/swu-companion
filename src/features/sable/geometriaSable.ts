import * as THREE from 'three'
import { alturaLibreBoca, perfilConCavidad, recorteBoca } from './extremosSable'
import { perfilValido, type PiezaSuelta, type Punto } from './partesSable'

/** Una repetición de la superficie equivale a dos unidades del mango. */
export const ESCALA_SUPERFICIE = 2

/** Microbiseles de mecanizado. No altera el catálogo ni las medidas de asiento. */
function biselarPerfil(puntos: Punto[]): THREE.Vector2[] {
  const limpios = puntos.filter((p, i) => i === 0
    || p[0] !== puntos[i - 1][0] || p[1] !== puntos[i - 1][1])
  const salida: THREE.Vector2[] = []
  for (let i = 0; i < limpios.length; i++) {
    const p = new THREE.Vector2(...limpios[i])
    if (i === 0 || i === limpios.length - 1 || p.x === 0) {
      salida.push(p)
      continue
    }
    const antes = new THREE.Vector2(...limpios[i - 1]).sub(p)
    const despues = new THREE.Vector2(...limpios[i + 1]).sub(p)
    const largoAntes = antes.length(), largoDespues = despues.length()
    // No subdividir líneas rectas ni crear un bisel mayor que una ranura fina.
    if (antes.dot(despues) / (largoAntes * largoDespues) < -0.995) {
      salida.push(p)
      continue
    }
    const bisel = Math.min(0.055, largoAntes * 0.2, largoDespues * 0.2)
    const entrada = p.clone().addScaledVector(antes, bisel / largoAntes)
    const fin = p.clone().addScaledVector(despues, bisel / largoDespues)
    salida.push(entrada, entrada.clone().lerp(p, 0.5).lerp(fin.clone().lerp(p, 0.5), 0.5), fin)
  }
  return salida
}

/**
 * Torneado compartido por visor y miniatura. El propietario libera la geometría.
 * V recorre la distancia sobre el metal; insertar puntos o biseles no estira la
 * textura. U usa el perímetro medio y un número entero de repeticiones para que
 * la unión de 360° no deje una costura. Ningún estado global retiene GPU.
 */
export function crearGeometriaPieza(pieza: PiezaSuelta, segmentos = 96): THREE.LatheGeometry {
  if (!Number.isInteger(segmentos) || segmentos < 8 || segmentos > 192) {
    throw new RangeError('El torneado necesita de 8 a 192 segmentos enteros.')
  }
  if (pieza.puntos.length < 2 || pieza.puntos.some(p => !p.every(Number.isFinite))
    || perfilValido(pieza.puntos).length) {
    throw new RangeError('El perfil del sable no es dibujable.')
  }
  const puntos = biselarPerfil(perfilConCavidad(pieza))
  const distancias = [0]
  let radioPonderado = 0, alto = 0
  for (let i = 1; i < puntos.length; i++) {
    const dy = puntos[i].y - puntos[i - 1].y
    distancias.push(distancias[i - 1] + puntos[i].distanceTo(puntos[i - 1]))
    radioPonderado += (puntos[i].x + puntos[i - 1].x) * 0.5 * dy
    alto += dy
  }
  if (alto <= 0 || distancias.at(-1)! <= 0) throw new RangeError('La pieza necesita altura.')
  const vueltas = Math.max(1, Math.round((2 * Math.PI * radioPonderado) / (alto * ESCALA_SUPERFICIE)))
  const geometria = new THREE.LatheGeometry(puntos, segmentos)
  const uv = geometria.getAttribute('uv')
  for (let i = 0; i <= segmentos; i++) {
    for (let j = 0; j < puntos.length; j++) {
      uv.setXY(i * puntos.length + j, (i / segmentos) * vueltas, distancias[j] / ESCALA_SUPERFICIE)
    }
  }
  if (pieza.clave === 'emisor') {
    const posicion = geometria.getAttribute('position')
    const normal = geometria.getAttribute('normal')
    const n = new THREE.Vector3()
    const libre = alturaLibreBoca(pieza)
    const escala = libre / 1.18
    for (let i = 0; i <= segmentos; i++) {
      const angulo = 2 * Math.PI * i / segmentos
      const rebaje = escala * recorteBoca(pieza.id, angulo)
      const pendiente = escala * (recorteBoca(pieza.id, angulo + .001) - recorteBoca(pieza.id, angulo - .001)) / .002
      for (let j = 0; j < puntos.length; j++) {
        const { x: radio, y } = puntos[j]
        const peso = libre > 0 ? Math.max(0, (y - pieza.alto + libre) / libre) : 0
        if (!peso || !radio) continue
        const k = i * puntos.length + j
        posicion.setY(k, y - peso * rebaje)
        // Normal inversa-transpuesta del recorte: conserva el brillo continuo
        // en la costura de 360° y también en la pared interior de la boca.
        n.fromBufferAttribute(normal, k)
        n.y /= 1 - rebaje / libre
        const giro = n.y * peso * pendiente / radio
        n.x += giro * Math.cos(angulo)
        n.z -= giro * Math.sin(angulo)
        n.normalize()
        normal.setXYZ(k, n.x, n.y, n.z)
      }
    }
  }
  uv.needsUpdate = true
  return geometria
}

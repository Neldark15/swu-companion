import * as THREE from 'three'
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
  const puntos = biselarPerfil(pieza.puntos)
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
  uv.needsUpdate = true
  return geometria
}

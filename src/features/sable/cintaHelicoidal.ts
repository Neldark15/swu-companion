import * as THREE from 'three'
import { radioEn, type CintaHelicoidal, type PiezaSuelta } from './partesSable'

type Cable = { y: number; giro?: number; grosor: number; cinta: CintaHelicoidal }

/** La cinta sigue el radio de la pieza en cada vuelta. Las dos orillas se
 * hunden ligeramente en el cuerpo y el lomo abombado recoge la luz al girar. */
export function crearCintaHelicoidal(pieza: PiezaSuelta, cable: Cable, detalle: boolean): THREE.BufferGeometry {
  const cinta = cable.cinta
  const centro = cable.y * pieza.alto
  const pasos = Math.ceil(Math.abs(cinta.vueltas) * (detalle ? 40 : 22))
  const seccion = [[-0.5, -0.28], [-0.43, 0.48], [-0.29, 0.92], [0, 1], [0.3, 0.86], [0.46, 0.35], [0.5, -0.28]]
  const posiciones: number[] = [], uv: number[] = [], caras: number[] = []

  for (let paso = 0; paso <= pasos; paso++) {
    const t = paso / pasos
    const angulo = (cable.giro ?? 0) + 2 * Math.PI * cinta.vueltas * t
    const y = (t - 0.5) * cinta.alto
    // En los dos extremos la cinta termina embutida bajo el casquillo.
    const remate = Math.min(1, t * pasos / 3, (1 - t) * pasos / 3)
    // El par trenzado alterna qué tira pasa por encima en cada cruce.
    const cruce = cinta.trenzada ? 0.65 * Math.cos(angulo) * Math.sign(cinta.vueltas) : 0
    for (const [ancho, lomo] of seccion) {
      const yLocal = y + ancho * cinta.ancho
      const relieve = cable.grosor * (remate * (lomo + cruce) - (1 - remate) * 0.35)
      const r = radioEn(pieza.perfil, centro + yLocal) + relieve
      posiciones.push(Math.sin(angulo) * r, yLocal, Math.cos(angulo) * r)
      uv.push(t * Math.abs(cinta.vueltas) * 5, (ancho + 0.5) * cinta.ancho / 2)
    }
  }

  for (let paso = 0; paso < pasos; paso++) {
    for (let j = 0; j < seccion.length - 1; j++) {
      const a = paso * seccion.length + j
      const b = a + seccion.length
      if (cinta.vueltas > 0) caras.push(a, b, a + 1, a + 1, b, b + 1)
      else caras.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }
  const geometria = new THREE.BufferGeometry()
  geometria.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3))
  geometria.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometria.setIndex(caras)
  geometria.computeVertexNormals()
  return geometria
}

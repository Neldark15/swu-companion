import * as THREE from 'three'
import { PROFUNDIDAD_IRIS_GEMELO } from './extremosSable'
import type { MaterialId, PiezaSuelta } from './partesSable'

/** Radio envolvente de los apliques que rompen la simetría del perfil torneado. */
export function radioApliqueCuerpo(id: string): number {
  switch (id) {
    case 'cue_reliquia': return 2.93
    case 'cue_senda': return 4.62
    case 'pom_cometa': return 3.86
    case 'pom_contrapeso': return 2.54
    default: return 0
  }
}

type Poner = (material: MaterialId, geometria: THREE.BufferGeometry) => void

/** Relieve plano con ambos cantos biselados. La forma se dibuja de perfil. */
function chapa(forma: THREE.Shape, espesor: number, bisel: number, detalle: boolean) {
  return new THREE.ExtrudeGeometry(forma, {
    depth: espesor, curveSegments: detalle ? 12 : 6, bevelEnabled: true,
    bevelSegments: detalle ? 2 : 1, bevelSize: bisel, bevelThickness: bisel,
  }).translate(0, 0, -espesor / 2)
}

function facetas(perfil: [number, number][], lados: number) {
  const torno = new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), lados)
  const planas = torno.toNonIndexed()
  torno.dispose()
  planas.computeVertexNormals()
  return planas
}

export function crearApliquesCuerpo(pieza: PiezaSuelta, detalle: boolean, poner: Poner): void {
  const { id, alto } = pieza
  if (id === 'cue_reliquia') {
    const nervio = new THREE.Shape()
    nervio.moveTo(1.54, .60)
    nervio.bezierCurveTo(2.01, 1.08, 2.28, 2.02, 2.77, 3.18)
    nervio.quadraticCurveTo(2.93, 3.74, 2.69, 4.67)
    nervio.bezierCurveTo(2.27, 6.12, 2.18, 7.69, 2.47, 8.84)
    nervio.quadraticCurveTo(2.70, 9.73, 1.79, alto - .6)
    nervio.lineTo(1.42, alto - .64)
    nervio.bezierCurveTo(2.14, 9.39, 1.98, 9.20, 1.97, 8.57)
    nervio.bezierCurveTo(1.85, 6.32, 2.28, 4.75, 2.35, 3.9)
    nervio.bezierCurveTo(2.48, 3.03, 1.87, 2.11, 1.46, .95)
    nervio.closePath()
    for (let i = 0; i < 5; i++) {
      poner('laton', chapa(nervio, .22, .045, detalle).rotateY(i * Math.PI * 2 / 5 + .38))
    }
    const centro = alto / 2
    poner('brasa', facetas([[.47, centro - 2.45], [1.35, centro - .52],
      [1.23, centro + .72], [.48, centro + 2.34]], 7).rotateY(.2))
    poner('cobre', facetas([[.58, centro - 2.8], [.98, centro - 2.49], [.84, centro - 1.48], [.65, centro - 1.32]], 7))
    poner('cobre', facetas([[.71, centro + 1.36], [.91, centro + 1.63], [.90, centro + 2.19],
      [.59, centro + 2.54]], 7))
  } else if (id === 'cue_senda') {
    // La guarda forma una hoja abierta en un solo costado. Su nervadura
    // nace del hombro superior y se reúne con el borde en la mitad inferior.
    const hoja = new THREE.Shape()
    hoja.moveTo(1.19, 1.03)
    hoja.bezierCurveTo(2.22, 1.25, 3.67, 2.04, 4.23, 4.03)
    hoja.bezierCurveTo(4.94, 6.94, 4.23, 10.14, 1.56, alto - .77)
    hoja.lineTo(1.26, alto - 1.72)
    hoja.bezierCurveTo(3.36, 8.99, 3.96, 6.33, 3.70, 4.56)
    hoja.bezierCurveTo(3.49, 2.99, 2.41, 2.12, 1.19, 1.82)
    hoja.closePath()
    const giro = Math.PI - .48
    poner('hueso', chapa(hoja, .62, .10, detalle).rotateY(giro))
    const vena = new THREE.Shape()
    vena.moveTo(3.78, 4.07)
    vena.bezierCurveTo(3.60, 7.29, 2.34, 9.23, 1.48, 9.89)
    vena.lineTo(1.58, 10.29)
    vena.bezierCurveTo(2.92, 9.49, 3.70, 7.78, 4.02, 5.30)
    vena.closePath()
    poner('bronce', chapa(vena, .24, .04, detalle).rotateY(giro))
  } else if (id === 'pom_cometa') {
    // La aleta lateral encierra un hueco en torno al pequeño núcleo central.
    const cola = new THREE.Shape()
    cola.moveTo(.93, alto * .56)
    cola.bezierCurveTo(1.69, 2.64, 3.05, 1.07, 3.78, .16)
    cola.bezierCurveTo(3.14, 2.72, 2.36, 3.68, 1.57, alto * .80)
    cola.lineTo(1.38, alto * .74)
    cola.bezierCurveTo(2.23, 3.12, 2.76, 2.32, 3.04, 1.56)
    cola.quadraticCurveTo(2.01, 2.72, 1.03, 3.14)
    cola.closePath()
    poner('cobre', chapa(cola, .43, .065, detalle).rotateY(.34))
  } else if (id === 'pom_contrapeso') {
    // Los ocho planos conservan sus normales por cara para que cada uno
    // recoja una franja distinta de la iluminación al girar la pieza.
    const giro = Math.PI / 8
    poner('bronce', facetas([[1.10, .16], [1.39, .26], [2.51, 1.26], [2.51, 2.76],
      [1.34, 3.90], [1.16, 4.04]], 8).rotateY(giro))
    poner('negro', facetas([[2.49, 1.81], [2.535, 1.87], [2.535, 2.13], [2.49, 2.18]], 8).rotateY(giro))
  } else if (id === 'pom_gemelo') {
    const r = pieza.perfil[1][0]
    // El labio apunta a -Y: el punto de arranque de la hoja queda dentro de esta boca.
    poner('luz', facetas([[r * .58, .105], [r * .60, .079], [r * .72, .079], [r * .75, .11]], 48))
    poner('negro', facetas([[0, PROFUNDIDAD_IRIS_GEMELO], [r * .56, PROFUNDIDAD_IRIS_GEMELO],
      [r * .58, .105]], 48))
  }
}

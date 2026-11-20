import * as THREE from 'three'
import type { MaterialId } from './partesSable'

type Agregar = (material: MaterialId, geometria: THREE.BufferGeometry) => void

// Radio exterior de cada silueta, incluyendo la parte iluminada. Las pruebas
// de encuadre comprueban este límite contra los vértices de la malla completa.
export const RADIO_SILUETA_EMISOR: Readonly<Partial<Record<string, number>>> = {
  emi_cruceta: 6.5, emi_orbita: 4.9, emi_lira: 4.45, emi_prisma: 3.28,
}

// Las cuatro siluetas miran a la cámara de la vitrina al abrir el visor.
const VISTA = .72

function cruceta(poner: Agregar) {
  for (const lado of [-1, 1]) {
    // Mangas escalonadas, terminal con facetas y breve rastro del cristal.
    const brazo = (material: MaterialId, radios: [number, number][], caras = 20) => {
      const perfil = radios.map(([radio, x]) => new THREE.Vector2(radio, x))
      const geo = new THREE.LatheGeometry(perfil, caras)
      geo.rotateZ(lado * -1.43).translate(0, 2.65, 0).rotateY(VISTA)
      poner(material, geo)
    }
    brazo('grafito', [[0, 1.20], [.94, 1.20], [.94, 1.86], [.74, 2.05],
      [.74, 3.60], [.49, 3.9], [0, 3.9]], 10)
    brazo('acero', [[.71, 2.15], [.8, 2.25], [.8, 2.54], [.71, 2.66]], 10)
    brazo('laton', [[.69, 3.24], [.83, 3.36], [.83, 3.66], [.59, 3.82], [.37, 3.82]], 10)
    brazo('plasma', [[.41, 3.70], [.42, 4.19], [.24, 5.77], [0, 6.43]], 12)
  }
}

function orbita(poner: Agregar, detalle: boolean) {
  // La órbita no es una arandela de revolución. Se levanta desde el collar
  // inferior y deja libre un cuadrante a la derecha del núcleo.
  const montura = (geo: THREE.BufferGeometry) => geo.rotateZ(-.16).rotateY(VISTA)
    .translate(.44, 4.12, 0)
  const punto = (a: number) => new THREE.Vector3(3.95 * Math.cos(a), 3.16 * Math.sin(a), .27 * Math.cos(a))
  const inicio = .55, fin = Math.PI * 2 - .30
  const arco = (a: number, b: number, radio: number, material: MaterialId, z: number) => {
    const pasos = detalle ? 48 : 24
    const puntos = Array.from({ length: pasos + 1 }, (_, i) => {
      const p = punto(a + (b - a) * i / pasos)
      p.z += z
      return p
    })
    poner(material, montura(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(puntos),
      pasos, radio, detalle ? 10 : 6, false)))
    for (const extremo of [puntos[0], puntos[pasos]]) {
      poner(material, montura(new THREE.SphereGeometry(radio, 10, 6)
        .translate(extremo.x, extremo.y, extremo.z)))
    }
  }
  arco(inicio, fin, .33, 'laton', 0)
  arco(inicio + .14, fin - .14, .095, 'plasma', .31)
  for (const a of [inicio, fin]) {
    const p = punto(a)
    poner('acero', montura(new THREE.IcosahedronGeometry(.46, 0).translate(p.x, p.y, p.z)))
  }
}

function lira(poner: Agregar, detalle: boolean) {
  // Las dos costillas se ensanchan desde el collar, retroceden y vuelven
  // hacia el eje. El espacio abierto deja ver la aguja central al girar.
  const ala = new THREE.Shape()
  ala.moveTo(1.18, 1.35)
  ala.bezierCurveTo(2.48, 1.65, 4.06, 2.92, 4.17, 4.76)
  ala.bezierCurveTo(4.32, 6.45, 3.19, 7.88, 2.04, 8.65)
  ala.bezierCurveTo(2.54, 7.28, 3.16, 5.87, 2.99, 4.78)
  ala.bezierCurveTo(2.79, 3.55, 1.95, 3.07, 1.12, 2.74)
  ala.closePath()
  for (const lado of [-1, 1]) {
    const angulo = VISTA + (lado < 0 ? Math.PI : 0)
    const costilla = new THREE.ExtrudeGeometry(ala, {depth: .6, curveSegments: detalle ? 12 : 6,
      bevelEnabled: true, bevelThickness: .10, bevelSize: .09, bevelSegments: 1})
    poner('laton', costilla.translate(0, 0, -.30).rotateY(angulo))
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.50, 2.10, .41), new THREE.Vector3(2.83, 3.05, .41),
      new THREE.Vector3(3.58, 4.71, .41), new THREE.Vector3(3.43, 6.14, .41),
      new THREE.Vector3(2.78, 7.55, .41),
    ])
    for (const frente of [-1, 1]) {
      const ribete = new THREE.TubeGeometry(curva, detalle ? 24 : 12, .07, 6, false)
      poner('plasma', ribete.translate(0, 0, frente < 0 ? -.82 : 0).rotateY(angulo))
    }
  }
}

function prisma(poner: Agregar) {
  // Un hexágono incluye seis caras planas que quiebran el reflejo al rotar.
  // Cada pétalo tiene una cintura ancha y un pico descentrado.
  for (let i = 0; i < 6; i++) {
    const angulo = VISTA + i * Math.PI / 3
    const vertices = [
      [-.49, 1.88, 1.24], [.49, 1.88, 1.24], [.93, 3.47, 2.45],
      [.52, 4.36, 2.91], [.19, i % 2 ? 6.13 : 6.76, 2.51],
      [-.57, 4.75, 2.61], [-.87, 3.56, 2.40],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z))
    const posiciones: number[] = []
    const uv: number[] = []
    const triangulo = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
      for (const p of [a, b, c]) {
        posiciones.push(p.x, p.y, p.z)
        uv.push(p.x * .5 + .5, p.y / 2)
      }
    }
    const cresta = new THREE.Vector3(.06, 4.07, 3.21)
    const dorso = new THREE.Vector3(0, 3.72, 1.76)
    for (let k = 0; k < vertices.length; k++) {
      const a = vertices[k], b = vertices[(k + 1) % vertices.length]
      triangulo(a, b, cresta)
      triangulo(b, a, dorso)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.computeVertexNormals()
    poner(i % 2 ? 'acero' : 'hueso', g.rotateY(angulo))
    const vena = new THREE.LineCurve3(new THREE.Vector3(.06, 4.07, 3.235),
      new THREE.Vector3(.18, i % 2 ? 6.02 : 6.65, 2.57))
    poner('luz', new THREE.TubeGeometry(vena, 1, .043, 5, false).rotateY(angulo))
  }
}

export function crearSiluetaEmisor(id: string, detalle: boolean, poner: Agregar) {
  switch (id) {
    case 'emi_cruceta': cruceta(poner); break
    case 'emi_orbita': orbita(poner, detalle); break
    case 'emi_lira': lira(poner, detalle); break
    case 'emi_prisma': prisma(poner); break
  }
}

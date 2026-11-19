import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PROFUNDIDAD_IRIS } from './extremosSable'
import { asientoDe, radioEn, type MaterialId, type PiezaSuelta } from './partesSable'

export interface AcabadoMecanizado {
  geometria: THREE.BufferGeometry
  material: MaterialId
}

/** Todas las piezas se entregan en coordenadas de su sección. Las matrices
 * quedan horneadas por material una sola vez, también para los tornillos y
 * para las dos paredes de cada ranura. */
export function unirGeometrias(geometrias: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const planas = geometrias.map(g => g.index ? g.toNonIndexed() : g)
  const resultado = mergeGeometries(planas, false)
  for (const g of new Set([...geometrias, ...planas])) g.dispose()
  if (!resultado) throw new Error('No se pudieron unir los detalles del sable.')
  return resultado
}

function torno(puntos: readonly (readonly [number, number])[], segmentos = 32) {
  return new THREE.LatheGeometry(puntos.map(([r, y]) => new THREE.Vector2(r, y)), segmentos)
}

function ranura(ancho: number, alto: number, x = 0, y = 0) {
  const camino = new THREE.Shape()
  const a = ancho / 2, h = alto / 2, bisel = Math.min(a * .48, h * .45)
  const esquinas = [[-a + bisel, -h], [a - bisel, -h], [a, -h + bisel], [a, h - bisel],
    [a - bisel, h], [-a + bisel, h], [-a, h - bisel], [-a, -h + bisel]]
  esquinas.forEach(([px, py], i) => { if (i === 0) camino.moveTo(px + x, py + y); else camino.lineTo(px + x, py + y) })
  camino.closePath()
  return camino
}

export function crearDetallesPieza(pieza: PiezaSuelta, detalle: boolean): AcabadoMecanizado[] {
  const grupos = new Map<MaterialId, THREE.BufferGeometry[]>()
  const poner = (material: MaterialId, geometria: THREE.BufferGeometry) => {
    const grupo = grupos.get(material)
    if (grupo) grupo.push(geometria)
    else grupos.set(material, [geometria])
  }
  const { alto, perfil, id } = pieza
  if (pieza.clave === 'emisor') {
    const r = perfil.at(-1)![0]
    // Un iris hundido entre dos paredes: el filo de cobre rodea un aislante
    // oscuro con escalones, visible al mirar dentro de la boca inclinada.
    poner('negro', torno([[r * .87, alto - 1.25], [r * .86, alto - .77], [r * .80, alto - .68],
      [r * .58, alto - .68], [r * .54, alto - .74], [r * .53, alto - PROFUNDIDAD_IRIS], [0, alto - PROFUNDIDAD_IRIS]]))
    poner('cobre', torno([[r * .72, alto - .69], [r * .72, alto - .64], [r * .60, alto - .64], [r * .58, alto - .69]]))
  }

  if (pieza.clave === 'pomo' && detalle) {
    // En la vista desarmada se ve el reverso del pomo. Tres contactos y
    // una guía hexagonal quedan bajo el labio, sin atravesar la pieza vecina.
    const radio = perfil.at(-1)![0] * .68
    const placa = new THREE.Shape()
    placa.absarc(0, 0, radio, 0, Math.PI * 2, false)
    for (let i = 0; i < 3; i++) {
      const a = i * 2 * Math.PI / 3
      const x = Math.sin(a) * radio * .67, z = Math.cos(a) * radio * .67
      const orificio = new THREE.Path()
      orificio.absarc(x, -z, radio * .18, 0, Math.PI * 2, true)
      placa.holes.push(orificio)
      poner('laton', new THREE.CylinderGeometry(radio * .14, radio * .15, .045, 16)
        .translate(x, alto - .13, z))
    }
    const disco = new THREE.ExtrudeGeometry(placa, { depth: .05, bevelEnabled: false, curveSegments: 10 })
    poner('negro', disco.rotateX(-Math.PI / 2).translate(0, alto - .14, 0))
    poner('acero', torno([[radio * .32, alto - .10], [radio * .31, alto - .055],
      [radio * .23, alto - .045], [radio * .20, alto - .10]], 6))
  }

  if (pieza.clave === 'pomo' && perfil[1][1] === 0 && detalle) {
    // La placa inferior tiene perforaciones reales que enseñan el fondo de
    // la cavidad. Se conserva el extremo macizo de los pomos en punta.
    const r = perfil[1][0] * .715
    const placa = new THREE.Shape()
    placa.absarc(0, 0, r, 0, Math.PI * 2, false)
    for (const y of [-.50, -.25, 0, .25, .50]) {
      placa.holes.push(ranura(r * (1.55 - Math.abs(y) * .55), r * .115, 0, y * r))
    }
    const rejilla = new THREE.ExtrudeGeometry(placa, { depth: .055, bevelEnabled: false, curveSegments: 20 })
    poner('acero', rejilla.rotateX(Math.PI / 2).translate(0, .14, 0))
    poner('negro', new THREE.CylinderGeometry(r, r, .04, 36).translate(0, .21, 0))
  }

  // Las piezas con jaula o gemas ya tienen una familia de detalles a esta
  // escala. En las lisas, una corona de paneles calados rompe la simetría.
  const paneles: Record<string, [number, number, number, number]> = {
    emi_estandar: [.44, .90, .69, 6], emi_campo: [.58, .96, .58, 4],
    emi_doble: [.44, .72, .64, 5], emi_disco: [.62, .85, .58, 6],
    pom_plano: [.65, 1.25, .70, 7], pom_disco: [.64, .80, .64, 8],
    pom_conico: [.65, .55, .52, 5], pom_taza: [.29, .66, .64, 6],
    pom_punta: [.37, .74, .38, 4],
  }
  const config = paneles[id]
  if (config && detalle) {
    const [fraccion, altura, ancho, numero] = config
    const centro = alto * fraccion
    const marco = ranura(ancho, altura)
    marco.holes.push(ranura(ancho * .57, altura * .74))
    const engaste = new THREE.ExtrudeGeometry(marco, {depth: .09, bevelEnabled: true,
      bevelSize: .017, bevelThickness: .016, bevelSegments: 1, curveSegments: 1})
    const fondo = new THREE.ShapeGeometry(ranura(ancho * .94, altura * .94))
    for (let i = 0; i < numero; i++) {
      const angulo = i * Math.PI * 2 / numero
      for (const [g, mat, salida] of [[engaste, 'acero', .017], [fondo, 'negro', .05]] as const) {
        const copia = g.clone()
        const posiciones = copia.getAttribute('position')
        for (let k = 0; k < posiciones.count; k++) {
          const y = centro + posiciones.getY(k)
          const radio = radioEn(perfil, y)
          const a = angulo + posiciones.getX(k) / radio
          const r = radio + salida + posiciones.getZ(k)
          posiciones.setXYZ(k, Math.sin(a) * r, y, Math.cos(a) * r)
        }
        copia.computeVertexNormals()
        poner(mat, copia)
      }
    }
    engaste.dispose(); fondo.dispose()
  }

  if (pieza.clave === 'cuerpo' && detalle) {
    for (const h of pieza.herrajes) {
      if (h.tipo !== 'caja') continue
      const radio = asientoDe(perfil, h, alto).fuera
      const fijar = (g: THREE.BufferGeometry, material: MaterialId) =>
        poner(material, g.translate(0, h.y * alto, radio).rotateY(h.giro ?? 0))
      // Contactos de latón sobre la caja y pernos hexagonales en las cuatro
      // esquinas. El centro se deja libre para el botón de activación.
      for (let i = 0; i < 4; i++) {
        fijar(new THREE.BoxGeometry(h.ancho * .52, h.alto * .035, .045)
          .translate(0, h.alto * (.19 + i * .052), .018), 'laton')
      }
      for (const x of [-1, 1]) for (const y of [-1, 1]) {
        fijar(new THREE.CylinderGeometry(h.ancho * .072, h.ancho * .085, .045, 6)
          .rotateX(Math.PI / 2).translate(x * h.ancho * .36, y * h.alto * .39, .017), 'acero')
      }
    }
  }
  return Array.from(grupos, ([material, geometrias]) => ({ material, geometria: unirGeometrias(geometrias) }))
}

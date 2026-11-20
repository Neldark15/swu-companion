/** npx tsx scripts/kyber-geometria.test.mts — sin DOM ni contexto WebGL. */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { crearGeometriaPieza, ESCALA_SUPERFICIE } from '../src/features/sable/geometriaSable.ts'
import { abrirTallerTres, radioMaximo, vestirPieza } from '../src/features/sable/herrajesTres.ts'
import {
  piezasDeSable, IDS_CONOCIDOS, MATERIALES, POR_DEFECTO,
  type MaterialId, type PiezaSuelta,
} from '../src/features/sable/partesSable.ts'
import { datosDeSuperficie, type SuperficieSable } from '../src/features/sable/texturasSable.ts'

function finita(g: THREE.BufferGeometry): void {
  for (const nombre of ['position', 'normal', 'uv']) {
    const atributo = g.getAttribute(nombre)
    assert(atributo, `${g.type} no tiene ${nombre}`)
    assert(Array.from(atributo.array).every(Number.isFinite), `${g.type}.${nombre} tiene NaN/Infinity`)
  }
  g.computeBoundingBox()
  assert(g.boundingBox && !g.boundingBox.isEmpty())
}

const revisadas = new Map<string, number>()
let combinaciones = 0, maxTriangulos = 0
for (const emisor of IDS_CONOCIDOS.emisor) {
  for (const cuerpo of IDS_CONOCIDOS.cuerpo) {
    for (const pomo of IDS_CONOCIDOS.pomo) {
      let triangulos = 0
      for (const pieza of piezasDeSable({ emisor, cuerpo, pomo, color: 'col_azul' })) {
        const clave = JSON.stringify(pieza.puntos)
        if (!revisadas.has(clave)) {
          const original = JSON.stringify(pieza)
          for (const segmentos of [48, 96]) {
            const g = crearGeometriaPieza(pieza, segmentos)
            finita(g)
            assert.equal(g.parameters.segments, segmentos)
            const puntos = g.parameters.points, uv = g.getAttribute('uv')
            for (let j = 1; j < puntos.length; j++) {
              const distancia = puntos[j].distanceTo(puntos[j - 1]) / ESCALA_SUPERFICIE
              assert(Math.abs(uv.getY(j) - uv.getY(j - 1) - distancia) < 2e-6,
                'La textura debe recorrer distancia, no número de vértices')
              if (puntos[j].y < puntos[j - 1].y) {
                const cavidad = pieza.clave === 'emisor' ? puntos[j].y >= pieza.alto - 1.301
                  : pieza.clave === 'pomo' && (puntos[j - 1].y <= .241 || puntos[j].y >= pieza.alto - .181)
                assert(cavidad, 'Solo las paredes internas de las cavidades invierten el perfil')
              }
            }
            const final = segmentos * puntos.length
            assert.equal(uv.getX(final) % 1, 0, 'La costura debe cerrar en una repetición entera')
            assert(Math.abs(g.boundingBox!.min.y) < 1e-6)
            assert(Math.abs(g.boundingBox!.max.y - pieza.alto) < 1e-5)
            if (segmentos === 96) revisadas.set(clave, g.index!.count / 3)
            g.dispose()
          }
          assert.equal(JSON.stringify(pieza), original, 'El render no debe mutar el catálogo')
        }
        triangulos += revisadas.get(clave)!
      }
      maxTriangulos = Math.max(maxTriangulos, triangulos)
      combinaciones++
    }
  }
}
assert.equal(combinaciones, IDS_CONOCIDOS.emisor.length * IDS_CONOCIDOS.cuerpo.length * IDS_CONOCIDOS.pomo.length)
assert(revisadas.size > 0)
assert(maxTriangulos < 80000, 'El microbisel excede el presupuesto geométrico del mango')
const base = piezasDeSable(POR_DEFECTO)[0]
assert.throws(() => crearGeometriaPieza({ ...base, puntos: [[0, 0], [1, NaN], [0, 2]] }), RangeError)
assert.throws(() => crearGeometriaPieza(base, 0), RangeError)
console.log(`✓ ${combinaciones} combinaciones; ${revisadas.size} perfiles con UV físicos en 48 y 96 segmentos; máximo ${maxTriangulos} triángulos`)

const superficies: SuperficieSable[] = ['cepillado', 'moleteado', 'cuero', 'anodizado']
const huellas: string[] = []
for (const tipo of superficies) {
  const a = datosDeSuperficie(tipo), b = datosDeSuperficie(tipo)
  assert.deepEqual(a, b, `${tipo} debe ser determinista`)
  const valores = a.rugosidad.filter((_, i) => i % 4 === 1)
  assert(Math.min(...valores) >= 200 && Math.max(...valores) <= 255,
    'La rugosidad no debe multiplicar acero por valores cercanos a cero y volverlo cromo')
  huellas.push(Buffer.from(a.relieve).toString('base64'))
}
assert.equal(new Set(huellas).size, superficies.length, 'Cuero, agarre y metal necesitan superficies distintas')

const taller = abrirTallerTres(true)
const materiales = new Set<THREE.Material>(), texturas = new Set<THREE.Texture>(), geometrias = new Set<THREE.BufferGeometry>()
taller.alumbrar('#31dcff') // La miniatura fija el color antes de crear los materiales.
for (const id of Object.keys(MATERIALES) as MaterialId[]) {
  const m = taller.material(id)
  assert.equal(taller.material(id), m, 'Cambiar la pieza debe reutilizar el material')
  materiales.add(m)
  if (m.bumpMap) texturas.add(m.bumpMap)
  if (m.roughnessMap) texturas.add(m.roughnessMap)
}
assert.equal(taller.material('plasma').emissive.getHexString(), '31dcff')
assert.equal(taller.material('luz').emissive.getHexString(), '31dcff')
assert.equal(texturas.size, 8, 'Como máximo cuatro pares de mapas 128² compartidos')
assert.notEqual(taller.material('cuero').bumpMap, taller.material('grafito').bumpMap)
assert.equal(taller.material('acero').roughnessMap, taller.material('laton').roughnessMap)

// La cara baja del visor inclinado de Faro debe seguir unida a su aro.
const faro = piezasDeSable({ ...POR_DEFECTO, emisor: 'emi_faro' })[2]
const faro3D = crearGeometriaPieza(faro)
const aroAlto = faro.herrajes.filter(h => h.tipo === 'anillo').at(-1)!
const yAro = aroAlto.y * faro.alto + aroAlto.grosor
const verticesFaro = faro3D.getAttribute('position')
const perfilFaro = faro3D.parameters.points
for (let k = 0; k < verticesFaro.count; k++) {
  const original = perfilFaro[k % perfilFaro.length]
  if (original.y <= yAro) assert(Math.abs(verticesFaro.getY(k) - original.y) < 1e-5,
    'El recorte del visor no puede cortar la camisa bajo el aro')
}
faro3D.dispose()

let maxMallas = 0
const presupuestos = new Map<string, number>()
function vestir(pieza: PiezaSuelta): void {
  const geo = crearGeometriaPieza(pieza)
  const malla = new THREE.Mesh(geo)
  const vacio = malla.material
  vestirPieza(malla, pieza, taller)
  vacio.dispose()
  const gruposFijos = malla.children.filter(h => h.userData.fase === undefined) as THREE.Mesh[]
  assert.equal(new Set(gruposFijos.map(m => m.material)).size, gruposFijos.length,
    'Los detalles estáticos de cada material se dibujan juntos')
  maxMallas = Math.max(maxMallas, malla.children.length)
  const originales = malla.children.map(m => (m as THREE.Mesh).geometry)
  vestirPieza(malla, pieza, taller)
  malla.children.forEach((m, i) => {
    const g = (m as THREE.Mesh).geometry
    assert.equal(g, originales[i], 'Cambiar acabados no debe reconstruir herrajes')
    finita(g)
    geometrias.add(g)
  })
  if (!presupuestos.has(pieza.id)) {
    const radio = radioMaximo([pieza])
    const v = new THREE.Vector3()
    malla.updateMatrixWorld()
    let triangulos = 0
    malla.traverse(objeto => {
      if (!(objeto instanceof THREE.Mesh)) return
      const g = objeto.geometry as THREE.BufferGeometry
      const posiciones = g.getAttribute('position')
      triangulos += (g.index?.count ?? posiciones.count) / 3
      for (let i = 0; i < posiciones.count; i++) {
        v.fromBufferAttribute(posiciones, i).applyMatrix4(objeto.matrixWorld)
        assert(Math.hypot(v.x, v.z) <= radio + 1e-5 && v.y >= -1e-5 && v.y <= pieza.alto + 1e-5,
          `${pieza.id}: los herrajes deben caber en el encuadre del visor`)
      }
    })
    presupuestos.set(pieza.id, triangulos)
  }
  geo.dispose()
}
for (const tipo of ['emisor', 'cuerpo', 'pomo'] as const) {
  for (const id of IDS_CONOCIDOS[tipo]) {
    for (const pieza of piezasDeSable({ ...POR_DEFECTO, [tipo]: id, cristalVisto: true })) vestir(pieza)
  }
}
assert(maxMallas <= 10, 'La ventana no puede añadir más draw calls que el conjunto anterior')
const peorMango = (['pomo', 'cuerpo', 'emisor'] as const).reduce((total, tipo) =>
  total + Math.max(...IDS_CONOCIDOS[tipo].map(id => presupuestos.get(id)!)), 0)
assert(peorMango < 80000, `Mango con herrajes y cámara sobre presupuesto: ${peorMango}`)
console.log(`✓ Máximo ${peorMango} triángulos en el mango completo; todos los herrajes dentro del encuadre`)
const recursos = [...materiales, ...texturas, ...geometrias]
const liberados = new Map<object, number>()
for (const recurso of recursos) recurso.addEventListener('dispose', () => liberados.set(recurso, (liberados.get(recurso) ?? 0) + 1))
taller.soltar()
taller.soltar()
for (const recurso of recursos) assert.equal(liberados.get(recurso), 1, 'Cada recurso GPU se libera una sola vez')

const miniatura = abrirTallerTres(false)
for (const id of Object.keys(MATERIALES) as MaterialId[]) {
  const m = miniatura.material(id)
  assert.equal(m.bumpMap, null)
  assert.equal(m.roughnessMap, null)
}
for (const pieza of piezasDeSable({ ...POR_DEFECTO, emisor: 'emi_faro', cuerpo: 'cue_placas' })) {
  if (pieza.clave === 'pomo') continue
  const geometria = crearGeometriaPieza(pieza, 48)
  const malla = new THREE.Mesh(geometria)
  const vacio = malla.material
  vestirPieza(malla, pieza, miniatura, 8)
  vacio.dispose()
  const superficie = miniatura.material(pieza.clave === 'emisor' ? 'negro' : 'grafito')
  const insertos = malla.children.filter(h => (h as THREE.Mesh).material === superficie)
  assert(insertos.length >= 4, 'La miniatura debe conservar los insertos anchos aunque sobresalgan poco')
  geometria.dispose()
}
miniatura.soltar()
console.log(`✓ Superficies distintas y deterministas; miniatura sin texturas; ${recursos.length} recursos cacheados y liberados una vez`)
console.log(`✓ Cámara integrada en los ${IDS_CONOCIDOS.cuerpo.length} cuerpos; máximo ${maxMallas} mallas de herraje con la cámara activa`)

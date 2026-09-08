import * as THREE from 'three'

/** Reflectores de estudio: se hornean una vez, no hay luces/sombras por panel. */
export function crearEntornoKyber(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const estudio = new THREE.Scene()
  estudio.background = new THREE.Color('#10151c')
  const plano = new THREE.PlaneGeometry(1, 1)
  const materiales: THREE.MeshBasicMaterial[] = []

  function reflector(color: number, intensidad: number, ancho: number, alto: number, posicion: THREE.Vector3) {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensidad),
      side: THREE.DoubleSide,
    })
    materiales.push(material)
    const panel = new THREE.Mesh(plano, material)
    panel.scale.set(ancho, alto, 1)
    panel.position.copy(posicion)
    panel.lookAt(0, 0, 0)
    estudio.add(panel)
  }

  // Una caja grande y tiras estrechas hacen legibles metal cepillado y biseles.
  reflector(0xf4f7ff, 4.0, 7, 15, new THREE.Vector3(-7, 3, 7))
  reflector(0xddeaff, 3.2, 2.0, 18, new THREE.Vector3(8, 0, 3))
  reflector(0xffdfa6, 2.0, 3, 12, new THREE.Vector3(-4, 2, -8))
  reflector(0xffffff, 2.0, 7, 5, new THREE.Vector3(0, 10, 0))
  reflector(0xc3cbd8, 0.5, 6, 12, new THREE.Vector3(1, -3, -9))

  const pmrem = new THREE.PMREMGenerator(renderer)
  try {
    return pmrem.fromScene(estudio, 0.035, 0.1, 60)
  } finally {
    pmrem.dispose()
    plano.dispose()
    materiales.forEach(m => m.dispose())
    estudio.clear()
  }
}

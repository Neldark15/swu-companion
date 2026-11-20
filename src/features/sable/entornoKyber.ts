import * as THREE from 'three'

/** Reflectores de estudio: se hornean una vez, no hay luces/sombras por panel. */
export function crearEntornoKyber(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const estudio = new THREE.Scene()
  estudio.background = new THREE.Color('#202932')
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

  // Los paneles anchos dibujan el volumen. Las tiras más estrechas se
  // reflejan en labios, roscas y biseles al girar las piezas en primer plano.
  reflector(0xf5f3eb, 3.1, 8.5, 16, new THREE.Vector3(-7, 5, 8))
  reflector(0xd8ebff, 2.6, 2.8, 18, new THREE.Vector3(8, 1, 4))
  reflector(0xeaf5ff, 3.4, 0.7, 13, new THREE.Vector3(7, 0, 6))
  reflector(0xffcb8a, 2.5, 3.4, 14, new THREE.Vector3(-5, 0, -7))
  reflector(0xfff3df, 2.1, 8, 6, new THREE.Vector3(0, 10, 0))
  reflector(0x9ab0c4, 0.8, 11, 10, new THREE.Vector3(2, -6, -9))
  reflector(0xb6c3c9, 0.45, 9, 4, new THREE.Vector3(0, -8, 3))

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

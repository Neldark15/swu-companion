/**
 * Renderiza el MANGO del sable a un PNG — para la barra de XP.
 *
 * Nel, viendo su perfil: «esta barra podría ser la empuñadura que uno hace en
 * el Taller Kyber, que sea personalizable y no esa que parece dibujo — que se
 * vea 3D». La barra dibujaba una empuñadura genérica en SVG plano; esto
 * renderiza LA TUYA — las mismas piezas, los mismos materiales PBR y el mismo
 * entorno que la escena del taller — una sola vez, a una imagen.
 *
 * ── Por qué una FOTO y no una escena viva ─────────────────────────────
 *
 * La barra vive en el Home, que es la pantalla que más tiene que volar en gama
 * baja (§2s), y Chrome corta a ~16 contextos WebGL vivos. Un renderizador que
 * nace, dibuja UN cuadro, entrega el PNG y muere (`forceContextLoss`) cuesta
 * unas decenas de ms una vez por diseño; una escena viva costaría un contexto
 * permanente por un adorno de 72×22. El PNG queda en localStorage
 * (`mangoBarra.ts`) y las visitas siguientes no tocan WebGL.
 *
 * Sin texturas de moleteado ni vetas: a 22 px de alto son ruido subpixel. El
 * volumen lo dan el entorno reflejado y el tallado real de las piezas.
 */

import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { piezasDeSable, type Diseno } from './partesSable'

/** `null` si este navegador no puede dibujar en 3D: la barra usa su SVG. */
export function renderizarMango(d: Diseno, anchoPx = 216, altoPx = 66): string | null {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
  } catch {
    return null
  }
  const basura: { dispose(): void }[] = []
  try {
    renderer.setSize(anchoPx, altoPx, false)
    // El mismo revelado que la escena grande: sin ACES el metal PBR satura a
    // blanco y el mango de la barra no se parecería al del taller.
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = envRT.texture
    pmrem.dispose()
    basura.push(envRT)

    scene.add(new THREE.AmbientLight(0x44506a, 0.5))
    const focoCalido = new THREE.DirectionalLight(0xffc27a, 1.9)
    focoCalido.position.set(7, 9, 7)
    const focoFrio = new THREE.DirectionalLight(0x8fb4ff, 0.7)
    focoFrio.position.set(-8, -3, 5)
    scene.add(focoCalido, focoFrio)
    basura.push(focoCalido, focoFrio)

    // La roughness fija reemplaza al mapa de vetas de la escena grande: a este
    // tamaño el promedio del mapa ES el material.
    const matAcero = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.92, roughness: 0.4 })
    const matAgarre = new THREE.MeshStandardMaterial({ color: 0x23252b, metalness: 0.2, roughness: 0.82 })
    const matLaton = new THREE.MeshStandardMaterial({ color: 0xd29a4a, metalness: 0.95, roughness: 0.34 })
    const geoAro = new THREE.TorusGeometry(1.78, 0.13, 8, 40)
    basura.push(matAcero, matAgarre, matLaton, geoAro)

    const sueltas = piezasDeSable(d)
    const altoTotal = sueltas.reduce((s, p) => s + p.alto, 0)
    const grupo = new THREE.Group()
    sueltas.forEach((sp, i) => {
      // 48 segmentos y no 96: a 22 px nadie distingue la diferencia.
      const geo = new THREE.LatheGeometry(sp.puntos.map(([r, y]) => new THREE.Vector2(r, y)), 48)
      basura.push(geo)
      const malla = new THREE.Mesh(geo, i === 1 ? matAgarre : matAcero)
      malla.position.y = -altoTotal / 2 + sp.base
      const aro = new THREE.Mesh(geoAro, matLaton)
      aro.rotation.x = Math.PI / 2
      aro.position.y = sp.alto * (i === 1 ? 0.5 : 0.28)
      malla.add(aro)
      grupo.add(malla)
    })
    /* Acostado con el EMISOR a la DERECHA —de ahí sale la hoja de la barra— y
       apenas cabeceado: de perfil perfecto un torneado parece una silueta
       plana, que es justo lo que se está reemplazando. */
    grupo.quaternion.setFromEuler(new THREE.Euler(0.14, 0, -Math.PI / 2))
    scene.add(grupo)

    // Encuadre medido, no supuesto (la lección de la escena grande): el largo
    // del mango decide la distancia; el FOV estrecho evita deformar los extremos.
    const camera = new THREE.PerspectiveCamera(26, anchoPx / altoPx, 0.5, 200)
    const tanH = Math.tan(THREE.MathUtils.degToRad(13)) * (anchoPx / altoPx)
    const dist = ((altoTotal / 2 + 1.6) / tanH) * 1.04
    camera.position.set(0, dist * 0.22, dist)
    camera.lookAt(0, 0, 0)

    renderer.render(scene, camera)
    // `toDataURL` en la MISMA tarea que el render: después de un vuelto al
    // navegador el búfer WebGL ya no garantiza contenido.
    return renderer.domElement.toDataURL('image/png')
  } catch {
    return null
  } finally {
    for (const b of basura) b.dispose()
    renderer.dispose()
    // Sin esto el contexto sigue contando contra el tope de ~16 de Chrome (§2s).
    renderer.forceContextLoss()
  }
}

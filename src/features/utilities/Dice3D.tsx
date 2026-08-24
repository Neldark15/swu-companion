/**
 * Dice3D — dados de verdad, en tres dimensiones.
 *
 * ── Por qué el resultado NO sale de la física ─────────────────────────
 *
 * El número lo decide `Math.random()` ANTES de animar, y la animación se
 * encarga de terminar mostrando esa cara. Podría hacerse al revés —simular y
 * leer qué quedó arriba— pero entonces el resultado dependería del motor: un
 * dado que se traba contra otro, un fotograma perdido o un móvil lento
 * cambiarían la tirada. Así el azar es el mismo de siempre y el 3D es lo que
 * es: la forma de mostrarlo.
 *
 * ── Sin archivos externos ─────────────────────────────────────────────
 *
 * Las seis caras se dibujan con canvas al montar. No hay texturas que bajar,
 * nada que se rompa sin conexión y ningún arte ajeno.
 */

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Rotación que deja cada valor mirando a la cámara, en radianes.
 *
 * Sale de la geometría, no de probar: con las caras repartidas +X=5, −X=2,
 * +Y=3, −Y=4, +Z=1, −Z=6, girar θ sobre Y lleva la normal (−1,0,0) a
 * (−cos θ, 0, sen θ); para que apunte a la cámara (0,0,1) hace falta θ=+π/2.
 * Tenerlo al revés es lo que hacía que el dado dijera 2 y mostrara 5.
 */
const CARA_ARRIBA: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [0, Math.PI / 2, 0],
  3: [Math.PI / 2, 0, 0],
  4: [-Math.PI / 2, 0, 0],
  5: [0, -Math.PI / 2, 0],
  6: [0, Math.PI, 0],
}

/** Posición de los puntos por valor, en una rejilla de 3×3. */
const PUNTOS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
}

/** Dibuja una cara. El 1 va en ámbar, como el punto rojo de un dado real. */
function caraTextura(valor: number): THREE.Texture {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const x = c.getContext('2d')!

  const fondo = x.createLinearGradient(0, 0, S, S)
  fondo.addColorStop(0, '#2a2a3c')
  fondo.addColorStop(1, '#1e1e2e')
  x.fillStyle = fondo
  x.fillRect(0, 0, S, S)

  x.strokeStyle = 'rgba(34,211,238,0.35)'
  x.lineWidth = 6
  x.strokeRect(10, 10, S - 20, S - 20)

  const r = S * 0.075
  for (const [cx, cy] of PUNTOS[valor]) {
    const px = S * 0.25 + cx * S * 0.25
    const py = S * 0.25 + cy * S * 0.25
    x.beginPath()
    x.arc(px, py, r, 0, Math.PI * 2)
    x.fillStyle = valor === 1 ? '#F59E0B' : '#E2E8F0'
    x.fill()
    // Un brillo arriba a la izquierda: sin él los puntos se ven planos.
    x.beginPath()
    x.arc(px - r * 0.3, py - r * 0.3, r * 0.32, 0, Math.PI * 2)
    x.fillStyle = 'rgba(255,255,255,0.35)'
    x.fill()
  }

  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 4
  return t
}

interface Dado {
  malla: THREE.Mesh
  giroInicial: THREE.Euler
  giroFinal: THREE.Euler
  /** Vueltas completas extra, para que se vea que rueda y no que se acomoda. */
  vueltas: THREE.Vector3
  altura: number
  desfase: number
}

interface Props {
  /** Valores ya sorteados. Cambiar el array dispara una tirada nueva. */
  valores: number[]
  /** Identifica la tirada: dos tiradas con los mismos valores deben animarse. */
  tirada: number
  className?: string
}

const DURACION = 1500

export function Dice3D({ valores, tirada, className = '' }: Props) {
  const cajaRef = useRef<HTMLDivElement>(null)
  const escenaRef = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    dados: Dado[]
    materiales: THREE.Material[]
    inicio: number
    raf: number
  } | null>(null)

  // ── Montaje ──
  useEffect(() => {
    const caja = cajaRef.current
    if (!caja) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(0, 0, 9)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    // Se limita a 2: por encima el móvil calienta sin que se note la mejora.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.style.display = 'block'
    caja.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 1.1))
    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(4, 6, 7)
    scene.add(key)
    const relleno = new THREE.DirectionalLight(0x22d3ee, 0.9)
    relleno.position.set(-5, -2, 3)
    scene.add(relleno)

    // Un material por cara, en el orden que espera BoxGeometry:
    // +X, -X, +Y, -Y, +Z, -Z. Con CARA_ARRIBA en [0,0,0] mira el +Z, que es
    // la quinta ranura: por eso el 1 va ahí.
    const orden = [5, 2, 3, 4, 1, 6]
    const materiales = orden.map(v => new THREE.MeshStandardMaterial({
      map: caraTextura(v), roughness: 0.45, metalness: 0.12,
    }))

    const estado = { renderer, scene, camera, dados: [] as Dado[], materiales, inicio: 0, raf: 0 }
    escenaRef.current = estado

    const ajustar = () => {
      const w = caja.clientWidth
      const h = caja.clientHeight || Math.round(w * 0.5)
      if (w === 0) return
      // `setSize(w, h)` y NO `(w, h, false)`: con `false` Three ajusta el búfer
      // de dibujo pero deja el CSS del lienzo sin tocar, así que con
      // devicePixelRatio 2 el canvas se mostraba al doble de tamaño y los
      // dados quedaban fuera de la caja, cortados abajo a la derecha.
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    ajustar()
    const ro = new ResizeObserver(ajustar)
    ro.observe(caja)

    const animar = () => {
      const e = escenaRef.current
      if (!e) return
      e.raf = requestAnimationFrame(animar)
      const t = e.inicio ? Math.min(1, (performance.now() - e.inicio) / DURACION) : 1
      // Salida rápida y frenada suave: es como cae un dado de verdad.
      const suave = 1 - Math.pow(1 - t, 3)

      for (const d of e.dados) {
        d.malla.rotation.set(
          d.giroInicial.x + (d.giroFinal.x + d.vueltas.x * Math.PI * 2 - d.giroInicial.x) * suave,
          d.giroInicial.y + (d.giroFinal.y + d.vueltas.y * Math.PI * 2 - d.giroInicial.y) * suave,
          d.giroInicial.z + (d.giroFinal.z + d.vueltas.z * Math.PI * 2 - d.giroInicial.z) * suave,
        )
        // Un salto que se apaga: da peso sin necesidad de simular nada.
        const rebote = Math.abs(Math.sin(t * Math.PI * 2 + d.desfase)) * (1 - t) * d.altura
        d.malla.position.y = rebote
      }
      e.renderer.render(e.scene, e.camera)
    }
    animar()

    return () => {
      ro.disconnect()
      cancelAnimationFrame(estado.raf)
      escenaRef.current = null
      // WebGL no se libera solo: sin esto, entrar y salir de Utilidades
      // deja contextos vivos hasta que el navegador los corta.
      for (const d of estado.dados) d.malla.geometry.dispose()
      for (const m of materiales) {
        const mm = m as THREE.MeshStandardMaterial
        mm.map?.dispose()
        mm.dispose()
      }
      renderer.dispose()
      // `dispose()` suelta los recursos PERO NO el contexto: el contexto se
      // libera cuando el navegador quiere, y hasta entonces cuenta contra el
      // tope (~16 en Chrome). Este panel vive dentro de `{dado.abierto && …}`
      // en ContadorPage, así que fugaba UNO POR CADA abrir/cerrar, no por
      // visita — y al llegar al tope Chrome mata los MÁS VIEJOS, que es como
      // la Galaxia terminaba diciendo «este navegador no puede dibujar en 3D».
      // Era el único de los cuatro renderers del repo sin esta línea.
      //
      // Acá va después de `dispose()` y sin más cuidado porque este archivo NO
      // engancha `webglcontextlost`; donde sí lo hay (§2s) tiene que ir DESPUÉS
      // de quitar el listener, o la pérdida provocada dispara el fallback.
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [])

  // ── Cada tirada ──
  useEffect(() => {
    const e = escenaRef.current
    if (!e || valores.length === 0) return

    for (const d of e.dados) {
      e.scene.remove(d.malla)
      d.malla.geometry.dispose()
    }
    e.dados = []

    const n = valores.length
    const paso = 1.9
    const ancho = (n - 1) * paso

    // La cámara se aleja lo JUSTO para que entre la fila, calculado con el
    // campo de visión horizontal real. Con una fórmula fija los dados quedaban
    // diminutos en un recuadro medio vacío, y en pantallas angostas encima se
    // salían de cuadro.
    const medioAlto = Math.tan((38 * Math.PI) / 180 / 2)
    const medioAncho = medioAlto * e.camera.aspect
    const necesarioX = (ancho + 2.2) / 2
    const necesarioY = 1.4
    e.camera.position.z = Math.max(necesarioX / medioAncho, necesarioY / medioAlto)

    valores.forEach((v, i) => {
      const geo = new THREE.BoxGeometry(1.5, 1.5, 1.5)
      const malla = new THREE.Mesh(geo, e.materiales)
      malla.position.x = -ancho / 2 + i * paso

      const [fx, fy, fz] = CARA_ARRIBA[v] ?? [0, 0, 0]
      // Una pizca de inclinación: un dado perfectamente de frente parece
      // un dibujo, no un objeto.
      const ladeo = 0.12
      e.dados.push({
        malla,
        giroInicial: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        giroFinal: new THREE.Euler(
          fx + (Math.random() - 0.5) * ladeo,
          fy + (Math.random() - 0.5) * ladeo,
          fz + (Math.random() - 0.5) * ladeo,
        ),
        vueltas: new THREE.Vector3(
          1 + Math.floor(Math.random() * 2),
          2 + Math.floor(Math.random() * 2),
          1 + Math.floor(Math.random() * 2),
        ),
        altura: 0.45 + Math.random() * 0.35,
        desfase: Math.random() * Math.PI,
      })
      e.scene.add(malla)
    })

    e.inicio = performance.now()
  }, [valores, tirada])

  return (
    <div
      ref={cajaRef}
      className={`w-full ${className}`}
      role="img"
      aria-label={valores.length ? `Dados: ${valores.join(', ')}` : 'Dados'}
    />
  )
}

/**
 * Coin3D — la moneda, girando de verdad.
 *
 * Mismo criterio que los dados: el resultado lo decide `Math.random()` ANTES
 * de animar y el giro termina mostrando esa cara. Si el resultado saliera de
 * la simulación, un móvil lento o un fotograma perdido podrían cambiarlo.
 *
 * Las dos caras se dibujan con canvas al montar: sin archivos que bajar y sin
 * arte ajeno.
 */

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export type Lado = 'cara' | 'cruz'

/** Dibuja una cara de la moneda: aro, leyenda y un símbolo simple. */
function caraTextura(lado: Lado): THREE.Texture {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const x = c.getContext('2d')!
  const m = S / 2

  const g = x.createRadialGradient(m * 0.7, m * 0.7, S * 0.05, m, m, m)
  g.addColorStop(0, lado === 'cara' ? '#FCD34D' : '#94A3B8')
  g.addColorStop(1, lado === 'cara' ? '#B45309' : '#475569')
  x.fillStyle = g
  x.fillRect(0, 0, S, S)

  x.strokeStyle = 'rgba(0,0,0,0.35)'
  x.lineWidth = 8
  x.beginPath()
  x.arc(m, m, m * 0.82, 0, Math.PI * 2)
  x.stroke()

  x.fillStyle = 'rgba(0,0,0,0.55)'
  x.textAlign = 'center'
  x.textBaseline = 'middle'

  if (lado === 'cara') {
    // Un hexágono, el mismo motivo que usa la app en la barra inferior.
    x.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2
      const px = m + Math.cos(a) * m * 0.4
      const py = m + Math.sin(a) * m * 0.4
      if (i === 0) x.moveTo(px, py)
      else x.lineTo(px, py)
    }
    x.closePath()
    x.lineWidth = 12
    x.strokeStyle = 'rgba(0,0,0,0.55)'
    x.stroke()
  } else {
    x.font = `bold ${Math.round(S * 0.34)}px Arial, sans-serif`
    x.fillText('✦', m, m + S * 0.02)
  }

  x.font = `bold ${Math.round(S * 0.11)}px Arial, sans-serif`
  x.fillText(lado === 'cara' ? 'CARA' : 'CRUZ', m, m + m * 0.62)

  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 4
  return t
}

interface Props {
  /** Lado ya sorteado. `null` = todavía no se lanzó. */
  lado: Lado | null
  /** Cambia en cada lanzamiento, para que repetir el mismo lado igual anime. */
  lanzamiento: number
  className?: string
}

const DURACION = 1400

export function Coin3D({ lado, lanzamiento, className = '' }: Props) {
  const cajaRef = useRef<HTMLDivElement>(null)
  const ref = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    moneda: THREE.Mesh
    desde: number
    hasta: number
    inicio: number
    raf: number
  } | null>(null)

  useEffect(() => {
    const caja = cajaRef.current
    if (!caja) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.set(0, 0, 5.2)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.style.display = 'block'
    caja.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 1.2))
    const key = new THREE.DirectionalLight(0xffffff, 2.4)
    key.position.set(3, 5, 6)
    scene.add(key)
    const relleno = new THREE.DirectionalLight(0xf59e0b, 0.8)
    relleno.position.set(-4, -2, 3)
    scene.add(relleno)

    const canto = new THREE.MeshStandardMaterial({ color: 0x8a6d1f, roughness: 0.5, metalness: 0.6 })
    const texCara = caraTextura('cara')
    const texCruz = caraTextura('cruz')
    // CylinderGeometry ordena sus materiales [lado, tapa superior, tapa inferior].
    const mats = [
      canto,
      new THREE.MeshStandardMaterial({ map: texCara, roughness: 0.35, metalness: 0.45 }),
      new THREE.MeshStandardMaterial({ map: texCruz, roughness: 0.35, metalness: 0.45 }),
    ]
    const geo = new THREE.CylinderGeometry(1.35, 1.35, 0.16, 56)
    const moneda = new THREE.Mesh(geo, mats)
    // El cilindro nace con su eje en Y; girándolo −90° en X, la tapa superior
    // («cara») queda mirando a la cámara. Desde ahí, lanzar es girar en X.
    moneda.rotation.x = -Math.PI / 2
    scene.add(moneda)

    const estado = { renderer, scene, camera, moneda, desde: -Math.PI / 2, hasta: -Math.PI / 2, inicio: 0, raf: 0 }
    ref.current = estado

    const ajustar = () => {
      const w = caja.clientWidth
      const h = caja.clientHeight || Math.round(w * 0.6)
      if (w === 0) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    ajustar()
    const ro = new ResizeObserver(ajustar)
    ro.observe(caja)

    const animar = () => {
      const e = ref.current
      if (!e) return
      e.raf = requestAnimationFrame(animar)
      const t = e.inicio ? Math.min(1, (performance.now() - e.inicio) / DURACION) : 1
      const suave = 1 - Math.pow(1 - t, 3)
      e.moneda.rotation.x = e.desde + (e.hasta - e.desde) * suave
      // Sube y baja: sin el arco parece un disco girando, no una moneda
      // lanzada al aire.
      e.moneda.position.y = Math.sin(t * Math.PI) * 1.1 * (e.inicio ? 1 : 0)
      e.moneda.rotation.z = Math.sin(t * Math.PI * 2) * 0.12
      e.renderer.render(e.scene, e.camera)
    }
    animar()

    return () => {
      ro.disconnect()
      cancelAnimationFrame(estado.raf)
      ref.current = null
      geo.dispose()
      texCara.dispose()
      texCruz.dispose()
      for (const m of mats) m.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  useEffect(() => {
    const e = ref.current
    if (!e || !lado) return
    // «Cara» mira a la cámara a −90°; «cruz», a +90°. Se suman vueltas enteras
    // para que se vea girar y no acomodarse.
    const destino = lado === 'cara' ? -Math.PI / 2 : Math.PI / 2
    const vueltas = 3 + Math.floor(Math.random() * 2)
    e.desde = e.moneda.rotation.x
    e.hasta = destino + vueltas * Math.PI * 2
    e.inicio = performance.now()
  }, [lado, lanzamiento])

  return (
    <div
      ref={cajaRef}
      className={`w-full ${className}`}
      role="img"
      aria-label={lado ? `Moneda: ${lado}` : 'Moneda'}
    />
  )
}

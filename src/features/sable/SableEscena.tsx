/**
 * El sable en 3D. three PELADO, siguiendo el patrón del §2s.
 *
 * ── Un mango, UNA geometría ───────────────────────────────────────────
 *
 * Todo el mango es una sola `LatheGeometry` girada de un perfil de puntos
 * (`partesSable.ts`). No son tres mallas apiladas, y eso importa por dos cosas:
 * una sola llamada de dibujo, y ninguna costura visible entre pomo, cuerpo y
 * emisor — que es justo lo que delata un mango hecho de pedazos.
 *
 * ── Metal con Phong y no con Standard, a propósito ────────────────────
 *
 * `MeshStandardMaterial` necesita un mapa de entorno para que el metal se vea
 * metal; sin él, `metalness` alto sale casi negro, y generar el entorno
 * (`PMREMGenerator`) es exactamente el tipo de coste que el §2s manda evitar en
 * un teléfono. `MeshPhongMaterial` con brillo especular da el reflejo con las
 * luces que ya hay y cuesta una fracción.
 *
 * ── La hoja son DOS cápsulas, y el color va en el HALO ────────────────
 *
 * Una hoja de sable es luz: el núcleo es casi blanco y lo que tiñe es el
 * resplandor de alrededor. Pintar el núcleo del color da un tubo de plástico.
 * El halo va con mezcla aditiva y `depthWrite: false` — si escribiera
 * profundidad, taparía al núcleo que tiene dentro.
 *
 * ── Lo que el §2s obliga y acá está ───────────────────────────────────
 *
 * · `forceContextLoss()` en la limpieza, DESPUÉS de quitar el listener de
 *   `webglcontextlost`. Al revés, la pérdida provocada dispara el fallback y la
 *   pantalla dice «este navegador no puede dibujar en 3D» para siempre.
 * · `setPixelRatio(Math.min(devicePixelRatio, 2))`.
 * · rAF pausado con `document.hidden` Y con `IntersectionObserver`.
 * · Todo se libera: geometrías, materiales, luces y el renderer.
 */

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { perfilDeSable, colorDeHoja, type Diseno } from './partesSable'

interface Props {
  diseno: Diseno
  /** Enciende la hoja. Apagada solo se ve el mango, que es lo que se arma. */
  encendido: boolean
  onSinWebGL?: () => void
  className?: string
}

export function SableEscena({ diseno, encendido, onSinWebGL, className = '' }: Props) {
  const cajaRef = useRef<HTMLDivElement>(null)
  const alFallarRef = useRef(onSinWebGL)
  /** El mando: la escena no se reconstruye al cambiar de pieza (§3y). */
  const mandoRef = useRef<{
    rehacer: (d: Diseno) => void
    encender: (v: boolean) => void
  } | null>(null)

  useEffect(() => { alFallarRef.current = onSinWebGL })

  // ── Montaje: UNA sola vez. Las piezas entran por el mando. ──
  useEffect(() => {
    const caja = cajaRef.current
    if (!caja) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: dpr < 2, powerPreference: 'low-power' })
    } catch {
      alFallarRef.current?.()
      return
    }
    renderer.setPixelRatio(dpr)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    // Sin esto el navegador se queda el arrastre para desplazar la página y el
    // sable no gira. `pan-y` deja pasar el scroll vertical.
    renderer.domElement.style.touchAction = 'pan-y'
    caja.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400)

    // ── Luces: tres, y ninguna de más ──
    // Un ambiente frío para que el lado oscuro del metal se lea, y dos focos
    // cruzados que son los que dan el filo especular. Con una sola luz el mango
    // parece un dibujo plano.
    scene.add(new THREE.AmbientLight(0x8899bb, 1.1))
    const foco1 = new THREE.DirectionalLight(0xffffff, 2.1); foco1.position.set(6, 10, 8)
    const foco2 = new THREE.DirectionalLight(0x99bbff, 1.0); foco2.position.set(-7, -4, 5)
    scene.add(foco1, foco2)

    // ── El mango ──
    const matMango = new THREE.MeshPhongMaterial({
      color: 0x9aa3ad, specular: 0xffffff, shininess: 88, flatShading: false,
    })
    const matDetalle = new THREE.MeshPhongMaterial({
      color: 0x2b2f36, specular: 0x666666, shininess: 40,
    })
    let geoMango: THREE.LatheGeometry | null = null
    const mango = new THREE.Mesh(new THREE.BufferGeometry(), matMango)
    scene.add(mango)

    // Un aro oscuro en el cuerpo: rompe el gris y da escala. Geometría fija.
    const geoAro = new THREE.TorusGeometry(1.16, 0.1, 8, 36)
    const aro = new THREE.Mesh(geoAro, matDetalle)
    aro.rotation.x = Math.PI / 2
    scene.add(aro)

    // ── La hoja: cápsulas, para que la punta salga redonda sola ──
    const LARGO = 78
    const geoNucleo = new THREE.CapsuleGeometry(0.42, LARGO, 4, 12)
    const geoHalo = new THREE.CapsuleGeometry(0.92, LARGO, 4, 12)
    const matNucleo = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const matHalo = new THREE.MeshBasicMaterial({
      color: 0x2b8cff, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending,
      // Sin esto el halo escribe profundidad y tapa el núcleo que lleva dentro.
      depthWrite: false,
    })
    const nucleo = new THREE.Mesh(geoNucleo, matNucleo)
    const halo = new THREE.Mesh(geoHalo, matHalo)
    halo.renderOrder = 1
    scene.add(nucleo, halo)

    function rehacer(d: Diseno): void {
      const { puntos, alto } = perfilDeSable(d)
      const vec = puntos.map(([r, y]) => new THREE.Vector2(r, y))
      const nueva = new THREE.LatheGeometry(vec, 48)
      // La vieja se libera SIEMPRE: cada cambio de pieza crea una geometría, y
      // sin esto armar un sable probando piezas fuga una por toque.
      geoMango?.dispose()
      geoMango = nueva
      mango.geometry = nueva

      // El mango se centra en su propio alto para que gire sobre su medio.
      mango.position.y = -alto / 2
      aro.position.y = -alto / 2 + alto * 0.42

      const c = colorDeHoja(d.color)
      matHalo.color.set(c.halo)
      matNucleo.color.set(c.nucleo)

      // La hoja arranca en la boca del emisor, no en el centro del mango.
      const base = alto / 2
      nucleo.position.y = base + LARGO / 2
      halo.position.y = base + LARGO / 2
      pedirCuadro()
    }

    function encender(v: boolean): void {
      nucleo.visible = v
      halo.visible = v
      // Encendido se aleja para que entre la hoja; apagado se acerca al mango,
      // que es lo que se está armando.
      distMeta = v ? 108 : 46
      pedirCuadro()
    }

    // ── Cámara orbital a mano ──
    let theta = 0.7, phi = 1.42, dist = 46, distMeta = 46
    const centro = new THREE.Vector3(0, 0, 0)
    function colocarCamara(): void {
      camera.position.set(
        centro.x + dist * Math.sin(phi) * Math.cos(theta),
        centro.y + dist * Math.cos(phi),
        centro.z + dist * Math.sin(phi) * Math.sin(theta),
      )
      camera.lookAt(centro)
    }

    // ── Gestos ──
    const punteros = new Map<number, { x: number; y: number }>()
    function alBajar(e: PointerEvent) {
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY })
      renderer.domElement.setPointerCapture(e.pointerId)
      arrancar()
    }
    function alMover(e: PointerEvent) {
      const p = punteros.get(e.pointerId); if (!p) return
      theta -= (e.clientX - p.x) * 0.011
      phi = Math.max(0.25, Math.min(2.9, phi - (e.clientY - p.y) * 0.009))
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY })
      pedirCuadro()
    }
    function alSoltar(e: PointerEvent) { punteros.delete(e.pointerId) }
    const lienzo = renderer.domElement
    lienzo.addEventListener('pointerdown', alBajar)
    lienzo.addEventListener('pointermove', alMover)
    lienzo.addEventListener('pointerup', alSoltar)
    lienzo.addEventListener('pointercancel', alSoltar)

    // ── Bucle ──
    let animando = false, rafBucle = 0, rafSuelto = 0, sueltoPendiente = false
    let ultimo = 0
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)')

    function pintar(ahora = performance.now()): void {
      const dt = ultimo ? Math.min(0.05, (ahora - ultimo) / 1000) : 0
      ultimo = ahora
      // Suavizado exponencial, independiente del ritmo de cuadro.
      if (Math.abs(dist - distMeta) > 0.05) dist += (distMeta - dist) * Math.min(1, dt * 6)
      else dist = distMeta
      // Giro lento solo si nadie está tocando y no hay «menos movimiento».
      if (punteros.size === 0 && !reducido.matches) theta += dt * 0.18
      colocarCamara()
      renderer.render(scene, camera)
    }
    function bucle(): void { rafBucle = requestAnimationFrame(bucle); pintar() }
    function arrancar(): void {
      if (animando) return
      animando = true; ultimo = 0
      cancelAnimationFrame(rafSuelto); sueltoPendiente = false
      rafBucle = requestAnimationFrame(bucle)
    }
    function parar(): void { if (!animando) return; cancelAnimationFrame(rafBucle); animando = false }
    function pedirCuadro(): void {
      if (animando || sueltoPendiente) return
      sueltoPendiente = true
      rafSuelto = requestAnimationFrame(() => { sueltoPendiente = false; pintar() })
    }

    // ── Pausa: pestaña oculta o fuera de la vista (§2s) ──
    let visible = true
    function reevaluar(): void {
      if (visible && !document.hidden && !reducido.matches) arrancar()
      else { parar(); pedirCuadro() }
    }
    const io = new IntersectionObserver(es => { visible = es[0]?.isIntersecting ?? true; reevaluar() }, { threshold: 0.05 })
    io.observe(caja)
    const alCambiarVisibilidad = () => reevaluar()
    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    const alCambiarMovimiento = () => reevaluar()
    reducido.addEventListener('change', alCambiarMovimiento)

    // ── Tamaño ──
    function ajustar(): void {
      /* `caja` se re-lee del ref y no se toma de la closure: TypeScript pierde
         el estrechamiento del `if (!caja) return` de arriba dentro de una
         función declarada, y además el nodo puede haberse ido si un
         ResizeObserver llega tarde al desmontar. */
      const c = cajaRef.current
      if (!c) return
      const w = c.clientWidth, h = c.clientHeight
      if (w === 0 || h === 0) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      pedirCuadro()
    }
    const ro = new ResizeObserver(ajustar)
    ro.observe(caja)

    // ── Pérdida de contexto ──
    function alPerderContexto(e: Event) { e.preventDefault(); parar(); alFallarRef.current?.() }
    lienzo.addEventListener('webglcontextlost', alPerderContexto)

    ajustar()
    rehacer(diseno)
    encender(encendido)
    colocarCamara()
    reevaluar()

    mandoRef.current = { rehacer, encender }

    return () => {
      mandoRef.current = null
      parar()
      cancelAnimationFrame(rafSuelto)
      ro.disconnect(); io.disconnect()
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      reducido.removeEventListener('change', alCambiarMovimiento)
      lienzo.removeEventListener('pointerdown', alBajar)
      lienzo.removeEventListener('pointermove', alMover)
      lienzo.removeEventListener('pointerup', alSoltar)
      lienzo.removeEventListener('pointercancel', alSoltar)
      // VA ANTES de `forceContextLoss`: si no, la pérdida que provocamos a
      // propósito llama al fallback y la pantalla queda diciendo «este
      // navegador no puede dibujar en 3D» para siempre (§2s).
      lienzo.removeEventListener('webglcontextlost', alPerderContexto)

      geoMango?.dispose()
      geoAro.dispose(); geoNucleo.dispose(); geoHalo.dispose()
      matMango.dispose(); matDetalle.dispose(); matNucleo.dispose(); matHalo.dispose()
      foco1.dispose(); foco2.dispose()
      renderer.dispose()
      // `dispose()` NO suelta el contexto: lo suelta el navegador cuando quiere,
      // y hasta entonces cuenta contra el tope de ~16 de Chrome, que se comparte
      // con el Contador, la Galaxia y la Mesa.
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
    // Se monta UNA vez: las piezas y el encendido entran por el mando, no
    // reconstruyendo la escena — reconstruir recompila shaders (§3y).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { mandoRef.current?.rehacer(diseno) }, [diseno])
  useEffect(() => { mandoRef.current?.encender(encendido) }, [encendido])

  return <div ref={cajaRef} className={`relative overflow-hidden ${className}`} />
}

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
import { piezasDeSable, colorDeHoja, type Diseno } from './partesSable'

interface Props {
  diseno: Diseno
  /** Enciende la hoja. Apagada solo se ve el mango, que es lo que se arma. */
  encendido: boolean
  /**
   * Separa las piezas a lo largo del eje. 0 = armado, 1 = abierto del todo.
   *
   * Es la vista que pidió Nel: las piezas flotando en fila con el hueco entre
   * ellas, para ver QUÉ se está cambiando. Se anima con suavizado exponencial en
   * el bucle, no con una transición de CSS — el sable vive en un lienzo y el CSS
   * no puede tocar una malla.
   */
  explotado?: boolean
  onSinWebGL?: () => void
  className?: string
}

export function SableEscena({ diseno, encendido, explotado = false, onSinWebGL, className = '' }: Props) {
  const cajaRef = useRef<HTMLDivElement>(null)
  const alFallarRef = useRef(onSinWebGL)
  /** El mando: la escena no se reconstruye al cambiar de pieza (§3y). */
  const mandoRef = useRef<{
    rehacer: (d: Diseno) => void
    encender: (v: boolean) => void
    explotar: (v: boolean) => void
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
    /* TRES materiales, y es lo que salva al mango de parecer un tubo. La primera
       versión pintaba las tres piezas con UN gris y el resultado era exactamente
       eso. Lo que hace que se lea como objeto es el CONTRASTE de material, no el
       detalle de la silueta:
       · acero claro y brillante en emisor y pomo — piezas mecanizadas;
       · agarre oscuro y mate en la empuñadura — es cuero o goma, no metal;
       · latón en los aros, que además marcan DÓNDE termina cada pieza.
       Los aros hacen doble trabajo: dan el acento cálido y son la única pista de
       por dónde se separa el sable. Sin ellos la vista explotada parece que se
       rompió. */
    const matAcero = new THREE.MeshPhongMaterial({
      color: 0xb9c0c9, specular: 0xffffff, shininess: 95,
    })
    const matAgarre = new THREE.MeshPhongMaterial({
      color: 0x24262c, specular: 0x4a4f57, shininess: 18,
    })
    const matLaton = new THREE.MeshPhongMaterial({
      color: 0xc08b3e, specular: 0xffe6b0, shininess: 70,
    })
    /* TRES mallas y no una: la vista explotada necesita separarlas, y no hay
       forma de abrir una pieza torneada única. Con separación 0 se ven pegadas,
       así que es UN solo camino de código para las dos vistas. */
    /* El aro de latón va de HIJO de su pieza: así viaja solo cuando el sable se
       abre, sin tener que recolocarlo por cuadro. */
    const geoAro = new THREE.TorusGeometry(1.78, 0.13, 8, 40)
    /* El sable vive en un GRUPO inclinado y el pedestal NO: así se ve en diagonal
       como en el mockup mientras el suelo sigue siendo suelo. Inclinar la cámara
       en su lugar torcería también el pedestal. */
    const grupoSable = new THREE.Group()
    grupoSable.rotation.z = -0.42
    grupoSable.rotation.x = 0.1
    scene.add(grupoSable)

    const piezas = ([0, 1, 2] as const).map(i => {
      const malla = new THREE.Mesh(new THREE.BufferGeometry(), i === 1 ? matAgarre : matAcero)
      const anillo = new THREE.Mesh(geoAro, matLaton)
      anillo.rotation.x = Math.PI / 2
      malla.add(anillo)
      grupoSable.add(malla)
      return { malla, anillo, base: 0, alto: 0 }
    })

    /* ── El pedestal ──
       Dos aros concéntricos planos debajo del sable. Es lo que hace que el mango
       flote SOBRE algo en vez de flotar en la nada, y en los dos mockups es lo
       que da la sensación de taller. Van con mezcla aditiva y sin escribir
       profundidad: son luz proyectada, no un objeto. */
    const matPeana = new THREE.MeshBasicMaterial({
      color: 0xff9d2e, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
    const geoDisco = new THREE.CircleGeometry(8.6, 44)
    const geoPeana1 = new THREE.RingGeometry(9.4, 10.1, 44)
    const geoPeana2 = new THREE.RingGeometry(12.4, 12.7, 44)
    // El disco va MÁS tenue que los aros: es el resplandor del suelo, no un aro.
    const matDisco = matPeana.clone(); matDisco.opacity = 0.13
    const peanas = [
      new THREE.Mesh(geoDisco, matDisco),
      new THREE.Mesh(geoPeana1, matPeana),
      new THREE.Mesh(geoPeana2, matPeana),
    ]
    for (const p of peanas) { p.rotation.x = -Math.PI / 2; scene.add(p) }

    // ── La hoja: cápsulas, para que la punta salga redonda sola ──
    const LARGO = 78
    const geoNucleo = new THREE.CapsuleGeometry(0.6, LARGO, 4, 12)
    const geoHalo = new THREE.CapsuleGeometry(1.45, LARGO, 4, 12)
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
    grupoSable.add(nucleo, halo)

    let altoTotal = 26
    function rehacer(d: Diseno): void {
      const sueltas = piezasDeSable(d)
      altoTotal = sueltas.reduce((s, p) => s + p.alto, 0)

      sueltas.forEach((sp, i) => {
        const vec = sp.puntos.map(([r, y]) => new THREE.Vector2(r, y))
        const nueva = new THREE.LatheGeometry(vec, 48)
        // La vieja se libera SIEMPRE: cada cambio de pieza crea geometría, y sin
        // esto probar piezas fuga una por toque.
        piezas[i].malla.geometry.dispose()
        piezas[i].malla.geometry = nueva
        piezas[i].base = sp.base
        piezas[i].alto = sp.alto
      })
      colocarPiezas()

      const c = colorDeHoja(d.color)
      matHalo.color.set(c.halo)
      matNucleo.color.set(c.nucleo)
      // El pedestal se tiñe del cristal: la forja toma el color de lo que estás
      // armando, y así el cristal se ve incluso con la hoja apagada.
      matPeana.color.set(c.halo)
      matDisco.color.set(c.halo)

      // La hoja arranca en la boca del emisor, no en el centro del mango.
      const base = altoTotal / 2
      nucleo.position.y = base + LARGO / 2
      halo.position.y = base + LARGO / 2
      for (const p of peanas) p.position.y = -altoTotal / 2 - 3.2
      pedirCuadro()
    }

    /* Coloca las tres piezas según cuánto está abierto el sable. `separacion` la
       anima el bucle, así que esto se llama por cuadro mientras se abre. */
    let separacion = 0, separacionMeta = 0
    function colocarPiezas(): void {
      const HUECO = 4.6
      for (let i = 0; i < piezas.length; i++) {
        const p = piezas[i]
        p.malla.position.y = -altoTotal / 2 + p.base + separacion * HUECO * i
        p.anillo.position.y = p.alto * (i === 1 ? 0.5 : 0.28)
      }
    }

    function explotar(v: boolean): void {
      separacionMeta = v ? 1 : 0
      // Abierto hace falta más distancia: la fila de piezas es más larga.
      
      arrancar()
    }

    function encender(v: boolean): void {
      nucleo.visible = v
      halo.visible = v
      // Encendido se aleja para que entre la hoja; apagado se acerca al mango,
      // que es lo que se está armando.
      distMeta = v ? 108 : (separacionMeta > 0 ? 62 : 46)
      pedirCuadro()
    }

    // ── Cámara orbital a mano ──
    // `phi` por encima del ecuador y `theta` en diagonal: el sable se ve en
    // escorzo como en el mockup, y no de frente y plano.
    let theta = 0.62, phi = 1.16, dist = 42, distMeta = 42
    // El centro se baja un poco: el pedestal vive debajo del mango, y mirar
    // exactamente al 0 dejaba el pomo y el pedestal pegados al borde de abajo.
    const centro = new THREE.Vector3(0, -2.4, 0)
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
      phi = Math.max(0.3, Math.min(2.6, phi - (e.clientY - p.y) * 0.009))
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
      if (Math.abs(separacion - separacionMeta) > 0.002) {
        separacion += (separacionMeta - separacion) * Math.min(1, dt * 5)
        colocarPiezas()
      } else if (separacion !== separacionMeta) {
        separacion = separacionMeta; colocarPiezas()
      }
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
    explotar(explotado)
    colocarCamara()
    reevaluar()

    mandoRef.current = { rehacer, encender, explotar }

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

      for (const p of piezas) p.malla.geometry.dispose()
      geoAro.dispose(); geoNucleo.dispose(); geoHalo.dispose()
      geoDisco.dispose(); geoPeana1.dispose(); geoPeana2.dispose()
      matAcero.dispose(); matAgarre.dispose(); matLaton.dispose()
      matNucleo.dispose(); matHalo.dispose()
      matPeana.dispose(); matDisco.dispose()
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
  useEffect(() => { mandoRef.current?.explotar(explotado) }, [explotado])

  return <div ref={cajaRef} className={`relative overflow-hidden ${className}`} />
}

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { construirMundo, RADIO_MUNDO } from './mundoGeometria'
import type { RasgosMundo } from './semilla'

/**
 * El mundo de un jugador, a pantalla completa.
 *
 * ── three PELADO ─────────────────────────────────────────────────────
 *
 * Sin react-three-fiber ni drei, como el resto de las pantallas 3D de la app
 * (gotcha 2s). No es dogma: R3F hace `import * as THREE` y `extend(THREE)`, o
 * sea que le pasa el namespace ENTERO a una función y ningún bundler puede
 * podar después. Medido: el chunk COMPARTIDO de three engorda ~52 KB gzip para
 * los veinte usuarios, entren o no a esta pantalla. La ruta perezosa no lo
 * evita, porque `manualChunks` obliga a que three viva en un solo chunk.
 *
 * ── Las reglas medidas que se respetan acá ───────────────────────────
 *
 *   · `forceContextLoss()` al desmontar, DESPUÉS de quitar el listener de
 *     `webglcontextlost`. Si va antes, la pérdida provocada dispara el aviso de
 *     «no se puede dibujar en 3D» y la pantalla se queda así para siempre.
 *   · `setPixelRatio(min(dpr, 2))` — sin tope, un teléfono con dpr 3 dibuja
 *     2,25× los píxeles para nada.
 *   · rAF pausado con `document.hidden`: esta pantalla ocupa todo, así que no
 *     hace falta IntersectionObserver — si está montada, se ve.
 *   · Una geometría y un material por objeto, compartidos. Nada de crear
 *     materiales dentro del bucle de dibujo.
 */

interface Props {
  rasgos: RasgosMundo
  /** Se llama si el navegador no puede dibujar en 3D. */
  onSinWebGL?: () => void
  /** Se llama con los FPS medidos, una vez por segundo. Para el rótulo de depuración. */
  onFps?: (fps: number) => void
  className?: string
}

/**
 * Detalle del icosaedro según el aparato.
 *
 * 144 son ~414.000 triángulos y 96 son ~184.000. La diferencia se nota al
 * CONSTRUIR (es un bucle por vértice con cráteres y ruido), no al dibujar, y
 * construir bloquea el hilo principal: en un teléfono de gama media 144 son
 * varios segundos de pantalla trabada. Se decide por memoria y por núcleos, que
 * es lo único que el navegador cuenta de verdad.
 */
function detalleSegunAparato(): number {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const mem = nav.deviceMemory ?? 4
  const nucleos = navigator.hardwareConcurrency ?? 4
  if (mem <= 2 || nucleos <= 4) return 72
  if (mem <= 4 || nucleos <= 6) return 96
  return 144
}

export function PlanetaEscena({ rasgos, onSinWebGL, onFps, className = '' }: Props) {
  const cajaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const caja = cajaRef.current
    if (!caja) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    } catch {
      onSinWebGL?.()
      return
    }

    const alPerderContexto = (e: Event) => { e.preventDefault(); onSinWebGL?.() }
    renderer.domElement.addEventListener('webglcontextlost', alPerderContexto)

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(caja.clientWidth, caja.clientHeight)
    caja.appendChild(renderer.domElement)

    const escena = new THREE.Scene()
    const camara = new THREE.PerspectiveCamera(45, caja.clientWidth / caja.clientHeight, 0.5, 900)

    // ── el mundo ──
    const detalle = detalleSegunAparato()
    const geoMundo = construirMundo(rasgos, detalle, true)
    const matMundo = new THREE.MeshLambertMaterial({ vertexColors: true })
    const mundo = new THREE.Mesh(geoMundo, matMundo)
    // La inclinación del eje decide por dónde pega el sol: dos mundos con la
    // misma paleta se ven distintos solo por esto.
    mundo.rotation.z = rasgos.inclinacion
    escena.add(mundo)

    /**
     * Atmósfera: una esfera un poco más grande dibujada POR DENTRO.
     *
     * `BackSide` + `AdditiveBlending` y un desvanecido por el ángulo entre la
     * normal y la cámara: donde la superficie mira de canto, el halo se ve; de
     * frente, desaparece. Es el truco barato de siempre —un shader de 20 líneas
     * contra un postproceso de pantalla completa— y en móvil la diferencia es
     * todo el presupuesto de relleno.
     */
    const geoAtmosfera = new THREE.SphereGeometry(RADIO_MUNDO * 1.032, 48, 32)
    const matAtmosfera = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(rasgos.atmosfera) } },
      vertexShader: `
        varying vec3 vNormalVista;
        varying vec3 vPosVista;
        void main() {
          vNormalVista = normalize(normalMatrix * normal);
          vec4 pv = modelViewMatrix * vec4(position, 1.0);
          vPosVista = pv.xyz;
          gl_Position = projectionMatrix * pv;
        }`,
      fragmentShader: `
        uniform vec3 color;
        varying vec3 vNormalVista;
        varying vec3 vPosVista;
        void main() {
          float f = 1.0 - abs(dot(normalize(vNormalVista), normalize(-vPosVista)));
          // El exponente decide el grosor: con 2,6 y la cáscara al 5,5% se veía
          // un ARO azul de borde duro, no un resplandor. Con 3,4 el halo se
          // concentra en el filo y se desvanece rápido hacia adentro.
          float i = pow(clamp(f, 0.0, 1.0), 3.4);
          // Un segundo término mucho más suave y tenue: sin él el halo termina
          // de golpe y se le ve el corte contra el negro.
          i += pow(clamp(f, 0.0, 1.0), 1.4) * 0.13;
          gl_FragColor = vec4(color, i * 0.62);
        }`,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
    escena.add(new THREE.Mesh(geoAtmosfera, matAtmosfera))

    /**
     * Estrellas: UN solo `Points` con 1.400 vértices.
     *
     * Mil cuatrocientas mallas serían 1.400 draw calls; así es una. Se colocan
     * en una cáscara esférica lejana, nunca dentro del volumen de la cámara,
     * para que ninguna quede «delante» del planeta.
     */
    const nEstrellas = 1400
    const posEstrellas = new Float32Array(nEstrellas * 3)
    const brilloEstrellas = new Float32Array(nEstrellas)
    for (let i = 0; i < nEstrellas; i++) {
      // Distribución uniforme sobre la esfera: con ángulos al azar sin el
      // `acos`, las estrellas se apelotonan en los polos.
      const u = Math.random() * 2 - 1
      const phi = Math.random() * Math.PI * 2
      const r = 320 + Math.random() * 180
      const s = Math.sqrt(1 - u * u)
      posEstrellas[i * 3] = Math.cos(phi) * s * r
      posEstrellas[i * 3 + 1] = u * r
      posEstrellas[i * 3 + 2] = Math.sin(phi) * s * r
      brilloEstrellas[i] = 0.35 + Math.random() * 0.65
    }
    const geoEstrellas = new THREE.BufferGeometry()
    geoEstrellas.setAttribute('position', new THREE.BufferAttribute(posEstrellas, 3))
    geoEstrellas.setAttribute('brillo', new THREE.BufferAttribute(brilloEstrellas, 1))
    const matEstrellas = new THREE.ShaderMaterial({
      uniforms: { escala: { value: renderer.getPixelRatio() } },
      vertexShader: `
        attribute float brillo;
        uniform float escala;
        varying float vBrillo;
        void main() {
          vBrillo = brillo;
          vec4 pv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (1.0 + brillo * 1.6) * escala;
          gl_Position = projectionMatrix * pv;
        }`,
      fragmentShader: `
        varying float vBrillo;
        void main() {
          // Punto redondo y no cuadrado, sin textura.
          vec2 d = gl_PointCoord - vec2(0.5);
          if (dot(d, d) > 0.25) discard;
          gl_FragColor = vec4(vec3(1.0), vBrillo);
        }`,
      transparent: true,
      depthWrite: false,
    })
    escena.add(new THREE.Points(geoEstrellas, matEstrellas))

    // ── luces ──
    // Un sol duro y un relleno frío desde el lado opuesto, para que la mitad en
    // sombra no sea negra plana sino azulada — el planeta se lee como volumen.
    const sol = new THREE.DirectionalLight(0xfff3e0, 2.6)
    sol.position.set(1, 0.35, 0.6).normalize().multiplyScalar(100)
    escena.add(sol)
    const relleno = new THREE.DirectionalLight(new THREE.Color(rasgos.atmosfera), 0.35)
    relleno.position.set(-1, -0.2, -0.5).normalize().multiplyScalar(100)
    escena.add(relleno)
    escena.add(new THREE.AmbientLight(0x2a3050, 0.9))

    // ── cámara orbital: arrastre y pellizco ──
    //
    // A mano y no con OrbitControls: los controles viven en `three/examples`,
    // que NO está en el chunk compartido, y traerlos sumaría peso por un
    // arrastre y un pellizco que son treinta líneas.
    /**
     * La distancia a la que el mundo ENTRA en pantalla, según la forma de la
     * pantalla.
     *
     * Una distancia fija no sirve: `fov` es el campo VERTICAL, y en un teléfono
     * en vertical (375×812, relación 0,46) el campo horizontal es mucho más
     * angosto. Con la misma distancia que en escritorio, el planeta se salía por
     * los costados — y el caso normal de esta comunidad es el teléfono en
     * vertical.
     *
     * Se resuelve por el eje que limita: `dist = R / sin(fov_menor / 2)`.
     */
    const distanciaQueEncuadra = (margen: number) => {
      const vFov = (camara.fov * Math.PI) / 180
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camara.aspect)
      return (RADIO_MUNDO * margen) / Math.sin(Math.min(vFov, hFov) / 2)
    }

    // 1,25 deja aire alrededor: pegado al borde se siente encajonado, y además
    // los rótulos de arriba y de abajo tapan parte del disco.
    const orbita = { theta: 0.6, phi: 1.15, dist: distanciaQueEncuadra(1.25) }
    const objetivo = { theta: orbita.theta, phi: orbita.phi, dist: orbita.dist }
    // Los topes del pellizco también dependen de la pantalla: acercarse hasta
    // rozar la superficie y alejarse hasta que el mundo sea una canica.
    let distMin = distanciaQueEncuadra(0.55)
    let distMax = distanciaQueEncuadra(3.2)
    let autoGiro = true

    const punteros = new Map<number, { x: number; y: number }>()
    let distPellizco = 0

    const alBajar = (e: PointerEvent) => {
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY })
      autoGiro = false
      renderer.domElement.setPointerCapture(e.pointerId)
    }
    const alMover = (e: PointerEvent) => {
      const prev = punteros.get(e.pointerId)
      if (!prev) return
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (punteros.size === 1) {
        objetivo.theta -= (e.clientX - prev.x) * 0.006
        objetivo.phi -= (e.clientY - prev.y) * 0.006
        // Tope antes de los polos: si `phi` llega a 0 o π, el vector «arriba»
        // se vuelve paralelo a la vista y la cámara pega un tirón.
        objetivo.phi = Math.max(0.18, Math.min(Math.PI - 0.18, objetivo.phi))
      } else if (punteros.size === 2) {
        const [a, b] = [...punteros.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (distPellizco > 0) {
          objetivo.dist *= distPellizco / d
          objetivo.dist = Math.max(distMin, Math.min(distMax, objetivo.dist))
        }
        distPellizco = d
      }
    }
    const alSoltar = (e: PointerEvent) => {
      punteros.delete(e.pointerId)
      if (punteros.size < 2) distPellizco = 0
    }
    const alRueda = (e: WheelEvent) => {
      e.preventDefault()
      autoGiro = false
      objetivo.dist = Math.max(distMin, Math.min(distMax, objetivo.dist * (1 + e.deltaY * 0.0012)))
    }

    const lienzo = renderer.domElement
    lienzo.style.touchAction = 'none'
    lienzo.addEventListener('pointerdown', alBajar)
    lienzo.addEventListener('pointermove', alMover)
    lienzo.addEventListener('pointerup', alSoltar)
    lienzo.addEventListener('pointercancel', alSoltar)
    lienzo.addEventListener('wheel', alRueda, { passive: false })

    // ── bucle ──
    let raf = 0
    let ultimo = performance.now()
    let cuadros = 0
    let acumulado = 0

    const dibujar = () => {
      raf = requestAnimationFrame(dibujar)
      const ahora = performance.now()
      const dt = Math.min(0.05, (ahora - ultimo) / 1000)
      ultimo = ahora

      if (autoGiro) objetivo.theta += dt * 0.055

      // Suavizado exponencial independiente de los FPS: con un `lerp` de factor
      // fijo, a 30 fps la cámara llega a la mitad de velocidad que a 60.
      const k = 1 - Math.exp(-dt * 9)
      orbita.theta += (objetivo.theta - orbita.theta) * k
      orbita.phi += (objetivo.phi - orbita.phi) * k
      orbita.dist += (objetivo.dist - orbita.dist) * k

      const sp = Math.sin(orbita.phi)
      camara.position.set(
        Math.cos(orbita.theta) * sp * orbita.dist,
        Math.cos(orbita.phi) * orbita.dist,
        Math.sin(orbita.theta) * sp * orbita.dist,
      )
      camara.lookAt(0, 0, 0)
      renderer.render(escena, camara)

      cuadros++
      acumulado += dt
      if (acumulado >= 1) {
        onFps?.(Math.round(cuadros / acumulado))
        cuadros = 0
        acumulado = 0
      }
    }

    const alCambiarVisibilidad = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        raf = 0
      } else if (!raf) {
        ultimo = performance.now()
        dibujar()
      }
    }
    document.addEventListener('visibilitychange', alCambiarVisibilidad)

    const alRedimensionar = () => {
      const w = caja.clientWidth, h = caja.clientHeight
      if (!w || !h) return
      camara.aspect = w / h
      camara.updateProjectionMatrix()
      renderer.setSize(w, h)
      // Girar el teléfono cambia qué eje limita: sin recalcular, el mundo que
      // encuadraba en vertical se sale al pasar a horizontal.
      distMin = distanciaQueEncuadra(0.55)
      distMax = distanciaQueEncuadra(3.2)
      objetivo.dist = Math.max(distMin, Math.min(distMax, objetivo.dist))
    }
    const observador = new ResizeObserver(alRedimensionar)
    observador.observe(caja)

    dibujar()

    return () => {
      cancelAnimationFrame(raf)
      observador.disconnect()
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      lienzo.removeEventListener('pointerdown', alBajar)
      lienzo.removeEventListener('pointermove', alMover)
      lienzo.removeEventListener('pointerup', alSoltar)
      lienzo.removeEventListener('pointercancel', alSoltar)
      lienzo.removeEventListener('wheel', alRueda)

      geoMundo.dispose()
      matMundo.dispose()
      geoAtmosfera.dispose()
      matAtmosfera.dispose()
      geoEstrellas.dispose()
      matEstrellas.dispose()
      renderer.dispose()

      // El listener PRIMERO, y recién después soltar el contexto: al revés, la
      // pérdida que provocamos a propósito llamaría a `onSinWebGL` y la
      // pantalla diría que el navegador no puede dibujar en 3D.
      lienzo.removeEventListener('webglcontextlost', alPerderContexto)
      renderer.forceContextLoss()
      lienzo.remove()
    }
  }, [rasgos, onSinWebGL, onFps])

  return (
    <div
      ref={cajaRef}
      className={`relative overflow-hidden ${className}`}
      style={{ background: 'radial-gradient(circle at 50% 45%, #0d1424 0%, #070a14 55%, #03040a 100%)' }}
      role="img"
      aria-label="Vista 3D del planeta. Arrastrá para girarlo, pellizcá para acercarte."
    />
  )
}

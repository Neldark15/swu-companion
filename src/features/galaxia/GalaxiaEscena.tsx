/**
 * GalaxiaEscena — la comunidad dibujada como un sistema solar, en three.js pelado.
 *
 * Mismo patrón de montaje que `Dice3D.tsx`: ref al contenedor, renderer creado
 * dentro del efecto, bucle con rAF y limpieza completa en el return. Sin
 * @react-three/fiber ni drei: son ~200 KB para resolver algo que este repo ya
 * sabe hacer a mano, y `three` ya viaja en su propio chunk compartido.
 *
 * ── El anillo NO es `orbita`, y esa es la decisión que salva la pantalla ──
 *
 * `galaxiaService` entrega `orbita` = índice 0-based (nivel DESC, desempate por
 * id). Lo obvio sería un círculo por jugador. Medido con lápiz antes de
 * escribir código: con 19 círculos concéntricos, el paso radial tiene que ser
 * mayor que el diámetro de un planeta o se tocan, así que el sistema entero
 * mide ~60 radios de planeta. Encajado en una pantalla de teléfono eso deja
 * planetas de 7 px: no se ven y no se pueden tocar con el dedo.
 *
 * Acá el índice se reparte en ANILLOS de capacidad creciente, como se acomodan
 * los puntos de un girasol: el anillo k tiene sitio para `2k+1` planetas, así
 * que los índices 0…(k+1)²−1 caben en k+1 anillos. Sale directo:
 *
 *     k = floor(√orbita)        y       hueco = orbita − k²
 *
 * Con 19 jugadores son 5 anillos (1+3+5+7+3 de 9) y cada planeta queda a ~10
 * unidades de su vecino: planetas de ~21 px de diámetro, tocables. Con 200 son
 * 15 anillos y la separación de arco converge a π·PASO_ANILLO ≈ 7 unidades —
 * nunca se apelotona, por construcción. Y el orden se respeta: el índice 0
 * (más nivel) queda en el anillo interior, pegado al sol.
 *
 * ── Qué se dibuja y con cuántas llamadas ──
 *
 *   1 InstancedMesh   → los N planetas (1 geometría + 1 material, color por
 *                       instancia). Con un material por planeta serían N
 *                       programas de shader compilándose al entrar.
 *   1 LineSegments    → TODAS las órbitas fundidas en un solo búfer, punteadas
 *                       gratis (se emite un segmento sí y otro no).
 *   1 Points          → el campo de estrellas, un búfer de 620 vértices.
 *   2 Mesh + 1 Sprite → el sol, su resplandor y los dos aros (yo / seleccionado)
 *                       que comparten UNA geometría de anillo.
 *
 * Los rótulos son DOS divs de HTML movidos con `transform`, no sprites: texto
 * nítido a cualquier zoom, cero texturas y cero materiales extra.
 */

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RANKS } from '../../services/gamification'
import type { PlanetaJugador } from '../../services/galaxiaService'

// ─── Color por rango ─────────────────────────────────────

/**
 * `RANKS` guarda el color como clase de Tailwind y WebGL necesita un número.
 * La traducción va por la clase —no por el índice del rango— para que agregar
 * un rango intermedio en gamification.ts no le cambie el color a todos los
 * demás. Un color que no esté en la tabla cae al gris del primer rango en vez
 * de inventar uno: la Galaxia y la tarjeta de perfil tienen que decir lo mismo.
 */
const HEX_POR_CLASE: Record<string, number> = {
  'text-gray-400': 0x9ca3af,
  'text-blue-400': 0x60a5fa,
  'text-green-400': 0x4ade80,
  'text-yellow-400': 0xfacc15,
  'text-amber-400': 0xfbbf24,
  'text-amber-300': 0xfcd34d,
  'text-yellow-300': 0xfde047,
}

function colorDeNivel(nivel: number): number {
  const rango = RANKS.find(r => nivel >= r.minLevel && nivel <= r.maxLevel) ?? RANKS[0]
  return HEX_POR_CLASE[rango.color] ?? 0x9ca3af
}

// ─── Geometría del sistema ───────────────────────────────

const RADIO_SOL = 2.0
/** Radio del primer anillo. Deja aire entre el sol y el planeta más grande. */
const RADIO_MIN = 4.6
/** Separación entre anillos. Fija la separación de arco de largo plazo (π·PASO). */
const PASO_ANILLO = 2.25
/** Ángulo áureo: desfasa cada anillo para que no se alineen radialmente. */
const AUREO = 2.399963229728653

function radioAnillo(k: number): number {
  return RADIO_MIN + k * PASO_ANILLO
}

/** El anillo del índice y su hueco dentro de él. Ver la cabecera del archivo. */
function acomodo(orbita: number): { k: number; hueco: number; cupo: number } {
  const k = Math.floor(Math.sqrt(Math.max(0, orbita)))
  return { k, hueco: orbita - k * k, cupo: 2 * k + 1 }
}

/**
 * Tamaño del planeta por NIVEL, nunca por victorias.
 *
 * `victorias`/`derrotas` son 0 en las 19 cuentas (la tabla `matches` está
 * vacía): dimensionar por ahí daría 19 planetas idénticos. El nivel va de 1 a 8
 * hoy y el techo de rango está en 26, así que se comprime con log — si mañana
 * alguien llega a nivel 40 su planeta no se come la pantalla.
 */
function radioPlaneta(nivel: number): number {
  const n = Math.max(1, nivel)
  const t = Math.min(1, Math.log2(1 + n) / Math.log2(27))
  return 0.42 + 0.52 * t
}

/**
 * Velocidad angular del anillo, más lenta cuanto más afuera.
 *
 * Es la tercera ley de Kepler a ojo (ω ∝ 1/√r). No cuesta nada y es lo que hace
 * que la escena se lea como un sistema solar y no como una diana girando.
 */
function velocidadAnillo(k: number): number {
  return 0.052 / Math.sqrt(radioAnillo(k) / RADIO_MIN)
}

// ─── Texturas dibujadas al vuelo ─────────────────────────

/** Punto redondo con borde suave: sin esto las estrellas son cuadraditos. */
function texturaPunto(): THREE.Texture {
  const S = 32
  const c = document.createElement('canvas')
  c.width = c.height = S
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g
  x.fillRect(0, 0, S, S)
  return new THREE.CanvasTexture(c)
}

/** Resplandor del sol: un degradado radial ámbar que se apaga hacia afuera. */
function texturaResplandor(): THREE.Texture {
  const S = 128
  const c = document.createElement('canvas')
  c.width = c.height = S
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,214,160,0.85)')
  g.addColorStop(0.25, 'rgba(245,158,11,0.42)')
  g.addColorStop(0.6, 'rgba(245,158,11,0.12)')
  g.addColorStop(1, 'rgba(245,158,11,0)')
  x.fillStyle = g
  x.fillRect(0, 0, S, S)
  return new THREE.CanvasTexture(c)
}

// ─── Tipos internos ──────────────────────────────────────

interface Cuerpo {
  id: string
  nombre: string
  radio: number
  rOrbita: number
  angBase: number
  velocidad: number
  /** Posición DIBUJADA. La usa el acierto del dedo, que corre entre cuadros. */
  x: number
  z: number
}

interface Mando {
  seleccionar: (id: string | null) => void
}

interface Props {
  /**
   * Tiene que ser ESTABLE entre renders (memoizado). Es la dependencia del
   * efecto de montaje: un array nuevo en cada render reconstruye la escena
   * entera —y recompila shaders— en cada toque. Medido con el banco de pruebas:
   * pasándolo sin memoizar, un barrido de toques solo alcanzaba 8 de los 19
   * planetas porque el lienzo se reemplazaba a mitad de camino.
   */
  planetas: PlanetaJugador[]
  /** Id del planeta resaltado. Lo controla la pantalla. */
  seleccion: string | null
  onSeleccionar: (id: string | null) => void
  /** Se avisa si el navegador suelta el contexto 3D en marcha. */
  onSinWebGL?: () => void
  className?: string
}

export function GalaxiaEscena({
  planetas, seleccion, onSeleccionar, onSinWebGL, className = '',
}: Props) {
  const cajaRef = useRef<HTMLDivElement>(null)
  const etiquetaYoRef = useRef<HTMLDivElement>(null)
  const etiquetaSelRef = useRef<HTMLDivElement>(null)
  const mandoRef = useRef<Mando | null>(null)

  // Los callbacks y la selección viven en refs para que el efecto de montaje no
  // dependa de ellos: si dependiera, cada render de la pantalla —y cada toque—
  // reconstruiría la escena entera, recompilando shaders.
  //
  // Este efecto va PRIMERO a propósito: React los corre en orden de
  // declaración, así que cuando el de montaje se vuelve a ejecutar (cambió la
  // lista de planetas) los refs ya traen el valor de este render.
  const alSeleccionarRef = useRef(onSeleccionar)
  const alFallarRef = useRef(onSinWebGL)
  const seleccionRef = useRef(seleccion)
  useEffect(() => {
    alSeleccionarRef.current = onSeleccionar
    alFallarRef.current = onSinWebGL
    seleccionRef.current = seleccion
  })

  // ── Montaje ──
  useEffect(() => {
    const caja = cajaRef.current
    if (!caja || planetas.length === 0) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        // El antialias se apaga cuando el búfer ya va a doble resolución: a DPR
        // 2 el supermuestreo del propio lienzo ya suaviza los bordes y el MSAA
        // encima solo cuesta relleno en un teléfono.
        antialias: dpr < 2,
        powerPreference: 'low-power',
      })
    } catch {
      alFallarRef.current?.()
      return
    }
    // Tope de 2 como en Dice3D: a DPR 3 se renderizan 2,25× más píxeles sin que
    // se note la mejora, y el teléfono lo paga en batería.
    renderer.setPixelRatio(dpr)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    // Sin esto el navegador se queda el arrastre para desplazar la página y la
    // cámara no gira. El lienzo es un panel de alto fijo, así que la página
    // sigue desplazándose por fuera de él.
    renderer.domElement.style.touchAction = 'none'
    // Va PRIMERO en el contenedor: los rótulos son hermanos posteriores y así
    // quedan encima del lienzo sin pelear con z-index.
    caja.insertBefore(renderer.domElement, caja.firstChild)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 600)

    // ── Luces ──
    // Ambiente frío y bajo: el lado nocturno del planeta se ve, pero se ve
    // oscuro. El sol es una luz puntual en el origen SIN caída (decay 0) a
    // propósito: con caída física los anillos exteriores quedarían negros, y
    // ahí es donde vive la mayor parte de la comunidad.
    scene.add(new THREE.AmbientLight(0x2a3350, 1.15))
    const luzSol = new THREE.PointLight(0xffd9a0, 2.3, 0, 0)
    scene.add(luzSol)

    // ── Sol ──
    const geoSol = new THREE.SphereGeometry(RADIO_SOL, 24, 16)
    const matSol = new THREE.MeshBasicMaterial({ color: 0xffd9a0 })
    scene.add(new THREE.Mesh(geoSol, matSol))

    const texResplandor = texturaResplandor()
    const matResplandor = new THREE.SpriteMaterial({
      map: texResplandor, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const resplandor = new THREE.Sprite(matResplandor)
    resplandor.scale.setScalar(RADIO_SOL * 6)
    scene.add(resplandor)

    // ── Cuerpos ──
    const cuerpos: Cuerpo[] = planetas.map(p => {
      const { k, hueco, cupo } = acomodo(p.orbita)
      return {
        id: p.id,
        nombre: p.nombre,
        radio: radioPlaneta(p.nivel),
        rOrbita: radioAnillo(k),
        angBase: (hueco / cupo) * Math.PI * 2 + k * AUREO,
        velocidad: velocidadAnillo(k),
        x: 0,
        z: 0,
      }
    })
    const kMax = Math.max(...planetas.map(p => acomodo(p.orbita).k))

    // ── Órbitas: un solo búfer para todos los anillos ──
    // Se emite un segmento sí y otro no, así el punteado sale de la geometría
    // (mitad de vértices) en vez de costar un LineDashedMaterial.
    const puntos: number[] = []
    for (let k = 0; k <= kMax; k++) {
      const r = radioAnillo(k)
      const tramos = Math.max(72, Math.round(r * 11))
      for (let i = 0; i < tramos; i += 2) {
        const a0 = (i / tramos) * Math.PI * 2
        const a1 = ((i + 1) / tramos) * Math.PI * 2
        puntos.push(Math.cos(a0) * r, 0, Math.sin(a0) * r)
        puntos.push(Math.cos(a1) * r, 0, Math.sin(a1) * r)
      }
    }
    const geoOrbitas = new THREE.BufferGeometry()
    geoOrbitas.setAttribute('position', new THREE.Float32BufferAttribute(puntos, 3))
    const matOrbitas = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      // Con muchos anillos la suma de líneas tenues se vuelve una nata gris.
      // La opacidad baja a medida que crece la comunidad.
      opacity: Math.max(0.06, Math.min(0.2, 1.1 / (kMax + 1))),
    })
    scene.add(new THREE.LineSegments(geoOrbitas, matOrbitas))

    // ── Planetas: UNA geometría y UN material para todos ──
    // La teselación baja cuando hay mucha gente. Medido con el banco de pruebas:
    // 200 planetas a 20×14 son 104.898 triángulos por cuadro; a 12×8 son 33.600.
    // A esa cantidad cada planeta mide ~9 px y la silueta ya no se distingue,
    // así que son tres cuartas partes del trabajo tiradas a la basura.
    const gajos = cuerpos.length > 120 ? 12 : cuerpos.length > 40 ? 16 : 20
    const geoPlaneta = new THREE.SphereGeometry(1, gajos, Math.round(gajos * 0.7))
    const matPlaneta = new THREE.MeshLambertMaterial({})
    const malla = new THREE.InstancedMesh(geoPlaneta, matPlaneta, cuerpos.length)
    malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    const color = new THREE.Color()
    planetas.forEach((p, i) => {
      malla.setColorAt(i, color.setHex(colorDeNivel(p.nivel)))
    })
    if (malla.instanceColor) malla.instanceColor.needsUpdate = true
    scene.add(malla)

    // ── Aros de «yo» y «seleccionado»: comparten geometría ──
    const geoAro = new THREE.RingGeometry(0.86, 1, 44)
    const matAroYo = new THREE.MeshBasicMaterial({
      color: 0x22d3ee, transparent: true, opacity: 0.85,
      side: THREE.DoubleSide, depthWrite: false,
    })
    const matAroSel = new THREE.MeshBasicMaterial({
      color: 0xf59e0b, transparent: true, opacity: 0.95,
      side: THREE.DoubleSide, depthWrite: false,
    })
    const aroYo = new THREE.Mesh(geoAro, matAroYo)
    const aroSel = new THREE.Mesh(geoAro, matAroSel)
    aroYo.visible = false
    aroSel.visible = false
    scene.add(aroYo, aroSel)

    // ── Estrellas: un búfer de puntos, no 620 mallas ──
    const N_ESTRELLAS = 620
    const posEstrellas = new Float32Array(N_ESTRELLAS * 3)
    const colEstrellas = new Float32Array(N_ESTRELLAS * 3)
    const tono = new THREE.Color()
    for (let i = 0; i < N_ESTRELLAS; i++) {
      // Distribución uniforme sobre la esfera: el coseno del ángulo polar tiene
      // que salir uniforme, no el ángulo. Repartir el ángulo amontona estrellas
      // en los polos y deja el ecuador pelado.
      const u = Math.random() * 2 - 1
      const a = Math.random() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      const r = 150 + Math.random() * 90
      posEstrellas[i * 3] = Math.cos(a) * s * r
      posEstrellas[i * 3 + 1] = u * r
      posEstrellas[i * 3 + 2] = Math.sin(a) * s * r
      const d = Math.random()
      tono.setHex(d > 0.93 ? 0xf59e0b : d > 0.86 ? 0x22d3ee : 0xdbeafe)
      const brillo = 0.35 + Math.random() * 0.65
      colEstrellas[i * 3] = tono.r * brillo
      colEstrellas[i * 3 + 1] = tono.g * brillo
      colEstrellas[i * 3 + 2] = tono.b * brillo
    }
    const geoEstrellas = new THREE.BufferGeometry()
    geoEstrellas.setAttribute('position', new THREE.BufferAttribute(posEstrellas, 3))
    geoEstrellas.setAttribute('color', new THREE.BufferAttribute(colEstrellas, 3))
    const texPunto = texturaPunto()
    const matEstrellas = new THREE.PointsMaterial({
      // `gl_PointSize` va en píxeles del búfer de dibujo, no en CSS: sin
      // multiplicar por el DPR las estrellas salen a la mitad en un teléfono.
      size: 2.1 * dpr,
      sizeAttenuation: false,
      vertexColors: true,
      map: texPunto,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const estrellas = new THREE.Points(geoEstrellas, matEstrellas)
    estrellas.renderOrder = -1
    scene.add(estrellas)

    // ── Cámara orbital, a mano ──
    const rSistema = radioAnillo(kMax) + 1.2
    let theta = -0.55
    let phi = 0.66
    let dist = 40
    let distAjuste = 40
    /** La PRIMERA medida fija el encuadre; las siguientes solo re-topan el zoom. */
    let encuadrado = false

    function encuadre(): number {
      const vFov = (camera.fov * Math.PI) / 180
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect)
      // Con TANGENTE y no con seno: el seno ajusta una ESFERA envolvente y lo
      // que hay acá es un disco plano, así que dejaba un 7,5 % de aire de más y
      // el sistema se veía chico en el teléfono. La tangente ajusta el disco.
      // El peor caso vertical es la cámara en planta (cos φ = 1), que sigue
      // pidiendo menos que el ancho: girar nunca saca planetas de cuadro.
      return (rSistema / Math.tan(Math.min(vFov, hFov) / 2)) * 1.04
    }

    function colocarCamara(): void {
      const sp = Math.sin(phi)
      camera.position.set(
        dist * sp * Math.sin(theta),
        dist * Math.cos(phi),
        dist * sp * Math.cos(theta),
      )
      camera.lookAt(0, 0, 0)
      // Se actualiza acá y no se deja para `render()`.
      //
      // `Vector3.project()` usa `matrixWorldInverse`, que normalmente refresca
      // el render. Sin esta línea, un toque que llegue ANTES del primer cuadro
      // proyecta con la matriz identidad: medido con un barrido de toques cada
      // 6 px, los 19 planetas caían en y = alto/2 y solo 4 eran alcanzables.
      // Y no fallaba en silencio — elegía el planeta equivocado.
      camera.updateMatrixWorld()
    }

    // ── Estado del bucle ──
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)')
    let tiempo = 0
    let ultimo = 0
    let animando = false
    let rafBucle = 0
    let rafSuelto = 0
    let sueltoPendiente = false
    let enPantalla = true
    let recolocar = true
    let seleccionActual: string | null = seleccionRef.current
    let miId: string | null = planetas.find(p => p.esYo)?.id ?? null

    const matriz = new THREE.Matrix4()
    const proyector = new THREE.Vector3()

    function colocar(): void {
      for (let i = 0; i < cuerpos.length; i++) {
        const c = cuerpos[i]
        const ang = c.angBase + tiempo * c.velocidad
        c.x = Math.cos(ang) * c.rOrbita
        c.z = Math.sin(ang) * c.rOrbita
        matriz.makeScale(c.radio, c.radio, c.radio)
        matriz.setPosition(c.x, 0, c.z)
        malla.setMatrixAt(i, matriz)
      }
      malla.instanceMatrix.needsUpdate = true
    }

    /** Píxeles de pantalla por unidad de mundo a esa distancia de la cámara. */
    function escalaEn(x: number, z: number): number {
      const alto = renderer.domElement.clientHeight || 1
      const d = camera.position.distanceTo(new THREE.Vector3(x, 0, z))
      return (alto / 2) / (Math.tan((camera.fov * Math.PI) / 360) * Math.max(0.001, d))
    }

    /** Proyecta a píxeles CSS del lienzo. Devuelve null si queda detrás. */
    function aPantalla(x: number, z: number): { px: number; py: number } | null {
      proyector.set(x, 0, z).project(camera)
      if (proyector.z > 1) return null
      const el = renderer.domElement
      return {
        px: (proyector.x * 0.5 + 0.5) * el.clientWidth,
        py: (-proyector.y * 0.5 + 0.5) * el.clientHeight,
      }
    }

    function ponerAro(aro: THREE.Mesh, id: string | null, factor: number): void {
      const c = id ? cuerpos.find(v => v.id === id) : undefined
      if (!c) { aro.visible = false; return }
      aro.visible = true
      aro.position.set(c.x, 0, c.z)
      // Mira siempre a la cámara: un anillo plano visto de canto es una raya.
      aro.quaternion.copy(camera.quaternion)
      aro.scale.setScalar(c.radio * factor)
    }

    function ponerEtiqueta(el: HTMLDivElement | null, id: string | null, texto: string): void {
      if (!el) return
      const c = id ? cuerpos.find(v => v.id === id) : undefined
      const p = c ? aPantalla(c.x, c.z) : null
      if (!c || !p) { el.style.visibility = 'hidden'; return }
      if (el.textContent !== texto) el.textContent = texto
      el.style.visibility = 'visible'
      // Solo `transform`: mover con left/top dispara relayout en cada cuadro.
      const alto = c.radio * escalaEn(c.x, c.z) + 14
      el.style.transform = `translate3d(${Math.round(p.px)}px, ${Math.round(p.py - alto)}px, 0) translate(-50%, -100%)`
    }

    function pintar(): void {
      const ahora = performance.now()
      // El delta se topa en 50 ms: al volver de una pestaña oculta el reloj trae
      // minutos acumulados y los planetas darían un salto en un solo cuadro.
      const dt = ultimo ? Math.min(0.05, (ahora - ultimo) / 1000) : 0
      ultimo = ahora
      const anima = !reducido.matches

      if (anima) tiempo += dt
      if (anima || recolocar) { colocar(); recolocar = false }

      colocarCamara()
      ponerAro(aroYo, miId, 1.55)
      ponerAro(aroSel, seleccionActual, 2.1)
      renderer.render(scene, camera)

      const yo = miId ? planetas.find(p => p.id === miId) : undefined
      ponerEtiqueta(etiquetaYoRef.current, miId, yo ? `Tú · ${yo.nombre}` : 'Tú')
      const sel = seleccionActual && seleccionActual !== miId
        ? planetas.find(p => p.id === seleccionActual)
        : undefined
      ponerEtiqueta(etiquetaSelRef.current, sel?.id ?? null, sel?.nombre ?? '')
    }

    function bucle(): void {
      rafBucle = requestAnimationFrame(bucle)
      pintar()
    }

    function arrancar(): void {
      if (animando) return
      animando = true
      ultimo = 0
      bucle()
    }

    function parar(): void {
      if (!animando) return
      cancelAnimationFrame(rafBucle)
      animando = false
    }

    /**
     * Un cuadro suelto. Es lo que mantiene la escena viva con
     * `prefers-reduced-motion`: no hay bucle, se redibuja al interactuar.
     */
    function pedirCuadro(): void {
      if (animando || sueltoPendiente) return
      sueltoPendiente = true
      rafSuelto = requestAnimationFrame(() => { sueltoPendiente = false; pintar() })
    }

    /**
     * Un rAF corriendo detrás quema batería sin que nadie lo mire. Se apaga con
     * la pestaña oculta, con el lienzo fuera del viewport y cuando la persona
     * pidió menos movimiento.
     */
    function reevaluar(): void {
      const visible = enPantalla && !document.hidden
      if (visible && !reducido.matches) arrancar()
      else {
        parar()
        if (visible) pedirCuadro()
      }
    }

    // ── Tamaño ──
    // Va como const y no como `function`: TypeScript sube las declaraciones de
    // función al inicio del bloque para analizar el flujo, así que ahí adentro
    // `caja` vuelve a ser `HTMLDivElement | null` pese al guard de arriba.
    const ajustar = (): void => {
      const w = caja.clientWidth
      const h = caja.clientHeight
      if (w === 0 || h === 0) return
      // `setSize(w, h)` y no `(w, h, false)`: con `false` Three cambia el búfer
      // pero deja el CSS del lienzo intacto y a DPR 2 el canvas se muestra al
      // doble. Es el mismo tropiezo que documenta Dice3D.
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      const nuevo = encuadre()
      // Solo la primera medida coloca la cámara: recolocarla en cada cambio de
      // tamaño (girar el teléfono, aparecer el teclado) le arrancaría el zoom
      // de las manos a quien la está moviendo.
      if (!encuadrado) { dist = nuevo; encuadrado = true }
      distAjuste = nuevo
      dist = Math.min(Math.max(dist, rSistema * 0.22), distAjuste * 2.2)
      pedirCuadro()
    }

    const ro = new ResizeObserver(() => ajustar())
    ro.observe(caja)

    const io = new IntersectionObserver(entradas => {
      enPantalla = entradas.some(e => e.isIntersecting)
      reevaluar()
    }, { threshold: 0.01 })
    io.observe(caja)

    const alCambiarVisibilidad = () => reevaluar()
    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    const alCambiarMovimiento = () => { recolocar = true; reevaluar() }
    reducido.addEventListener('change', alCambiarMovimiento)

    // ── Puntero: orbitar, pellizcar y tocar ──
    const lienzo = renderer.domElement
    const punteros = new Map<number, { x: number; y: number }>()
    let pinchIni = 0
    let distIni = 0
    let toqueX = 0
    let toqueY = 0
    let toqueT = 0
    let esToque = false

    /**
     * Qué planeta hay bajo el dedo.
     *
     * Se resuelve proyectando a pantalla en vez de con `Raycaster`: un planeta
     * mide entre 7 y 21 px y un dedo cubre 40, así que el rayo exacto falla más
     * de lo que acierta. Acá gana el más CERCANO dentro de un radio generoso,
     * que es lo que la persona quiso tocar. Es O(n) y solo corre al soltar.
     */
    function planetaEn(px: number, py: number): string | null {
      // La cámara se recoloca ANTES de proyectar. Girar solo cambia `theta` y
      // `phi`; quien mueve la cámara de verdad es el cuadro. Sin esto, soltar el
      // dedo justo después de arrastrar proyectaría con la cámara de un cuadro
      // atrás y el toque podría caer en el planeta vecino.
      colocarCamara()
      let mejor: string | null = null
      let mejorD = Infinity
      for (const c of cuerpos) {
        const p = aPantalla(c.x, c.z)
        if (!p) continue
        const d = Math.hypot(p.px - px, p.py - py)
        const umbral = Math.min(30, Math.max(14, c.radio * escalaEn(c.x, c.z) + 10))
        if (d <= umbral && d < mejorD) { mejorD = d; mejor = c.id }
      }
      return mejor
    }

    function coords(e: PointerEvent): { x: number; y: number } {
      const r = lienzo.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    function alBajar(e: PointerEvent): void {
      const c = coords(e)
      lienzo.setPointerCapture(e.pointerId)
      punteros.set(e.pointerId, c)
      if (punteros.size === 1) {
        esToque = true
        toqueX = c.x; toqueY = c.y; toqueT = performance.now()
      } else {
        // Con dos dedos ya no es un toque; empieza el pellizco.
        esToque = false
        const [a, b] = [...punteros.values()]
        pinchIni = Math.hypot(a.x - b.x, a.y - b.y)
        distIni = dist
      }
    }

    function alMover(e: PointerEvent): void {
      const c = coords(e)
      if (!punteros.has(e.pointerId)) {
        // Sin botón apretado solo interesa el cursor de escritorio.
        if (e.pointerType === 'mouse') {
          lienzo.style.cursor = planetaEn(c.x, c.y) ? 'pointer' : 'grab'
        }
        return
      }
      const prev = punteros.get(e.pointerId)!
      punteros.set(e.pointerId, c)

      if (punteros.size === 1) {
        theta -= (c.x - prev.x) * 0.0075
        // Se topa el ángulo polar: a 0 la escena se ve en planta y a π/2 de
        // canto, y de canto los anillos son rayas y no se puede tocar nada.
        phi = Math.min(1.32, Math.max(0.16, phi - (c.y - prev.y) * 0.0075))
        if (Math.hypot(c.x - toqueX, c.y - toqueY) > 10) esToque = false
      } else if (punteros.size === 2 && pinchIni > 0) {
        const [a, b] = [...punteros.values()]
        const ahora = Math.hypot(a.x - b.x, a.y - b.y)
        if (ahora > 0) {
          dist = Math.min(Math.max(distIni * (pinchIni / ahora), rSistema * 0.22), distAjuste * 2.2)
        }
      }
      pedirCuadro()
    }

    function alSubir(e: PointerEvent): void {
      const c = coords(e)
      if (lienzo.hasPointerCapture(e.pointerId)) lienzo.releasePointerCapture(e.pointerId)
      punteros.delete(e.pointerId)
      if (punteros.size < 2) pinchIni = 0
      if (esToque && punteros.size === 0 && performance.now() - toqueT < 500) {
        alSeleccionarRef.current(planetaEn(c.x, c.y))
      }
      esToque = false
      pedirCuadro()
    }

    function alRodar(e: WheelEvent): void {
      // Va con `addEventListener` y no como prop de React para poder cancelar:
      // sin `preventDefault` la rueda desplaza la página en vez de acercar.
      e.preventDefault()
      dist = Math.min(Math.max(dist * Math.exp(e.deltaY * 0.0012), rSistema * 0.22), distAjuste * 2.2)
      pedirCuadro()
    }

    function alPerderContexto(e: Event): void {
      e.preventDefault()
      parar()
      alFallarRef.current?.()
    }

    lienzo.style.cursor = 'grab'
    lienzo.addEventListener('pointerdown', alBajar)
    lienzo.addEventListener('pointermove', alMover)
    lienzo.addEventListener('pointerup', alSubir)
    lienzo.addEventListener('pointercancel', alSubir)
    lienzo.addEventListener('wheel', alRodar, { passive: false })
    lienzo.addEventListener('webglcontextlost', alPerderContexto)

    // Escena y cámara quedan colocadas YA, sin esperar al primer cuadro: si
    // alguien toca antes, `cuerpos` tiene que traer posiciones de verdad y la
    // cámara su matriz, o el acierto del dedo apunta a otro lado.
    ajustar()
    colocar()
    colocarCamara()
    recolocar = false
    reevaluar()
    pedirCuadro()

    mandoRef.current = {
      seleccionar: (id: string | null) => { seleccionActual = id; pedirCuadro() },
    }

    return () => {
      mandoRef.current = null
      parar()
      cancelAnimationFrame(rafSuelto)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      reducido.removeEventListener('change', alCambiarMovimiento)
      lienzo.removeEventListener('pointerdown', alBajar)
      lienzo.removeEventListener('pointermove', alMover)
      lienzo.removeEventListener('pointerup', alSubir)
      lienzo.removeEventListener('pointercancel', alSubir)
      lienzo.removeEventListener('wheel', alRodar)
      lienzo.removeEventListener('webglcontextlost', alPerderContexto)

      // WebGL no se libera solo: sin esto, entrar y salir de la Galaxia deja
      // contextos vivos hasta que el navegador empieza a cortar los más viejos.
      geoSol.dispose(); matSol.dispose()
      texResplandor.dispose(); matResplandor.dispose()
      geoOrbitas.dispose(); matOrbitas.dispose()
      geoPlaneta.dispose(); matPlaneta.dispose()
      malla.dispose()
      geoAro.dispose(); matAroYo.dispose(); matAroSel.dispose()
      geoEstrellas.dispose(); texPunto.dispose(); matEstrellas.dispose()
      luzSol.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      miId = null
    }
  }, [planetas])

  // La selección la manda la pantalla: se le pasa a la escena por el mando en
  // vez de reconstruirla, que costaría recompilar shaders en cada toque.
  useEffect(() => {
    mandoRef.current?.seleccionar(seleccion)
  }, [seleccion])

  const nombreYo = planetas.find(p => p.esYo)?.nombre

  return (
    <div
      ref={cajaRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        // El degradado del espacio va en CSS, detrás del lienzo transparente:
        // pintarlo en WebGL costaría relleno de pantalla completa por cuadro.
        background:
          'radial-gradient(circle at 50% 45%, #131c33 0%, #0a0f1d 55%, #05070f 100%)',
      }}
      role="img"
      aria-label={
        `Mapa 3D de la comunidad: ${planetas.length} planetas en órbita.` +
        (nombreYo ? ` El tuyo es ${nombreYo}.` : '')
      }
    >
      {/* Dos rótulos de HTML movidos solo con transform. Texto nítido a
          cualquier zoom, sin texturas ni materiales extra. */}
      <div
        ref={etiquetaYoRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full
                   border border-swu-cyan/50 bg-black/70 px-2 py-0.5 text-[10px]
                   font-semibold text-swu-cyan"
        style={{ visibility: 'hidden' }}
      />
      <div
        ref={etiquetaSelRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full
                   border border-swu-amber/50 bg-black/70 px-2 py-0.5 text-[10px]
                   font-semibold text-swu-amber"
        style={{ visibility: 'hidden' }}
      />
    </div>
  )
}

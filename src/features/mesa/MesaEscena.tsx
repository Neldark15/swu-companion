/**
 * MesaEscena — la partida del simulador, dibujada como una mesa de verdad.
 *
 * Mismo patrón de montaje que `Dice3D.tsx` y `GalaxiaEscena.tsx`: ref al
 * contenedor, renderer creado dentro del efecto, bucle con rAF y limpieza
 * completa en el return. Sin @react-three/fiber ni drei — `three` pelado, que
 * es lo que este repo ya sabe hacer y ya viaja en su propio chunk.
 *
 * ── Cero luces, a propósito ───────────────────────────────────────────
 *
 * Todo es `MeshBasicMaterial`. El arte de las cartas ya viene iluminado por
 * el ilustrador: alumbrarlo otra vez solo lo apaga. Y sin luces no hay
 * variantes de shader que compilar al entrar, que es el tirón que se siente
 * en un teléfono al abrir una pantalla 3D. La profundidad la ponen la
 * perspectiva, el ángulo de las cartas y la sombra pintada del tapete.
 *
 * ── La caché de texturas es del MONTAJE, no del módulo ────────────────
 *
 * Un `Map<url, Texture>` a nivel de módulo compartiría texturas entre visitas
 * —bonito— pero nadie las liberaría nunca: se sale de la mesa y los ~30 PNG
 * de 286×400 (≈14 MB de VRAM) se quedan puestos. Aquí la caché vive en la
 * instancia y se libera entera al desmontar. Dentro del montaje sí es
 * compartida, que es lo que de verdad hacía falta: un mazo lleva 3 copias de
 * cada carta y las 3 apuntan a la MISMA textura.
 *
 * ── Lo que se carga y cuándo ──────────────────────────────────────────
 *
 * Las texturas se piden cuando la carta APARECE en la mesa, no al abrir la
 * pantalla. Medido: los PNG oficiales pesan 150-210 KB cada uno, así que
 * precargar las ~28 cartas de una partida serían ~5 MB de golpe. Repartidas
 * por las 12 rondas, y con la caché del navegador que ya comparte con
 * `CardImage`, la mesa arranca al instante.
 *
 * ── Los líderes y las bases van APAISADOS… menos el líder desplegado ──
 *
 * El arte oficial es 400×286 en líderes y bases, y 286×400 en todo lo demás.
 * Meter uno en el hueco del otro es el bug que ya salió cuatro veces en este
 * repo. Aquí la orientación la decide `arte.apaisada`, que sale del tipo de
 * carta que declara el propio simulador.
 *
 * Con UNA excepción, que es la regla del juego: al desplegarse, un líder se
 * VOLTEA a su cara de unidad y pasa a la arena como una unidad más. Esa cara
 * es el dorso de la carta y es VERTICAL (286×400 medido sobre el arte
 * oficial). Dibujarlo apaisado en la fila hacía dos cosas mal a la vez:
 * enseñaba la cara sin desplegar de un líder ya desplegado, y como el apaisado
 * mide 1,92 de ancho contra el 1,72 del hueco más grande, se salía SIEMPRE de
 * su sitio y pisaba a la vecina (0,34 de solape con 7 unidades en fila).
 */

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { EstadoMesa, LadoMesa, UnidadMesa } from './reproductor'
import { vidaVisible, enArena } from './reproductor'
import type { Lado, Arena } from '../lab/simApi'

/** Lo mínimo para pintar una carta: su arte y si va tumbada. */
export interface ArteCarta {
  url: string
  apaisada: boolean
  /**
   * La cara de UNIDAD de un líder — su dorso.
   *
   * Un líder tiene dos caras y son de distinta forma: el frente es 400×286
   * (apaisado, el que se ve en su zona) y el dorso es 286×400 (vertical, la
   * unidad en la que se convierte al desplegarse). Verificado sobre el arte
   * oficial, no supuesto. `null` en todo lo que no sea un líder de dos caras.
   */
  dorso: string | null
}

interface Props {
  estado: EstadoMesa
  /** nombre de carta → arte. Lo arma `MesaPage` desde la base local. */
  arte: Map<string, ArteCarta>
  /** Cuánto dura la transición hacia este estado. 0 = sin animación. */
  duracion: number
  className?: string
  /**
   * Se llama cuando la mesa NO se puede dibujar: el renderer no se pudo crear,
   * o el navegador perdió el contexto en marcha.
   *
   * Sin esto había dos agujeros medidos. Con `getContext` devolviendo null, el
   * montaje hacía `catch { return }` y la pantalla quedaba en un rectángulo
   * negro de 52vh con el pie «arrastra para girar» encima y NADA dentro — sin
   * lienzo, sin texto y sin error en consola. Y con
   * `WEBGL_lose_context.loseContext()` sobre una mesa viva, el lienzo se
   * congelaba sin avisar a nadie. `GalaxiaEscena` ya tenía las dos salidas;
   * la Mesa no heredó ninguna.
   */
  onSinWebGL?: () => void
}

/* ── Medidas de la mesa, en unidades de escena ───────────────────────── */

const CARTA_ANCHO = 1.5
const RATIO_VERTICAL = 400 / 286      // alto/ancho de una carta normal
const RATIO_APAISADO = 286 / 400

/** Lo que mide una fila de lado a lado. Con más cartas, se solapan. */
const ANCHO_FILA = 9.6
const PASO_MAX = 1.72

/**
 * La z de cada fila. El orden bajando por la pantalla es:
 * base+líder del rival · su espacio · su tierra ┃ mi tierra · mi espacio ·
 * mi base+líder. Cada jugador tiene lo suyo JUNTO —que es como se lee una
 * partida— y el combate terrestre queda en el centro, que es donde pasa.
 */
const FILA_Z: Record<string, number> = {
  'B:zona': -9.7, 'B:espacio': -6.3, 'B:tierra': -2.6,
  'A:tierra': 2.6, 'A:espacio': 6.3, 'A:zona': 9.7,
}
/** De dónde salen volando las cartas al entrar: la mano, fuera de cuadro. */
const MANO_Z: Record<Lado, number> = { A: 13.5, B: -13.5 }

const clave = (lado: Lado, arena: Arena) => `${lado}:${arena}`

/**
 * Qué cara de la carta toca dibujar.
 *
 * `frente` es la de la zona —el líder sin desplegar, la base—; `unidad` es la
 * de la arena. Solo importa en los líderes, que son los únicos con dos caras,
 * pero se pide siempre: así el sitio de llamada declara qué está colocando y
 * no hay que adivinarlo por el uid.
 */
type Cara = 'frente' | 'unidad'

/** Inclinación de las cartas hacia la cámara: tumbadas del todo no se leen. */
const INCLINACION = -Math.PI / 2 + 0.34
/** Lo que gira una carta agotada. En SWU agotar es girar la carta. */
const GIRO_AGOTADO = 0.42

const COLOR_A = 0x22d3ee
const COLOR_B = 0xf87171

/* ── Dibujos de apoyo, hechos con canvas ─────────────────────────────── */

/** El tapete: un degradado radial y las líneas de las filas. */
function texturaTapete(): THREE.Texture {
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(S / 2, S / 2, S * 0.08, S / 2, S / 2, S * 0.62)
  g.addColorStop(0, '#131a2b')
  g.addColorStop(1, '#080b14')
  x.fillStyle = g
  x.fillRect(0, 0, S, S)
  // La línea central: separa las dos mitades sin dibujar un marco.
  x.strokeStyle = 'rgba(34,211,238,0.22)'
  x.lineWidth = 3
  x.beginPath(); x.moveTo(0, S / 2); x.lineTo(S, S / 2); x.stroke()
  x.strokeStyle = 'rgba(148,163,184,0.09)'
  x.lineWidth = 1.5
  for (const f of [0.22, 0.36, 0.64, 0.78]) {
    x.beginPath(); x.moveTo(S * 0.06, S * f); x.lineTo(S * 0.94, S * f); x.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Una etiqueta de texto sobre fondo transparente, para rótulos y cifras. */
function texturaTexto(texto: string, color: string, tam = 76): THREE.Texture {
  const W = 256, H = 128
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const x = c.getContext('2d')!
  x.font = `700 ${tam}px ui-sans-serif, system-ui, sans-serif`
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  // Un contorno oscuro: sin él las cifras claras se pierden sobre el arte.
  x.lineWidth = 8
  x.strokeStyle = 'rgba(2,6,23,0.92)'
  x.strokeText(texto, W / 2, H / 2)
  x.fillStyle = color
  x.fillText(texto, W / 2, H / 2)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/* ── El motor de la escena ───────────────────────────────────────────── */

/** Una carta viva en la escena, con su animación en curso. */
interface Ficha {
  uid: number
  malla: THREE.Mesh
  material: THREE.MeshBasicMaterial
  /** Aro de color bajo la carta: de quién es y si está condenada. */
  aro: THREE.Mesh
  destino: THREE.Vector3
  origen: THREE.Vector3
  giroDestino: number
  giroOrigen: number
  /** 0 → 1. En reposo vale 1. */
  t: number
  /** Cuánto dura el viaje, en ms. */
  dur: number
  /** Se está yendo: cae y se desvanece, y al terminar se destruye. */
  muriendo: boolean
  /** Sacudida del ataque: desplazamiento hacia el objetivo. */
  embiste: THREE.Vector3 | null
}

/** Una cifra que sube y se desvanece (daño a la base, golpes). */
interface Cifra {
  sprite: THREE.Sprite
  material: THREE.SpriteMaterial
  desde: THREE.Vector3
  t: number
}

interface Motor {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  geoCarta: THREE.PlaneGeometry
  geoAro: THREE.PlaneGeometry
  texturas: Map<string, THREE.Texture>
  /** Texturas de cifras, cacheadas por el texto: «-4» se repite mucho. */
  textos: Map<string, THREE.Texture>
  fichas: Map<number, Ficha>
  cifras: Cifra[]
  /** Todo lo que hay que liberar al desmontar y no está en los mapas. */
  basura: (THREE.Texture | THREE.Material | THREE.BufferGeometry)[]
  vidaA: THREE.Sprite
  vidaB: THREE.Sprite
  orbita: { az: number; el: number; zoom: number }
  raf: number
  /**
   * Los DOS estados van separados a propósito.
   *
   * Antes el `IntersectionObserver` y el `visibilitychange` escribían la MISMA
   * variable `visible`, así que con la mesa fuera de pantalla bastaba cambiar
   * de pestaña y volver para que se pusiera a dibujar a fondo detrás del resto
   * de la página hasta que el observador volviera a hablar. `GalaxiaEscena`
   * mantiene los dos y los combina; este es ese patrón.
   */
  enPantalla: boolean
  pestanaVisible: boolean
  reducido: boolean
  ultimoIndice: number
}

/** ¿Hay que estar dibujando? */
const debeDibujar = (m: Motor) => m.enPantalla && m.pestanaVisible

/** Suavizado: sale rápido y frena. Lo mismo que usa Dice3D. */
const suave = (t: number) => 1 - Math.pow(1 - t, 3)

export function MesaEscena({ estado, arte, duracion, className = '', onSinWebGL }: Props) {
  const cajaRef = useRef<HTMLDivElement>(null)
  const motorRef = useRef<Motor | null>(null)
  // El aviso va por ref para que cambiar la función no vuelva a montar la
  // escena entera — mismo motivo que en GalaxiaEscena.
  const avisoRef = useRef(onSinWebGL)
  // Un cuadro suelto a petición. Lo llena el montaje; con movimiento reducido
  // es la ÚNICA forma de que la mesa se repinte, porque el bucle no corre.
  const pedirCuadroRef = useRef<() => void>(() => {})
  // En un efecto y no durante el render (regla `react-hooks/refs`). Va PRIMERO
  // a propósito: React los corre en orden de declaración, así que el de
  // montaje ya encuentra el ref con el valor de este render. Mismo patrón que
  // `GalaxiaEscena`.
  useEffect(() => { avisoRef.current = onSinWebGL })

  /* ── Montaje: una sola vez ── */
  useEffect(() => {
    const caja = cajaRef.current
    if (!caja) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x05070d)
    const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 200)

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' })
    } catch {
      // Antes esto era `return` a secas: la pantalla se quedaba en un
      // rectángulo negro sin lienzo, sin texto y sin error. Ahora se avisa y
      // `MesaPage` cae al reproductor plano, que tiene los mismos datos.
      avisoRef.current?.()
      return
    }
    // Por encima de 2 el teléfono calienta sin que se note la mejora.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'
    caja.appendChild(renderer.domElement)

    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    // El tapete.
    const texTapete = texturaTapete()
    const matTapete = new THREE.MeshBasicMaterial({ map: texTapete })
    const geoTapete = new THREE.PlaneGeometry(13.4, 23)
    const tapete = new THREE.Mesh(geoTapete, matTapete)
    tapete.rotation.x = -Math.PI / 2
    tapete.position.y = -0.02
    scene.add(tapete)

    // Rótulos de las cuatro filas, en el borde izquierdo del tapete.
    const basura: Motor['basura'] = [texTapete, matTapete, geoTapete]
    const geoRotulo = new THREE.PlaneGeometry(2.1, 1.05)
    basura.push(geoRotulo)
    for (const [k, z] of Object.entries(FILA_Z)) {
      const [lado, arena] = k.split(':')
      if (arena === 'zona') continue
      const tex = texturaTexto(arena.toUpperCase(), 'rgba(148,163,184,0.5)', 46)
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
      const m = new THREE.Mesh(geoRotulo, mat)
      m.rotation.x = -Math.PI / 2
      m.position.set(-6.05, 0.01, z)
      scene.add(m)
      basura.push(tex, mat)
      void lado
    }

    // Los dos marcadores de vida.
    const hacerVida = (z: number, color: number) => {
      // Nace SIN textura: la pone `ponerVida` en la primera sincronización,
      // sacándola de la caché de textos. Con una textura de arranque hecha
      // aquí, esa primera quedaba fuera de la caché y nadie la liberaba —
      // medido, dos texturas por visita a la mesa.
      const mat = new THREE.SpriteMaterial({ transparent: true, depthTest: false })
      const s = new THREE.Sprite(mat)
      s.scale.set(3.2, 1.6, 1)
      s.position.set(4.9, 1.5, z)
      s.renderOrder = 20
      scene.add(s)
      basura.push(mat)
      void color
      return s
    }
    const vidaB = hacerVida(FILA_Z['B:zona'], COLOR_B)
    const vidaA = hacerVida(FILA_Z['A:zona'], COLOR_A)

    const motor: Motor = {
      renderer, scene, camera,
      geoCarta: new THREE.PlaneGeometry(1, 1),
      geoAro: new THREE.PlaneGeometry(1, 1),
      texturas: new Map(), textos: new Map(),
      fichas: new Map(), cifras: [], basura,
      vidaA, vidaB,
      orbita: { az: 0, el: 0.95, zoom: 1 },
      raf: 0, enPantalla: true, pestanaVisible: !document.hidden,
      reducido, ultimoIndice: -1,
    }
    motorRef.current = motor

    /* ── Encuadre ── */
    const ajustar = () => {
      const w = caja.clientWidth
      // Si el contenedor no impone altura, el lienzo se queda con los 300 px
      // que trae WebGL por defecto Y encima define la altura del contenedor,
      // que era `h-full` de nada: la mesa quedaba en una franja y el resto de
      // la caja, vacío. La proporción de reserva es vertical porque la mesa se
      // lee a lo largo. Es la misma red de seguridad que tiene Dice3D.
      const h = caja.clientHeight || Math.round(w * 1.25)
      if (w === 0 || h === 0) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      colocarCamara(motor)
    }
    ajustar()
    const ro = new ResizeObserver(ajustar)
    ro.observe(caja)

    /* ── El dedo orbita ── */
    let arrastrando = false
    let ultimo = { x: 0, y: 0 }
    const activos = new Map<number, { x: number; y: number }>()
    let pellizco = 0

    const abajo = (e: PointerEvent) => {
      activos.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (activos.size === 1) { arrastrando = true; ultimo = { x: e.clientX, y: e.clientY } }
      if (activos.size === 2) pellizco = distanciaDedos(activos)
      // `setPointerCapture` lanza `NotFoundError` si el puntero ya no está
      // activo — pasa de verdad cuando el `pointerup` se adelanta al
      // `pointerdown` (dos dedos, o un ratón que sale de la ventana). El
      // estado no se corrompe, pero salía como error no capturado en consola.
      try { renderer.domElement.setPointerCapture(e.pointerId) } catch { /* el dedo ya se fue */ }
    }
    const mover = (e: PointerEvent) => {
      if (!activos.has(e.pointerId)) return
      activos.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (activos.size >= 2) {
        const d = distanciaDedos(activos)
        if (pellizco > 0) {
          // El pellizco mueve el ZOOM, no la distancia: la distancia se
          // recalcula con la elevación en cada fotograma de órbita, así que
          // tocarla a mano se perdería en cuanto la persona girara la mesa.
          motor.orbita.zoom = THREE.MathUtils.clamp(motor.orbita.zoom * (pellizco / d), 0.5, 1.7)
          colocarCamara(motor)
          pedirCuadro()
        }
        pellizco = d
        return
      }
      if (!arrastrando) return
      motor.orbita.az = THREE.MathUtils.clamp(motor.orbita.az + (e.clientX - ultimo.x) * 0.006, -0.75, 0.75)
      // El techo se queda en 1,45 rad: más arriba se ve la mesa desde el
      // cenit y las cartas dejan de leerse.
      motor.orbita.el = THREE.MathUtils.clamp(motor.orbita.el - (e.clientY - ultimo.y) * 0.005, 0.42, 1.45)
      ultimo = { x: e.clientX, y: e.clientY }
      colocarCamara(motor)
      // Girar tiene que verse también con movimiento reducido, donde el bucle
      // está parado. Cuando el bucle corre, `pedirCuadro` no hace nada.
      pedirCuadro()
    }
    const arriba = (e: PointerEvent) => {
      activos.delete(e.pointerId)
      if (activos.size < 2) pellizco = 0
      if (activos.size === 0) arrastrando = false
    }
    // La rueda del ratón acerca y aleja. El pie dice «pellizca para acercar» y
    // con ratón de escritorio no había NINGUNA forma de hacerlo: solo estaban
    // registrados los cuatro eventos de puntero. `passive: false` porque hace
    // falta `preventDefault` para que la página no se desplace debajo.
    const rueda = (e: WheelEvent) => {
      e.preventDefault()
      motor.orbita.zoom = THREE.MathUtils.clamp(motor.orbita.zoom * (1 + e.deltaY * 0.0012), 0.5, 1.7)
      colocarCamara(motor)
      pedirCuadro()
    }
    renderer.domElement.addEventListener('pointerdown', abajo)
    renderer.domElement.addEventListener('pointermove', mover)
    renderer.domElement.addEventListener('pointerup', arriba)
    renderer.domElement.addEventListener('pointercancel', arriba)
    renderer.domElement.addEventListener('wheel', rueda, { passive: false })

    /* ── El bucle ── */

    /**
     * Un cuadro suelto, fuera del bucle.
     *
     * Con `prefers-reduced-motion` el bucle no corre, pero la mesa igual tiene
     * que repintarse cuando cambia algo (girar con el dedo, un paso nuevo).
     * Es lo mismo que hace `GalaxiaEscena`.
     */
    let rafSuelto = 0
    const pedirCuadro = () => {
      const m = motorRef.current
      if (!m || m.raf || rafSuelto || !debeDibujar(m)) return
      rafSuelto = requestAnimationFrame(() => {
        rafSuelto = 0
        const v = motorRef.current
        if (v) v.renderer.render(v.scene, v.camera)
      })
    }

    let anterior = performance.now()
    const animar = () => {
      const m = motorRef.current
      if (!m) return
      const ahora = performance.now()
      const dt = Math.min(ahora - anterior, 100)
      anterior = ahora
      avanzarAnimaciones(m, dt)
      m.renderer.render(m.scene, m.camera)
      m.raf = requestAnimationFrame(animar)
    }

    /**
     * Arranca o para el bucle DE VERDAD.
     *
     * Antes `requestAnimationFrame` se volvía a pedir siempre y solo se saltaba
     * el `render`, así que el rAF seguía latiendo a 60 Hz con la pestaña oculta
     * o la mesa fuera de pantalla — justo lo contrario de lo que decía su
     * comentario. Y con `prefers-reduced-motion` el bucle renderizaba cada
     * cuadro una escena congelada.
     */
    const reevaluar = () => {
      const m = motorRef.current
      if (!m) return
      const debe = debeDibujar(m) && !m.reducido
      if (debe && !m.raf) {
        anterior = performance.now()
        m.raf = requestAnimationFrame(animar)
      } else if (!debe && m.raf) {
        cancelAnimationFrame(m.raf)
        m.raf = 0
      }
      // Con movimiento reducido no hay bucle, pero sí un cuadro para que la
      // mesa no se quede en negro al volver a pantalla.
      if (!debe && debeDibujar(m)) pedirCuadro()
    }

    const io = new IntersectionObserver(([e]) => {
      const m = motorRef.current
      if (!m) return
      m.enPantalla = e.isIntersecting
      reevaluar()
    }, { threshold: 0.01 })
    io.observe(caja)

    const alCambiarVisibilidad = () => {
      const m = motorRef.current
      if (!m) return
      m.pestanaVisible = !document.hidden
      reevaluar()
    }
    document.addEventListener('visibilitychange', alCambiarVisibilidad)

    // El ajuste del sistema puede cambiar con la mesa abierta. Antes se leía
    // una sola vez al montar y no había forma de que la escena se enterara.
    const consultaReducido = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const alCambiarReducido = (e: MediaQueryListEvent) => {
      const m = motorRef.current
      if (!m) return
      m.reducido = e.matches
      reevaluar()
    }
    consultaReducido?.addEventListener?.('change', alCambiarReducido)

    /**
     * El navegador puede quitar el contexto en marcha (memoria, cambio de GPU,
     * o demasiados contextos vivos — ver la nota 2s). Sin este listener el
     * lienzo se quedaba CONGELADO sin avisar a nadie: medido con
     * `WEBGL_lose_context.loseContext()`, `perdido: true` y cero aviso.
     */
    const alPerderContexto = (e: Event) => {
      e.preventDefault()
      const m = motorRef.current
      if (m?.raf) { cancelAnimationFrame(m.raf); m.raf = 0 }
      avisoRef.current?.()
    }
    renderer.domElement.addEventListener('webglcontextlost', alPerderContexto)

    pedirCuadroRef.current = pedirCuadro
    // Un primer cuadro siempre, incluso con movimiento reducido: si no, la
    // mesa arranca en negro en vez de en el fondo de escena.
    renderer.render(scene, camera)
    reevaluar()

    return () => {
      const m = motorRef.current
      motorRef.current = null
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      consultaReducido?.removeEventListener?.('change', alCambiarReducido)
      renderer.domElement.removeEventListener('pointerdown', abajo)
      renderer.domElement.removeEventListener('pointermove', mover)
      renderer.domElement.removeEventListener('pointerup', arriba)
      renderer.domElement.removeEventListener('pointercancel', arriba)
      renderer.domElement.removeEventListener('wheel', rueda)
      // ANTES que `forceContextLoss`: si va después, la pérdida que provocamos
      // nosotros dispara el fallback y la pantalla dice «este navegador no
      // puede dibujar en 3D» para siempre. Es la nota 2s, al pie de la letra.
      renderer.domElement.removeEventListener('webglcontextlost', alPerderContexto)
      cancelAnimationFrame(rafSuelto)
      if (m) {
        cancelAnimationFrame(m.raf)
        // WebGL no se libera solo. Sin esto, entrar y salir de la mesa deja
        // ~14 MB de texturas de carta vivos hasta que el navegador corta el
        // contexto — y en un teléfono eso llega antes de lo que parece.
        for (const t of m.texturas.values()) t.dispose()
        for (const t of m.textos.values()) t.dispose()
        for (const f of m.fichas.values()) { f.material.map = null; f.material.dispose(); (f.aro.material as THREE.Material).dispose() }
        for (const c of m.cifras) c.material.dispose()
        for (const b of m.basura) b.dispose()
        m.geoCarta.dispose()
        m.geoAro.dispose()
        m.renderer.dispose()
        /*
         * `dispose()` NO devuelve el contexto WebGL: libera lo de three, pero
         * el contexto sigue vivo hasta que el navegador decide matarlo.
         *
         * Medido, 12 ciclos de montar/desmontar con CERO lienzos en el DOM:
         * 27 contextos creados, **18 vivos**, 9 ya matados por Chrome. Y no es
         * uno por visita a /mesa: `MesaPage` hace `setFase('cargando')` en cada
         * «Ver una partida» y en cada «Otra», lo que desmonta este bloque
         * entero — o sea UNO POR PARTIDA VISTA. Con 20 contextos Chrome mata
         * los más VIEJOS, que son Dice3D, Coin3D, Carta3D y la Galaxia: la
         * Mesa se llevaba por delante el 3D del resto de la app.
         *
         * `GalaxiaEscena` ya lo hacía; la Mesa no. Nota 2s: es obligatorio.
         */
        m.renderer.forceContextLoss()
      }
      renderer.domElement.remove()
    }
  }, [])

  /* ── Cada estado nuevo se sincroniza con la escena ── */
  useEffect(() => {
    const m = motorRef.current
    if (!m) return
    sincronizar(m, estado, arte, duracion)
    // Con movimiento reducido el bucle está parado, así que sin esto la mesa
    // se quedaba en el paso anterior hasta que alguien la girase con el dedo.
    if (m.reducido) pedirCuadroRef.current()
  }, [estado, arte, duracion])

  return (
    <div
      ref={cajaRef}
      className={`w-full h-full ${className}`}
      role="img"
      aria-label={`Mesa: base propia ${vidaVisible(estado.a)}, base rival ${vidaVisible(estado.b)}`}
    />
  )
}

/* ── Cámara ──────────────────────────────────────────────────────────── */

function distanciaDedos(activos: Map<number, { x: number; y: number }>): number {
  const [a, b] = [...activos.values()]
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * La caja que tiene que entrar en pantalla: las filas de punta a punta, los
 * rótulos del borde y la altura a la que flotan los marcadores de vida.
 */
const CAJA_X = 7.1
const CAJA_Y = 2.4
const CAJA_Z = 10.7
const ESQUINAS: [number, number, number][] = []
for (const x of [-CAJA_X, CAJA_X]) for (const y of [0, CAJA_Y]) for (const z of [-CAJA_Z, CAJA_Z]) ESQUINAS.push([x, y, z])

/** Cuánto del cuadro se llena. 0,94 deja un dedo de aire por los cuatro lados. */
const LLENADO = 0.94

/**
 * Coloca la cámara a la distancia JUSTA para que la mesa entre.
 *
 * Se hace PROYECTANDO las ocho esquinas de la caja del contenido y midiendo
 * cuánto se salen, no con una fórmula cerrada. Las dos fórmulas obvias fallan,
 * y las dos se probaron:
 *
 * · **Esfera envolvente.** La mesa mide 13×23, o sea radio 13,3. Encuadrar esa
 *   esfera dejaba el tapete ocupando el 40 % de la pantalla, rodeado de negro:
 *   la esfera reserva sitio para una diagonal que, vista desde arriba, no se
 *   ve nunca.
 * · **Aplastar la profundidad por el coseno.** Mejor, pero supone proyección
 *   ortográfica. Con perspectiva el borde CERCANO está mucho más cerca de la
 *   cámara que el lejano y ocupa bastante más pantalla, así que la mitad de
 *   abajo se salía del cuadro — que es exactamente lo que pasó.
 *
 * Proyectar y corregir no supone nada: cuatro vueltas de ocho puntos por
 * gesto de órbita, y encuadra igual de bien a cualquier elevación y en
 * cualquier proporción de pantalla.
 */
function colocarCamara(m: Motor) {
  const { az, el, zoom } = m.orbita
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  )
  const medioV = Math.tan((m.camera.fov * Math.PI) / 180 / 2)
  // Semilla razonable; las vueltas de abajo la corrigen.
  let dist = CAJA_Z / medioV
  const p = new THREE.Vector3()
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    m.camera.position.copy(dir).multiplyScalar(dist)
    m.camera.lookAt(0, 0, 0)
    m.camera.updateMatrixWorld()
    let peor = 0
    for (const [x, y, z] of ESQUINAS) {
      p.set(x, y, z).project(m.camera)
      peor = Math.max(peor, Math.abs(p.x), Math.abs(p.y))
    }
    if (peor === 0) break
    const factor = peor / LLENADO
    if (Math.abs(factor - 1) < 0.01) break
    dist *= factor
  }
  m.camera.position.copy(dir).multiplyScalar(dist * zoom)
  m.camera.lookAt(0, 0, 0)
}

/* ── Texturas ────────────────────────────────────────────────────────── */

const cargador = new THREE.TextureLoader()

/**
 * La textura de una carta, compartida dentro del montaje.
 *
 * Se devuelve la textura ANTES de que la imagen llegue: three la sube a la
 * GPU sola cuando termina. Así la carta aparece en su sitio con su aro de
 * color desde el primer fotograma y el arte entra encima, en vez de hacer un
 * hueco que salta.
 */
function textura(m: Motor, url: string): THREE.Texture {
  const ya = m.texturas.get(url)
  if (ya) return ya
  const t = cargador.load(url)
  t.colorSpace = THREE.SRGBColorSpace
  // Sin anisotropía las cartas del fondo, muy inclinadas, se ven pastosas.
  t.anisotropy = Math.min(4, m.renderer.capabilities.getMaxAnisotropy())
  m.texturas.set(url, t)
  return t
}

function textoCacheado(m: Motor, txt: string, color: string): THREE.Texture {
  const k = txt + '|' + color
  const ya = m.textos.get(k)
  if (ya) return ya
  const t = texturaTexto(txt, color)
  m.textos.set(k, t)
  return t
}

/* ── Sincronizar el estado con la escena ─────────────────────────────── */

/** Lo que separa a dos vecinas de una fila. Con muchas cartas, se solapan. */
const pasoFila = (total: number) => Math.min(PASO_MAX, ANCHO_FILA / Math.max(1, total))

/** Dónde va cada unidad de una fila, repartida y centrada. */
function sitio(indice: number, total: number, z: number): THREE.Vector3 {
  const paso = pasoFila(total)
  const ancho = (total - 1) * paso
  return new THREE.Vector3(-ancho / 2 + indice * paso, 0.02 + indice * 0.001, z)
}

function sincronizar(m: Motor, est: EstadoMesa, arte: Map<string, ArteCarta>, duracion: number) {
  // Un salto (arrastrar la barra, ir a una ronda) coloca todo de golpe: animar
  // 40 pasos a la vez sería un baile ilegible.
  const salto = Math.abs(est.indice - m.ultimoIndice) > 1 || m.ultimoIndice < 0
  const dur = m.reducido || salto ? 0 : duracion
  m.ultimoIndice = est.indice

  const vivos = new Set<number>()

  for (const [lado, l] of [['A', est.a], ['B', est.b]] as [Lado, LadoMesa][]) {
    for (const arena of ['tierra', 'espacio'] as Arena[]) {
      const fila = enArena(l, arena)
      const z = FILA_Z[clave(lado, arena)]
      fila.forEach((u, i) => {
        vivos.add(u.uid)
        const destino = sitio(i, fila.length, z)
        colocarFicha(m, u, lado, destino, arte, dur, 'unidad')
      })
    }
    // Zona de base y líder: dos cartas apaisadas, siempre visibles.
    // Sus uid entran en `vivos` porque abajo se barre TODO lo que no esté ahí:
    // sin esto se creaban y se destruían en la misma sincronización, y las dos
    // bases y los dos líderes no llegaban a dibujarse ni un fotograma.
    for (const uid of colocarZona(m, l, lado, est, arte)) vivos.add(uid)
  }

  // Las que se acaban de ir: caen y se desvanecen.
  for (const u of est.salientes) {
    const f = m.fichas.get(u.uid)
    if (!f) continue
    if (dur === 0) { destruirFicha(m, f); continue }
    f.muriendo = true
    f.t = 0
    f.dur = Math.max(260, dur)
    f.origen = f.malla.position.clone()
    f.destino = f.malla.position.clone().setY(-1.6)
    f.giroOrigen = f.malla.rotation.z
    f.giroDestino = f.malla.rotation.z + 1.1
  }

  // Y las que ya no están y tampoco se estaban muriendo (retroceder, saltar).
  for (const [uid, f] of [...m.fichas]) {
    if (vivos.has(uid) || f.muriendo) continue
    destruirFicha(m, f)
  }

  // Marcadores de vida.
  ponerVida(m, m.vidaA, vidaVisible(est.a), COLOR_A)
  ponerVida(m, m.vidaB, vidaVisible(est.b), COLOR_B)

  // Lo que se ve del evento: embestida del atacante y cifras flotantes.
  animarEvento(m, est, dur)
}

function ponerVida(m: Motor, s: THREE.Sprite, vida: number, color: number) {
  const mat = s.material as THREE.SpriteMaterial
  const tex = textoCacheado(m, String(vida), '#' + color.toString(16).padStart(6, '0'))
  if (mat.map !== tex) { mat.map = tex; mat.needsUpdate = true }
}

/**
 * Qué cara de la carta se ve y cómo de grande, resuelto en un sitio.
 *
 * `cara` es lo que separa al líder de su zona del líder ya desplegado: son la
 * MISMA carta con dos caras de distinta forma, y solo quien coloca sabe cuál
 * de las dos toca.
 */
function verCarta(a: ArteCarta | undefined, cara: Cara) {
  // En la arena, un líder enseña su dorso: la cara de unidad, que es vertical.
  const dorso = cara === 'unidad' ? a?.dorso ?? null : null
  const apaisada = dorso ? false : (a?.apaisada ?? false)
  // Un apaisado en la fila —solo pasa si a un líder le faltara el dorso— se
  // recorta al ancho de una carta normal. Más ancho que sus vecinas es lo que
  // hacía que se saliera del hueco y las pisara; que sea más CHICO no rompe
  // nada, y sigue con su proporción, que es lo que nunca se puede tocar.
  const w = apaisada && cara === 'unidad' ? CARTA_ANCHO : (apaisada ? CARTA_ANCHO * 1.28 : CARTA_ANCHO)
  return { url: dorso ?? a?.url ?? null, apaisada, w, h: w * (apaisada ? RATIO_APAISADO : RATIO_VERTICAL) }
}

/** Crea la carta si no existe y le fija su destino. */
function colocarFicha(
  m: Motor, u: UnidadMesa, lado: Lado, destino: THREE.Vector3,
  arte: Map<string, ArteCarta>, dur: number, cara: Cara,
) {
  let f = m.fichas.get(u.uid)
  const a = arte.get(u.nombre)
  const { url, w, h } = verCarta(a, cara)

  if (!f) {
    const material = new THREE.MeshBasicMaterial({
      // Sin arte todavía, un rectángulo del color del bando: la carta ocupa su
      // sitio desde el primer fotograma en vez de aparecer de la nada.
      color: url ? 0xffffff : (lado === 'A' ? COLOR_A : COLOR_B),
      map: url ? textura(m, url) : null,
      transparent: true,
      depthWrite: false,
    })
    const malla = new THREE.Mesh(m.geoCarta, material)
    malla.scale.set(w, h, 1)
    malla.rotation.x = INCLINACION

    const aro = new THREE.Mesh(m.geoAro, new THREE.MeshBasicMaterial({
      color: lado === 'A' ? COLOR_A : COLOR_B,
      transparent: true, opacity: 0.3, depthWrite: false,
    }))
    aro.scale.set(w * 1.14, h * 1.1, 1)
    aro.rotation.x = INCLINACION

    m.scene.add(malla)
    m.scene.add(aro)

    // Entra desde la mano: fuera de cuadro, por detrás de su dueño.
    const origen = new THREE.Vector3(destino.x * 0.4, 1.2, MANO_Z[lado])
    malla.position.copy(dur > 0 ? origen : destino)
    f = {
      uid: u.uid, malla, material, aro,
      destino: destino.clone(), origen,
      giroDestino: 0, giroOrigen: 0,
      t: dur > 0 ? 0 : 1, dur: Math.max(1, dur),
      muriendo: false, embiste: null,
    }
    m.fichas.set(u.uid, f)
  } else {
    if (!f.material.map && url) {
      // El arte llegó tarde (la carta se dibujó antes de resolverse su imagen).
      // Con él llega también la FORMA, así que la malla y su aro se reescalan:
      // el rectángulo de espera es vertical y la carta podría no serlo.
      f.material.map = textura(m, url)
      f.material.color.set(0xffffff)
      f.material.needsUpdate = true
      f.malla.scale.set(w, h, 1)
      f.aro.scale.set(w * 1.14, h * 1.1, 1)
    }
    if (f.muriendo) {
      // Resucita: se retrocedió justo encima de su muerte. Sin esto la carta
      // volvía a la mesa a medio desvanecer y, al terminar su animación de
      // caída, se destruía sola — una unidad viva desapareciendo del tablero.
      f.muriendo = false
      f.embiste = null
      f.t = 1
      f.malla.position.copy(destino)
    }
    f.material.opacity = 1
  }

  const giro = u.agotado ? GIRO_AGOTADO * (lado === 'A' ? 1 : -1) : 0
  const movido = !f.destino.equals(destino) || f.giroDestino !== giro
  if (movido) {
    f.origen = f.malla.position.clone()
    f.giroOrigen = f.malla.rotation.z
    f.destino = destino.clone()
    f.giroDestino = giro
    f.t = dur > 0 ? 0 : 1
    f.dur = Math.max(1, dur)
  }
  /*
   * Sin animación hay que colocarla A MANO. `avanzarAnimaciones` solo toca la
   * posición dentro de `if (f.t < 1)`, y aquí `f.t` ya vale 1: la carta se
   * quedaba donde estuviera y la MESA ENSEÑABA UNA FILA QUE NO ERA. Medido en
   * la partida de 161 eventos, llegando al paso 96 por seis caminos: la fila
   * de tierra del rival tiene 5 unidades y salía repartida como 4 (−2,58 /
   * −0,86 / 0,86 / 2,58 en vez de −3,44 / −1,72 / 0 / 1,72 / 3,44), y por otro
   * camino a paso 1,3714 —el reparto de SIETE—. Solo el salto 0 → 96 acertaba,
   * porque ahí todas las fichas nacen y las nuevas sí se posan en su sitio.
   *
   * `dur` es 0 en tres situaciones REALES, no de laboratorio: cualquier salto
   * (arrastrar la barra, los botones de ronda, volver al principio, retroceder),
   * y SIEMPRE con `prefers-reduced-motion` — a quien pide menos movimiento se
   * le enseñaba un tablero que no correspondía en cada paso.
   *
   * Va fuera del `if (movido)` a propósito: el error se quedaba PEGADO. Una vez
   * que `destino` era el bueno y la malla no, la sincronización siguiente veía
   * `movido === false` y no volvía a intentarlo nunca.
   */
  if (dur === 0) {
    f.malla.position.copy(f.destino)
    f.malla.rotation.z = f.giroDestino
    f.aro.position.set(f.destino.x, f.destino.y - 0.01, f.destino.z)
    f.aro.rotation.z = f.giroDestino
    f.embiste = null
    f.t = 1
  }
  // La condenada se marca en el aro: hay una mejora rival encima.
  //
  // El color necesita las DOS ramas. Con solo el `if`, retroceder por debajo
  // del `adjunta` hostil dejaba la unidad con el aro morado (ya a 0,3, así que
  // ni siquiera se leía como «condenada») en vez del color de su bando, y no
  // volvía a su sitio en toda la sesión: la opacidad se reiniciaba y el color
  // no.
  const matAro = f.aro.material as THREE.MeshBasicMaterial
  matAro.opacity = u.condenada ? 0.75 : 0.3
  matAro.color.set(u.condenada ? 0xa855f7 : (lado === 'A' ? COLOR_A : COLOR_B))
  // Herida: se apaga un poco, en proporción a lo que le queda.
  const salud = u.hp > 0 ? Math.max(0.25, u.resto / u.hp) : 1
  f.material.color.setScalar(f.material.map ? 0.45 + 0.55 * salud : 1)
}

/**
 * La base y el líder de un lado, en su zona.
 *
 * Se dibujan con uid negativos —fuera del espacio de las unidades— para poder
 * vivir en el mismo mapa de fichas y liberarse con todo lo demás. El líder se
 * apaga cuando se despliega: en ese momento su carta ya está en la mesa como
 * unidad y tenerlo en los dos sitios haría creer que hay dos.
 */
function colocarZona(
  m: Motor, l: LadoMesa, lado: Lado, est: EstadoMesa, arte: Map<string, ArteCarta>,
): number[] {
  const z = FILA_Z[clave(lado, 'zona' as Arena)]
  const base = pseudoUnidad(lado === 'A' ? -1 : -2, l.base, lado)
  const lider = pseudoUnidad(lado === 'A' ? -3 : -4, l.lider, lado)
  colocarFicha(m, base, lado, new THREE.Vector3(-1.5, 0.02, z), arte, 0, 'frente')
  colocarFicha(m, lider, lado, new THREE.Vector3(1.5, 0.02, z), arte, 0, 'frente')
  const f = m.fichas.get(lider.uid)
  if (f) f.material.opacity = l.liderDesplegado ? 0.22 : 1
  const fb = m.fichas.get(base.uid)
  // La base parpadea en rojo cuando el último evento la golpeó.
  if (fb) {
    const golpeada = est.ultimo?.t === 'base' && est.ultimo.lado === lado && est.ultimo.delta < 0
    fb.material.color.setScalar(golpeada ? 1 : 0.9)
  }
  return [base.uid, lider.uid]
}

function pseudoUnidad(uid: number, nombre: string, lado: Lado): UnidadMesa {
  return {
    uid, nombre, lado, arena: 'tierra', lider: true,
    poder: 0, hp: 1, resto: 1, mejoras: [], condenada: false,
    agotado: false, entroEn: 0,
  }
}

function destruirFicha(m: Motor, f: Ficha) {
  m.scene.remove(f.malla)
  m.scene.remove(f.aro)
  // El `map` NO se libera: es de la caché compartida y otras cartas del mismo
  // nombre lo están usando. Se libera entero al desmontar.
  f.material.map = null
  f.material.dispose()
  ;(f.aro.material as THREE.Material).dispose()
  m.fichas.delete(f.uid)
}

/* ── Lo que se ve de cada evento ─────────────────────────────────────── */

function animarEvento(m: Motor, est: EstadoMesa, dur: number) {
  const ev = est.ultimo
  if (!ev || dur === 0) return

  // Embestida: el atacante se lanza hacia su objetivo y vuelve.
  if (ev.t === 'ataca' && est.foco.actor !== null) {
    const f = m.fichas.get(est.foco.actor)
    if (f) {
      const hacia = ev.objetivo === 'base'
        ? new THREE.Vector3(0, 0, FILA_Z[clave(ev.lado === 'A' ? 'B' : 'A', 'zona' as Arena)])
        : (typeof est.foco.objetivo === 'number'
          ? m.fichas.get(est.foco.objetivo)?.malla.position.clone() ?? null
          : null)
      if (hacia) {
        f.embiste = hacia.sub(f.destino).normalize().multiplyScalar(0.85)
        f.t = 0
        f.dur = Math.max(1, dur)
        f.origen = f.destino.clone()
        // Reiniciar `t` reinicia también el tween del GIRO, así que su origen
        // tiene que ser dónde está la carta AHORA. Sin esto, un atacante que
        // ya venía girado volvería a girar desde cero al embestir.
        f.giroOrigen = f.malla.rotation.z
      }
    }
  }

  // Cifras flotantes: el golpe a la base y el daño a una unidad.
  if (ev.t === 'base') {
    const z = FILA_Z[clave(ev.lado, 'zona' as Arena)]
    soltarCifra(m, new THREE.Vector3(-1.5, 1.1, z),
      (ev.delta > 0 ? '+' : '') + ev.delta,
      ev.delta < 0 ? '#f87171' : '#4ade80')
  }
  if (ev.t === 'dano' && typeof est.foco.objetivo === 'number') {
    const f = m.fichas.get(est.foco.objetivo)
    if (f) soltarCifra(m, f.destino.clone().setY(1.0), ev.escudo ? 'escudo' : '-' + ev.n,
      ev.escudo ? '#38bdf8' : '#f87171')
  }
}

/** Máximo de cifras a la vez: más se solapan y no se lee ninguna. */
const MAX_CIFRAS = 6

function soltarCifra(m: Motor, desde: THREE.Vector3, txt: string, color: string) {
  if (m.cifras.length >= MAX_CIFRAS) {
    const vieja = m.cifras.shift()!
    m.scene.remove(vieja.sprite)
    vieja.material.dispose()
  }
  const material = new THREE.SpriteMaterial({
    map: textoCacheado(m, txt, color), transparent: true, depthTest: false,
  })
  const sprite = new THREE.Sprite(material)
  const ancho = txt.length > 3 ? 2.6 : 1.7
  sprite.scale.set(ancho, ancho * 0.5, 1)
  sprite.position.copy(desde)
  sprite.renderOrder = 30
  m.scene.add(sprite)
  m.cifras.push({ sprite, material, desde: desde.clone(), t: 0 })
}

const VIDA_CIFRA = 900

function avanzarAnimaciones(m: Motor, dt: number) {
  for (const [, f] of m.fichas) {
    if (f.t < 1) {
      f.t = Math.min(1, f.t + dt / f.dur)
      const s = suave(f.t)
      if (f.embiste) {
        // Ida y vuelta: sube hasta la mitad del recorrido y regresa.
        const vaiven = Math.sin(f.t * Math.PI)
        f.malla.position.copy(f.destino).addScaledVector(f.embiste, vaiven)
        f.malla.position.y = f.destino.y + vaiven * 0.55
        if (f.t >= 1) { f.embiste = null; f.malla.position.copy(f.destino) }
      } else {
        f.malla.position.lerpVectors(f.origen, f.destino, s)
        if (f.muriendo) f.material.opacity = 1 - s
      }
      /*
       * El giro va FUERA del `else`, y ese era el bug.
       *
       * `GIRO_AGOTADO` estaba muerto en el camino animado, que es el normal.
       * `aplicar()` marca `agotado` solo en `case 'ataca'`, y `animarEvento`
       * le da embestida a TODO atacante: la rama de arriba solo tocaba la
       * posición, así que la carta que acaba de atacar nunca se giraba. Peor:
       * `animarEvento` pisa `f.t = 0` y `f.origen` justo después de que
       * `colocarFicha` armara el tween, y a partir de ahí
       * `movido = … || f.giroDestino !== giro` es false PARA SIEMPRE — no se
       * reintentaba nunca. Es el mismo error que documenta el bloque de
       * `colocarFicha`, una rama más allá.
       *
       * Medido sobre la partida 1 del fixture, evento 21 (Outland Protector
       * ataca la base), donde el modelo dice `agotado: true`:
       *   reproducción animada  rotation.z = 0     (y seguía en 0 dos eventos después)
       *   mismo estado por salto rotation.z = 0,42  ✓
       * O sea: la misma mesa se veía distinta según cómo habías llegado.
       */
      f.malla.rotation.z = f.giroOrigen + (f.giroDestino - f.giroOrigen) * s
      if (f.muriendo && f.t >= 1) { destruirFicha(m, f); continue }
    }
    f.aro.position.set(f.malla.position.x, f.malla.position.y - 0.01, f.malla.position.z)
    f.aro.rotation.z = f.malla.rotation.z
    ;(f.aro.material as THREE.MeshBasicMaterial).opacity =
      Math.min((f.aro.material as THREE.MeshBasicMaterial).opacity, f.material.opacity)
  }

  for (let i = m.cifras.length - 1; i >= 0; i--) {
    const c = m.cifras[i]
    c.t += dt / VIDA_CIFRA
    if (c.t >= 1) {
      m.scene.remove(c.sprite)
      c.material.dispose()
      m.cifras.splice(i, 1)
      continue
    }
    c.sprite.position.set(c.desde.x, c.desde.y + c.t * 1.6, c.desde.z)
    c.material.opacity = 1 - c.t * c.t
  }
}

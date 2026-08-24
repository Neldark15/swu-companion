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
 *   1 InstancedMesh   → TODAS las lunas (una por logro, tope 9 por planeta):
 *                       otra sola llamada aunque haya 180.
 *   1 LineSegments    → TODAS las órbitas fundidas en un solo búfer, punteadas
 *                       gratis (se emite un segmento sí y otro no).
 *   1 Points          → el campo de estrellas, un búfer de 620 vértices.
 *   2 InstancedMesh   → los soles y sus resplandores. Uno por país, y la
 *                       cuenta NO crece con los países: ver abajo.
 *   2 Mesh            → los dos aros (yo / seleccionado), que comparten UNA
 *                       geometría de anillo.
 *
 * Son **8 llamadas de dibujo por cuadro**, y son 8 con 19 planetas o con 200,
 * la cuenta no depende de la comunidad. Medido contando `drawElements`,
 * `drawArrays` y `drawElementsInstanced` sobre el contexto real, con el
 * histograma de índices para saber qué es cada una:
 *
 *     idx2160 ×1  soles        inst1560 ×1  los 19 planetas (520 tri × 19)
 *     idx6    ×1  resplandores idx264   ×2  los dos aros
 *     v620    ×1  estrellas    v524     ×1  órbitas
 *
 * ── Varios soles, un solo dibujo ──
 *
 * Cada país es un sistema con su sol. Lo obvio —un `Mesh` y un `Sprite` por
 * país— llevaría de 8 llamadas a 8+2n: con cinco países son 18, y cada país
 * nuevo cuesta dos más para siempre. Así que los soles y los resplandores van
 * instanciados como ya iban los planetas y las lunas, y la cuenta se queda
 * clavada en 8 con uno o con veinte.
 *
 * El resplandor deja de ser `Sprite` porque un `Sprite` NO se puede instanciar
 * (three lo trata como un objeto suelto). Es un plano que mira a la cámara: la
 * misma cuenta que hace el `Sprite` por dentro, hecha acá para las n a la vez.
 *
 * ── Cada sol alumbra SOLO su sistema ──
 *
 * La luz del sol no tenía corte a propósito, para que los anillos exteriores
 * no quedaran negros. Con varios soles eso se vuelve un problema: sin corte,
 * los cinco alumbran a todos y los planetas se lavan a blanco.
 *
 * El corte se aplica AUNQUE la caída siga en cero, así que la luz se queda
 * plana dentro del sistema y se apaga antes de llegar al vecino. El número no
 * es a ojo: con el corte en 1,6 radios de sistema, el anillo exterior de casa
 * conserva el 72 % de la luz y al planeta más cercano del vecino le llega un
 * 2 %. Es lo que separa los sistemas sin apagar el propio.
 *
 * Con 19 planetas eso son 10.778 triángulos (720 + 9.880 + 176 + 2), muy por
 * debajo del umbral donde el número de llamadas empieza a costar.
 *
 * Los rótulos son DOS divs de HTML movidos con `transform`, no sprites: texto
 * nítido a cualquier zoom, cero texturas y cero materiales extra. Y el cuadro
 * NO lee geometría del DOM (ver `anchoCSS`/`altoCSS`): leer después de escribir
 * estilos forzaría un recálculo de layout dentro del cuadro.
 */

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RANKS } from '../../services/gamification'
import type { PlanetaJugador, SistemaSolar } from '../../services/galaxiaService'

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
 * Tamaño del planeta por MAGNITUD (0..1), que decide la pantalla según la
 * lente activa (nivel, colección, mazos, logros). La escena no sabe de lentes:
 * dibuja lo que le digan. La razón original sigue vigente — `victorias` es 0
 * en todas las cuentas y dimensionar por ahí daría planetas idénticos; por eso
 * las lentes disponibles son solo las magnitudes con varianza real.
 */
function radioPlaneta(magnitud: number): number {
  return 0.42 + 0.52 * Math.max(0, Math.min(1, magnitud))
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

// ─── Geometría de la galaxia (varios sistemas) ───────────

/** Aire entre el borde de un sistema y el del vecino. */
const AIRE = 8.0

/**
 * Alcance de la luz de un sol, en radios de su propio sistema.
 *
 * 1,6 no es a ojo. La atenuación de three con caída cero es
 * `(1 − (d/corte)⁴)²`, así que con el sistema de casa en r = 14,8 y el vecino
 * a 28,6: el anillo exterior propio (d = 14,8) conserva el 72 % y el planeta
 * más cercano del vecino (d = 22,8) recibe el 2 %. Subirlo lava el sistema de
 * al lado; bajarlo apaga el anillo exterior propio.
 */
const ALCANCE_SOL = 1.6

/**
 * El sol de un sistema chico NO puede medir lo mismo que el de uno grande.
 *
 * Se vio en el banco con los cinco soles: un sol de radio 2,0 dentro de un
 * sistema de 5,8 es una bola que se come a su propio planeta, y con cuatro de
 * esas alrededor la vista se convierte en faroles. Se escala con el sistema y
 * se topa en la mitad, para que un país de una persona siga teniendo un sol
 * visible y tocable en vez de un punto.
 */
function radioSol(radio: number, mayor: number): number {
  return RADIO_SOL * Math.max(0.5, Math.min(1, radio / Math.max(0.001, mayor)))
}

/** Hasta dónde llega un sistema: el anillo más externo y un poco de aire. */
function radioSistema(gente: PlanetaJugador[]): number {
  const kMax = gente.length ? Math.max(...gente.map(v => acomodo(v.orbita).k)) : 0
  return radioAnillo(kMax) + 1.2
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
  /** Centro del sistema al que pertenece. Ya no todos giran sobre el origen. */
  cx: number
  cz: number
  rOrbita: number
  angBase: number
  velocidad: number
  /** Posición DIBUJADA. La usa el acierto del dedo, que corre entre cuadros. */
  x: number
  z: number
}

interface Mando {
  seleccionar: (id: string | null) => void
  encuadrar: (todo: boolean) => void
  /**
   * Aplica una lente SIN reconstruir la escena.
   *
   * Cambiar de lente solo mueve dos números por planeta —`orbita` y
   * `magnitud`— pero `conLente` devuelve arreglos nuevos, y con `sistemas` en
   * las dependencias del efecto de montaje eso disparaba la limpieza completa:
   * `forceContextLoss()`, contexto nuevo, las dos texturas de canvas otra vez,
   * y three recompilando y enlazando los ~6 programas. `glLinkProgram` es
   * SÍNCRONO: en un Adreno/Mali de gama media son decenas de ms por programa,
   * con el hilo principal parado. Ese era el congelón al tocar una pestaña.
   *
   * Acá no se toca ni un shader: se reescriben los campos derivados de la
   * lente sobre los MISMOS `cuerpos` y se vuelve a colocar.
   */
  reacomodar: (sistemas: SistemaSolar[]) => void
}

interface Props {
  /**
   * Tiene que ser ESTABLE entre renders (memoizado). Es la dependencia del
   * efecto de montaje: un array nuevo en cada render reconstruye la escena
   * entera —y recompila shaders— en cada toque. Medido con el banco de pruebas:
   * pasándolo sin memoizar, un barrido de toques solo alcanzaba 8 de los 19
   * planetas porque el lienzo se reemplazaba a mitad de camino.
   *
   * Es la lista de SISTEMAS, uno por país. El de quien mira va al centro y el
   * resto lo rodea; con un solo sistema la escena queda igual que siempre.
   */
  sistemas: SistemaSolar[]
  /** Id del planeta resaltado. Lo controla la pantalla. */
  seleccion: string | null
  /**
   * Qué tanto se ve. Es un BOTÓN de la pantalla y no solo un pellizco, porque
   * al entrar la cámara encuadra el sistema propio y los otros soles quedan
   * FUERA de cuadro: sin un control visible, nadie descubre que hay más
   * galaxia que la suya. Alejar de arranque para que asomen costaría el 15 %
   * de tamaño que se acaba de ganar al repartir los países.
   */
  amplitud: 'sistema' | 'galaxia'
  onSeleccionar: (id: string | null) => void
  /** Se avisa si el navegador suelta el contexto 3D en marcha. */
  onSinWebGL?: () => void
  className?: string
}

export function GalaxiaEscena({
  sistemas, seleccion, amplitud, onSeleccionar, onSinWebGL, className = '',
}: Props) {
  // La lista plana la usan el rótulo accesible y el efecto. Se memoiza contra
  // `sistemas`, que ya viene memoizado de la pantalla: si se recalculara en
  // cada render, el efecto de montaje se dispararía en cada toque.
  const planetas = useMemo(() => sistemas.flatMap(s => s.planetas), [sistemas])

  /**
   * Qué obliga a RECONSTRUIR la escena, que no es lo mismo que «cambió algo».
   *
   * `conLente` devuelve arreglos nuevos en cada toque de pestaña, así que
   * `sistemas` como dependencia significaba reconstruir —y recompilar los
   * shaders— cuatro veces por curiosear. Pero la lente solo mueve `orbita` y
   * `magnitud`, y eso se reescribe en caliente (ver `reacomodar`).
   *
   * Lo que sí exige empezar de cero es lo que se hornea UNA vez al construir:
   * cuántas instancias hay, qué jugador ocupa cada índice, el color por
   * instancia (`nivel`), cuántas lunas cuelgan de cada planeta (`logros`), el
   * texto de cada rótulo y quién es «yo». Por eso van todos en la clave.
   *
   * Los planetas se ordenan POR ID antes de serializar: si se dejaran en el
   * orden de la lente, la clave cambiaría con cada pestaña y no habríamos
   * arreglado nada.
   */
  const claveEstructural = useMemo(
    () => sistemas.map(s =>
      `${s.nombre}|${s.bandera}|${s.planetas.length}|` +
      s.planetas
        .map(p => `${p.id}:${p.nivel}:${p.logros}:${p.esYo ? 1 : 0}:${p.nombre}`)
        .sort()
        .join(','),
    ).join(';'),
    [sistemas],
  )

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
  const amplitudRef = useRef(amplitud)
  useEffect(() => {
    alSeleccionarRef.current = onSeleccionar
    alFallarRef.current = onSinWebGL
    seleccionRef.current = seleccion
    amplitudRef.current = amplitud
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

    // ── Dónde cae cada sistema ──
    //
    // El de quien mira va al ORIGEN. No es un detalle de implementación: es lo
    // que hace que abrir la Galaxia se vea igual que siempre para los 24
    // salvadoreños, y que quien entre desde México no aterrice mirando un país
    // ajeno con el suyo de reojo en una esquina.
    const iHogar = Math.max(0, sistemas.findIndex(v => v.planetas.some(p => p.esYo)))
    const nSat = sistemas.length - 1
    const rHogar = radioSistema(sistemas[iHogar].planetas)
    const rSatMax = sistemas.length > 1
      ? Math.max(...sistemas.filter((_, i) => i !== iHogar).map(v => radioSistema(v.planetas)))
      : 0
    // Dos condiciones, y hay que cumplir las DOS: que el satélite no toque a
    // casa, y que los satélites no se toquen entre ellos. Hoy manda la primera
    // (28,6 contra 13,9), pero la segunda es la que evita que el día que haya
    // diez países se solapen en el mismo anillo.
    const dOrbita = nSat === 0 ? 0 : Math.max(
      rHogar + rSatMax + AIRE,
      nSat > 1 ? (2 * rSatMax + AIRE) / (2 * Math.sin(Math.PI / nSat)) : 0,
    )

    interface Sistema {
      nombre: string
      bandera: string
      cx: number
      cz: number
      kMax: number
      radio: number
      /** Radio del sol, que NO es el mismo en todos. Ver `radioSol`. */
      rSol: number
      etiqueta: HTMLDivElement | null
    }
    const enEscena: Sistema[] = sistemas.map((v, i) => {
      // El puesto del satélite en su anillo: los repartidos en partes iguales
      // y girados por el ángulo áureo, para que no se lea como un reloj.
      const j = i < iHogar ? i : i - 1
      const ang = AUREO + (j / Math.max(1, nSat)) * Math.PI * 2
      const kMax = v.planetas.length ? Math.max(...v.planetas.map(p => acomodo(p.orbita).k)) : 0
      return {
        nombre: v.nombre,
        bandera: v.bandera,
        cx: i === iHogar ? 0 : Math.cos(ang) * dOrbita,
        cz: i === iHogar ? 0 : Math.sin(ang) * dOrbita,
        kMax,
        radio: radioAnillo(kMax) + 1.2,
        rSol: RADIO_SOL,
        etiqueta: null,
      }
    })
    const rMayor = Math.max(...enEscena.map(v => v.radio))
    for (const v of enEscena) v.rSol = radioSol(v.radio, rMayor)
    const rGalaxia = nSat === 0 ? rHogar : dOrbita + rSatMax

    // Un rótulo de HTML por sol, hermano del lienzo. Solo si hay más de un
    // sistema: con uno solo no hay nada que distinguir y sería ruido.
    if (enEscena.length > 1) {
      for (const v of enEscena) {
        const el = document.createElement('div')
        el.className =
          'pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full ' +
          'border border-white/15 bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/75'
        el.setAttribute('aria-hidden', 'true')
        el.style.visibility = 'hidden'
        el.textContent = `${v.bandera} ${v.nombre}`
        caja.appendChild(el)
        v.etiqueta = el
      }
    }

    // ── Luces ──
    // Ambiente frío y bajo: el lado nocturno del planeta se ve, pero se ve
    // oscuro. Cada sol es una luz puntual SIN caída (decay 0) a propósito: con
    // caída física los anillos exteriores quedarían negros, y ahí es donde vive
    // la mayor parte de la comunidad. Lo que sí lleva es CORTE, que se aplica
    // aunque la caída siga en cero — es lo único que impide que los cinco soles
    // alumbren a todos a la vez y laven los planetas a blanco. Ver ALCANCE_SOL.
    scene.add(new THREE.AmbientLight(0x2a3350, 1.15))
    const luces = enEscena.map(v => {
      const l = new THREE.PointLight(0xffd9a0, 2.3, v.radio * ALCANCE_SOL, 0)
      l.position.set(v.cx, 0, v.cz)
      scene.add(l)
      return l
    })

    // ── Soles y resplandores: una llamada cada uno, haya los que haya ──
    const molde = new THREE.Matrix4()
    // La esfera se crea de radio 1 y el tamaño va en la escala de la instancia:
    // con un radio fijo en la geometría, cada sol distinto pediría su propia
    // geometría y con ella su propia llamada de dibujo.
    const geoSol = new THREE.SphereGeometry(1, 24, 16)
    const matSol = new THREE.MeshBasicMaterial({ color: 0xffd9a0 })
    const soles = new THREE.InstancedMesh(geoSol, matSol, enEscena.length)
    enEscena.forEach((v, i) => {
      molde.makeScale(v.rSol, v.rSol, v.rSol)
      molde.setPosition(v.cx, 0, v.cz)
      soles.setMatrixAt(i, molde)
    })
    soles.instanceMatrix.needsUpdate = true
    scene.add(soles)

    // El resplandor era un `Sprite` y ahora es un plano: un `Sprite` no se
    // puede instanciar. Mirar a la cámara es la misma cuenta que el `Sprite`
    // hacía por dentro, hecha acá para todos a la vez en `mirarResplandores`.
    const texResplandor = texturaResplandor()
    const geoResplandor = new THREE.PlaneGeometry(1, 1)
    const matResplandor = new THREE.MeshBasicMaterial({
      map: texResplandor, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const resplandores = new THREE.InstancedMesh(geoResplandor, matResplandor, enEscena.length)
    resplandores.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    scene.add(resplandores)
    const escalaGlow = new THREE.Vector3()

    // ── Cuerpos ──
    // El recorrido va sistema por sistema en el MISMO orden que `planetas`
    // (que es `flatMap` sobre `sistemas`), porque el color por instancia de más
    // abajo indexa por posición: si los dos órdenes se separaran, cada planeta
    // se pintaría con el rango de otro.
    const cuerpos: Cuerpo[] = []
    sistemas.forEach((v, i) => {
      const c = enEscena[i]
      for (const p of v.planetas) {
        const { k, hueco, cupo } = acomodo(p.orbita)
        cuerpos.push({
          id: p.id,
          nombre: p.nombre,
          radio: radioPlaneta(p.magnitud),
          cx: c.cx,
          cz: c.cz,
          rOrbita: radioAnillo(k),
          angBase: (hueco / cupo) * Math.PI * 2 + k * AUREO,
          velocidad: velocidadAnillo(k),
          x: 0,
          z: 0,
        })
      }
    })
    const kMax = Math.max(...planetas.map(p => acomodo(p.orbita).k))

    // ── Órbitas: un solo búfer para todos los anillos de todos los sistemas ──
    // Se emite un segmento sí y otro no, así el punteado sale de la geometría
    // (mitad de vértices) en vez de costar un LineDashedMaterial.
    const puntos: number[] = []
    for (const v of enEscena) {
      for (let k = 0; k <= v.kMax; k++) {
        const r = radioAnillo(k)
        const tramos = Math.max(72, Math.round(r * 11))
        for (let i = 0; i < tramos; i += 2) {
          const a0 = (i / tramos) * Math.PI * 2
          const a1 = ((i + 1) / tramos) * Math.PI * 2
          puntos.push(v.cx + Math.cos(a0) * r, 0, v.cz + Math.sin(a0) * r)
          puntos.push(v.cx + Math.cos(a1) * r, 0, v.cz + Math.sin(a1) * r)
        }
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

    // ── Lunas: los LOGROS de cada jugador, orbitando su planeta ──
    //
    // Es la forma de dato nueva que sí tiene cobertura total: las 20 cuentas
    // tienen entre 1 y 9 logros (contado en la base). Una luna por logro, tope
    // 9 — más de eso se vuelve un enjambre ilegible alrededor de un planeta
    // chico. TODAS las lunas de TODOS los planetas van en UN InstancedMesh:
    // una llamada de dibujo, igual que los planetas. Las matrices se
    // actualizan por cuadro (son ~80 con 20 jugadores; la Mesa mueve más).
    /**
     * `desfase` y no `rLocal`: la distancia de la luna a su planeta se DERIVA
     * del radio del planeta en cada cuadro, en vez de copiarse al construir.
     * Como la lente cambia el radio (`magnitud`), un `rLocal` copiado quedaba
     * viejo en cuanto el planeta cambiaba de tamaño y las lunas se metían
     * dentro de la bola o se despegaban. Derivado no puede quedar viejo.
     */
    interface Luna { planeta: number; desfase: number; vel: number; fase: number; inclinacion: number }
    const lunas: Luna[] = []
    planetas.forEach((p, i) => {
      const n = Math.min(9, Math.max(0, p.logros))
      for (let m = 0; m < n; m++) {
        lunas.push({
          planeta: i,
          // Escalonadas en dos pisos para que 9 no se pisen entre sí.
          desfase: 0.34 + (m % 2) * 0.17,
          // Cada una a su ritmo, y más rápido que los planetas: son chicas y
          // el movimiento es lo único que las separa visualmente del fondo.
          vel: 0.65 + (m * 0.11) % 0.5,
          fase: (m / n) * Math.PI * 2,
          // Planos distintos: todas en el ecuador parecían un aro punteado.
          inclinacion: ((m % 3) - 1) * 0.45,
        })
      }
    })
    const geoLuna = new THREE.SphereGeometry(0.085, 8, 6)
    const matLuna = new THREE.MeshBasicMaterial({ color: 0xcfe8ff })
    const mallaLunas = lunas.length ? new THREE.InstancedMesh(geoLuna, matLuna, lunas.length) : null
    if (mallaLunas) {
      mallaLunas.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      scene.add(mallaLunas)
    }

    // Asa de inspección SOLO en desarrollo (`import.meta.env.DEV` es literal:
    // el empaquetador poda el bloque en producción). Igual que `__mesa`: contar
    // cuerpos y lunas por números en vez de adivinar por píxeles.
    if (import.meta.env.DEV) {
      ;(window as unknown as { __galaxia?: unknown }).__galaxia = {
        cuerpos, lunas, enEscena, dOrbita, rGalaxia,
        // Estado vivo de la cámara. Sin esto, comprobar que tocar un sol muda
        // el objetivo obliga a leerlo de los píxeles, que es justo lo que este
        // archivo no quiere que se haga.
        estado: () => ({
          dist, distMin, distMax,
          objetivo: [objetivo.x, objetivo.z],
          meta: [objetivoMeta.x, objetivoMeta.z],
        }),
      }
    }

    // ── Aros de «yo» y «seleccionado»: comparten geometría ──
    const geoAro = new THREE.RingGeometry(0.86, 1, 44)
    /**
     * `forceSinglePass` no es un adorno: sin él los DOS aros cuestan CUATRO
     * llamadas de dibujo.
     *
     * Three dibuja todo material `transparent` + `DoubleSide` en dos pasadas
     * (primero las caras traseras, después las delanteras) para que una
     * superficie transparente vista de canto no se vea mal. Estos aros miran
     * siempre a la cámara —son carteles planos—, así que la pasada trasera se
     * descarta entera por winding: cero píxeles escritos, y aun así paga su
     * llamada. Peor: three cambia `material.side` y pone `needsUpdate = true`
     * dos veces por aro y por cuadro, y cada `needsUpdate` reconstruye la clave
     * de caché del programa (una cadena con ~50 propiedades) para volver a
     * buscar el MISMO shader.
     *
     * Medido con el histograma de índices por cuadro: `idx264` (la geometría
     * del aro) aparecía 4 veces, total 9 llamadas. Con el flag son 2 y 7.
     * Es el caso que la propia documentación de three nombra como ejemplo.
     */
    const matAroYo = new THREE.MeshBasicMaterial({
      color: 0x22d3ee, transparent: true, opacity: 0.85,
      side: THREE.DoubleSide, depthWrite: false, forceSinglePass: true,
    })
    const matAroSel = new THREE.MeshBasicMaterial({
      color: 0xf59e0b, transparent: true, opacity: 0.95,
      side: THREE.DoubleSide, depthWrite: false, forceSinglePass: true,
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
    //
    // Ya no orbita el origen sino un OBJETIVO que se puede mudar de sistema.
    // Ahí está la mitad del pedido: la galaxia entera es navegable, y sin
    // enseñar un gesto nuevo — se toca un sol o un planeta de otro país y la
    // cámara se muda. El zoom hacia afuera es la otra mitad, y alcanza para
    // ver los cinco a la vez.
    let theta = -0.55
    let phi = 0.66
    let dist = 40
    let distMin = 3
    let distMax = 120
    /** La PRIMERA medida fija el encuadre; las siguientes solo re-topan el zoom. */
    let encuadrado = false

    const objetivo = new THREE.Vector3(0, 0, 0)
    const objetivoMeta = new THREE.Vector3(0, 0, 0)

    /** Muda la cámara a ese punto. El cuadro la lleva, no salta. */
    function viajarA(cx: number, cz: number): void {
      objetivoMeta.set(cx, 0, cz)
    }

    /**
     * Encuadra el sistema propio o la galaxia entera.
     *
     * La usan el botón de la pantalla Y el montaje. Que la use el montaje no
     * es un adorno: la escena se reconstruye entera al cambiar de lente, y sin
     * esto se volvía al sistema propio con el botón todavía diciendo «toda la
     * galaxia». Se vio en el banco cambiando de lente con la vista amplia.
     */
    function encuadrar(todo: boolean): void {
      dist = Math.min(Math.max(encuadre(todo ? rGalaxia : rHogar), distMin), distMax)
      // La vista amplia mira al centro de la galaxia, que es donde está el
      // sistema propio: los satélites se reparten a su alrededor, así que el
      // centro de todo y el de casa son el mismo punto.
      if (todo) viajarA(0, 0)
    }

    function encuadre(r: number): number {
      const vFov = (camera.fov * Math.PI) / 180
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect)
      // Con TANGENTE y no con seno: el seno ajusta una ESFERA envolvente y lo
      // que hay acá es un disco plano, así que dejaba un 7,5 % de aire de más y
      // el sistema se veía chico en el teléfono. La tangente ajusta el disco.
      // El peor caso vertical es la cámara en planta (cos φ = 1), que sigue
      // pidiendo menos que el ancho: girar nunca saca planetas de cuadro.
      return (r / Math.tan(Math.min(vFov, hFov) / 2)) * 1.04
    }

    function colocarCamara(): void {
      const sp = Math.sin(phi)
      camera.position.set(
        objetivo.x + dist * sp * Math.sin(theta),
        dist * Math.cos(phi),
        objetivo.z + dist * sp * Math.cos(theta),
      )
      camera.lookAt(objetivo)
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
    /** Reusado por `escalaEn`: crear un Vector3 por llamada es basura por cuadro. */
    const medidor = new THREE.Vector3()

    /**
     * Tamaño del lienzo en píxeles CSS, guardado en vez de leído.
     *
     * El cuadro ESCRIBE `style.transform` en los rótulos y después leía
     * `clientWidth`/`clientHeight` del lienzo para colocar el siguiente: leer
     * geometría del DOM después de escribir estilos obliga al navegador a
     * recalcular el layout ahí mismo, en medio del cuadro. Medido con los
     * getters instrumentados: 3 lecturas por cuadro, todas evitables.
     *
     * Lo actualiza `ajustar()`, que es exactamente donde el tamaño cambia (es
     * quien llama a `setSize`, y el ResizeObserver quien lo llama a él). Así el
     * cuadro no toca el DOM para leer ni una vez.
     */
    let anchoCSS = 1
    let altoCSS = 1

    function colocar(): void {
      for (let i = 0; i < cuerpos.length; i++) {
        const c = cuerpos[i]
        const ang = c.angBase + tiempo * c.velocidad
        c.x = c.cx + Math.cos(ang) * c.rOrbita
        c.z = c.cz + Math.sin(ang) * c.rOrbita
        matriz.makeScale(c.radio, c.radio, c.radio)
        matriz.setPosition(c.x, 0, c.z)
        malla.setMatrixAt(i, matriz)
      }
      malla.instanceMatrix.needsUpdate = true
      // Las lunas van DESPUÉS: leen la posición que los planetas acaban de
      // escribir en `cuerpos`, así nunca orbitan un planeta de hace un cuadro.
      if (mallaLunas) {
        for (let i = 0; i < lunas.length; i++) {
          const l = lunas[i]
          const c = cuerpos[l.planeta]
          const a = l.fase + tiempo * l.vel
          // Derivado del radio VIGENTE del planeta: al cambiar de lente el
          // planeta cambia de tamaño y la luna lo sigue sin que nadie la toque.
          const rLocal = c.radio + l.desfase
          matriz.identity()
          matriz.setPosition(
            c.x + Math.cos(a) * rLocal,
            Math.sin(a) * rLocal * Math.sin(l.inclinacion),
            c.z + Math.sin(a) * rLocal * Math.cos(l.inclinacion),
          )
          mallaLunas.setMatrixAt(i, matriz)
        }
        mallaLunas.instanceMatrix.needsUpdate = true
      }
    }

    /**
     * Los resplandores miran a la cámara. Va DESPUÉS de colocarla: con la
     * rotación del cuadro anterior, girar deja los discos de canto un cuadro.
     */
    function mirarResplandores(): void {
      for (let i = 0; i < enEscena.length; i++) {
        const v = enEscena[i]
        const e = v.rSol * 6
        molde.makeRotationFromQuaternion(camera.quaternion)
        molde.scale(escalaGlow.set(e, e, e))
        molde.setPosition(v.cx, 0, v.cz)
        resplandores.setMatrixAt(i, molde)
      }
      resplandores.instanceMatrix.needsUpdate = true
    }

    /** Píxeles de pantalla por unidad de mundo a esa distancia de la cámara. */
    function escalaEn(x: number, z: number): number {
      const d = camera.position.distanceTo(medidor.set(x, 0, z))
      return (altoCSS / 2) / (Math.tan((camera.fov * Math.PI) / 360) * Math.max(0.001, d))
    }

    /** Proyecta a píxeles CSS del lienzo. Devuelve null si queda detrás. */
    function aPantalla(x: number, z: number): { px: number; py: number } | null {
      proyector.set(x, 0, z).project(camera)
      if (proyector.z > 1) return null
      return {
        px: (proyector.x * 0.5 + 0.5) * anchoCSS,
        py: (-proyector.y * 0.5 + 0.5) * altoCSS,
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

      // El viaje entre sistemas: suavizado exponencial, que es independiente
      // del ritmo de cuadro. Con «menos movimiento» no se anima, se llega.
      if (!objetivo.equals(objetivoMeta)) {
        if (!anima || dt === 0) objetivo.copy(objetivoMeta)
        else {
          objetivo.lerp(objetivoMeta, 1 - Math.exp(-dt * 5))
          if (objetivo.distanceToSquared(objetivoMeta) < 1e-4) objetivo.copy(objetivoMeta)
        }
      }

      colocarCamara()
      mirarResplandores()
      ponerAro(aroYo, miId, 1.55)
      ponerAro(aroSel, seleccionActual, 2.1)
      renderer.render(scene, camera)

      const yo = miId ? planetas.find(p => p.id === miId) : undefined
      ponerEtiqueta(etiquetaYoRef.current, miId, yo ? `Tú · ${yo.nombre}` : 'Tú')
      const sel = seleccionActual && seleccionActual !== miId
        ? planetas.find(p => p.id === seleccionActual)
        : undefined
      ponerEtiqueta(etiquetaSelRef.current, sel?.id ?? null, sel?.nombre ?? '')

      // El rótulo de cada sol. Se esconde el que se sale del lienzo en vez de
      // dejarlo pegado al borde: pegado parece que señala a otra cosa.
      for (const v of enEscena) {
        if (!v.etiqueta) continue
        const p = aPantalla(v.cx, v.cz)
        // El rótulo cuelga por ENCIMA del sol, así que se mide donde de verdad
        // queda: con el sol apenas debajo del borde inferior el rótulo todavía
        // se lee, y con el sol arriba del borde superior ya no.
        const alto = p ? v.rSol * escalaEn(v.cx, v.cz) + 10 : 0
        if (!p || p.px < -60 || p.px > anchoCSS + 60 ||
            p.py - alto < 0 || p.py - alto > altoCSS + 40) {
          v.etiqueta.style.visibility = 'hidden'
          continue
        }
        v.etiqueta.style.visibility = 'visible'
        v.etiqueta.style.transform =
          `translate3d(${Math.round(p.px)}px, ${Math.round(p.py - alto)}px, 0) translate(-50%, -100%)`
      }
    }

    function bucle(): void {
      rafBucle = requestAnimationFrame(bucle)
      pintar()
    }

    function arrancar(): void {
      if (animando) return
      animando = true
      ultimo = 0
      // Se PROGRAMA el primer cuadro, no se pinta acá. Llamando `bucle()`
      // directo, el `render()` —con su compilación de shaders— caía dentro de
      // quien llamó a `arrancar()`, que puede ser el efecto de montaje.
      // Un cuadro de rAF después el navegador ya pintó el resto de la pantalla.
      //
      // Y se cancela el cuadro suelto pendiente: `ajustar()` deja uno agendado
      // al montar, así que sin esto el arranque pintaba dos veces.
      cancelAnimationFrame(rafSuelto)
      sueltoPendiente = false
      rafBucle = requestAnimationFrame(bucle)
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
      // `setSize` deja el lienzo en exactamente w×h píxeles CSS, así que estas
      // dos son la medida real: el cuadro las usa en vez de leer el DOM.
      anchoCSS = w
      altoCSS = h
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      // El encuadre de arranque es el sistema de CASA, no la galaxia: se entra
      // viendo a los vecinos de uno, y de ahí se sale a mirar el resto.
      const nuevo = encuadre(rHogar)
      // Solo la primera medida coloca la cámara: recolocarla en cada cambio de
      // tamaño (girar el teléfono, aparecer el teclado) le arrancaría el zoom
      // de las manos a quien la está moviendo.
      if (!encuadrado) { dist = nuevo; encuadrado = true }
      distMin = rHogar * 0.22
      // Y el tope de alejamiento tiene que dar para la galaxia ENTERA, o los
      // otros países existirían sin poder verse. Con un solo sistema se queda
      // en el 2,2× de siempre.
      distMax = Math.max(nuevo * 2.2, encuadre(rGalaxia) * 1.12)
      dist = Math.min(Math.max(dist, distMin), distMax)
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

    /**
     * Qué SOL hay bajo el dedo. Es el atajo para cruzar la galaxia: los soles
     * son lo único visible de un país lejano cuando sus planetas ya son
     * puntos. Solo cuenta con más de un sistema — si no, tocar el sol propio
     * dejaría de deseleccionar, que es lo que hace hoy.
     */
    function solEn(px: number, py: number): Sistema | null {
      if (enEscena.length < 2) return null
      colocarCamara()
      let mejor: Sistema | null = null
      let mejorD = Infinity
      for (const v of enEscena) {
        const p = aPantalla(v.cx, v.cz)
        if (!p) continue
        const d = Math.hypot(p.px - px, p.py - py)
        const umbral = Math.min(44, Math.max(18, v.rSol * escalaEn(v.cx, v.cz) + 12))
        if (d <= umbral && d < mejorD) { mejorD = d; mejor = v }
      }
      return mejor
    }

    function coords(e: PointerEvent): { x: number; y: number } {
      const r = lienzo.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    function alBajar(e: PointerEvent): void {
      const c = coords(e)
      // El dedo se REGISTRA antes de capturarlo, y la captura va con red.
      //
      // `setPointerCapture` lanza `NotFoundError` si el puntero ya no está
      // activo cuando llega el evento. Estaba primero y sin `try`: si lanzaba,
      // `punteros.set` no llegaba a correr y ese dedo no existía para nadie —
      // el pellizco moría en silencio y la escena se quedaba orbitando con un
      // dedo fantasma. Al revés no hay caso malo: perder la captura solo
      // significa que el gesto se corta si el dedo sale del lienzo, y el
      // `pointercancel` que llega después limpia igual.
      punteros.set(e.pointerId, c)
      try { lienzo.setPointerCapture(e.pointerId) } catch { /* dedo ya soltado */ }
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
          dist = Math.min(Math.max(distIni * (pinchIni / ahora), distMin), distMax)
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
        // Los planetas ganan al sol: en un sistema chico el sol y su único
        // planeta caen dentro del mismo dedo, y ahí lo que se quiso tocar es
        // la persona, no el país.
        const id = planetaEn(c.x, c.y)
        if (id) alSeleccionarRef.current(id)
        else {
          const sol = solEn(c.x, c.y)
          if (sol) viajarA(sol.cx, sol.cz)
          else alSeleccionarRef.current(null)
        }
      }
      esToque = false
      pedirCuadro()
    }

    function alRodar(e: WheelEvent): void {
      // Va con `addEventListener` y no como prop de React para poder cancelar:
      // sin `preventDefault` la rueda desplaza la página en vez de acercar.
      e.preventDefault()
      dist = Math.min(Math.max(dist * Math.exp(e.deltaY * 0.0012), distMin), distMax)
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
    if (amplitudRef.current === 'galaxia') encuadrar(true)
    colocar()
    colocarCamara()
    recolocar = false

    /* El primer DIBUJO se difiere un cuadro; el resto no.
     *
     * `colocar()` y `colocarCamara()` de arriba siguen síncronos a propósito:
     * si no, un toque anterior al primer cuadro proyectaría con la matriz vieja
     * y seleccionaría el planeta equivocado EN SILENCIO.
     *
     * Lo que se saca del efecto es el `render()`, que es donde three compila y
     * ENLAZA los ~6 programas — `glLinkProgram` es síncrono y en una GPU móvil
     * de gama media son decenas de ms por programa. Corriendo dentro del efecto
     * bloquea el montaje entero; en un rAF el navegador ya pintó el resto de la
     * pantalla antes de tragarse la compilación. Lo hace `arrancar()`.
     *
     * SE PROBÓ `renderer.compileAsync()` Y NO SE PUEDE USAR ACÁ. Revienta con
     * esta escena: su `checkMaterialsReady` lee
     * `properties.get(material).currentProgram` y llama `program.isReady()`
     * sobre un `undefined` (three 0.185.1, three.module.js:17497). Y el error no
     * se puede atrapar —lo tira desde su propio `setTimeout`, fuera de la
     * promesa— así que ni un `.catch()` lo contiene: queda un error rojo en
     * consola y la promesa NUNCA resuelve. Verificado en `/banco-galaxia`. Si
     * alguna vez se reintenta, hay que comprobarlo ahí primero.
     */
    reevaluar()
    pedirCuadro()

    mandoRef.current = {
      seleccionar: (id: string | null) => {
        seleccionActual = id
        // Elegir a alguien desde la lista o el recorrido de la pantalla tiene
        // que llevar la cámara hasta su sistema; si no, se resalta un aro que
        // está fuera de cuadro y parece que no pasó nada.
        const c = id ? cuerpos.find(v => v.id === id) : undefined
        if (c) viajarA(c.cx, c.cz)
        pedirCuadro()
      },
      encuadrar: (todo: boolean) => { encuadrar(todo); pedirCuadro() },

      reacomodar: (nuevos) => {
        /* SE EMPAREJA POR ID, NUNCA POR ÍNDICE.
           `conLente` REORDENA `s.planetas`, pero el color por instancia
           (`setColorAt`, hecho una vez al construir) y el reparto de lunas
           (`planeta: i`) se hornearon con el orden ORIGINAL. Recorrer `cuerpos`
           por índice y escribir encima le pondría a cada instancia los datos de
           otro jugador: los planetas quedarían pintados con el rango de un
           vecino y el de 9 logros mostraría 3 lunas. Emparejando por id, el
           mapeo índice↔jugador no se toca y las dos cosas siguen correctas
           gratis. */
        const porId = new Map<string, { orbita: number; magnitud: number }>()
        for (const s of nuevos) {
          for (const p of s.planetas) porId.set(p.id, { orbita: p.orbita, magnitud: p.magnitud })
        }

        let cambio = false
        for (const c of cuerpos) {
          const n = porId.get(c.id)
          if (!n) continue
          const { k, hueco, cupo } = acomodo(n.orbita)
          const radio = radioPlaneta(n.magnitud)
          const rOrbita = radioAnillo(k)
          const angBase = (hueco / cupo) * Math.PI * 2 + k * AUREO
          const velocidad = velocidadAnillo(k)
          if (c.radio !== radio || c.rOrbita !== rOrbita ||
              c.angBase !== angBase || c.velocidad !== velocidad) {
            c.radio = radio
            c.rOrbita = rOrbita
            c.angBase = angBase
            c.velocidad = velocidad
            cambio = true
          }
        }
        // Sin cambio no se pide cuadro: este mando también corre al montar,
        // justo después de que el efecto construyó con estos mismos valores.
        if (!cambio) return

        /* Los anillos NO se rehacen, y no es un descuido: la lente es una
           PERMUTACIÓN —reasigna `orbita = i` dentro de cada sistema—, así que
           el conjunto de órbitas por sistema es idéntico y `acomodo()` produce
           los mismos anillos. `kMax`, el búfer de `geoOrbitas`, la opacidad de
           las órbitas y `gajos` son invariantes entre lentes. */
        colocar()
        pedirCuadro()
      },
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
      for (const v of enEscena) v.etiqueta?.remove()
      geoSol.dispose(); matSol.dispose(); soles.dispose()
      geoResplandor.dispose(); texResplandor.dispose()
      matResplandor.dispose(); resplandores.dispose()
      geoOrbitas.dispose(); matOrbitas.dispose()
      geoPlaneta.dispose(); matPlaneta.dispose()
      malla.dispose()
      geoLuna.dispose(); matLuna.dispose()
      mallaLunas?.dispose()
      geoAro.dispose(); matAroYo.dispose(); matAroSel.dispose()
      geoEstrellas.dispose(); texPunto.dispose(); matEstrellas.dispose()
      for (const l of luces) l.dispose()
      renderer.dispose()

      /**
       * `dispose()` NO alcanza, y esa es la trampa: suelta lo que three creó
       * pero deja el CONTEXTO vivo, con su búfer de dibujo y las 4 texturas
       * internas que three crea al inicializarlo.
       *
       * Medido con 3 idas y vueltas a la pantalla, contando contextos con
       * `getContext` instrumentado: 1 → 2 → 3 → 4 contextos VIVOS
       * (`isContextLost() === false`) con UN SOLO lienzo en el DOM, y +4
       * texturas por visita. Los búferes y los programas sí bajaban a cero, o
       * sea que el resto de la limpieza estaba bien: lo único que faltaba era
       * soltar el contexto.
       *
       * Importa porque el presupuesto es global y chico: Chrome corta a los 16
       * contextos y lo comparten Dice3D, Coin3D, Carta3D y la mesa 3D. En una
       * PWA que vive días, quien entre ~15 veces a la Galaxia rompe el 3D de
       * TODA la app, y el primero en morir es el más viejo.
       *
       * Va DESPUÉS del `removeEventListener` de `webglcontextlost` de arriba.
       * Si fuera antes, la pérdida que provocamos a propósito llamaría a
       * `alPerderContexto` → `onSinWebGL()`, y la pantalla se quedaría diciendo
       * «este navegador no puede dibujar en 3D» para siempre.
       */
      renderer.forceContextLoss()
      renderer.domElement.remove()
      miId = null
    }
    /* La dependencia es la CLAVE, no `sistemas`.
       `sistemas` cambia de identidad en cada toque de lente (`conLente` hace
       `.map()`), y tenerlo acá significaba reconstruir la escena entera cuatro
       veces por curiosear: contexto nuevo, texturas resubidas y three
       recompilando los ~6 programas con `glLinkProgram` SÍNCRONO. Ese era el
       congelón. La clave solo cambia cuando de verdad hay que rehornear algo
       (quién está, su nivel, sus logros, su nombre); la lente va por
       `reacomodar`.

       El cuerpo sigue leyendo `sistemas`/`planetas` de la closure y es
       correcto: React crea esta closure en el render en que la clave cambió,
       así que trae los valores de ESE render. Cuando la clave no cambia, el
       efecto no corre y los datos vigentes entran por `reacomodar`. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveEstructural])

  // La selección la manda la pantalla: se le pasa a la escena por el mando en
  // vez de reconstruirla, que costaría recompilar shaders en cada toque.
  useEffect(() => {
    mandoRef.current?.seleccionar(seleccion)
  }, [seleccion])

  // Y la lente, igual: por el mando. Va DESPUÉS del efecto de montaje —React
  // los corre en orden de declaración— así que en un cambio estructural el
  // mando ya existe cuando esto llama.
  useEffect(() => {
    mandoRef.current?.reacomodar(sistemas)
  }, [sistemas])

  useEffect(() => {
    mandoRef.current?.encuadrar(amplitud === 'galaxia')
  }, [amplitud])

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

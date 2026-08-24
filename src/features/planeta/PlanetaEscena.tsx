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
  /** SOLO PARA EL BANCO: pone el sol detrás para poder mirar la cara nocturna. */
  deNoche?: boolean
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

export function PlanetaEscena({ rasgos, onSinWebGL, onFps, deNoche = false, className = '' }: Props) {
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

    /** El material de la capa viva, para latir las auroras en el bucle. */
    let matVidaRef: THREE.ShaderMaterial | null = null

    /* La dirección del sol se decide ACÁ ARRIBA porque la usan tres cosas: la
       luz, el shader de la capa viva y el relleno. Con `deNoche` va al revés y
       queda la cara nocturna de frente — es lo único que permite revisar las
       ciudades y las auroras, porque girar la cámara no alcanza: el sol está
       fijo en el mundo y habría que dar media vuelta exacta. Solo lo usa el
       banco. */
    const dirSolar = deNoche
      ? new THREE.Vector3(-1, -0.35, -0.6).normalize()
      : new THREE.Vector3(1, 0.35, 0.6).normalize()

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

    /* ── LA CAPA VIVA: ciudades de noche y auroras en los polos ──
       Las DOS en una sola cáscara, y no en dos, porque son la misma pregunta
       geométrica —¿de qué lado está el sol y a qué latitud estoy?— y separarlas
       costaría una llamada de dibujo más por nada.

       Las ciudades salen SOLO donde el sol no pega (`ndl < 0`): una ciudad
       encendida a pleno día no se ve, y dibujarla ahí la delataría como una
       calcomanía. La textura son puntos agrupados, no una malla regular: la
       gente se junta en la costa y en los valles, no en cuadrícula.

       Las auroras viven arriba de |lat| 0,72 y laten. El color no es inventado:
       es el de la atmósfera de la familia, así que un mundo helado tiene
       auroras violetas y uno de jungla las tiene verdes. */
    const desechosVida: { dispose(): void }[] = []
    if (rasgos.ciudades > 0 || rasgos.auroras > 0) {
      const S = 256
      const cv = document.createElement('canvas')
      cv.width = cv.height = S
      const cx = cv.getContext('2d')!
      cx.fillStyle = '#000'
      cx.fillRect(0, 0, S, S)
      if (rasgos.ciudades > 0) {
        // Cuantos más grados, más núcleos y más grandes.
        const nucleos = 14 + rasgos.ciudades * 12
        let semilla = Math.floor(rasgos.s01 * 100000) >>> 0
        const rnd = () => {
          semilla ^= semilla << 13; semilla >>>= 0
          semilla ^= semilla >> 17
          semilla ^= semilla << 5; semilla >>>= 0
          return semilla / 4294967296
        }
        for (let n = 0; n < nucleos; n++) {
          const cxN = rnd() * S
          // Se evitan los polos: nadie funda una ciudad sobre el hielo.
          const cyN = S * (0.22 + rnd() * 0.56)
          const puntos = 6 + Math.floor(rnd() * 18) * rasgos.ciudades
          const disp = 4 + rnd() * (7 + rasgos.ciudades * 5)
          for (let k = 0; k < puntos; k++) {
            const px = cxN + (rnd() - 0.5) * disp * 2
            const py = cyN + (rnd() - 0.5) * disp
            const b = 0.35 + rnd() * 0.65
            cx.fillStyle = `rgba(255,${190 + Math.floor(rnd() * 50)},${120 + Math.floor(rnd() * 70)},${b.toFixed(2)})`
            cx.fillRect(px, py, 1 + (rnd() < 0.18 ? 1 : 0), 1)
          }
        }
      }
      const texVida = new THREE.CanvasTexture(cv)
      texVida.wrapS = THREE.RepeatWrapping

      const geoVida = new THREE.SphereGeometry(RADIO_MUNDO * 1.004, 48, 32)
      const matVida = new THREE.ShaderMaterial({
        uniforms: {
          luces: { value: texVida },
          dirSol: { value: dirSolar.clone() },
          tinte: { value: new THREE.Color(rasgos.atmosfera) },
          conCiudades: { value: rasgos.ciudades > 0 ? 1 : 0 },
          conAuroras: { value: rasgos.auroras },
          tiempo: { value: 0 },
        },
        vertexShader: `
          varying vec3 vN; varying vec2 vUv;
          void main() {
            /* La normal va a espacio de MUNDO, no de vista: normalMatrix la
               lleva a vista y dirSol es una direccion del mundo. Comparadas
               asi, el lado nocturno se movia con la CAMARA en vez de con el
               sol, y las ciudades no aparecian donde tenian que estar.
               (Sin acentos ni comillas invertidas: esto vive dentro de un
               template literal y una comilla invertida lo corta.) */
            vN = normalize(mat3(modelMatrix) * normal);
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform sampler2D luces; uniform vec3 dirSol; uniform vec3 tinte;
          uniform float conCiudades; uniform float conAuroras; uniform float tiempo;
          varying vec3 vN; varying vec2 vUv;
          void main() {
            float ndl = dot(normalize(vN), normalize(dirSol));
            // La noche, con un borde suave: un corte duro se ve como una línea
            // dibujada alrededor del planeta.
            float noche = smoothstep(0.12, -0.28, ndl);
            vec3 c = vec3(0.0);
            if (conCiudades > 0.5) {
              c += texture2D(luces, vUv).rgb * noche * 1.5;
            }
            if (conAuroras > 0.5) {
              float lat = abs(vUv.y - 0.5) * 2.0;
              float banda = smoothstep(0.72, 0.94, lat) * (1.0 - smoothstep(0.94, 1.0, lat));
              // Ondas lentas: una aurora quieta es un anillo pintado.
              float onda = 0.55 + 0.45 * sin(vUv.x * 22.0 + tiempo * 0.6)
                                 * sin(vUv.x * 7.0 - tiempo * 0.35);
              c += tinte * banda * onda * (0.35 + noche * 0.75) * conAuroras;
            }
            if (c.r + c.g + c.b < 0.004) discard;
            gl_FragColor = vec4(c, 1.0);
          }`,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      })
      const capaVida = new THREE.Mesh(geoVida, matVida)
      capaVida.rotation.z = rasgos.inclinacion
      escena.add(capaVida)
      desechosVida.push(geoVida, matVida, texVida)
      matVidaRef = matVida
    }

    /* ── NUBES ──
       Cáscara con ruido, girando MÁS RÁPIDO que el planeta. Esa diferencia de
       velocidad es lo único que las hace leer como atmósfera y no como pintura
       sobre la superficie. */
    let nubes: THREE.Mesh | null = null
    const desechosNubes: { dispose(): void }[] = []
    if (rasgos.nubes > 0) {
      const S = 256
      const cv = document.createElement('canvas')
      cv.width = S; cv.height = S / 2
      const cx = cv.getContext('2d')!
      cx.fillStyle = 'rgba(0,0,0,0)'
      cx.fillRect(0, 0, S, S / 2)
      let semilla = (Math.floor(rasgos.s01 * 77777) ^ 0x9e37) >>> 0
      const rnd = () => {
        semilla ^= semilla << 13; semilla >>>= 0
        semilla ^= semilla >> 17
        semilla ^= semilla << 5; semilla >>>= 0
        return semilla / 4294967296
      }
      const bancos = 26 + rasgos.nubes * 22
      for (let n = 0; n < bancos; n++) {
        const cxN = rnd() * S
        const cyN = rnd() * (S / 2)
        // Los bancos se estiran en horizontal: las nubes de un planeta que gira
        // salen en bandas, no en manchas redondas.
        const ancho = 12 + rnd() * (26 + rasgos.nubes * 12)
        const alto = 3 + rnd() * 7
        const g = cx.createRadialGradient(cxN, cyN, 0, cxN, cyN, ancho)
        const a = (0.12 + rnd() * 0.3) * (0.5 + rasgos.nubes * 0.28)
        g.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`)
        g.addColorStop(1, 'rgba(255,255,255,0)')
        cx.save()
        cx.translate(cxN, cyN); cx.scale(1, alto / ancho); cx.translate(-cxN, -cyN)
        cx.fillStyle = g
        cx.beginPath(); cx.arc(cxN, cyN, ancho, 0, Math.PI * 2); cx.fill()
        cx.restore()
      }
      const texNubes = new THREE.CanvasTexture(cv)
      texNubes.wrapS = THREE.RepeatWrapping
      const geoNubes = new THREE.SphereGeometry(RADIO_MUNDO * 1.017, 40, 26)
      const matNubes = new THREE.MeshLambertMaterial({
        map: texNubes, transparent: true, depthWrite: false, opacity: 0.9,
      })
      nubes = new THREE.Mesh(geoNubes, matNubes)
      nubes.rotation.z = rasgos.inclinacion
      escena.add(nubes)
      desechosNubes.push(geoNubes, matNubes, texNubes)
    }

    /* ── ANILLOS ──
       Un disco plano con bandas y huecos, inclinado con el eje del planeta.
       Lo que lo vende no es el disco: son los HUECOS. Un anillo macizo se lee
       como un plato; las divisiones son lo que dice «esto son millones de
       piedras dando vueltas».

       Las UV de `RingGeometry` vienen mapeadas sobre la caja envolvente, o sea
       que una textura de bandas saldría en cuadrícula. Se reescriben acá: `u`
       pasa a ser la distancia radial normalizada, que es la única forma de que
       las bandas sean concéntricas. */
    const desechosAnillo: { dispose(): void }[] = []
    if (rasgos.anillos > 0) {
      const dentro = RADIO_MUNDO * 1.35
      const fuera = RADIO_MUNDO * (1.9 + rasgos.anillos * 0.18)
      const geoAnillo = new THREE.RingGeometry(dentro, fuera, 96, 1)
      const pos = geoAnillo.getAttribute('position')
      const uv = geoAnillo.getAttribute('uv')
      for (let i = 0; i < pos.count; i++) {
        const d = Math.hypot(pos.getX(i), pos.getY(i))
        uv.setXY(i, (d - dentro) / (fuera - dentro), 0.5)
      }

      const cv = document.createElement('canvas')
      cv.width = 128; cv.height = 1
      const cx = cv.getContext('2d')!
      const base = new THREE.Color(rasgos.altiplano)
      for (let i = 0; i < 128; i++) {
        const t = i / 127
        /* Tres senos de periodo distinto: el batido entre ellos da bandas
           irregulares y huecos, en vez del rayado regular de uno solo. */
        const b = Math.sin(t * 41 + rasgos.s01 * 9) * 0.5
          + Math.sin(t * 17 + rasgos.s01 * 4) * 0.32
          + Math.sin(t * 7) * 0.18
        const a = Math.max(0, Math.min(1, 0.5 + b)) * (1 - Math.abs(t - 0.45) * 0.7)
        cx.fillStyle = `rgba(${Math.round(base.r * 255)},${Math.round(base.g * 255)},${Math.round(base.b * 255)},${a.toFixed(3)})`
        cx.fillRect(i, 0, 1, 1)
      }
      const texAnillo = new THREE.CanvasTexture(cv)
      const matAnillo = new THREE.MeshBasicMaterial({
        map: texAnillo, transparent: true, side: THREE.DoubleSide,
        depthWrite: false, opacity: 0.85,
      })
      const anillo = new THREE.Mesh(geoAnillo, matAnillo)
      // Acostado en el ecuador y con la MISMA inclinación que el eje: si el
      // planeta está ladeado y el anillo no, se ve como un aro puesto encima.
      anillo.rotation.x = Math.PI / 2
      anillo.rotation.y = rasgos.inclinacion
      escena.add(anillo)
      desechosAnillo.push(geoAnillo, matAnillo, texAnillo)
    }

    /* ── LUNAS ──
       Esferas chicas en órbitas de radio, velocidad e inclinación distintas.
       Comparten geometría y material: tres lunas son tres llamadas de dibujo,
       no tres de todo. El material es el altiplano del planeta apagado — una
       luna del color del mundo dice que salieron del mismo sistema. */
    const geoLuna = new THREE.SphereGeometry(RADIO_MUNDO * 0.11, 12, 8)
    const matLuna = new THREE.MeshLambertMaterial({
      color: new THREE.Color(rasgos.altiplano).multiplyScalar(0.72),
    })
    const lunas = Array.from({ length: rasgos.lunas }, (_, i) => {
      const m = new THREE.Mesh(geoLuna, matLuna)
      m.userData.radio = RADIO_MUNDO * (1.75 + i * 0.42)
      m.userData.vel = 0.00013 - i * 0.000028
      m.userData.fase = (i / Math.max(1, rasgos.lunas)) * Math.PI * 2 + rasgos.giro
      m.userData.inc = rasgos.inclinacion + (i - 1) * 0.28
      m.scale.setScalar(1 - i * 0.18)
      escena.add(m)
      return m
    })

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
    sol.position.copy(dirSolar).multiplyScalar(100)
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

      // Las auroras respiran y las nubes corren más rápido que el suelo.
      if (matVidaRef) matVidaRef.uniforms.tiempo.value = ahora * 0.001
      if (nubes) nubes.rotation.y += dt * 0.018

      // Las lunas orbitan. Cada una en su plano y a su velocidad: en órbitas
      // idénticas se leerían como un collar rígido, no como satélites.
      for (const m of lunas) {
        const a = ahora * (m.userData.vel as number) + (m.userData.fase as number)
        const r = m.userData.radio as number
        const inc = m.userData.inc as number
        m.position.set(
          Math.cos(a) * r,
          Math.sin(a) * r * Math.sin(inc),
          Math.sin(a) * r * Math.cos(inc),
        )
      }

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
      geoLuna.dispose()
      matLuna.dispose()
      for (const d of desechosAnillo) d.dispose()
      for (const d of desechosVida) d.dispose()
      for (const d of desechosNubes) d.dispose()
      renderer.dispose()

      // El listener PRIMERO, y recién después soltar el contexto: al revés, la
      // pérdida que provocamos a propósito llamaría a `onSinWebGL` y la
      // pantalla diría que el navegador no puede dibujar en 3D.
      lienzo.removeEventListener('webglcontextlost', alPerderContexto)
      renderer.forceContextLoss()
      lienzo.remove()
    }
    // `deNoche` va en las dependencias: cambia la dirección del sol, que se
    // lee al construir la escena y al armar el shader de la capa viva. Sin
    // ella, el botón del banco no haría nada hasta remontar.
  }, [rasgos, onSinWebGL, onFps, deNoche])

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

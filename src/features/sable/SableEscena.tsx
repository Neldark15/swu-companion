/**
 * EL SABLE EN 3D — TALLER KYBER. three PELADO, siguiendo el §2s.
 *
 * ── PBR con entorno generado UNA VEZ (revisión de una decisión previa) ─
 *
 * La primera versión usaba Phong «porque Standard necesita mapa de entorno y
 * generarlo es caro». Era verdad a medias: lo caro es una foto HDR que
 * descargar, o regenerar por cuadro. Acá el entorno sale de `RoomEnvironment`
 * —un cuarto sintético de cajas luminosas que el propio three trae— pasado UNA
 * vez por `PMREMGenerator` al montar: decenas de ms, una sola vez, el mismo
 * tipo de costo único que la promoción de capas de la credencial (30 ms, §3e).
 * A cambio el metal REFLEJA de verdad, que es la diferencia entre un objeto y
 * un dibujo. El generador se desecha apenas produce la textura; la textura, en
 * la limpieza.
 *
 * ── Texturas PROCEDURALES, cero descargas ─────────────────────────────
 *
 * El moleteado del agarre y el cepillado del acero son `CanvasTexture`
 * dibujadas al vuelo (128², como las de la Galaxia §2s): rombos en relieve
 * para el bump del agarre, vetas para el roughness del acero. Nota honesta: la
 * V de los UV de `LatheGeometry` avanza por PUNTO del perfil, no por
 * distancia, así que el patrón se estira un poco en las piezas con muchos
 * escalones — a tamaño de pantalla no se distingue, y arreglarlo exigiría
 * re-parametrizar los doce perfiles.
 *
 * ── EL OBJETO rota, no la cámara ──────────────────────────────────────
 *
 * Antes el arrastre orbitaba la cámara y el sable vivía clavado en diagonal.
 * Nel pidió poder ponerlo vertical y horizontal: ahora el arrastre gira el
 * GRUPO del sable con cuaterniones —premultiplicando en ejes de pantalla, así
 * el gesto hace lo que la mano espera en CUALQUIER orientación— y hay tres
 * poses con nombre (`orientar`) que viajan con slerp. La cámara queda fija:
 * inclinarla a ella torcería también el pedestal, que tiene que seguir siendo
 * suelo.
 *
 * ── Lo que el §2s obliga y acá está ───────────────────────────────────
 *
 * · `forceContextLoss()` en la limpieza, DESPUÉS de quitar el listener de
 *   `webglcontextlost`.
 * · `setPixelRatio(Math.min(devicePixelRatio, 2))`.
 * · rAF pausado con `document.hidden` Y con `IntersectionObserver`.
 * · Sin bucle (movimiento reducido, pestaña oculta) las animaciones LLEGAN de
 *   golpe en vez de quedarse a medias — el bug de accesibilidad ya pagado.
 * · Todo se libera: geometrías, materiales, texturas, entorno y renderer.
 */

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { piezasDeSable, colorDeHoja, type Diseno } from './partesSable'

export type Orientacion = 'vertical' | 'diagonal' | 'horizontal'
export type Vista = 'sable' | 'cristal'

interface Props {
  diseno: Diseno
  /** Enciende la hoja. Apagada solo se ve el mango, que es lo que se arma. */
  encendido: boolean
  /** Separa las piezas a lo largo del eje. Se anima en el bucle. */
  explotado?: boolean
  /** Pose con nombre. El arrastre libre puede salirse de ella cuando quiera. */
  orientacion?: Orientacion
  /** `cristal` esconde el sable y enseña el CRISTAL flotando sobre el pedestal. */
  vista?: Vista
  onSinWebGL?: () => void
  className?: string
}

interface Mando {
  rehacer: (d: Diseno) => void
  encender: (v: boolean) => void
  explotar: (v: boolean) => void
  orientar: (o: Orientacion) => void
  cambiarVista: (v: Vista) => void
}

/* Las tres poses. Euler → cuaternión una sola vez, a nivel de módulo. */
const POSES: Record<Orientacion, THREE.Quaternion> = {
  vertical: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)),
  diagonal: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0, -0.42)),
  horizontal: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, -Math.PI / 2)),
}

/** Rombos en relieve para el bump del agarre. Gris medio = plano. */
function texturaMoleteado(): THREE.CanvasTexture {
  const S = 128
  const c = document.createElement('canvas')
  c.width = c.height = S
  const x = c.getContext('2d')!
  x.fillStyle = '#808080'
  x.fillRect(0, 0, S, S)
  x.lineWidth = 5
  // Dos familias de diagonales: el cruce dibuja los rombos del moleteado.
  for (const [inclinacion, tono] of [[1, '#b4b4b4'], [-1, '#4a4a4a']] as const) {
    x.strokeStyle = tono
    for (let i = -S; i < S * 2; i += 16) {
      x.beginPath()
      x.moveTo(i, 0)
      x.lineTo(i + inclinacion * S, S)
      x.stroke()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(10, 4)
  return t
}

/** Vetas del acero cepillado, como roughness: la veta refleja distinto. */
function texturaCepillado(): THREE.CanvasTexture {
  const S = 128
  const c = document.createElement('canvas')
  c.width = c.height = S
  const x = c.getContext('2d')!
  x.fillStyle = '#3c3c3c'
  x.fillRect(0, 0, S, S)
  for (let i = 0; i < 340; i++) {
    const y = Math.random() * S
    const tono = 40 + Math.floor(Math.random() * 60)
    x.strokeStyle = `rgba(${tono},${tono},${tono},0.5)`
    x.lineWidth = 1
    x.beginPath()
    x.moveTo(0, y)
    x.lineTo(S, y + (Math.random() - 0.5) * 2)
    x.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 2)
  return t
}

export function SableEscena({
  diseno, encendido, explotado = false, orientacion = 'diagonal', vista = 'sable',
  onSinWebGL, className = '',
}: Props) {
  const cajaRef = useRef<HTMLDivElement>(null)
  const alFallarRef = useRef(onSinWebGL)
  const mandoRef = useRef<Mando | null>(null)

  useEffect(() => { alFallarRef.current = onSinWebGL })

  useEffect(() => {
    const caja = cajaRef.current
    if (!caja) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true, antialias: dpr < 2, powerPreference: 'low-power',
      })
    } catch {
      alFallarRef.current?.()
      return
    }
    renderer.setPixelRatio(dpr)
    /* ACES es lo que evita que el metal PBR sature a blanco bajo el foco: sin
       tone mapping los brillos revientan y el sable parece cromado barato. Es
       coste por píxel, pero el lienzo es chico y el dpr ya está topado. */
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    // Sin esto el navegador se queda el arrastre y el sable no gira. `pan-y`
    // deja pasar el scroll vertical de la página.
    renderer.domElement.style.touchAction = 'pan-y'
    caja.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400)

    /* ── El entorno: UNA generación y afuera ── */
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = envRT.texture
    pmrem.dispose()

    // ── Luces ──
    // Con el entorno puesto, el ambiente baja: su trabajo lo hace el reflejo.
    // Quedan el foco cálido (la forja) y un relleno frío para el lado en sombra.
    scene.add(new THREE.AmbientLight(0x44506a, 0.5))
    const focoCalido = new THREE.DirectionalLight(0xffc27a, 1.9)
    focoCalido.position.set(7, 9, 7)
    const focoFrio = new THREE.DirectionalLight(0x8fb4ff, 0.7)
    focoFrio.position.set(-8, -3, 5)
    scene.add(focoCalido, focoFrio)

    // ── Materiales PBR ──
    const texMoleteado = texturaMoleteado()
    const texCepillado = texturaCepillado()
    const matAcero = new THREE.MeshStandardMaterial({
      color: 0xc9ced6, metalness: 0.92, roughness: 0.9, roughnessMap: texCepillado,
    })
    const matAgarre = new THREE.MeshStandardMaterial({
      color: 0x23252b, metalness: 0.2, roughness: 0.82,
      bumpMap: texMoleteado, bumpScale: 0.9,
    })
    const matLaton = new THREE.MeshStandardMaterial({
      color: 0xd29a4a, metalness: 0.95, roughness: 0.34,
    })

    /* El sable vive en un GRUPO que es lo que rota; el pedestal queda fuera
       para seguir siendo suelo. */
    const grupoSable = new THREE.Group()
    grupoSable.quaternion.copy(POSES[orientacion])
    scene.add(grupoSable)

    /* El aro de latón va de HIJO de su pieza: viaja solo cuando el sable se
       abre, sin recolocarlo por cuadro. */
    const geoAro = new THREE.TorusGeometry(1.78, 0.13, 10, 48)
    const piezas = ([0, 1, 2] as const).map(i => {
      const malla = new THREE.Mesh(new THREE.BufferGeometry(), i === 1 ? matAgarre : matAcero)
      const anillo = new THREE.Mesh(geoAro, matLaton)
      anillo.rotation.x = Math.PI / 2
      malla.add(anillo)
      grupoSable.add(malla)
      return { malla, anillo, base: 0, alto: 0 }
    })

    // ── La hoja: tres capas (núcleo, halo, bruma) ──
    const LARGO = 78
    const geoNucleo = new THREE.CapsuleGeometry(0.6, LARGO, 4, 12)
    const geoHalo = new THREE.CapsuleGeometry(1.5, LARGO, 4, 12)
    const geoBruma = new THREE.CapsuleGeometry(3.1, LARGO * 0.98, 4, 10)
    const matNucleo = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const matHalo = new THREE.MeshBasicMaterial({
      color: 0x2b8cff, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const matBruma = new THREE.MeshBasicMaterial({
      color: 0x2b8cff, transparent: true, opacity: 0.2,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const nucleo = new THREE.Mesh(geoNucleo, matNucleo)
    const halo = new THREE.Mesh(geoHalo, matHalo)
    const bruma = new THREE.Mesh(geoBruma, matBruma)
    halo.renderOrder = 2
    bruma.renderOrder = 1
    grupoSable.add(nucleo, halo, bruma)

    // ── El pedestal: luz proyectada, no un objeto ──
    const matPeana = new THREE.MeshBasicMaterial({
      color: 0xff9d2e, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
    const geoDisco = new THREE.CircleGeometry(8.6, 44)
    const geoPeana1 = new THREE.RingGeometry(9.4, 10.1, 44)
    const geoPeana2 = new THREE.RingGeometry(12.4, 12.7, 44)
    const matDisco = matPeana.clone(); matDisco.opacity = 0.22
    const peanas = [
      new THREE.Mesh(geoDisco, matDisco),
      new THREE.Mesh(geoPeana1, matPeana),
      new THREE.Mesh(geoPeana2, matPeana),
    ]
    for (const p of peanas) { p.rotation.x = -Math.PI / 2; scene.add(p) }

    /* ── EL CRISTAL KYBER: tallado, no traslúcido ──
       El vidrio de verdad sería `MeshPhysicalMaterial` con `transmission`, pero
       la transmisión DUPLICA el render (pasa la escena entera a un target aparte
       por cuadro) y este módulo tiene que correr en gama baja. El truco barato
       que se ve caro: UNA LatheGeometry de 6 lados —sección hexagonal, como un
       cristal de verdad— con `flatShading` para que cada faceta agarre el
       entorno por su lado, EMISIVO del color (el kyber brilla desde adentro), y
       una cáscara aditiva por fuera como resplandor: la misma receta de tres
       capas de la hoja. Total: dos llamadas de dibujo. */
    /* Perfil ANGULOSO a propósito: pocos puntos y quiebres francos. Con un
       perfil redondeado las 6 caras se funden y el cristal parece una pastilla —
       medido mirándolo, no leyendo. */
    const perfilCristal = [
      [0, 0], [0.78, 1.15], [0.92, 3.3], [0.5, 4.55], [0, 5.4],
    ].map(([r, y]) => new THREE.Vector2(r, y))
    const geoCristal = new THREE.LatheGeometry(perfilCristal, 6)
    /* El emisivo va BAJO: es lo que deja que cada faceta agarre el entorno por
       su lado. A 0.5 el brillo interior aplanaba el tallado y el cristal parecía
       una pastilla; el latido del bucle se mueve alrededor de este valor. */
    const matCristal = new THREE.MeshStandardMaterial({
      flatShading: true, metalness: 0.15, roughness: 0.22, envMapIntensity: 1.4,
      color: 0x2b8cff, emissive: 0x2b8cff, emissiveIntensity: 0.22,
    })
    const matCristalGlow = new THREE.MeshBasicMaterial({
      color: 0x2b8cff, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
    })
    const cristal = new THREE.Mesh(geoCristal, matCristal)
    cristal.position.y = -2.7
    const cristalGlow = new THREE.Mesh(geoCristal, matCristalGlow)
    cristalGlow.scale.setScalar(1.24)
    cristalGlow.position.y = -2.7 * 1.24
    const grupoCristal = new THREE.Group()
    grupoCristal.add(cristal, cristalGlow)
    // Nace inclinado: de frente y derecho, un hexágono enseña una cara plana y
    // parece redondo. En diagonal se ven las aristas, que son el cristal.
    grupoCristal.quaternion.setFromEuler(new THREE.Euler(0.4, 0.5, 0.28))
    grupoCristal.visible = false
    scene.add(grupoCristal)

    let altoTotal = 26
    let separacion = 0, separacionMeta = 0
    let hoja = 0, hojaMeta = 0
    let encendidoActual = false
    let vistaActual: Vista = 'sable'
    /** La pose a la que se viaja con slerp. El arrastre libre la cancela. */
    const qMeta = new THREE.Quaternion().copy(POSES[orientacion])
    let enViaje = false

    const HUECO = 4.6
    function colocarPiezas(): void {
      for (let i = 0; i < piezas.length; i++) {
        const p = piezas[i]
        p.malla.position.y = -altoTotal / 2 + p.base + separacion * HUECO * i
        p.anillo.position.y = p.alto * (i === 1 ? 0.5 : 0.28)
      }
    }

    function colocarHoja(): void {
      const visible = hoja > 0.004
      nucleo.visible = visible
      halo.visible = visible
      bruma.visible = visible
      if (!visible) return
      const nace = altoTotal / 2
      for (const m of [nucleo, halo, bruma]) {
        m.scale.y = hoja
        m.position.y = nace + (LARGO * hoja) / 2
      }
      const prende = Math.min(1, Math.max(0, (hoja - 0.15) / 0.6))
      matHalo.opacity = 0.6 * prende
      matBruma.opacity = 0.2 * prende
    }

    function rehacer(d: Diseno): void {
      const sueltas = piezasDeSable(d)
      altoTotal = sueltas.reduce((s, p) => s + p.alto, 0)
      sueltas.forEach((sp, i) => {
        const vec = sp.puntos.map(([r, y]) => new THREE.Vector2(r, y))
        // 96 segmentos radiales: con PBR el borde del brillo delata las caras
        // planas, y la geometría sigue siendo diminuta.
        const nueva = new THREE.LatheGeometry(vec, 96)
        piezas[i].malla.geometry.dispose()
        piezas[i].malla.geometry = nueva
        piezas[i].base = sp.base
        piezas[i].alto = sp.alto
      })
      const c = colorDeHoja(d.color)
      matHalo.color.set(c.halo)
      matBruma.color.set(c.halo)
      matNucleo.color.set(c.nucleo)
      matPeana.color.set(c.halo)
      matDisco.color.set(c.halo)
      /* El cuerpo va más oscuro que el emisivo: si los dos fueran el halo puro,
         las facetas se aplanan a un solo tono y el tallado desaparece. */
      matCristal.color.set(c.halo).multiplyScalar(0.38)
      matCristal.emissive.set(c.halo)
      matCristalGlow.color.set(c.halo)
      for (const p of peanas) p.position.y = -altoTotal / 2 - 3.2
      colocarPiezas()
      colocarHoja()
      pedirCuadro()
    }

    function encender(v: boolean): void {
      encendidoActual = v
      if (vistaActual === 'cristal') { hojaMeta = 0; arrancar(); return }
      const abierto = separacionMeta > 0.12
      hojaMeta = v && !abierto ? 1 : 0
      distMeta = v && !abierto ? 106 : (abierto ? 48 : 36)
      arrancar()
    }

    function cambiarVista(v: Vista): void {
      vistaActual = v
      const esCristal = v === 'cristal'
      grupoSable.visible = !esCristal
      grupoCristal.visible = esCristal
      /* El pedestal acompaña al que esté en escena: con el cristal, sube y se
         encoge — el cristal mide 5 contra los 26 del mango, y dejar los aros a
         escala de sable los sacaba de cuadro. */
      for (const p of peanas) {
        p.position.y = esCristal ? -5.2 : -altoTotal / 2 - 3.2
        p.scale.setScalar(esCristal ? 0.55 : 1)
      }
      // La cámara mira al punto medio entre el cristal y su pedestal; con el
      // centro del sable, el pedestal quedaba cortado por el borde de abajo.
      centro.y = esCristal ? -2.3 : -1.6
      if (esCristal) { hojaMeta = 0; distMeta = 15 }
      else encender(encendidoActual)
      arrancar()
    }

    function explotar(v: boolean): void {
      separacionMeta = v ? 1 : 0
      encender(encendidoActual)
    }

    function orientar(o: Orientacion): void {
      qMeta.copy(POSES[o])
      enViaje = true
      arrancar()
    }

    // ── Cámara FIJA, apenas elevada. El que rota es el sable. ──
    let dist = 36, distMeta = 36
    const centro = new THREE.Vector3(0, -1.6, 0)
    function colocarCamara(): void {
      camera.position.set(0, centro.y + dist * 0.30, dist)
      camera.lookAt(centro)
    }

    // ── Gestos: arrastre = girar el OBJETO, en ejes de pantalla ──
    const punteros = new Map<number, { x: number; y: number }>()
    const qGiro = new THREE.Quaternion()
    const EJE_X = new THREE.Vector3(1, 0, 0)
    const EJE_Y = new THREE.Vector3(0, 1, 0)
    function alBajar(e: PointerEvent) {
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY })
      renderer.domElement.setPointerCapture(e.pointerId)
      arrancar()
    }
    function alMover(e: PointerEvent) {
      const p = punteros.get(e.pointerId); if (!p) return
      const dx = e.clientX - p.x, dy = e.clientY - p.y
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY })
      /* PREMULTIPLICAR gira en ejes del MUNDO (≈ de pantalla, con la cámara casi
         en +Z): mover el dedo a la derecha rueda el sable a la derecha esté como
         esté. Postmultiplicar giraría en ejes del objeto y con el sable
         horizontal el gesto se sentiría cruzado. */
      const objetivo = vistaActual === 'cristal' ? grupoCristal : grupoSable
      qGiro.setFromAxisAngle(EJE_Y, dx * 0.011)
      objetivo.quaternion.premultiply(qGiro)
      qGiro.setFromAxisAngle(EJE_X, dy * 0.011)
      objetivo.quaternion.premultiply(qGiro)
      // El arrastre manda: cancela cualquier viaje a una pose con nombre.
      enViaje = false
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

      /* SIN BUCLE SE LLEGA DE GOLPE, no a medias. Con `prefers-reduced-motion`
         el bucle no corre nunca: suavizar dejaría la hoja a medio salir PARA
         SIEMPRE. Movimiento reducido es llegar sin transición (§3u). */
      const alGolpe = !animando || reducido.matches
      if (alGolpe) {
        dist = distMeta
        if (separacion !== separacionMeta) { separacion = separacionMeta; colocarPiezas() }
        if (hoja !== hojaMeta) { hoja = hojaMeta; colocarHoja() }
        if (enViaje) { grupoSable.quaternion.copy(qMeta); enViaje = false }
        colocarCamara()
        renderer.render(scene, camera)
        return
      }

      if (Math.abs(dist - distMeta) > 0.05) dist += (distMeta - dist) * Math.min(1, dt * 6)
      else dist = distMeta
      if (Math.abs(separacion - separacionMeta) > 0.002) {
        separacion += (separacionMeta - separacion) * Math.min(1, dt * 5)
        colocarPiezas()
      } else if (separacion !== separacionMeta) {
        separacion = separacionMeta; colocarPiezas()
      }
      if (hoja !== hojaMeta) {
        const paso = dt * (hojaMeta > hoja ? 2.6 : 3.4)
        hoja = hojaMeta > hoja ? Math.min(hojaMeta, hoja + paso) : Math.max(hojaMeta, hoja - paso)
        colocarHoja()
      }
      if (hoja === 1) {
        const late = Math.sin(ahora * 0.011)
        matHalo.opacity = 0.6 + late * 0.06
        matBruma.opacity = 0.2 + late * 0.035
      }
      // El viaje a una pose con nombre. Slerp con freno; al llegar, se suelda.
      if (enViaje) {
        grupoSable.quaternion.slerp(qMeta, Math.min(1, dt * 7))
        if (grupoSable.quaternion.angleTo(qMeta) < 0.01) {
          grupoSable.quaternion.copy(qMeta)
          enViaje = false
        }
      } else if (punteros.size === 0 && !reducido.matches) {
        // Deriva lenta alrededor del eje vertical del mundo, esté en la pose
        // que esté: es presentación, no navegación.
        qGiro.setFromAxisAngle(EJE_Y, dt * (vistaActual === 'cristal' ? 0.45 : 0.16))
        ;(vistaActual === 'cristal' ? grupoCristal : grupoSable).quaternion.premultiply(qGiro)
      }
      // El cristal FLOTA: sube y baja despacio sobre el pedestal. Posición, no
      // escala — mover no invalida nada del compositor de three.
      if (vistaActual === 'cristal') {
        grupoCristal.position.y = Math.sin(ahora * 0.0014) * 0.45
        matCristal.emissiveIntensity = 0.22 + Math.sin(ahora * 0.004) * 0.06
      }
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
    function parar(): void {
      if (!animando) return
      cancelAnimationFrame(rafBucle); animando = false
    }
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
    const io = new IntersectionObserver(
      es => { visible = es[0]?.isIntersecting ?? true; reevaluar() },
      { threshold: 0.05 },
    )
    io.observe(caja)
    const alCambiarVisibilidad = () => reevaluar()
    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    const alCambiarMovimiento = () => reevaluar()
    reducido.addEventListener('change', alCambiarMovimiento)

    // ── Tamaño ──
    function ajustar(): void {
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

    function alPerderContexto(e: Event) {
      e.preventDefault(); parar(); alFallarRef.current?.()
    }
    lienzo.addEventListener('webglcontextlost', alPerderContexto)

    ajustar()
    rehacer(diseno)
    explotar(explotado)
    cambiarVista(vista)
    encender(encendido)
    colocarCamara()
    reevaluar()

    mandoRef.current = { rehacer, encender, explotar, orientar, cambiarVista }

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
      // VA ANTES de `forceContextLoss`: al revés, la pérdida provocada dispara
      // el fallback y la pantalla queda diciendo «no puede dibujar en 3D» (§2s).
      lienzo.removeEventListener('webglcontextlost', alPerderContexto)

      for (const p of piezas) p.malla.geometry.dispose()
      geoAro.dispose(); geoNucleo.dispose(); geoHalo.dispose(); geoBruma.dispose()
      geoDisco.dispose(); geoPeana1.dispose(); geoPeana2.dispose()
      geoCristal.dispose(); matCristal.dispose(); matCristalGlow.dispose()
      matAcero.dispose(); matAgarre.dispose(); matLaton.dispose()
      matNucleo.dispose(); matHalo.dispose(); matBruma.dispose()
      matPeana.dispose(); matDisco.dispose()
      texMoleteado.dispose(); texCepillado.dispose()
      envRT.dispose()
      focoCalido.dispose(); focoFrio.dispose()
      renderer.dispose()
      // `dispose()` NO suelta el contexto: cuenta contra el tope de ~16 de
      // Chrome, compartido con el Contador, la Galaxia y la Mesa (§2s).
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
    // Se monta UNA vez: piezas, encendido, explosión y pose entran por el
    // mando. Reconstruir la escena recompila shaders (§3y).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { mandoRef.current?.rehacer(diseno) }, [diseno])
  useEffect(() => { mandoRef.current?.encender(encendido) }, [encendido])
  useEffect(() => { mandoRef.current?.explotar(explotado) }, [explotado])
  useEffect(() => { mandoRef.current?.orientar(orientacion) }, [orientacion])
  useEffect(() => { mandoRef.current?.cambiarVista(vista) }, [vista])

  return <div ref={cajaRef} className={`relative overflow-hidden ${className}`} />
}

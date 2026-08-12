import * as THREE from 'three'
import type { RasgosMundo } from './semilla'

/**
 * La geometría de un mundo: esfera, cráteres, relieve y albedo por vértice.
 *
 * ── De dónde sale ────────────────────────────────────────────────────
 *
 * Es el `moonGeometry.ts` del demo LUNARIA, portado. El port fue barato porque
 * el original ya era matemática pura sobre `BufferGeometry`: nada de
 * react-three-fiber, nada de física. Se importa `three` pelado, como manda el
 * gotcha 2s de CLAUDE.md.
 *
 * ── Lo que hubo que cambiar, y por qué importa ───────────────────────
 *
 * El original NO tomaba semilla, y eso no era un detalle: los cráteres salían
 * de `theta = golden * i`, una espiral de Fibonacci FIJA, y su tamaño de
 * `hash01(i + 0.5)`, que depende solo del índice. O sea que los veinte
 * jugadores habrían tenido el MISMO mundo, cráter por cráter. Todo lo que
 * decide la forma pasa ahora por la semilla:
 *
 *   · el giro del campo de cráteres      → cada mundo los tiene en otro lado
 *   · su densidad y sus tamaños          → unos picados, otros lisos
 *   · el desplazamiento del ruido        → mares y colinas en otra parte
 *   · la FASE de la ondulación grande    → ojo: esa va con seno y coseno, así
 *     que un desplazamiento de dominio no la mueve; hay que correrle la fase
 *   · la paleta y el nivel de mares      → familias de color, mundos claros y
 *     oscuros
 *
 * `hash01` también cambió: el original hacía `sin(n * 127.1) * 43758.5453`, y
 * sumarle la semilla a `n` corría el argumento por una zona del seno con la
 * misma pinta — mundos «distintos» que se parecían. Ahora la semilla entra por
 * una mezcla entera, que rompe la correlación.
 */

/** Radio del mundo en unidades de escena. El relieve escala su densidad con él. */
export const RADIO_MUNDO = 14.4

/**
 * Hash determinista 0..1 con semilla.
 *
 * La semilla se mezcla con enteros ANTES del seno: sumarla al argumento daría
 * mundos correlacionados, porque el seno es suave y dos semillas cercanas caen
 * en una zona parecida de la curva.
 */
function hash01(n: number, semilla: number): number {
  let h = (Math.imul(semilla ^ 0x9e3779b9, 0x85ebca6b) ^ Math.round(n * 1000)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  const s = Math.sin((h >>> 0) * 0.0001 + n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

function valueNoise(x: number, y: number, z: number, semilla: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const xf = x - xi, yf = y - yi, zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const w = zf * zf * (3 - 2 * zf)
  const h = (i: number, j: number, k: number) => hash01(i * 1.0 + j * 57.0 + k * 113.0, semilla)
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const x00 = lerp(h(xi, yi, zi), h(xi + 1, yi, zi), u)
  const x10 = lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u)
  const x01 = lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u)
  const x11 = lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u)
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w)
}

function fbm(x: number, y: number, z: number, semilla: number): number {
  let f = 0, amp = 0.5, freq = 1
  for (let o = 0; o < 4; o++) {
    f += amp * valueNoise(x * freq, y * freq, z * freq, semilla)
    freq *= 2
    amp *= 0.5
  }
  return f
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Primer índice con arr[i] >= objetivo. Para el descarte por banda de latitud. */
function cotaInferior(arr: Float64Array, n: number, objetivo: number): number {
  let lo = 0, hi = n
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid] < objetivo) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * @param rasgos   los que devuelve `rasgosDe(userId)`
 * @param detalle  subdivisiones del icosaedro. 96 en móvil, 144 en escritorio.
 * @param conColor albedo por vértice (mares, eyección, rayos)
 */
export function construirMundo(
  rasgos: RasgosMundo,
  detalle: number,
  conColor = true,
): THREE.BufferGeometry {
  const semilla = Math.round(rasgos.s01 * 0xffffff)
  const g = new THREE.IcosahedronGeometry(RADIO_MUNDO, detalle)
  const pos = g.attributes.position as THREE.BufferAttribute

  const RB = RADIO_MUNDO / 4.8
  // Deja la PROFUNDIDAD del cráter constante en unidades de mundo: los dos
  // factores RB se cancelan.
  const ESCALA = RADIO_MUNDO / 1.6
  const AMP = 1 / RB

  // Desplazamiento de dominio: mueve DÓNDE cae cada rasgo del ruido. Números
  // grandes y distintos entre ejes para que dos mundos no compartan un plano.
  const ox = rasgos.s01 * 137.5
  const oy = rasgos.s01 * 311.7 + 41.3
  const oz = rasgos.s01 * 523.1 + 97.9

  // ── campo de cráteres ──
  const nC = Math.max(60, Math.round(60 * RB * RB * rasgos.densidadCrateres))
  const aureo = Math.PI * (3 - Math.sqrt(5))
  const cx = new Float64Array(nC), cy = new Float64Array(nC)
  const cz = new Float64Array(nC), cr = new Float64Array(nC)
  for (let i = 0; i < nC; i++) {
    const y = 1 - (i / (nC - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    // `rasgos.giro` es lo que impide que los veinte mundos tengan los cráteres
    // en las mismas coordenadas.
    const theta = aureo * i + rasgos.giro
    cx[i] = Math.cos(theta) * r
    cy[i] = y
    cz[i] = Math.sin(theta) * r
    const t = hash01(i + 0.5, semilla)
    cr[i] = (0.03 + t * t * 0.17) / RB
  }

  // Ordenados por latitud para poder descartar por banda: sin esto, cada
  // vértice compararía contra los ~800 cráteres y la malla tardaría segundos.
  const orden = Array.from({ length: nC }, (_, i) => i).sort((a, b) => cy[a] - cy[b])
  const sx = new Float64Array(nC), sy = new Float64Array(nC)
  const sz = new Float64Array(nC), sr = new Float64Array(nC)
  let radioMax = 0
  for (let k = 0; k < nC; k++) {
    const i = orden[k]
    sx[k] = cx[i]; sy[k] = cy[i]; sz[k] = cz[i]; sr[k] = cr[i]
    if (cr[i] > radioMax) radioMax = cr[i]
  }

  // ── cráteres jóvenes con rayos de eyección ──
  type Rayo = {
    cx: number; cy: number; cz: number; alcance: number; cosAlcance: number
    t1: THREE.Vector3; t2: THREE.Vector3; semilla: number
  }
  const rayos: Rayo[] = []
  if (conColor) {
    const arriba = new THREE.Vector3(0, 1, 0)
    const alterno = new THREE.Vector3(1, 0, 0)
    const c = new THREE.Vector3()
    for (let k = nC - 1; k >= 0 && rayos.length < 10; k--) {
      if (sr[k] < 0.12 / RB) continue
      c.set(sx[k], sy[k], sz[k])
      const t1 = new THREE.Vector3().crossVectors(Math.abs(c.y) > 0.95 ? alterno : arriba, c).normalize()
      const t2 = new THREE.Vector3().crossVectors(c, t1).normalize()
      const ang = 2 * Math.asin(Math.min(1, sr[k] / 2))
      const alcance = ang * 7
      rayos.push({
        cx: c.x, cy: c.y, cz: c.z, alcance, cosAlcance: Math.cos(alcance),
        t1, t2, semilla: hash01(k + 3.7, semilla),
      })
    }
  }

  const colores = conColor ? new Float32Array(pos.count * 3) : null
  const cAltiplano = new THREE.Color(rasgos.altiplano)
  const cMares = new THREE.Color(rasgos.mares)
  const tmp = new THREE.Color()

  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    let despl = 0

    // Ondulación grande y colinas.
    //
    // OJO: acá la semilla entra como FASE (el `+ rasgos.giro`), no como
    // desplazamiento de dominio. Son senos y cosenos del vector ya normalizado:
    // sumarle un offset a `v.x` no mueve el patrón, lo escala mal. Correrle la
    // fase sí lo gira.
    despl += AMP * 0.03 * Math.sin(v.x * 4 * RB + v.y * 3 * RB + rasgos.giro) *
                          Math.cos(v.z * 3.5 * RB + rasgos.giro * 0.7)
    despl += AMP * 0.014 * Math.sin(v.x * 11 * RB + 1.3 + rasgos.giro * 1.9) *
                           Math.sin(v.y * 9 * RB + 2.1) *
                           Math.sin(v.z * 10 * RB + rasgos.giro * 0.4)

    let sueloMul = 1
    let brillo = 0

    const ny = v.y
    let k = cotaInferior(sy, nC, ny - radioMax)
    for (; k < nC && sy[k] <= ny + radioMax; k++) {
      const dx = v.x - sx[k], dy = v.y - sy[k], dz = v.z - sz[k]
      const d2 = dx * dx + dy * dy + dz * dz
      const rad = sr[k]
      if (d2 < rad * rad) {
        const d = Math.sqrt(d2)
        const t = d / rad
        const prof = rad * 0.32
        despl += -prof * (1 - t * t)
        despl += prof * 0.7 * Math.exp(-((t - 0.9) ** 2) * 70)
        if (conColor) {
          sueloMul *= 0.72 + 0.28 * t * t
          brillo += Math.exp(-((t - 0.92) ** 2) * 60) * 0.18
        }
      } else if (conColor && d2 < (rad * 1.7) * (rad * 1.7)) {
        const d = Math.sqrt(d2)
        brillo += (1 - (d - rad) / (rad * 0.7)) * 0.07
      }
    }

    // Micro-relieve facetado. Solo en alta resolución: en 96 subdivisiones los
    // vértices están más separados que la frecuencia del ruido y solo agrega
    // ruido de muestreo.
    if (detalle >= 120) {
      despl += (valueNoise(v.x * 22 * RB + ox, v.y * 22 * RB + oy, v.z * 22 * RB + oz, semilla) - 0.5) * 0.02 * AMP
      despl += (valueNoise(v.x * 48 * RB + ox, v.y * 48 * RB + oy, v.z * 48 * RB + oz, semilla) - 0.5) * 0.008 * AMP
    }

    if (conColor && colores) {
      const m = fbm(v.x * 1.4 * RB + ox, v.y * 1.4 * RB + oy, v.z * 1.4 * RB + oz, semilla)
      // `nivelMares` corre el umbral: bajo = mundo manchado y oscuro, alto =
      // mundo claro y liso. Es lo que más cambia el aire de un planeta a otro.
      const mar = smoothstep(rasgos.nivelMares, rasgos.nivelMares + 0.14, m)
      tmp.copy(cAltiplano).lerp(cMares, mar)

      const tono = 0.9 + 0.16 * fbm(v.x * 2.3 * RB - ox, v.y * 2.3 * RB + oy, v.z * 2.3 * RB - oz, semilla)
      const mota = (valueNoise(v.x * 40 * RB + ox, v.y * 40 * RB + oy, v.z * 40 * RB + oz, semilla) - 0.5) * 0.06
      tmp.multiplyScalar(sueloMul * tono)

      for (let r = 0; r < rayos.length; r++) {
        const rc = rayos[r]
        const dot = v.x * rc.cx + v.y * rc.cy + v.z * rc.cz
        // Descarte antes de la trigonometría: `acos` y `atan2` por vértice y
        // por rayo serían el cuello de botella de toda la construcción.
        if (dot <= rc.cosAlcance) continue
        const a = Math.acos(Math.min(1, dot))
        const phi = Math.atan2(v.dot(rc.t2), v.dot(rc.t1))
        let s = Math.abs(Math.sin(phi * 7 + rc.semilla * 6.28))
        s = s * 0.7 + 0.3 * Math.abs(Math.sin(phi * 15 + rc.semilla * 3))
        brillo += smoothstep(0.74, 0.97, s) * (1 - a / rc.alcance) * 0.3
      }

      const suma = brillo + mota
      colores[i * 3] = Math.min(1.1, tmp.r + suma)
      colores[i * 3 + 1] = Math.min(1.1, tmp.g + suma)
      colores[i * 3 + 2] = Math.min(1.1, tmp.b + suma)
    }

    v.multiplyScalar(RADIO_MUNDO + despl * ESCALA)
    pos.setXYZ(i, v.x, v.y, v.z)
  }

  if (colores) g.setAttribute('color', new THREE.BufferAttribute(colores, 3))
  g.computeVertexNormals()
  return g
}

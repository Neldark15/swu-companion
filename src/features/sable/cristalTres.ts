/**
 * EL CRISTAL KYBER: una roca de verdad, no una pastilla.
 *
 * Nel: «que tengan formas reales de roca, cristales que brillen, que tengan
 * texturas, que emanen brillos».
 *
 * ── Por qué no alcanzaba con `LatheGeometry` ──────────────────────────
 *
 * La versión vieja era un perfil girado 6 veces: un huso hexagonal perfecto,
 * simétrico hasta el último micrón. Un cuarzo de verdad NO es eso. Es un prisma
 * de seis caras DESPAREJAS —cada una con su ancho— rematado por una pirámide
 * de seis triángulos que casi nunca cae en el centro. Esa irregularidad es toda
 * la diferencia entre «piedra» y «pieza torneada de vidrio».
 *
 * Así que la geometría se construye a mano, triángulo por triángulo.
 *
 * ── Cada color es una roca DISTINTA, y siempre la misma ───────────────
 *
 * La irregularidad sale de una semilla derivada del id del color, no de
 * `Math.random()`. Dos cosas dependen de eso: que el cristal ámbar no cambie de
 * forma cada vez que abrís la pantalla, y que la foto del mango de la barra de
 * XP —que se cachea— salga idéntica en cada render. El azar acá sería un caché
 * que nunca acierta.
 *
 * ── Sin transparencia, a propósito ────────────────────────────────────
 *
 * El vidrio de verdad sería `transmission`, que DUPLICA el render (pasa la
 * escena entera a un target aparte por cuadro) y este módulo tiene que correr
 * en gama baja. Lo que da la ilusión son tres capas opacas: la roca facetada
 * que refleja el entorno, una cáscara aditiva que la envuelve, y las vetas
 * internas dibujadas en una textura emisiva.
 */

import * as THREE from 'three'

/** Azar DETERMINISTA a partir de una semilla. Mismo id, misma roca, siempre. */
function dado(semilla: number): () => number {
  let s = semilla >>> 0
  return () => {
    // xorshift32: barato, sin dependencias y suficientemente revuelto.
    s ^= s << 13; s >>>= 0
    s ^= s >> 17
    s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
}

/** La semilla de un id: suma de sus letras. Estable entre sesiones y equipos. */
export function semillaDe(id: string): number {
  let n = 2166136261
  for (let i = 0; i < id.length; i++) {
    n ^= id.charCodeAt(i)
    n = Math.imul(n, 16777619)
  }
  return n >>> 0
}

/**
 * Una roca de cuarzo: prisma de N caras desparejas con terminación piramidal
 * arriba y abajo.
 *
 * Sin índices y con `computeVertexNormals`: cada triángulo se queda con su
 * propia normal, que es lo que hace que las caras se vean PLANAS y con arista
 * viva. Indexada, three promedia las normales de los vértices compartidos y el
 * cristal sale redondeado como un caramelo.
 */
export function geometriaDeCristal(semilla: number, caras = 6): THREE.BufferGeometry {
  const r = dado(semilla)
  const v: number[] = []
  const empuja = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
    v.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)

  /* Las proporciones de un cuarzo: el prisma es el grueso del cristal y las
     puntas son cortas. Un prisma corto con puntas largas se lee como un dado
     de rol, no como una piedra. */
  const yBajo = -1.6, yAlto = 1.9
  const puntaAlta = 3.5, puntaBaja = -2.7

  // Cada cara tiene su radio y su ángulo un poco corridos: es lo que hace que
  // la piedra no sea un tornillo.
  const anillo = (y: number, escala: number) =>
    Array.from({ length: caras }, (_, i) => {
      const a = ((i + (r() - 0.5) * 0.14) / caras) * Math.PI * 2
      const rad = (0.72 + r() * 0.34) * escala
      return new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad)
    })

  const abajo = anillo(yBajo, 0.86)
  const arriba = anillo(yAlto, 1)
  /* Las puntas se corren del eje: en un cristal natural el ápice casi nunca cae
     justo en el centro, y ese desvío es lo que delata que creció. */
  const apice = new THREE.Vector3((r() - 0.5) * 0.5, puntaAlta, (r() - 0.5) * 0.5)
  const base = new THREE.Vector3((r() - 0.5) * 0.4, puntaBaja, (r() - 0.5) * 0.4)

  for (let i = 0; i < caras; i++) {
    const j = (i + 1) % caras
    // La pared del prisma: dos triángulos por cara.
    empuja(abajo[i], arriba[i], arriba[j])
    empuja(abajo[i], arriba[j], abajo[j])
    // Las dos terminaciones.
    empuja(arriba[i], apice, arriba[j])
    empuja(abajo[j], base, abajo[i])
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
  g.computeVertexNormals()
  // Los UV van por altura: las vetas de la textura corren a lo largo del
  // cristal, que es como corren en una piedra de verdad.
  const uv: number[] = []
  const pos = g.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    uv.push((Math.atan2(z, x) / (Math.PI * 2)) + 0.5, (y - puntaBaja) / (puntaAlta - puntaBaja))
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  return g
}

/**
 * Las VETAS: fracturas internas dibujadas en un lienzo.
 *
 * Va como `emissiveMap`, no como `map`: lo que se busca es que la luz salga
 * por las grietas y no que la piedra tenga un dibujo pintado encima. El
 * emisivo multiplica el color del cristal, así que la misma textura sirve para
 * los quince colores — una sola textura para toda la pantalla.
 *
 * Determinista, sin `Math.random`: la foto del mango se cachea y con azar dos
 * renders del mismo cristal darían dos imágenes distintas.
 */
export function texturaDeVetas(): THREE.CanvasTexture {
  const S = 128
  const c = document.createElement('canvas')
  c.width = c.height = S
  const x = c.getContext('2d')!
  // El fondo NO es negro: es el brillo de base de la piedra. En negro puro
  // solo brillarían las grietas y el cristal se vería apagado entre ellas.
  const f = x.createLinearGradient(0, 0, 0, S)
  f.addColorStop(0, '#8a8a8a')
  f.addColorStop(0.5, '#5a5a5a')
  f.addColorStop(1, '#7a7a7a')
  x.fillStyle = f
  x.fillRect(0, 0, S, S)

  const r = dado(0x5ab1e)
  x.lineCap = 'round'
  for (let i = 0; i < 26; i++) {
    // Las fracturas corren casi verticales, como en un cuarzo.
    const x0 = r() * S
    const y0 = r() * S * 0.4
    const largo = S * (0.3 + r() * 0.6)
    const tono = 170 + Math.floor(r() * 85)
    x.strokeStyle = `rgba(${tono},${tono},${tono},${0.25 + r() * 0.5})`
    x.lineWidth = 0.6 + r() * 1.8
    x.beginPath()
    x.moveTo(x0, y0)
    // Tres tramos con quiebre: una grieta recta se lee como una raya.
    let px = x0, py = y0
    for (let t = 0; t < 3; t++) {
      px += (r() - 0.5) * S * 0.18
      py += largo / 3
      x.lineTo(px, py)
    }
    x.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

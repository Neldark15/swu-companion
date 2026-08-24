/**
 * EL TALLER DE MATERIALES: convierte los datos de `partesSable` en mallas.
 *
 * Lo usan LOS DOS que dibujan un mango —la escena grande (`SableEscena`) y la
 * foto de la barra de XP (`miniaturaSable3D`)— y esa es la razón de que exista.
 * Antes cada uno armaba sus materiales y su aro por su cuenta, y ya empezaban a
 * diferir: la escena tenía moleteado y vetas, la miniatura no. Dos dibujos del
 * mismo objeto es exactamente cómo se separó de sí misma la tarjeta de jugador
 * (§2y). Ahora hay un solo constructor y dos clientes.
 *
 * ── Los materiales se crean UNA vez y no se tocan más ─────────────────
 *
 * Cambiar de pieza reconstruye las mallas de sus herrajes en caliente. Eso es
 * gratis mientras el MATERIAL sea el mismo objeto: three enlaza un programa por
 * material, y `glLinkProgram` es síncrono — un material nuevo por cada cambio
 * de pieza sería un tirón en cada toque, que es el fallo que ya costó caro en
 * la Galaxia (§3y). Por eso el taller cachea materiales por id y geometrías por
 * medidas, y lo único que se destruye al cambiar de pieza son los `Object3D`,
 * que no cuestan nada.
 *
 * ── `luz` es el único material que cambia ─────────────────────────────
 *
 * El testigo del botón y las gemas toman el color de TU cristal. Es un solo
 * material compartido al que se le cambia el color cuando cambia la hoja: una
 * asignación, sin recompilar nada.
 */

import * as THREE from 'three'
import {
  MATERIALES, asientoDe, emite, tomaElColorDelCristal,
  type Herraje, type MaterialId, type PiezaSuelta,
} from './partesSable'

/**
 * Un herraje más fino que esto, en píxeles, es ruido: no se lee como un botón,
 * se lee como suciedad en la pantalla. Es el umbral que deja fuera los aros de
 * la foto de la barra de XP (0,10 unidades ≈ 0,8 px) y deja pasar las aletas.
 */
const PX_MINIMOS = 1.2

export interface Taller {
  material: (id: MaterialId) => THREE.MeshStandardMaterial
  /** Repinta los materiales que toman el color de la hoja. */
  alumbrar: (hex: string) => void
  /**
   * EL LATIDO. Se llama por cuadro con el reloj.
   *
   * Pasar `null` es «sin bucle»: deja todo en su valor MEDIO en vez de
   * congelarlo donde haya quedado. Con `prefers-reduced-motion` el bucle no
   * corre nunca, y una brasa clavada en su punto más apagado se ve rota, no
   * quieta — es la misma regla que ya rige la hoja y la explosión (§3u).
   */
  latir: (ahora: number | null) => void
  /** La geometría de un herraje, ya orientada. La usa `vestirPieza`; va acá
      para que el caché de geometrías no se escape del taller que las destruye. */
  geometriaDe: (h: Herraje, espesor: number, apoyo: number) => THREE.BufferGeometry
  soltar: () => void
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
  /* Sin `Math.random`: la veta se calcula con una función revuelta pero
     DETERMINISTA, así la foto de la barra de XP sale idéntica en cada visita.
     Con azar, dos renders del mismo mango daban dos PNG distintos y el caché
     dejaba de tener sentido. */
  for (let i = 0; i < 340; i++) {
    const a = Math.sin(i * 12.9898) * 43758.5453
    const b = Math.sin(i * 78.233) * 12345.6789
    const y = (a - Math.floor(a)) * S
    const tono = 40 + Math.floor((b - Math.floor(b)) * 60)
    x.strokeStyle = `rgba(${tono},${tono},${tono},0.5)`
    x.lineWidth = 1
    x.beginPath()
    x.moveTo(0, y)
    x.lineTo(S, y + ((a - Math.floor(a)) - 0.5) * 2)
    x.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 2)
  return t
}

/**
 * Abre un taller. `detalle: false` deja fuera las texturas procedurales, que a
 * 22 px de alto (la barra de XP) son ruido subpíxel y no se distinguen.
 */
export function abrirTallerTres(detalle = true): Taller {
  const materiales = new Map<MaterialId, THREE.MeshStandardMaterial>()
  const texturas: THREE.Texture[] = []
  const moleteado = detalle ? texturaMoleteado() : null
  const cepillado = detalle ? texturaCepillado() : null
  if (moleteado) texturas.push(moleteado)
  if (cepillado) texturas.push(cepillado)

  function material(id: MaterialId): THREE.MeshStandardMaterial {
    const hecho = materiales.get(id)
    if (hecho) return hecho
    const d = MATERIALES[id] ?? MATERIALES.acero
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(d.hex),
      metalness: d.metalico,
      roughness: d.rugoso,
    })
    if (emite(id)) {
      /* Lo que emite no refleja: brilla. Sin `emissive` un testigo sería un
         punto gris, y sin bajarle el `color` el cuerpo del objeto compite con
         su propio brillo y el conjunto se lee como plástico claro.

         Las intensidades están escalonadas a propósito: `luz` es un testigo
         (avisa), `plasma` es energía a la vista (impresiona), `nucleo` es lo
         más brillante que hay en un mango. Si fueran todas iguales, agregar un
         reactor no se sentiría distinto a agregar un botón. */
      m.emissive = new THREE.Color(d.hex)
      m.emissiveIntensity = id === 'luz' ? 0.95 : id === 'plasma' ? 1.6 : id === 'brasa' ? 1.2 : 1.5
      m.color.multiplyScalar(id === 'luz' ? 0.25 : 0.18)
    }
    /* El moleteado va SOLO en lo que se agarra. Puesto también en el negro,
       el emisor TITÁN salía escamoso como piel de reptil: el patrón se repite
       10×4 sobre el mango entero, y en una pieza de 6 de alto esa densidad deja
       de leerse como agarre y pasa a ser ruido. Los colores planos (esmalte,
       jade, luz) van lisos: una veta sobre pintura es un error. */
    if (moleteado && !emite(id) && (id === 'grafito' || id === 'cuero')) {
      m.bumpMap = moleteado
      m.bumpScale = id === 'cuero' ? 0.45 : 0.9
    }
    if (cepillado && !emite(id) && (id === 'acero' || id === 'laton' || id === 'cobre' || id === 'bronce')) {
      m.roughnessMap = cepillado
    }
    materiales.set(id, m)
    return m
  }

  /* Las geometrías se cachean por MEDIDAS. Dos piezas distintas con el mismo
     aro comparten una sola geometría, y cambiar de pieza casi nunca crea una
     nueva: al tercer o cuarto cambio el caché ya las tiene todas. */
  const geometrias = new Map<string, THREE.BufferGeometry>()
  function geo(clave: string, hacer: () => THREE.BufferGeometry): THREE.BufferGeometry {
    const hecha = geometrias.get(clave)
    if (hecha) return hecha
    const nueva = hacer()
    geometrias.set(clave, nueva)
    return nueva
  }

  const n = (v: number) => v.toFixed(2)

  /** La geometría de un herraje, ya orientada: +Z apunta hacia afuera. */
  function geoDe(h: Herraje, espesor: number, apoyo: number): THREE.BufferGeometry {
    switch (h.tipo) {
      case 'anillo':
        return geo(`ani:${n(apoyo)}:${n(h.grosor)}`, () => {
          const g = new THREE.TorusGeometry(apoyo, h.grosor, 8, 40)
          g.rotateX(Math.PI / 2)
          return g
        })
      case 'cable':
        return geo(`cab:${n(apoyo)}:${n(h.grosor)}:${n(h.arco)}`, () => {
          const g = new THREE.TorusGeometry(apoyo, h.grosor, 6, 26, h.arco)
          g.rotateX(Math.PI / 2)
          return g
        })
      case 'boton':
        return geo(`bot:${n(h.radio)}:${n(espesor)}`, () => {
          // Ligeramente cónico: un botón con la cara de arriba más chica que la
          // base agarra la luz por el bisel y deja de ser un disco pegado.
          const g = new THREE.CylinderGeometry(h.radio * 0.86, h.radio, espesor, 14)
          g.rotateX(Math.PI / 2) // el eje pasa a ser +Z: hacia afuera
          return g
        })
      case 'caja':
        return geo(`caj:${n(h.ancho)}:${n(h.alto)}:${n(espesor)}`,
          () => new THREE.BoxGeometry(h.ancho, h.alto, espesor))
      case 'aleta':
        return geo(`ale:${n(h.ancho)}:${n(h.alto)}:${n(espesor)}`,
          () => new THREE.BoxGeometry(h.ancho, h.alto, espesor))
      case 'gema':
        // Octaedro: pocas caras y bien marcadas. Una esfera a este tamaño es un
        // punto de color; las facetas son lo que se lee como piedra.
        return geo(`gem:${n(h.radio)}`, () => new THREE.OctahedronGeometry(h.radio, 0))
      case 'destello':
        // Ocho triángulos y afuera. Un destello se lee por su BRILLO y por
        // cómo late, no por su forma: gastar caras acá sería gastarlas en algo
        // que a este tamaño nadie distingue.
        return geo(`des:${n(h.radio)}`, () => new THREE.OctahedronGeometry(h.radio, 0))
    }
  }

  return {
    material,
    geometriaDe: geoDe,
    alumbrar(hex: string) {
      for (const id of ['luz', 'plasma'] as const) {
        if (!tomaElColorDelCristal(id)) continue
        const m = materiales.get(id)
        if (!m) continue
        m.emissive.set(hex)
        m.color.set(hex).multiplyScalar(id === 'luz' ? 0.25 : 0.18)
      }
    },
    latir(ahora: number | null) {
      /* Late el MATERIAL, que es compartido: una sola asignación mueve todos
         los plasmas de la escena. Los destellos, en cambio, tienen que titilar
         DESFASADOS entre sí o la fila se ve como una lámpara en vez de una
         chispa que corre — y eso no se puede hacer desde el material. Lo hace
         la escena, malla por malla, con el desfase que `vestirPieza` les dejó. */
      const plasma = materiales.get('plasma')
      if (plasma) plasma.emissiveIntensity = ahora === null ? 1.6 : 1.6 + Math.sin(ahora * 0.0045) * 0.45
      const brasa = materiales.get('brasa')
      // Más lento y desfasado: una brasa respira, no parpadea.
      if (brasa) brasa.emissiveIntensity = ahora === null ? 1.2 : 1.2 + Math.sin(ahora * 0.0022 + 1.1) * 0.35
    },
    soltar() {
      for (const m of materiales.values()) m.dispose()
      for (const g of geometrias.values()) g.dispose()
      for (const t of texturas) t.dispose()
      materiales.clear()
      geometrias.clear()
    },
  }
}

/**
 * Le pone a una malla su material y sus herrajes.
 *
 * Los herrajes van de HIJOS: así viajan con la pieza cuando el sable se abre,
 * sin recolocarlos por cuadro. Los hijos viejos se quitan pero NO se destruyen:
 * sus geometrías y materiales son del taller y los comparten otras piezas.
 */
export function vestirPieza(
  malla: THREE.Mesh, pieza: PiezaSuelta, taller: Taller,
  /**
   * Cuántos píxeles mide una unidad del mango en pantalla. Dándolo, los
   * herrajes demasiado finos para verse se omiten.
   *
   * NO es una segunda versión del mango —eso sería el §2y otra vez—: es el
   * MISMO dato mirado de lejos. La foto de la barra de XP sale a ~8 px por
   * unidad, donde un aro de 0,10 mide 0,8 px: dibujarlo no agrega un aro,
   * agrega una línea sucia. El material, en cambio, sí se lee a ese tamaño, y
   * por eso el color sí viaja.
   */
  pxPorUnidad?: number,
): THREE.Mesh[] {
  malla.material = taller.material(pieza.material)

  // Copia de `children`: recorrer la lista viva mientras se quita de ella salta
  // uno de cada dos y deja herrajes viejos apilados bajo los nuevos.
  for (const viejo of [...malla.children]) malla.remove(viejo)

  /** Los destellos, para que la escena los haga titilar con su desfase. */
  const titilan: THREE.Mesh[] = []

  for (const h of pieza.herrajes) {
    const { apoyo, dentro, fuera } = asientoDe(pieza.perfil, h, pieza.alto)
    if (pxPorUnidad && (fuera - apoyo) * pxPorUnidad < PX_MINIMOS) continue
    const espesor = fuera - dentro
    const centro = (dentro + fuera) / 2
    const y = h.y * pieza.alto
    const geometria = taller.geometriaDe(h, espesor, apoyo)
    const material = taller.material(h.material)

    if (h.tipo === 'anillo' || h.tipo === 'cable') {
      // Aros y cables rodean el eje: ya vienen girados a su plano. El `giro` los
      // corre alrededor del mango y la `inclina` los ladea, que es lo que hace
      // que un cable parezca atado y no impreso.
      const m = new THREE.Mesh(geometria, material)
      m.position.y = y
      if (h.tipo === 'cable') m.rotation.set(h.inclina ?? 0, 0, h.giro ?? 0)
      malla.add(m)
      continue
    }

    // La caja es única por definición (una caja de control no viene de a
    // cuatro); las demás pueden repetirse alrededor del eje.
    const vueltas = h.tipo === 'aleta' ? h.vueltas
      : h.tipo === 'caja' ? 1
      : (h.vueltas ?? 1)
    const giro0 = h.giro ?? 0
    for (let i = 0; i < vueltas; i++) {
      const a = giro0 + (i * Math.PI * 2) / vueltas
      const m = new THREE.Mesh(geometria, material)
      /* Un solo convenio para todos: la malla se corre al radio en la dirección
         del ángulo y se gira ese mismo ángulo sobre el eje del mango. Así su +Z
         local mira siempre hacia afuera, esté donde esté. */
      m.position.set(Math.sin(a) * centro, y, Math.cos(a) * centro)
      m.rotation.y = a
      if (h.tipo === 'destello') {
        // El desfase va POR MALLA: es lo único que distingue una chispa que
        // corre de ocho lucecitas prendiéndose a la vez.
        m.userData.fase = (i / vueltas) * Math.PI * 2
        titilan.push(m)
      }
      malla.add(m)
    }
  }
  return titilan
}

/** Cuánto se sale del eje la pieza más gorda, herrajes incluidos. */
export function radioMaximo(piezas: PiezaSuelta[]): number {
  let max = 0
  for (const p of piezas) {
    for (const [r] of p.puntos) if (r > max) max = r
    for (const h of p.herrajes) {
      const { fuera } = asientoDe(p.perfil, h, p.alto)
      if (fuera > max) max = fuera
    }
  }
  return max
}

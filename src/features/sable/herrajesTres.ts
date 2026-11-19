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
import { crearDetallesPieza, unirGeometrias, type AcabadoMecanizado } from './detalleHerrajes'
import { geometriaDeCristal } from './cristalTres'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  MATERIALES, asientoDe, emite, tomaElColorDelCristal,
  type Herraje, type MaterialId, type PiezaSuelta,
} from './partesSable'
import { placaRanurada } from './placaRanurada'
import { crearCintaHelicoidal } from './cintaHelicoidal'
import { crearTexturasSuperficie, type SuperficieSable } from './texturasSable'

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
  cintaDe: (pieza: PiezaSuelta, cable: Extract<Herraje, { tipo: 'cable'; cinta: object }>) => THREE.BufferGeometry
  /** Cartucho y cristal comparten caché y dueño con los demás herrajes. */
  camaraDe: (radio: number, espesor: number, vueltas: number, giro: number, centro: number) => {
    marco: THREE.BufferGeometry; fondo: THREE.BufferGeometry; cristal: THREE.BufferGeometry
  }
  detallesDe: (pieza: PiezaSuelta) => AcabadoMecanizado[]
  agruparFijos: (malla: THREE.Mesh, pieza: PiezaSuelta, animadas: THREE.Mesh[]) => void
  soltar: () => void
}

/**
 * Abre un taller. `detalle: false` deja fuera las texturas procedurales, que a
 * 22 px de alto (la barra de XP) son ruido subpíxel y no se distinguen.
 */
export function abrirTallerTres(detalle = true): Taller {
  const materiales = new Map<MaterialId, THREE.MeshStandardMaterial>()
  const texturas: THREE.Texture[] = []
  const superficies = new Map<SuperficieSable, ReturnType<typeof crearTexturasSuperficie>>()
  let colorCristal: string | null = null

  function superficie(tipo: SuperficieSable): ReturnType<typeof crearTexturasSuperficie> {
    const hecha = superficies.get(tipo)
    if (hecha) return hecha
    const nueva = crearTexturasSuperficie(tipo)
    superficies.set(tipo, nueva)
    texturas.push(nueva.relieve, nueva.rugosidad)
    return nueva
  }

  function material(id: MaterialId): THREE.MeshStandardMaterial {
    const hecho = materiales.get(id)
    if (hecho) return hecho
    const d = MATERIALES[id] ?? MATERIALES.acero
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(d.hex),
      metalness: d.metalico,
      // Acabados promediados también en la miniatura sin texturas.
      roughness: id === 'negro' ? 0.42 : d.rugoso,
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
      if (colorCristal && tomaElColorDelCristal(id)) {
        m.emissive.set(colorCristal)
        m.color.set(colorCristal).multiplyScalar(id === 'luz' ? 0.25 : 0.18)
      }
    }
    if (detalle && !emite(id)) {
      const tipo = id === 'grafito' ? 'moleteado' : id === 'cuero' ? 'cuero'
        : id === 'negro' ? 'anodizado'
        : ['acero', 'laton', 'cobre', 'bronce'].includes(id) ? 'cepillado' : null
      if (tipo) {
        const t = superficie(tipo)
        m.bumpMap = t.relieve
        m.roughnessMap = t.rugosidad
        // Relieve de décimas de milímetro: evita el viejo aspecto de escamas.
        m.bumpScale = tipo === 'moleteado' ? 0.065 : tipo === 'cuero' ? 0.045
          : tipo === 'cepillado' ? 0.018 : 0.012
      }
    }
    materiales.set(id, m)
    return m
  }

  /* Las geometrías se cachean por MEDIDAS. Dos piezas distintas con el mismo
     aro comparten una sola geometría, y cambiar de pieza casi nunca crea una
     nueva: al tercer o cuarto cambio el caché ya las tiene todas. */
  const detalles = new Map<string, AcabadoMecanizado[]>()
  const geometrias = new Map<string, THREE.BufferGeometry>()
  function geo(clave: string, hacer: () => THREE.BufferGeometry): THREE.BufferGeometry {
    const hecha = geometrias.get(clave)
    if (hecha) return hecha
    const nueva = hacer()
    geometrias.set(clave, nueva)
    return nueva
  }

  const n = (v: number) => v.toFixed(5)

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
        if (h.cinta) throw new Error('La cinta helicoidal necesita el perfil del cuerpo.')
        return geo(`cab:${n(apoyo)}:${n(h.grosor)}:${n(h.arco)}`, () => {
          const g = new THREE.TorusGeometry(apoyo, h.grosor, 6, 26, h.arco)
          g.rotateX(Math.PI / 2)
          return g
        })
      case 'boton':
        return geo(`bot:${n(h.radio)}:${n(espesor)}`, () => {
          const bisel = Math.min(0.045, h.radio * 0.2, espesor * 0.2)
          const medio = espesor / 2
          const g = new THREE.LatheGeometry([
            new THREE.Vector2(0, -medio), new THREE.Vector2(h.radio - bisel, -medio),
            new THREE.Vector2(h.radio, -medio + bisel), new THREE.Vector2(h.radio, medio - bisel),
            new THREE.Vector2(h.radio - bisel, medio), new THREE.Vector2(0, medio),
          ], detalle ? 24 : 14)
          g.rotateX(Math.PI / 2)
          return g
        })
      case 'caja':
        return geo(`caj:${n(h.ancho)}:${n(h.alto)}:${n(espesor)}`,
          () => detalle ? new RoundedBoxGeometry(h.ancho, h.alto, espesor, 1, Math.min(0.065, espesor * 0.16))
            : new THREE.BoxGeometry(h.ancho, h.alto, espesor))
      case 'aleta':
        if (h.ranuras) {
          const ranuras = h.ranuras
          return geo(`placa:${n(h.ancho)}:${n(h.alto)}:${n(espesor)}:${ranuras}`,
            () => placaRanurada(h.ancho, h.alto, espesor, ranuras, detalle))
        }
        return geo(`ale:${n(h.ancho)}:${n(h.alto)}:${n(espesor)}:${n(h.bisel ?? 0.045)}`,
          () => detalle ? new RoundedBoxGeometry(h.ancho, h.alto, espesor, 1, Math.min(h.bisel ?? 0.045, h.ancho * 0.3))
            : new THREE.BoxGeometry(h.ancho, h.alto, espesor))
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
    cintaDe(pieza, cable) {
      const clave = JSON.stringify([pieza.perfil, cable])
      return geo(clave, () => crearCintaHelicoidal(pieza, cable, detalle))
    },
    camaraDe(radio, espesor, vueltas, giro, centro) {
      const clave = `cam:${n(radio)}:${n(espesor)}:${vueltas}:${n(giro)}:${n(centro)}`
      const ancho = radio * 2, alto = radio * 5
      const borde = radio * 0.19, labio = espesor / 2
      // Los dos cartuchos se fusionan por material: tres draw calls en total,
      // el mismo presupuesto que las dos gemas y su aro anteriores.
      function repetir(g: THREE.BufferGeometry): THREE.BufferGeometry {
        const copias: THREE.BufferGeometry[] = []
        for (let i = 0; i < vueltas; i++) {
          const angulo = giro + i * Math.PI * 2 / vueltas
          copias.push(g.clone().translate(0, 0, centro).rotateY(angulo))
        }
        const unida = mergeGeometries(copias, false)!
        for (const copia of copias) copia.dispose()
        g.dispose()
        return unida
      }
      return {
        marco: geo(`${clave}:marco`, () => {
          const forma = new THREE.Shape()
          const r = radio * 0.22, w = ancho / 2, h = alto / 2
          forma.moveTo(-w + r, -h)
          forma.lineTo(w - r, -h); forma.quadraticCurveTo(w, -h, w, -h + r)
          forma.lineTo(w, h - r); forma.quadraticCurveTo(w, h, w - r, h)
          forma.lineTo(-w + r, h); forma.quadraticCurveTo(-w, h, -w, h - r)
          forma.lineTo(-w, -h + r); forma.quadraticCurveTo(-w, -h, -w + r, -h)
          const hueco = new THREE.Path()
          hueco.moveTo(-w + borde, -h + borde)
          hueco.lineTo(-w + borde, h - borde)
          hueco.lineTo(w - borde, h - borde)
          hueco.lineTo(w - borde, -h + borde)
          hueco.closePath()
          forma.holes.push(hueco)
          const bisel = borde * 0.22
          const g = new THREE.ExtrudeGeometry(forma, {
            depth: espesor - bisel * 2, steps: 1, curveSegments: 3,
            bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 1,
          })
          g.translate(0, 0, -espesor / 2 + bisel)
          if (!detalle) return repetir(g)
          // Las dos mordazas y sus pasadores van en la misma malla de latón.
          const elementos: THREE.BufferGeometry[] = [g]
          for (const lado of [-1, 1]) {
            const soporte = new THREE.CylinderGeometry(radio * 0.30, radio * 0.47, radio * 0.52, 12)
            if (lado === -1) soporte.rotateZ(Math.PI)
            soporte.translate(0, lado * alto * 0.39, labio - radio * 0.31)
            elementos.push(soporte.toNonIndexed())
            soporte.dispose()
            for (const x of [-1, 1]) {
              const pasador = new THREE.CylinderGeometry(borde * 0.55, borde * 0.67, borde * 0.18, 6)
              pasador.rotateX(Math.PI / 2)
              pasador.translate(x * (w - borde / 2), lado * (h - borde * 1.8), labio)
              elementos.push(pasador.toNonIndexed())
              pasador.dispose()
            }
          }
          const marco = mergeGeometries(elementos)!
          elementos.forEach(elemento => elemento.dispose())
          return repetir(marco)
        }),
        fondo: geo(`${clave}:fondo`, () => repetir(new THREE.BoxGeometry(ancho * 0.94, alto * 0.94, 0.025)
          .translate(0, 0, labio - radio * 0.58))),
        cristal: geo(`${clave}:cristal`, () => {
          // El mismo prisma asimétrico del paso Cristal, visible entre mordazas.
          const g = geometriaDeCristal(781)
          g.scale(radio * 0.55, alto * 0.13, radio * 0.24)
          g.translate(0, -alto * 0.053, labio - radio * 0.28)
          return repetir(g)
        }),
      }
    },
    alumbrar(hex: string) {
      colorCristal = hex
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
    detallesDe(pieza) {
      const hechos = detalles.get(pieza.id)
      if (hechos) return hechos
      const nuevos = crearDetallesPieza(pieza, detalle)
      detalles.set(pieza.id, nuevos)
      return nuevos
    },
    agruparFijos(malla, pieza, animadas) {
      if (!detalle) return
      const grupos = new Map<THREE.Material, THREE.Mesh[]>()
      for (const hijo of malla.children) {
        if (!(hijo instanceof THREE.Mesh) || animadas.includes(hijo)) continue
        const grupo = grupos.get(hijo.material)
        if (grupo) grupo.push(hijo)
        else grupos.set(hijo.material, [hijo])
      }
      for (const [material, hijos] of grupos) {
        if (hijos.length < 2) continue
        const clave = `${pieza.id}:${material.uuid}:${hijos.map(m => m.geometry.uuid).join('/')}`
        const fusion = geo(clave, () => unirGeometrias(hijos.map(hijo => {
          hijo.updateMatrix()
          return hijo.geometry.clone().applyMatrix4(hijo.matrix)
        })))
        malla.remove(...hijos)
        malla.add(new THREE.Mesh(fusion, material))
      }
    },
    soltar() {
      for (const m of materiales.values()) m.dispose()
      for (const g of geometrias.values()) g.dispose()
      for (const t of texturas) t.dispose()
      materiales.clear()
      for (const piezas of detalles.values()) for (const pieza of piezas) pieza.geometria.dispose()
      detalles.clear()
      geometrias.clear()
      superficies.clear()
      texturas.length = 0
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
    if (h.tipo === 'cable' && h.cinta) {
      const cinta = new THREE.Mesh(taller.cintaDe(pieza, h), taller.material(h.material))
      cinta.position.y = h.y * pieza.alto
      malla.add(cinta)
      continue
    }
    const { apoyo, dentro, fuera } = asientoDe(pieza.perfil, h, pieza.alto)
    // Un inserto casi enrasado sigue siendo una superficie de color visible.
    // Medir solo su salida borraba los paneles negros anchos en la miniatura.
    const tamanoVisible = h.tipo === 'aleta' || h.tipo === 'caja' ? Math.min(h.ancho, h.alto)
      : h.tipo === 'boton' ? h.radio * 2 : fuera - apoyo
    if (pxPorUnidad && tamanoVisible * pxPorUnidad < PX_MINIMOS) continue
    const espesor = fuera - dentro
    const centro = (dentro + fuera) / 2
    const y = h.y * pieza.alto
    if (h.tipo === 'gema' && h.alojamiento) {
      const camara = taller.camaraDe(h.radio, espesor, h.vueltas ?? 1, h.giro ?? 0, centro)
      for (const [geometria, id] of [
        [camara.marco, 'laton'], [camara.fondo, 'grafito'], [camara.cristal, h.material],
      ] as const) {
        const m = new THREE.Mesh(geometria, taller.material(id))
        m.position.y = y
        malla.add(m)
      }
      continue
    }
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
  for (const acabado of taller.detallesDe(pieza)) {
    malla.add(new THREE.Mesh(acabado.geometria, taller.material(acabado.material)))
  }
  taller.agruparFijos(malla, pieza, titilan)
  return titilan
}

/** Cuánto se sale del eje la pieza más gorda, herrajes incluidos. */
export function radioMaximo(piezas: PiezaSuelta[]): number {
  let max = 0
  for (const p of piezas) {
    const margenBisel = p.clave === 'cuerpo' ? 0 : .14
    for (const [r] of p.puntos) max = Math.max(max, r + margenBisel)
    for (const h of p.herrajes) {
      const { fuera, dentro } = asientoDe(p.perfil, h, p.alto)
      // «fuera» mide el centro de la cara. Los cantos de la caja y del
      // cartucho son tangentes al cilindro: sus esquinas quedan más lejos.
      const semiancho = h.tipo === 'caja' || h.tipo === 'aleta' ? h.ancho / 2
        : h.tipo === 'boton' || (h.tipo === 'gema' && h.alojamiento) ? h.radio : 0
      const centro = (fuera + dentro) / 2
      const radioReal = h.tipo === 'gema' && !h.alojamiento || h.tipo === 'destello'
        ? centro + h.radio
        : Math.hypot(fuera + (h.tipo === 'caja' || (h.tipo === 'gema' && h.alojamiento) ? .06 : 0), semiancho)
      max = Math.max(max, radioReal)
    }
  }
  return max
}

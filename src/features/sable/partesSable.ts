/**
 * La FORMA de cada pieza del sable. Puro, sin three y sin red.
 *
 * ── Por qué la geometría vive acá y no en Postgres ────────────────────
 *
 * La base guarda id, tipo, nombre y precio; el perfil de torneado vive en este
 * archivo. Es la misma línea del §2y: Postgres no guarda datos de presentación
 * que no puede usar ni validar. Agregar una pieza pide un deploy, y eso es una
 * ventaja — la geometría se revisa MIRÁNDOLA, no confiando en un jsonb.
 *
 * ── Un sable es una pieza torneada ────────────────────────────────────
 *
 * Todo el mango es UNA sola `LatheGeometry`: un perfil de puntos (radio, alto)
 * girado 360°. Eso importa por rendimiento, no por elegancia — el §2s manda
 * compartir geometría y material, y así el mango entero es **una geometría y
 * una llamada de dibujo** en vez de tres mallas apiladas con sus costuras.
 *
 * El perfil se arma de abajo hacia arriba: pomo → cuerpo → emisor. Cada pieza
 * declara su alto y devuelve sus puntos con el 0 en SU base; `perfilDeSable`
 * los desplaza y los pega.
 *
 * ── Dos reglas que `LatheGeometry` no perdona ─────────────────────────
 *
 * 1. **El alto tiene que ir siempre hacia arriba.** Un punto con `y` menor que
 *    el anterior gira la normal al revés y ese anillo sale negro. Para un
 *    escalón recto se repite el mismo `y` con otro radio, nunca se baja.
 * 2. **El radio nunca es 0 en el medio.** Solo puede cerrar en los extremos; un
 *    0 intermedio pincha la malla y deja ver el interior.
 *
 * `perfilValido()` comprueba las dos, y hay una prueba que las corre sobre
 * TODAS las combinaciones posibles del catálogo.
 */

/** Un punto del perfil: `[radio, alto]`. */
export type Punto = readonly [number, number]

export type TipoPieza = 'emisor' | 'cuerpo' | 'pomo' | 'color'

interface Pieza {
  /** Cuánto mide de alto, en las mismas unidades del perfil. */
  alto: number
  /** Los puntos, con el 0 en la base de ESTA pieza, de abajo hacia arriba. */
  puntos: (alto: number) => Punto[]
  /** De qué está hecha. Obligatorio: una pieza sin material es una pieza gris. */
  material: MaterialId
  /** Lo que lleva pegado encima. Vacío es una respuesta válida: hay piezas
      cuya gracia es ser lisas, y llenarlas de tornillos las igualaría al resto. */
  herrajes?: Herraje[]
}

/**
 * El radio «de agarre». Todo lo demás se mide contra esto.
 *
 * 1,6 y no 1,05: con el mango de 26 de alto, un radio de 1,05 da una proporción
 * de 25:1 y el sable se veía como una VARILLA. Un mango de verdad ronda los
 * 30 cm por 3,5 de diámetro, o sea ~8:1. A 1,6 el diámetro es 3,2 y la
 * proporción queda en 8:1. Se ve mirándolo en `/banco-sable-3d`; leyendo los
 * números no.
 */
const R = 1.6

/* ── LOS MATERIALES ────────────────────────────────────────────────
 *
 * Antes había tres y estaban CABLEADOS por tipo de pieza: acero para emisor y
 * pomo, gris oscuro para el cuerpo, latón para el aro. O sea que los diez
 * cuerpos del catálogo eran, en pantalla, diez siluetas del mismo gris.
 *
 * Ahora cada pieza declara de qué está hecha. Los valores son datos puros
 * —hex, metalness, roughness— y de acá los leen LOS DOS que dibujan: la escena
 * 3D y la miniatura de la tarjeta. Ese es el punto: si la miniatura eligiera
 * sus propios colores, la pieza de la tarjeta y la del sable serían dos objetos
 * distintos, que es exactamente cómo se separó de sí misma la tarjeta de
 * jugador (§2y).
 *
 * NINGÚN ROJO SATURADO. El rojo es color de HOJA vetado en este producto (se
 * gana sangrando un cristal, no comprándolo), y un herraje rojo encendido en la
 * empuñadura contaría la misma historia por la puerta de atrás. Los cálidos
 * llegan hasta el cobre y el bronce, que son metales, no señales.
 */

export interface Material {
  hex: string
  metalico: number
  rugoso: number
  /** El color con el que se dibuja en la miniatura plana de la tarjeta. */
  plano: string
  /** El borde de la miniatura. Un plano sin borde se pierde contra el fondo. */
  borde: string
}

export type MaterialId =
  | 'acero' | 'grafito' | 'negro' | 'laton' | 'cobre' | 'bronce'
  | 'cuero' | 'hueso' | 'esmalte' | 'jade'
  // Los que EMITEN. Ver el bloque de abajo.
  | 'luz' | 'plasma' | 'brasa' | 'nucleo'

/** ¿Este material emite luz propia? Decide si late y si lleva textura. */
export function emite(id: MaterialId): boolean {
  return id === 'luz' || id === 'plasma' || id === 'brasa' || id === 'nucleo'
}

/** ¿Toma el color del cristal del jugador, en vez de tener el suyo? */
export function tomaElColorDelCristal(id: MaterialId): boolean {
  return id === 'luz' || id === 'plasma'
}

export const MATERIALES: Record<MaterialId, Material> = {
  acero:   { hex: '#c9ced6', metalico: 0.92, rugoso: 0.34, plano: '#aeb6c0', borde: '#e6ebf2' },
  grafito: { hex: '#23252b', metalico: 0.20, rugoso: 0.82, plano: '#2b2e35', borde: '#4a4f57' },
  negro:   { hex: '#15161a', metalico: 0.75, rugoso: 0.25, plano: '#1b1d22', borde: '#3d424b' },
  laton:   { hex: '#d29a4a', metalico: 0.95, rugoso: 0.34, plano: '#c08c42', borde: '#f0c078' },
  cobre:   { hex: '#b96a3c', metalico: 0.95, rugoso: 0.30, plano: '#a85f34', borde: '#e09268' },
  bronce:  { hex: '#8c6a3f', metalico: 0.90, rugoso: 0.50, plano: '#7d5f39', borde: '#b48f5c' },
  cuero:   { hex: '#3d2a1c', metalico: 0.05, rugoso: 0.95, plano: '#54382a', borde: '#8a6449' },
  hueso:   { hex: '#d8cdb4', metalico: 0.05, rugoso: 0.70, plano: '#cfc3a8', borde: '#efe6d2' },
  esmalte: { hex: '#24507f', metalico: 0.10, rugoso: 0.35, plano: '#2a5b90', borde: '#4d8fd6' },
  jade:    { hex: '#2b6b57', metalico: 0.10, rugoso: 0.40, plano: '#2f7460', borde: '#57b294' },
  /* ── LOS QUE EMITEN ──
     `luz` y `plasma` NO tienen color propio: lo toman del CRISTAL. Es el
     detalle que ata la empuñadura a tu hoja — el testigo del botón y la gema
     del pomo se prenden del color que elegiste. Los hex de acá son el respaldo.

     La diferencia entre los dos es de INTENSIDAD y de comportamiento: `luz` es
     un testigo (se ve encendido y ya), `plasma` es energía a la vista y LATE.
     Tener dos evita la tentación de subirle el brillo a `luz` hasta que un
     botón de encendido parezca un reactor.

     `brasa` y `nucleo` sí tienen color propio: metal al rojo… ámbar (nada de
     rojo saturado, que es color de hoja vetado) y blanco de núcleo. */
  luz:     { hex: '#2b8cff', metalico: 0.00, rugoso: 0.40, plano: '#2b8cff', borde: '#bfe0ff' },
  plasma:  { hex: '#2b8cff', metalico: 0.00, rugoso: 0.25, plano: '#5fb0ff', borde: '#dff0ff' },
  brasa:   { hex: '#ff9d2e', metalico: 0.00, rugoso: 0.55, plano: '#ff9d2e', borde: '#ffd9a3' },
  nucleo:  { hex: '#eaf4ff', metalico: 0.00, rugoso: 0.20, plano: '#eaf4ff', borde: '#ffffff' },
}

export function materialDe(id: string): Material {
  return MATERIALES[id as MaterialId] ?? MATERIALES.acero
}

/* ── LOS HERRAJES: lo que va PEGADO a la pieza ──────────────────────
 *
 * Una pieza torneada no puede tener un botón: el torno gira un perfil y lo que
 * sale es simétrico alrededor del eje. Un botón, una caja de control o un cable
 * están en UN lado, y eso pide mallas aparte pegadas encima.
 *
 * Van como HIJAS de la malla de su pieza, así viajan solas cuando el sable se
 * abre — sin recolocarlas por cuadro, que es como ya funcionaban los dos cables
 * del cuerpo antes de que esto existiera.
 *
 * ── La regla que evita los dos errores de siempre ─────────────────
 *
 * Un herraje puede fallar de dos maneras, y las dos se ven horrible:
 * FLOTANDO (separado de la pieza, como un satélite) o ENTERRADO (dentro del
 * metal, invisible). Las dos vienen de lo mismo: adivinar el radio de la pieza
 * a esa altura en vez de medirlo.
 *
 * Por eso ningún herraje declara su radio. Declara su ALTURA como fracción de
 * la pieza (0 = base, 1 = tope) y `radioEn()` mide el radio real del perfil ahí.
 * El herraje se ancla a ESE radio y se hunde un poco: la superficie tiene que
 * quedar ENTRE la cara de adentro y la de afuera del herraje.
 *
 * Y ese «entre» no es una convención: `asientoDe()` lo devuelve y la prueba
 * (`scripts/sable-perfiles.test.mts`) lo comprueba en las 30 piezas. Un herraje
 * que flota, que se entierra o que un vecino tapa no llega a producción.
 *
 * ── Hundirlo también es lo que evita el parpadeo ──────────────────
 *
 * Dos caras que caen en el MISMO plano pelean por el píxel (z-fighting) y el
 * herraje titila al girar. Apoyarlo tangente a la curva es justo ese caso. Al
 * atravesar la superficie, la intersección es franca y no hay empate.
 */

/** Cuánto se hunde un herraje en la pieza, en unidades del mango. */
const MORDIDA = 0.18

/* Tres medidas, siempre con el mismo nombre, para no tener que recordar cuál
   es cuál en cada tipo: `alto` sube por el mango, `ancho` lo rodea, `salida`
   se aleja del eje. */
export type Herraje =
  /** Anillo completo alrededor del eje: abrazadera, llanta, aro de control. */
  | { tipo: 'anillo'; y: number; grosor: number; material: MaterialId }
  /** Botón de activación o remache. `vueltas` lo repite alrededor del eje. */
  | { tipo: 'boton'; y: number; radio: number; salida: number; giro?: number; vueltas?: number; material: MaterialId }
  /** Caja de control: la placa rectangular pegada a un costado. */
  | { tipo: 'caja'; y: number; alto: number; ancho: number; salida: number; giro?: number; material: MaterialId }
  /** Cable de aislante: un toro PARCIAL que abraza el mango. */
  | { tipo: 'cable'; y: number; grosor: number; arco: number; giro?: number; inclina?: number; material: MaterialId }
  /** Aletas, dientes o respiraderos: tablillas repetidas alrededor del eje. */
  | { tipo: 'aleta'; y: number; alto: number; ancho: number; salida: number; giro?: number; vueltas: number; material: MaterialId }
  /** Gema engarzada. Facetada a propósito para que cada cara agarre distinto. */
  | { tipo: 'gema'; y: number; radio: number; giro?: number; vueltas?: number; material: MaterialId }
  /**
   * DESTELLOS: puntitos que TITILAN en secuencia alrededor del eje.
   *
   * Cada uno late con su propio desfase, así que la fila entera se lee como una
   * chispa que corre por el mango — que es lo que pidió Nel («que emitan
   * brillos destellos»). El desfase se guarda por malla y no por material: los
   * materiales son compartidos y si el desfase viviera ahí, los ocho puntos
   * latirían al unísono y se vería como una lámpara, no como una chispa.
   */
  | { tipo: 'destello'; y: number; radio: number; vueltas: number; giro?: number; material: MaterialId }

/** Cuántas mallas cuesta un herraje. `vueltas` es la que multiplica. */
export function mallasDe(h: Herraje): number {
  return (h.tipo === 'aleta' || h.tipo === 'destello') ? h.vueltas
    : (h.tipo === 'boton' || h.tipo === 'gema') ? (h.vueltas ?? 1)
    : 1
}

/** Cuánto ocupa un herraje a lo largo del mango. Los chatos devuelven ~0. */
function altoDe(h: Herraje): number {
  return h.tipo === 'caja' || h.tipo === 'aleta' ? h.alto
    : (h.tipo === 'boton' || h.tipo === 'gema' || h.tipo === 'destello') ? h.radio * 2
    : 0
}

/**
 * El radio del perfil a una altura dada (en unidades, no en fracción).
 *
 * Devuelve el MÁXIMO cuando hay escalón: a la altura de un canto vivo el perfil
 * tiene dos radios, y el que importa es el de afuera — es donde se apoya lo que
 * se pegue ahí.
 */
export function radioEn(puntos: Punto[], y: number): number {
  let mejor = 0
  for (let i = 0; i < puntos.length - 1; i++) {
    const [r0, y0] = puntos[i]
    const [r1, y1] = puntos[i + 1]
    if (y < Math.min(y0, y1) - 1e-9 || y > Math.max(y0, y1) + 1e-9) continue
    // Tramo vertical (escalón): los dos radios valen a esta altura.
    const r = y1 === y0 ? Math.max(r0, r1) : r0 + (r1 - r0) * ((y - y0) / (y1 - y0))
    if (r > mejor) mejor = r
  }
  return mejor || R
}

/** Cuánto sobresale un herraje de la superficie donde se apoya. */
function salidaDe(h: Herraje): number {
  return h.tipo === 'anillo' || h.tipo === 'cable' ? h.grosor
    : h.tipo === 'gema' ? h.radio * 0.75
    // Un destello se apoya casi entero AFUERA: es una chispa sobre el metal,
    // no una piedra engarzada en él.
    : h.tipo === 'destello' ? h.radio * 0.95
    : h.salida
}

/** Qué tan lejos mira la prueba para ver si un vecino tapa al herraje. */
const VECINDAD = 0.5

/**
 * EL ASIENTO: dónde apoya un herraje y qué espesor necesita para apoyar bien.
 *
 * Acá está la mitad del trabajo de este archivo, y viene de dos fallos reales
 * que salieron al calcularlos, no al mirarlos:
 *
 * 1. **La campana que despega el herraje.** VÓRTICE se abre de 1,10·R a 1,42·R.
 *    Una aleta recta de 1,8 de alto pegada a esa pendiente toca arriba y queda
 *    SEPARADA abajo: 0,07 de aire, un satélite diminuto flotando junto al metal.
 * 2. **Las costillas que se lo tragan.** VÉRTEBRA alterna 0,94·R y 1,26·R. Un
 *    riel anclado al radio de su centro, si ese centro cae en un valle, queda
 *    ENTERRADO entre las crestas: declarado, construido, invisible.
 *
 * Anclar al máximo arregla (2) y rompe (1); anclar al mínimo, al revés. La
 * salida es que el herraje ENGORDE hasta cubrir el desnivel que tiene debajo:
 * su cara de adentro va bajo el radio MÍNIMO del tramo (muerde en todas partes)
 * y la de afuera sobre el MÁXIMO (sobresale en todas partes). Que es,
 * exactamente, una pieza mecanizada para calzar en el contorno.
 *
 * Lo de adentro no se ve nunca: queda dentro del metal.
 */
export function asientoDe(puntos: Punto[], h: Herraje, altoPieza: number): {
  /** El radio sobre el que descansa. */
  apoyo: number
  /** Radio de la cara interna. Por debajo del apoyo: muerde. */
  dentro: number
  /** Radio de la cara externa. Por encima del apoyo: se ve. */
  fuera: number
  /**
   * Hasta dónde tendría que salir para que ningún vecino lo esconda.
   *
   * NO es «el vecino más alto»: en una pieza TORNEADA toda ranura da la vuelta
   * completa, así que desde el costado se ve dentro de ella — un cable metido
   * en un canal se ve perfectamente, y castigarlo sería castigar el diseño.
   * Lo que sí esconde es un POZO ESTRECHO: paredes altas y cerca. Por eso la
   * medida es una línea de visión a 45°, que es la que entra en una ranura
   * ancha y no en una angosta.
   */
  sombra: number
} {
  const centro = Math.min(Math.max(h.y, 0), 1) * altoPieza
  const rueda = h.tipo === 'anillo' || h.tipo === 'cable'
  /* Un aro o un cable RUEDAN sobre las crestas: un fleje que abraza un mango
     con costillas se apoya en las costillas y salta los valles, no los rellena.
     Por eso su apoyo se mide en la vecindad y no en su propio punto — anclarlo
     al valle lo hundía entre las costillas de VÉRTEBRA y las ondas de ESPIRAL. */
  const medio = rueda ? VECINDAD : altoDe(h) / 2

  const medir = (desde: number, hasta: number) => {
    let max = 0, min = Infinity
    const PASOS = 16
    for (let i = 0; i <= PASOS; i++) {
      const y = Math.min(Math.max(desde + ((hasta - desde) * i) / PASOS, 0), altoPieza)
      const r = radioEn(puntos, y)
      if (r > max) max = r
      if (r < min) min = r
    }
    return { max, min }
  }

  const propio = medir(centro - medio, centro + medio)
  const salida = salidaDe(h)
  const apoyo = propio.max
  const fuera = apoyo + salida
  /* Cuánto se hunde. La gema muerde poco porque es una piedra engarzada, y el
     destello menos todavía: es una chispa apoyada, no una pieza embutida. */
  const mordida = h.tipo === 'gema' ? h.radio * 0.55
    : h.tipo === 'destello' ? h.radio * 0.45
    : MORDIDA
  // El aro cuelga de las crestas (es un toro, no puede rellenar el valle); los
  // demás bajan bajo el mínimo de su tramo para morder en toda su superficie.
  const dentro = rueda ? apoyo - salida : propio.min - mordida

  // La sombra: para cada vecino a distancia `d` del borde del herraje, la línea
  // a 45° pide que el vecino no sobrepase `fuera + d`.
  const borde = medio
  let sombra = 0
  const PASOS = 20
  for (let i = 1; i <= PASOS; i++) {
    const d = (VECINDAD * i) / PASOS
    for (const y of [centro - borde - d, centro + borde + d]) {
      if (y < 0 || y > altoPieza) continue
      const exige = radioEn(puntos, y) - d
      if (exige > sombra) sombra = exige
    }
  }
  return { apoyo, dentro, fuera, sombra }
}

/** Cuántas mallas de herraje lleva una pieza. La prueba le pone techo. */
export function mallasDeHerrajes(herrajes: Herraje[] | undefined): number {
  return (herrajes ?? []).reduce((s, h) => s + mallasDe(h), 0)
}

/* ── Pomos (abajo) ─────────────────────────────────────────────────── */

const POMOS: Record<string, Pieza> = {
  pom_plano: {
    alto: 3,
    puntos: h => [[0, 0], [R * 0.95, 0], [R * 1.06, h * 0.2], [R, h]],
    // YUNQUE, el de fábrica. Acero desnudo con un aro: tiene que verse
    // honesto, no pobre — es el que todos tienen el primer día.
    material: 'acero',
    herrajes: [
      { tipo: 'anillo', y: 0.32, grosor: 0.10, material: 'laton' },
    ],
  },
  pom_conico: {
    alto: 3.4,
    // Se cierra en punta hacia abajo, como el de Dooku.
    puntos: h => [[0, 0], [R * 0.45, h * 0.1], [R * 0.8, h * 0.4], [R * 1.06, h * 0.75], [R, h]],
    // AGUIJÓN. Los tres remaches de la cintura le dan la escala: sin algo
    // chico al lado, un cono liso no dice de qué tamaño es.
    material: 'acero',
    herrajes: [
      { tipo: 'anillo', y: 0.78, grosor: 0.10, material: 'cobre' },
      { tipo: 'boton', y: 0.50, radio: 0.11, salida: 0.07, vueltas: 3, material: 'negro' },
    ],
  },
  pom_bulbo: {
    alto: 3.6,
    puntos: h => [
      [0, 0], [R * 0.6, 0], [R * 1.3, h * 0.28], [R * 1.32, h * 0.55],
      [R * 1.0, h * 0.8], [R, h],
    ],
    // NÚCLEO (épico). Tres ventanas del color de TU cristal: el bulbo deja
    // de ser un contrapeso y pasa a ser lo que el nombre promete.
    material: 'grafito',
    herrajes: [
      { tipo: 'anillo', y: 0.55, grosor: 0.12, material: 'cobre' },
      { tipo: 'gema', y: 0.40, radio: 0.22, vueltas: 3, material: 'luz' },
    ],
  },
  pom_anillo: {
    alto: 4,
    // El aro del pomo: dos escalones marcados. Con `y` repetido para que el
    // canto sea recto sin retroceder nunca (regla 1).
    puntos: h => [
      [0, 0], [R * 0.9, 0], [R * 0.9, h * 0.15],
      [R * 1.45, h * 0.15], [R * 1.45, h * 0.4], [R * 0.92, h * 0.4],
      [R * 0.92, h * 0.7], [R, h * 0.75], [R, h],
    ],
    // ANCLA (legendario). Los pernos van EN LA CARA de la brida (y 0.33), no
    // en el cuello de abajo: ahí quedaban en un pozo entre la brida y el
    // hombro, y la prueba los cazó midiendo la línea de visión.
    material: 'negro',
    herrajes: [
      { tipo: 'anillo', y: 0.20, grosor: 0.14, material: 'laton' },
      { tipo: 'boton', y: 0.33, radio: 0.12, salida: 0.08, vueltas: 3, material: 'laton' },
      { tipo: 'gema', y: 0.85, radio: 0.18, vueltas: 2, material: 'luz' },
    ],
  },
  // ── Nuevos (catálogo grande, 2026-08-24) ──
  pom_taza: {
    alto: 3.2,
    // Un crisol: se abre como copa y se recoge al cuello.
    puntos: h => [[0, 0], [R * 0.7, 0], [R * 1.1, h * 0.15], [R * 1.1, h * 0.45], [R * 0.95, h * 0.6], [R, h]],
    // CRISOL. Cobre, que es de lo que está hecho un crisol de verdad.
    material: 'cobre',
    herrajes: [
      { tipo: 'anillo', y: 0.52, grosor: 0.09, material: 'negro' },
    ],
  },
  pom_disco: {
    alto: 2.8,
    // Una moneda plana en la base: el contrapeso más simple que existe.
    puntos: h => [[0, 0], [R * 1.3, 0], [R * 1.3, h * 0.25], [R * 0.95, h * 0.4], [R, h]],
    // MONEDA. El canto de latón es lo único que lleva, y es lo que la
    // vuelve una moneda y no una arandela.
    material: 'negro',
    herrajes: [
      { tipo: 'anillo', y: 0.14, grosor: 0.10, material: 'laton' },
    ],
  },
  pom_punta: {
    alto: 3.8,
    // Aguja: cierra en punta viva hacia abajo.
    puntos: h => [[0, 0], [R * 0.3, h * 0.05], [R * 0.7, h * 0.45], [R * 1.05, h * 0.8], [R, h]],
    // AGUJA. Dos aros finos escalonados: marcan dónde deja de ser mango.
    material: 'negro',
    herrajes: [
      { tipo: 'anillo', y: 0.82, grosor: 0.09, material: 'laton' },
      { tipo: 'anillo', y: 0.62, grosor: 0.06, material: 'laton' },
    ],
  },
  pom_tambor: {
    alto: 3.6,
    // Tambor con dos llantas y cintura.
    puntos: h => [
      [0, 0], [R * 0.9, 0], [R * 1.2, h * 0.1], [R * 1.2, h * 0.28], [R * 1.05, h * 0.35],
      [R * 1.05, h * 0.6], [R * 1.2, h * 0.68], [R * 1.2, h * 0.85], [R, h],
    ],
    // TAMBOR. Los cuatro pernos van en la CINTURA, no en las llantas: en
    // las llantas se perderían contra el canto.
    material: 'bronce',
    herrajes: [
      { tipo: 'boton', y: 0.47, radio: 0.12, salida: 0.08, vueltas: 4, material: 'negro' },
      { tipo: 'anillo', y: 0.75, grosor: 0.08, material: 'negro' },
    ],
  },
  pom_garra: {
    alto: 4.2,
    // GARRA (legendario): dos uñas de perfil, agresivo sin dientes reales.
    puntos: h => [
      [0, 0], [R * 0.5, h * 0.08], [R * 1.35, h * 0.3], [R * 1.1, h * 0.45],
      [R * 1.35, h * 0.62], [R * 1.05, h * 0.75], [R * 1.05, h * 0.9], [R, h],
    ],
    // GARRA (legendario). Acá el comentario viejo decía «agresivo sin
    // dientes reales», porque un torno no puede hacer una uña. Ahora
    // SÍ las tiene: tres aletas de acero que sobresalen de verdad.
    material: 'negro',
    herrajes: [
      { tipo: 'aleta', y: 0.55, alto: 1.10, ancho: 0.50, salida: 0.30, vueltas: 3, material: 'acero' },
      { tipo: 'gema', y: 0.20, radio: 0.20, material: 'luz' },
      { tipo: 'anillo', y: 0.86, grosor: 0.09, material: 'laton' },
    ],
  },
}

/* ── Cuerpos (el medio, lo que se agarra) ──────────────────────────── */

/**
 * n bultos iguales repartidos a lo largo del cuerpo. Para forros y costillas.
 *
 * EL BORDE DE CADA BULTO SE CALCULA CON LA MISMA EXPRESIÓN QUE EL PRINCIPIO DEL
 * SIGUIENTE, y no es un detalle de estilo. La primera versión cerraba con
 * `y + paso` y abría con `(i+1) * paso`: matemáticamente lo mismo, en coma
 * flotante no. Salía un alto que BAJABA 1×10⁻¹⁵ —11.147272727272728 seguido de
 * 11.147272727272727— y eso invierte la normal de ese anillo: un aro NEGRO en el
 * mango, en una sola de las 64 combinaciones, sin un error en consola.
 *
 * Lo cazó `scripts/sable-perfiles.test.mts` la primera vez que corrió.
 */
function repetir(h: number, n: number, rBajo: number, rAlto: number): Punto[] {
  const p: Punto[] = []
  const paso = h / n
  for (let i = 0; i < n; i++) {
    const y0 = i * paso
    const y1 = (i + 1) * paso
    const d = y1 - y0
    p.push([rBajo, y0], [rAlto, y0 + d * 0.3], [rAlto, y0 + d * 0.7], [rBajo, y1])
  }
  return p
}

const CUERPOS: Record<string, Pieza> = {
  cue_liso: {
    alto: 14,
    puntos: h => [[R, 0], [R, h]],
    // FUNDAMENTO, el de fábrica. Lleva la caja de control y EL BOTÓN, que
    // se prende del color de tu cristal. Un cuerpo liso sin nada
    // encima es un tubo; con el botón, es un sable.
    material: 'grafito',
    herrajes: [
      { tipo: 'anillo', y: 0.18, grosor: 0.11, material: 'laton' },
      { tipo: 'caja', y: 0.58, alto: 2.20, ancho: 0.90, salida: 0.22, material: 'negro' },
      { tipo: 'boton', y: 0.58, radio: 0.18, salida: 0.34, material: 'luz' },
    ],
  },
  cue_anillado: {
    alto: 14,
    // Los tres anillos de control, estilo Obi-Wan.
    puntos: h => [
      [R, 0], [R, h * 0.18],
      [R * 1.22, h * 0.18], [R * 1.22, h * 0.26], [R, h * 0.26],
      [R, h * 0.44],
      [R * 1.22, h * 0.44], [R * 1.22, h * 0.52], [R, h * 0.52],
      [R, h * 0.70],
      [R * 1.22, h * 0.70], [R * 1.22, h * 0.78], [R, h * 0.78],
      [R, h],
    ],
    // TRÍADA. Latón en los tres anillos de control y una caja al costado,
    // girada para que no tape el botón.
    material: 'grafito',
    herrajes: [
      { tipo: 'anillo', y: 0.22, grosor: 0.10, material: 'laton' },
      { tipo: 'anillo', y: 0.48, grosor: 0.10, material: 'laton' },
      { tipo: 'anillo', y: 0.74, grosor: 0.10, material: 'laton' },
      { tipo: 'boton', y: 0.60, radio: 0.18, salida: 0.12, material: 'luz' },
      { tipo: 'caja', y: 0.34, alto: 1.60, ancho: 0.80, salida: 0.20, giro: 2.6, material: 'negro' },
    ],
  },
  cue_forrado: {
    alto: 14,
    // El forro de cuero: muchos bultos chicos y suaves.
    puntos: h => [[R, 0], ...repetir(h * 0.86, 11, R, R * 1.1).map(
      ([r, y]) => [r, y + h * 0.07] as Punto), [R, h]],
    // CORTEZA (épico). CUERO de verdad, no gris oscuro: es la pieza que
    // más gana con que el material sea un dato y no una constante.
    // Las dos abrazaderas de latón son las que sujetan el forro.
    material: 'cuero',
    herrajes: [
      { tipo: 'anillo', y: 0.05, grosor: 0.12, material: 'laton' },
      { tipo: 'anillo', y: 0.95, grosor: 0.12, material: 'laton' },
      { tipo: 'cable', y: 0.50, grosor: 0.09, arco: 5.0, inclina: 0.10, material: 'bronce' },
      { tipo: 'boton', y: 0.30, radio: 0.18, salida: 0.13, material: 'luz' },
    ],
  },
  cue_costillas: {
    alto: 14,
    // Costillas: menos, más profundas y de canto vivo.
    puntos: h => [[R, 0], ...repetir(h * 0.8, 6, R * 0.94, R * 1.26).map(
      ([r, y]) => [r, y + h * 0.1] as Punto), [R, h]],
    // VÉRTEBRA (legendario). Dos rieles de acero corren por encima de las
    // costillas — son los que obligaron a que el herraje engorde hasta
    // cubrir el desnivel (ver `asientoDe`). El botón va ARRIBA, en la
    // zona lisa: entre costillas se lo tragaban los vecinos.
    material: 'negro',
    herrajes: [
      { tipo: 'aleta', y: 0.50, alto: 8.00, ancho: 0.45, salida: 0.26, vueltas: 2, material: 'acero' },
      { tipo: 'gema', y: 0.20, radio: 0.19, vueltas: 2, material: 'luz' },
      { tipo: 'anillo', y: 0.92, grosor: 0.10, material: 'laton' },
      { tipo: 'boton', y: 0.96, radio: 0.17, salida: 0.13, material: 'luz' },
    ],
  },
  // ── Nuevos (catálogo grande, 2026-08-24) ──
  cue_canal: {
    alto: 14,
    // Un solo canal ancho al medio: donde caen los dedos.
    puntos: h => [[R, 0], [R, h * 0.35], [R * 0.88, h * 0.4], [R * 0.88, h * 0.6], [R, h * 0.65], [R, h]],
    // CAUCE. El cable va DENTRO del canal, protegido por el labio: el canal
    // existía desde antes y no servía para nada.
    material: 'grafito',
    herrajes: [
      { tipo: 'cable', y: 0.50, grosor: 0.10, arco: 3.4, material: 'cobre' },
      { tipo: 'boton', y: 0.78, radio: 0.18, salida: 0.12, material: 'luz' },
    ],
  },
  cue_grip: {
    alto: 14,
    // Dos abrazaderas de goma, arriba y abajo.
    puntos: h => [
      [R, 0], [R, h * 0.15], [R * 1.12, h * 0.25], [R * 1.12, h * 0.42], [R, h * 0.5],
      [R, h * 0.55], [R * 1.12, h * 0.65], [R * 1.12, h * 0.82], [R, h * 0.9], [R, h],
    ],
    // TENAZA. Cobre en las dos abrazaderas, negro en el cuerpo.
    material: 'negro',
    herrajes: [
      { tipo: 'anillo', y: 0.33, grosor: 0.10, material: 'cobre' },
      { tipo: 'anillo', y: 0.73, grosor: 0.10, material: 'cobre' },
      { tipo: 'boton', y: 0.52, radio: 0.17, salida: 0.11, material: 'luz' },
    ],
  },
  cue_banda: {
    alto: 14,
    // Una cintura gruesa al centro, como venda de agarre.
    puntos: h => [[R, 0], [R, h * 0.3], [R * 1.18, h * 0.35], [R * 1.18, h * 0.62], [R, h * 0.67], [R, h]],
    // CINTURA. Dos vueltas de cuero sobre la banda torneada: una venda de
    // agarre son vueltas, no una pieza.
    material: 'grafito',
    herrajes: [
      { tipo: 'anillo', y: 0.42, grosor: 0.13, material: 'cuero' },
      { tipo: 'anillo', y: 0.55, grosor: 0.13, material: 'cuero' },
      { tipo: 'boton', y: 0.80, radio: 0.17, salida: 0.11, material: 'luz' },
    ],
  },
  cue_trenza: {
    alto: 14,
    // Trenzado fino: ocho ondas suaves.
    puntos: h => [[R, 0], ...repetir(h * 0.84, 8, R * 0.98, R * 1.12).map(
      ([r, y]) => [r, y + h * 0.08] as Punto), [R, h]],
    // TRENZA. Cuero con dos cables de latón cruzados en sentidos opuestos:
    // es lo que hace que la trenza se lea como trenza y no como ondas.
    material: 'cuero',
    herrajes: [
      { tipo: 'cable', y: 0.30, grosor: 0.09, arco: 4.2, inclina: 0.12, material: 'laton' },
      { tipo: 'cable', y: 0.68, grosor: 0.09, arco: 4.2, inclina: -0.12, material: 'laton' },
      { tipo: 'boton', y: 0.50, radio: 0.16, salida: 0.12, material: 'luz' },
    ],
  },
  cue_placas: {
    alto: 14,
    // Tres placas planas de blindaje, con hombros francos.
    puntos: h => [
      [R, 0], [R, h * 0.1],
      [R * 1.16, h * 0.12], [R * 1.16, h * 0.3], [R, h * 0.32],
      [R, h * 0.36], [R * 1.16, h * 0.38], [R * 1.16, h * 0.56], [R, h * 0.58],
      [R, h * 0.62], [R * 1.16, h * 0.64], [R * 1.16, h * 0.82], [R, h * 0.84],
      [R, h],
    ],
    // BLINDAJE. Cuatro remaches en la placa del MEDIO y nada en las otras
    // dos: remachar las tres cuesta doce mallas y se lee peor.
    material: 'acero',
    herrajes: [
      { tipo: 'boton', y: 0.47, radio: 0.12, salida: 0.08, vueltas: 4, material: 'negro' },
      { tipo: 'boton', y: 0.21, radio: 0.17, salida: 0.12, material: 'luz' },
      { tipo: 'anillo', y: 0.73, grosor: 0.09, material: 'laton' },
    ],
  },
  cue_helice: {
    alto: 14,
    // Nueve ondas finas: se lee como rosca. (Una espiral DE VERDAD no cabe en
    // una pieza torneada — el torno gira lo que le den y una hélice pide otra
    // geometría entera; esto es la aproximación honesta.)
    puntos: h => [[R, 0], ...repetir(h * 0.86, 9, R * 0.96, R * 1.18).map(
      ([r, y]) => [r, y + h * 0.07] as Punto), [R, h]],
    // ESPIRAL (épico). Bronce, y tres cables inclinados a la misma mano:
    // el torno no puede hacer una hélice, pero tres cables sí la
    // sugieren — es la vuelta honesta a la limitación de arriba.
    material: 'bronce',
    herrajes: [
      { tipo: 'cable', y: 0.22, grosor: 0.09, arco: 5.6, inclina: 0.16, material: 'negro' },
      { tipo: 'cable', y: 0.55, grosor: 0.09, arco: 5.6, inclina: 0.16, material: 'negro' },
      { tipo: 'cable', y: 0.85, grosor: 0.09, arco: 5.6, inclina: 0.16, material: 'negro' },
      { tipo: 'boton', y: 0.40, radio: 0.17, salida: 0.13, giro: 3.0, material: 'luz' },
    ],
  },
}

/* ── Emisores (arriba, de donde sale la hoja) ──────────────────────── */

const EMISORES: Record<string, Pieza> = {
  emi_estandar: {
    alto: 5,
    puntos: h => [
      [R, 0], [R * 1.18, h * 0.1], [R * 1.18, h * 0.55],
      [R * 0.92, h * 0.68], [R * 0.92, h], [R * 0.6, h],
    ],
    // AURORA, el de fábrica. Un aro y nada más.
    material: 'acero',
    herrajes: [
      { tipo: 'anillo', y: 0.30, grosor: 0.10, material: 'laton' },
    ],
  },
  emi_ranurado: {
    alto: 5.4,
    puntos: h => [
      [R, 0], [R * 1.2, h * 0.08],
      [R * 1.2, h * 0.22], [R * 0.98, h * 0.22], [R * 0.98, h * 0.34], [R * 1.2, h * 0.34],
      [R * 1.2, h * 0.48], [R * 0.98, h * 0.48], [R * 0.98, h * 0.6], [R * 1.2, h * 0.6],
      [R * 1.2, h * 0.72], [R * 0.88, h * 0.82], [R * 0.88, h], [R * 0.58, h],
    ],
    // OBSIDIAN. Negro con cuatro tablillas de acero en las ranuras: las
    // ranuras torneadas son surcos, las tablillas las vuelven rejilla.
    material: 'negro',
    herrajes: [
      { tipo: 'aleta', y: 0.28, alto: 0.90, ancho: 0.30, salida: 0.14, vueltas: 4, material: 'acero' },
      { tipo: 'anillo', y: 0.66, grosor: 0.09, material: 'laton' },
    ],
  },
  emi_conico: {
    alto: 5.6,
    // Se abre como una campana, estilo Vader.
    puntos: h => [
      [R, 0], [R * 1.1, h * 0.15], [R * 1.42, h * 0.62], [R * 1.42, h * 0.74],
      [R * 1.0, h * 0.84], [R * 1.0, h], [R * 0.62, h],
    ],
    // VÓRTICE (épico). La campana con cinco aletas de latón. Fue la que
    // destapó que una aleta recta sobre una pendiente despega por
    // abajo si no engorda (ver `asientoDe`).
    material: 'negro',
    herrajes: [
      { tipo: 'anillo', y: 0.18, grosor: 0.11, material: 'laton' },
      { tipo: 'aleta', y: 0.55, alto: 1.80, ancho: 0.28, salida: 0.18, vueltas: 5, material: 'laton' },
    ],
  },
  emi_dentado: {
    alto: 5.2,
    // Los «dientes» del cerco. Al ser una pieza torneada son escalones, no
    // dientes de verdad: en un mango de 26 unidades a 22 px de alto en el
    // teléfono, un diente real no se distinguiría del escalón y costaría una
    // geometría aparte.
    puntos: h => [
      [R, 0], [R * 1.16, h * 0.1], [R * 1.16, h * 0.42],
      [R * 1.34, h * 0.42], [R * 1.34, h * 0.52], [R * 1.02, h * 0.58],
      [R * 1.02, h * 0.72], [R * 1.3, h * 0.72], [R * 1.3, h * 0.82],
      [R * 0.9, h * 0.88], [R * 0.9, h], [R * 0.6, h],
    ],
    // KRAKEN (legendario). Los dientes de verdad, por fin: cuatro tablillas
    // de acero que salen del cerco, más la luz del cristal abajo.
    material: 'negro',
    herrajes: [
      { tipo: 'aleta', y: 0.76, alto: 1.20, ancho: 0.32, salida: 0.24, vueltas: 4, material: 'acero' },
      { tipo: 'gema', y: 0.25, radio: 0.18, vueltas: 2, material: 'luz' },
    ],
  },
  // ── Nuevos (catálogo grande, 2026-08-24) ──
  emi_faro: {
    alto: 5,
    // El más simple de los pagos: tubo con labio fino.
    puntos: h => [[R, 0], [R * 1.1, h * 0.15], [R * 1.1, h * 0.8], [R * 0.95, h * 0.85], [R * 0.95, h], [R * 0.62, h]],
    // FARO. Tres aletas cortas y un aro de cobre. El más simple de los que
    // se pagan, pero ya no es un tubo.
    material: 'acero',
    herrajes: [
      { tipo: 'anillo', y: 0.22, grosor: 0.10, material: 'cobre' },
      { tipo: 'aleta', y: 0.55, alto: 1.40, ancho: 0.35, salida: 0.16, vueltas: 3, material: 'negro' },
    ],
  },
  emi_campo: {
    alto: 5.2,
    // Cúpula: se hincha y se recoge, como campana cerrada.
    puntos: h => [
      [R, 0], [R * 1.15, h * 0.2], [R * 1.22, h * 0.5], [R * 1.05, h * 0.75],
      [R * 0.8, h * 0.9], [R * 0.8, h], [R * 0.55, h],
    ],
    // CÚPULA. ESMALTE azul: es el único emisor pintado del catálogo, y a
    // propósito — una cúpula lisa pedía color, no más herrajes.
    material: 'esmalte',
    herrajes: [
      { tipo: 'anillo', y: 0.22, grosor: 0.11, material: 'acero' },
    ],
  },
  emi_disco: {
    alto: 5.4,
    // Un plato de guardia ancho en la base, como tsuba.
    puntos: h => [
      [R, 0], [R * 1.5, h * 0.08], [R * 1.5, h * 0.18], [R * 1.02, h * 0.25],
      [R * 1.02, h * 0.7], [R * 0.9, h * 0.8], [R * 0.9, h], [R * 0.6, h],
    ],
    // ESCUDO. Bronce, con cuatro remaches en el plato de guardia.
    material: 'bronce',
    herrajes: [
      { tipo: 'boton', y: 0.13, radio: 0.10, salida: 0.06, vueltas: 4, material: 'negro' },
      { tipo: 'anillo', y: 0.45, grosor: 0.09, material: 'negro' },
    ],
  },
  emi_horquilla: {
    alto: 5.4,
    // Dos labios escalonados, como almenas.
    puntos: h => [
      [R, 0], [R * 1.18, h * 0.1], [R * 1.18, h * 0.3], [R * 0.95, h * 0.3],
      [R * 0.95, h * 0.5], [R * 1.24, h * 0.55], [R * 1.24, h * 0.75],
      [R * 0.88, h * 0.85], [R * 0.88, h], [R * 0.58, h],
    ],
    // ALMENA. Cuatro almenas de verdad sobre los labios torneados.
    material: 'acero',
    herrajes: [
      { tipo: 'aleta', y: 0.62, alto: 1.00, ancho: 0.30, salida: 0.15, vueltas: 4, material: 'negro' },
      { tipo: 'anillo', y: 0.18, grosor: 0.09, material: 'cobre' },
    ],
  },
  emi_doble: {
    alto: 5.4,
    // Dos bulbos gemelos.
    puntos: h => [
      [R, 0], [R * 1.2, h * 0.12], [R * 1.05, h * 0.3], [R * 1.28, h * 0.5],
      [R * 1.05, h * 0.68], [R * 1.15, h * 0.8], [R * 0.85, h * 0.9], [R * 0.85, h], [R * 0.6, h],
    ],
    // GEMELO. Cobre con dos aros negros que separan los bulbos, y dos
    // testigos del color del cristal en la base.
    material: 'cobre',
    herrajes: [
      { tipo: 'anillo', y: 0.30, grosor: 0.10, material: 'negro' },
      { tipo: 'anillo', y: 0.68, grosor: 0.10, material: 'negro' },
      { tipo: 'boton', y: 0.12, radio: 0.14, salida: 0.09, vueltas: 2, material: 'luz' },
    ],
  },
  emi_corona: {
    alto: 5.8,
    // Cuello fino que se abre en corona.
    puntos: h => [
      [R, 0], [R * 0.95, h * 0.15], [R * 0.95, h * 0.45], [R * 1.35, h * 0.7],
      [R * 1.48, h * 0.85], [R * 1.1, h * 0.9], [R * 1.1, h], [R * 0.66, h],
    ],
    // CORONA (épico). Latón entero: es una corona, no una pieza con un
    // detalle dorado. Las cinco puntas son aletas negras.
    material: 'laton',
    herrajes: [
      { tipo: 'aleta', y: 0.80, alto: 1.00, ancho: 0.30, salida: 0.20, vueltas: 5, material: 'negro' },
      { tipo: 'anillo', y: 0.30, grosor: 0.09, material: 'negro' },
    ],
  },
  emi_titan: {
    alto: 6,
    // TITÁN (legendario): tres pisos de blindaje.
    puntos: h => [
      [R, 0], [R * 1.3, h * 0.08], [R * 1.3, h * 0.25], [R * 1.05, h * 0.3],
      [R * 1.45, h * 0.5], [R * 1.45, h * 0.62], [R * 1.15, h * 0.7],
      [R * 1.5, h * 0.85], [R * 1.0, h * 0.92], [R * 1.0, h], [R * 0.6, h],
    ],
    // TITÁN (legendario). Dos cinturones de latón sobre los tres pisos de
    // blindaje, dos ventanas del cristal y dos pernos arriba.
    material: 'negro',
    herrajes: [
      { tipo: 'anillo', y: 0.16, grosor: 0.12, material: 'laton' },
      { tipo: 'anillo', y: 0.56, grosor: 0.12, material: 'laton' },
      { tipo: 'gema', y: 0.35, radio: 0.20, vueltas: 2, material: 'luz' },
      { tipo: 'boton', y: 0.88, radio: 0.12, salida: 0.08, vueltas: 2, material: 'laton' },
    ],
  },
}

/* ── Colores de hoja ───────────────────────────────────────────────── */

export interface ColorHoja {
  /** El núcleo, casi blanco: una hoja es luz, no pintura. */
  nucleo: string
  /** El halo, que es lo que le da el color. */
  halo: string
}

export const COLORES: Record<string, ColorHoja> = {
  col_azul:     { nucleo: '#eaf6ff', halo: '#2b8cff' },
  col_verde:    { nucleo: '#eaffee', halo: '#2ee06a' },
  col_rojo:     { nucleo: '#fff0ee', halo: '#ff2d2d' },
  col_purpura:  { nucleo: '#f7eaff', halo: '#a855f7' },
  col_amarillo: { nucleo: '#fffbea', halo: '#ffd21e' },
  col_blanco:   { nucleo: '#ffffff', halo: '#cfe6ff' },
}

/* ── Armar el perfil completo ──────────────────────────────────────── */

export interface Diseno {
  emisor: string
  cuerpo: string
  pomo: string
  color: string
  /**
   * El ACABADO: repinta las tres piezas del mismo material.
   *
   * Nulo —el valor por defecto— es «cada pieza con el suyo», que es la
   * identidad que el catálogo trae escrita: CORTEZA de cuero, CORONA de latón,
   * CÚPULA esmaltada. Elegir un acabado es una decisión de quien arma el sable,
   * y por eso el valor de fábrica no es un color sino la ausencia de uno.
   *
   * Los HERRAJES no se repintan: el latón de los aros y el testigo del cristal
   * son lo que evita que un mango de un solo material se vea como un tubo.
   */
  acabado?: string | null
}

export const POR_DEFECTO: Diseno = {
  emisor: 'emi_estandar', cuerpo: 'cue_liso', pomo: 'pom_plano', color: 'col_azul',
}

/** Los ids que este archivo sabe dibujar, por tipo. Para cotejar con la base. */
export const IDS_CONOCIDOS: Record<Exclude<TipoPieza, 'color'>, string[]> & { color: string[] } = {
  emisor: Object.keys(EMISORES),
  cuerpo: Object.keys(CUERPOS),
  pomo: Object.keys(POMOS),
  color: Object.keys(COLORES),
}

/**
 * El perfil del mango entero, de abajo hacia arriba.
 *
 * Ante un id desconocido cae al de fábrica en vez de reventar: los ids vienen
 * de la base y un deploy viejo puede no conocer una pieza nueva (§2g — la PWA
 * instalada tarda en actualizar). Un sable de fábrica se ve raro; una pantalla
 * en blanco parece que la app se rompió.
 */
export function perfilDeSable(d: Diseno): { puntos: Punto[]; alto: number } {
  const pomo = POMOS[d.pomo] ?? POMOS[POR_DEFECTO.pomo]
  const cuerpo = CUERPOS[d.cuerpo] ?? CUERPOS[POR_DEFECTO.cuerpo]
  const emisor = EMISORES[d.emisor] ?? EMISORES[POR_DEFECTO.emisor]

  const puntos: Punto[] = []
  let y = 0
  let techo = -Infinity
  for (const pieza of [pomo, cuerpo, emisor]) {
    for (const [r, py] of pieza.puntos(pieza.alto)) {
      /* Red de seguridad SOLO contra la deriva de coma flotante: sujeta el alto
         para que nunca retroceda. Un retroceso de 1×10⁻¹⁵ al pegar dos piezas
         invierte la normal y deja un anillo NEGRO, y eso no se ve revisando el
         código — pasó de verdad al empalmar `cue_forrado` con `pom_bulbo`.
         NO es un sustituto de la prueba: si una pieza retrocede de verdad, el
         guion sigue plantándose y hay que arreglar el catálogo, no taparlo acá. */
      const alt = Math.max(py + y, techo)
      techo = alt
      puntos.push([r, alt])
    }
    y += pieza.alto
  }
  return { puntos, alto: y }
}

/** El color de la hoja, con caída al azul de fábrica. */
export function colorDeHoja(id: string): ColorHoja {
  return COLORES[id] ?? COLORES[POR_DEFECTO.color]
}

/**
 * El perfil de UNA pieza sola, por tipo e id.
 *
 * Lo usan las miniaturas de las tarjetas. Cae al de fábrica ante un id
 * desconocido, por lo mismo que `perfilDeSable`: los ids vienen de la base y un
 * deploy viejo puede no conocer una pieza nueva (§2g).
 */
export function perfilDePieza(tipo: 'emisor' | 'cuerpo' | 'pomo', id: string): {
  puntos: Punto[]; alto: number; material: MaterialId; herrajes: Herraje[]
} {
  const tabla = tipo === 'emisor' ? EMISORES : tipo === 'cuerpo' ? CUERPOS : POMOS
  const porDefecto = tipo === 'emisor' ? POR_DEFECTO.emisor
    : tipo === 'cuerpo' ? POR_DEFECTO.cuerpo : POR_DEFECTO.pomo
  const p = tabla[id] ?? tabla[porDefecto]
  let techo = -Infinity
  const puntos = p.puntos(p.alto).map(([r, y]) => {
    const alt = Math.max(y, techo); techo = alt
    return [r, alt] as Punto
  })
  return { puntos, alto: p.alto, material: p.material, herrajes: p.herrajes ?? [] }
}

/**
 * La SILUETA de una pieza como `path` de SVG, para la miniatura de su tarjeta.
 *
 * ── Por qué no se dibuja aparte ───────────────────────────────────────
 *
 * El perfil de torneado ES el contorno: una pieza girada 360° se ve, de lado,
 * exactamente como su perfil espejado. Así que la miniatura sale del MISMO dato
 * que la malla 3D, y no hay forma de que se separen — que es justo lo que pasa
 * cuando alguien dibuja «un iconito parecido» al lado (§2y, la tarjeta que se
 * fue separando de sí misma).
 *
 * Se recorre el perfil por un lado, se cierra arriba y se vuelve por el espejo.
 * El resultado está en un cuadro de `ancho` × `alto` con el eje al medio.
 */
export function siluetaDePieza(
  tipo: 'emisor' | 'cuerpo' | 'pomo', id: string, ancho = 40, alto = 64,
): string {
  const { puntos, alto: h } = perfilDePieza(tipo, id)
  const rMax = Math.max(...puntos.map(([r]) => r)) || 1
  // Margen para que el trazo no quede pegado al borde de la caja.
  const escalaX = (ancho / 2 - 1.5) / rMax
  const escalaY = (alto - 3) / h
  const cx = ancho / 2
  // El SVG crece hacia abajo y el perfil hacia arriba: se invierte la Y o la
  // pieza sale de cabeza.
  const px = (r: number) => (cx + r * escalaX).toFixed(2)
  const py = (y: number) => (alto - 1.5 - y * escalaY).toFixed(2)

  const ida = puntos.map(([r, y]) => `${px(r)} ${py(y)}`)
  const vuelta = [...puntos].reverse().map(([r, y]) => `${px(-r)} ${py(y)}`)
  return `M ${ida.join(' L ')} L ${vuelta.join(' L ')} Z`
}

/** Una pieza suelta, para la vista explotada. */
export interface PiezaSuelta {
  clave: 'pomo' | 'cuerpo' | 'emisor'
  /** Puntos con el 0 en la BASE de la pieza, no del mango. */
  puntos: Punto[]
  alto: number
  /** A qué altura del mango armado empieza. */
  base: number
  /** De qué está hecha, y lo que lleva pegado encima. Viaja CON la pieza: los
      dos que dibujan el mango (la escena y la miniatura de la barra de XP) leen
      de acá, y así no hay dos versiones del mismo sable (§2y). */
  material: MaterialId
  herrajes: Herraje[]
  /** Los puntos SIN las tapas de los extremos. Los herrajes se apoyan en el
      perfil de verdad: las tapas son radio 0 y hundirían el cálculo. */
  perfil: Punto[]
}

/**
 * Las tres piezas por separado.
 *
 * El mango armado es UNA sola `LatheGeometry` (ver `perfilDeSable`) porque así
 * no hay costura entre pomo, cuerpo y emisor. Pero la vista EXPLOTADA necesita
 * separarlas, y para eso hacen falta tres geometrías — no hay forma de abrir una
 * pieza torneada única.
 *
 * La escena usa SIEMPRE estas tres y las junta con separación 0 cuando el sable
 * está armado: un solo camino de código en vez de dos. Cuesta dos llamadas de
 * dibujo más, que sobre una escena de tres mallas y dos cápsulas no se nota — y
 * es mucho más barato que mantener dos formas de construir el mismo mango, que
 * es como se separan las cosas en este repo (§2y).
 *
 * Los perfiles NO se cierran en el eje al separarse: una pieza torneada abierta
 * deja ver el hueco por dentro, y eso es lo correcto — es lo que se ve al
 * desarmar un sable de verdad. Cerrarlas las volvería bolitas macizas.
 */
export function piezasDeSable(d: Diseno): PiezaSuelta[] {
  const pomo = POMOS[d.pomo] ?? POMOS[POR_DEFECTO.pomo]
  const cuerpo = CUERPOS[d.cuerpo] ?? CUERPOS[POR_DEFECTO.cuerpo]
  const emisor = EMISORES[d.emisor] ?? EMISORES[POR_DEFECTO.emisor]

  const claves = ['pomo', 'cuerpo', 'emisor'] as const
  const piezas = [pomo, cuerpo, emisor]
  // Un acabado que este deploy no conoce se ignora en vez de pintar de gris:
  // los ids vienen del servidor y la PWA instalada tarda en actualizarse (§2g).
  const acabado = d.acabado && d.acabado in MATERIALES ? (d.acabado as MaterialId) : null
  const salida: PiezaSuelta[] = []
  let base = 0
  for (let i = 0; i < piezas.length; i++) {
    const p = piezas[i]
    // Misma red de seguridad que en `perfilDeSable`: la deriva de coma flotante
    // dentro de una pieza también invierte una normal y deja un aro negro.
    let techo = -Infinity
    const puntos: Punto[] = p.puntos(p.alto).map(([r, y]) => {
      const alt = Math.max(y, techo); techo = alt
      return [r, alt] as Punto
    })
    /* SE CIERRAN LOS DOS EXTREMOS. Una pieza torneada abierta deja ver el
       interior vacío de la malla, y en la vista explotada eso se leía como que
       el sable estaba HUECO — lo dijo Nel mirándolo. El torno permite radio 0
       exactamente en los extremos (regla 2 de `perfilValido`), así que la tapa
       es un punto más a cada lado, al mismo alto que el borde. Dentro del sable
       armado las tapas quedan escondidas entre piezas y cuestan un anillo de
       triángulos cada una. */
    const perfil = puntos.slice()
    if (puntos[0][0] > 0) puntos.unshift([0, puntos[0][1]])
    if (puntos[puntos.length - 1][0] > 0) puntos.push([0, puntos[puntos.length - 1][1]])
    salida.push({
      clave: claves[i], puntos, alto: p.alto, base,
      material: acabado ?? p.material, herrajes: p.herrajes ?? [], perfil,
    })
    base += p.alto
  }
  return salida
}

/**
 * ¿Este perfil es dibujable? Las dos reglas que `LatheGeometry` no perdona.
 *
 * Devuelve la lista de problemas, vacía si está bien. Se usa en la prueba
 * (`scripts/sable-perfiles.test.mts`) sobre las 64 combinaciones, no en
 * caliente: si una combinación es inválida, el bug es del catálogo y hay que
 * arreglarlo antes de desplegar, no taparlo en el navegador.
 */
export function perfilValido(puntos: Punto[]): string[] {
  const malos: string[] = []
  if (puntos.length < 3) malos.push('menos de 3 puntos')
  for (let i = 0; i < puntos.length; i++) {
    const [r, y] = puntos[i]
    if (!Number.isFinite(r) || !Number.isFinite(y)) { malos.push(`punto ${i} no es finito`); continue }
    if (r < 0) malos.push(`punto ${i}: radio negativo (${r})`)
    const interior = i > 0 && i < puntos.length - 1
    if (interior && r === 0) malos.push(`punto ${i}: radio 0 en el medio — pincha la malla`)
    if (i > 0 && y < puntos[i - 1][1]) {
      malos.push(`punto ${i}: el alto BAJA (${puntos[i - 1][1]} → ${y}) — ese anillo sale negro`)
    }
  }
  return malos
}

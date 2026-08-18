/**
 * AUREBESH — la escritura galáctica REAL, dibujada a mano como paths SVG.
 *
 * El Aurebesh es el alfabeto que se ve escrito en pantallas, cascos y naves de
 * Star Wars: 26 letras (AUREK, BESH, CRESH, DORN, ESK, FORN, GREK, HERF, ISK,
 * JENTH, KRILL, LETH, MERN, NERN, OSK, PETH, QEK, RESH, SENTH, TRILL, USK, VEV,
 * WESK, XESH, YIRT, ZEREK) que corresponden una a una con la A-Z latina. Es
 * ANGULAR: puros trazos rectos y quiebres duros, sin una sola curva.
 *
 * DE DÓNDE SALEN ESTAS FORMAS
 * Se miró la lámina de referencia pública https://aurebesh.org/images/aurebesh-3.png
 * (1789×1215, las 26 letras en 4 filas con su nombre debajo) y se midió glifo por
 * glifo sobre la imagen: dónde arranca cada trazo, dónde quiebra y dónde termina.
 * Cada `d` de esta tabla es un dibujo vectorial NUESTRO hecho a partir de esa
 * observación.
 *
 * POR QUÉ A MANO Y NO CON UNA FUENTE
 * Las FORMAS de un alfabeto no son software: lo que sí tiene dueño es el archivo
 * .ttf/.otf que alguien tipografió. Así que no se descarga ni se empaqueta
 * ninguna fuente Aurebesh — se dibujan los trazos. De paso, la credencial no
 * depende de que cargue un recurso externo: se imprime idéntica en cualquier
 * aparato, con o sin red, y no suma un solo byte de descarga.
 *
 * ANTES ACÁ HABÍA UN INVENTO. La versión vieja generaba glifos con un hash del
 * carácter: parecía escritura, pero no decía nada. Ahora la sublínea es
 * transliteración de verdad — quien lee Aurebesh puede leerla.
 *
 * El texto legible va SIEMPRE en latino arriba; esta sublínea es decoración
 * translúcida que además resulta ser cierta.
 */

/** Caja de diseño de cada glifo: 10 × 10, con la línea base abajo (y = 10). */
const GLIFO_ANCHO = 10
const GLIFO_ALTO = 10

/** Grosor del trazo en píxeles de pantalla (no se escala: ver `vectorEffect`). */
const GROSOR = 1.1

/**
 * Tabla de glifos: letra latina → camino SVG, medido sobre la lámina.
 * Solo `M` y `L` — el Aurebesh no tiene curvas, y una curva acá se vería mal.
 */
const GLIFOS: Record<string, string> = {
  // AUREK — dos brazos que se abren del asta izquierda: el de arriba sube a la
  // derecha, el de abajo baja. Se lee como una «K» ancha.
  A: 'M0.8 0 L0.8 3.2 L6.4 3.2 L9.6 1.2 M0.8 10 L0.8 6.8 L6.4 6.8 L9.6 8.8',
  // BESH — DOS galones separados, uno arriba (/‾\) y otro abajo (\_/), con las
  // puntas de izquierda y derecha ABIERTAS: entre los dos vértices horizontales
  // hay hueco. Al medio flota una barra corta que no toca nada.
  B: 'M0.9 3.2 L2 0.95 L8 0.95 L9.1 3.2 M0.9 6.8 L2 9.05 L8 9.05 L9.1 6.8 M2.8 4.9 L7 4.9',
  // CRESH — TRES barras verticales sueltas, sin nada que las una: la izquierda
  // alta (del tope a 0,66), la del medio corta (0,33 a 0,66, alineada por abajo
  // con la izquierda) y la derecha alta y corrida hacia abajo (0,33 a la base).
  C: 'M1.2 0 L1.2 6.6 M4.9 3.3 L4.9 6.6 M8.5 3.3 L8.5 10',
  // DORN — un «7» con travesaño.
  D: 'M0 0 L10 0 L1 10 M0.4 4.5 L7.5 4.5',
  // ESK — una «V» pegada a un asta con capitel: en la lámina parece «VT».
  E: 'M0 0 L4 10 L7 0 M6.4 0.6 L10 0.6 M9.1 0.6 L9.1 10',
  // FORN — el más cargado de todos: base larga, asta izquierda corta, asta
  // central que sobresale arriba y un brazo que sube hacia la derecha.
  F: 'M0.6 3.5 L0.6 9 L10 9 M0.6 3.5 L6 3.5 L9.8 0.6 M4.8 0 L4.8 9',
  // GREK — una «L» y un «7» pegados SOLO por abajo: asta izquierda entera, base
  // que corre a la derecha, y arriba un «7» cuya barra arranca a 0,35 del ancho
  // —queda hueco entre el remate del asta y la barra— con una uñeta corta que
  // baja de su extremo izquierdo; la diagonal cae del vértice superior a la base.
  G: 'M0.7 0 L0.7 9 L5.8 9 L8.7 1 L3.5 1 L3.5 3',
  // HERF — tres barras horizontales; la del medio más corta por los dos lados.
  H: 'M0 0.4 L10 0.4 M1.7 5 L8.3 5 M0 9.6 L10 9.6',
  // ISK — un «1»: asta a la derecha y banderín que baja hacia la izquierda.
  I: 'M1 3.5 L8 0 L8 10',
  // JENTH — dos barras que salen de la izquierda hacia una punta arriba a la
  // derecha, de donde cae una diagonal: parece una bandera.
  J: 'M0 4.4 L10 0 L6.9 10 M0 8.2 L7.4 8.2',
  // KRILL — corchete abierto hacia la IZQUIERDA.
  K: 'M0 0.4 L9.6 0.4 L9.6 9.6 L0 9.6',
  // LETH — un palomeo: asta a la derecha y diagonal que sube a la izquierda.
  L: 'M8.5 0 L8.5 10 L0 4.2',
  // MERN — barra arriba a la derecha, diagonal que baja a la izquierda y base.
  M: 'M9.5 0 L5.4 0 L0 10 L10 10',
  // NERN — asta izquierda, subida al vértice y caída a la derecha.
  N: 'M1.5 0 L1.5 8.8 L5.7 0 L9.5 10',
  // OSK — trapecio cerrado, más ancho abajo.
  O: 'M2.6 0 L7.4 0 L10 10 L0 10 Z',
  // PETH — una «U» abierta arriba con un brazo corto sobre el lado izquierdo.
  P: 'M6.4 0 L0.4 0 L0.4 10 L9.6 10 L9.6 0',
  // QEK — corchete abierto hacia la DERECHA, con uñeta que baja arriba.
  Q: 'M10 3 L10 0.4 L0.4 0.4 L0.4 9.6 L8 9.6',
  // RESH — un «7» pelado.
  R: 'M0 0.4 L10 0.4 L1.5 10',
  // SENTH — flecha hacia abajo-derecha: asta diagonal, barra vertical a la
  // derecha y una barbilla CORTA y SUELTA abajo a la izquierda que muere bastante
  // antes de la punta (medido: no toca la diagonal en ningún punto).
  S: 'M2 0 L9.2 9.8 L9.2 0 M0.2 6 L5.9 9.1',
  // TRILL — flecha hacia abajo, recta.
  T: 'M5 0 L5 10 M0 5 L5 10 L10 5',
  // USK — «U» abierta arriba con una diagonal que entra desde la esquina.
  U: 'M0.5 0 L0.5 10 L9.5 10 L9.5 0 L6 0 L2.5 4.5',
  // VEV — una «Y».
  V: 'M0 0 L5 4 L10 0 M5 4 L5 10',
  // WESK — rectángulo cerrado.
  W: 'M0 1 L10 1 L10 9 L0 9 Z',
  // XESH — triángulo cerrado.
  X: 'M5 0 L10 10 L0 10 Z',
  // YIRT — la «V» MÁS una barra horizontal arriba a la izquierda, y de su
  // extremo derecho un trazo corto que baja casi paralelo al brazo izquierdo y
  // muere en el aire, dejando un triángulo angosto entre ambos.
  Y: 'M0 0 L5 10 L10 0 M0.3 0.6 L3.3 0.6 L4.8 4.2',
  // ZEREK — asta derecha que SOBRESALE por arriba (la barra horizontal entra a
  // 0,29 de la altura y el asta sigue sola hasta el tope), base con una uñeta
  // corta que sube en su extremo izquierdo, y diagonal que baja de la barra y
  // MUERE EN EL AIRE: el lado izquierdo queda abierto (medido en la lámina).
  Z: 'M9.1 0 L9.1 8.9 L1.1 8.9 L1.1 7 M9.1 2.9 L4.1 2.9 L2 5.6',

  // ── Cifras ──────────────────────────────────────────────────────────────
  // OJO: la lámina de referencia NO trae numerales (después de ZEREK solo hay
  // signos de puntuación). Estos diez son dibujo nuestro en el mismo idioma
  // angular, para que un número de placa se vea como parte del alfabeto; no se
  // presentan como Aurebesh canónico porque no existe tal cosa en la lámina.
  '0': 'M2.5 0 L7.5 0 L10 2.5 L10 7.5 L7.5 10 L2.5 10 L0 7.5 L0 2.5 Z',
  '1': 'M1.5 2.5 L5 0 L5 10 M1.5 10 L8.5 10',
  '2': 'M0 2 L2 0 L8 0 L10 2 L10 4 L0 10 L10 10',
  '3': 'M0 0 L10 0 L4.5 4.5 L10 4.5 L10 8 L8 10 L2 10 L0 8',
  '4': 'M7.5 10 L7.5 0 L0 7 L10 7',
  '5': 'M10 0 L1.5 0 L1 4.5 L8 4.5 L10 6.5 L10 8 L8 10 L0 10',
  '6': 'M9 0 L3 0 L0 3.5 L0 10 L10 10 L10 5 L0 5',
  '7': 'M0 0 L10 0 L10 2 L4 10',
  '8': 'M0 0 L10 0 L10 10 L0 10 Z M0 5 L10 5',
  '9': 'M1 10 L7 10 L10 6.5 L10 0 L0 0 L0 5 L10 5',
}

/**
 * Quita tildes y diacríticos para que «José» y «Pérez» rindan sus letras en vez
 * de dejar huecos: NFD separa la letra de su acento y el rango combinante se
 * borra. La «ñ» cae en 'n' por el mismo camino.
 */
function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

interface SublineaProps {
  /** El texto en latino: acá se translitera letra por letra a Aurebesh. */
  texto: string
  x: number
  y: number
  /** Altura del glifo en unidades del viewBox (el ancho sale de la caja). */
  alto?: number
  color: string
  opacidad?: number
  /** Ancho máximo: los glifos que no quepan se omiten (no se encogen). */
  maxAncho?: number
}

/**
 * La sublínea en Aurebesh que va DEBAJO de cada texto legible de la credencial.
 * Va como grupo de <path> con trazo, no como <text>: no hay fuente que cargar.
 */
export function SublineaAurebesh({ texto, x, y, alto = 6, color, opacidad = 0.35, maxAncho }: SublineaProps) {
  const escala = alto / GLIFO_ALTO
  // Avance fijo: 10 de glifo + 3 de aire. Un carácter sin glifo avanza menos,
  // pero AVANZA — si no, «S. Vera» pegaría la S con la V y quedaría ilegible.
  const avance = (GLIFO_ANCHO + 3) * escala
  const espacioBlanco = GLIFO_ANCHO * 0.7 * escala

  const elementos: React.ReactElement[] = []
  let cursor = 0
  let i = 0
  for (const crudo of sinAcentos(texto).toUpperCase()) {
    const camino = GLIFOS[crudo]
    if (camino === undefined) {
      // Espacio, coma, guion, apóstrofo: no se dibujan (la lámina tiene sus
      // signos, pero la sublínea es un renglón de letras, no una copia fiel).
      cursor += espacioBlanco
      continue
    }
    if (maxAncho !== undefined && cursor + avance > maxAncho) break
    elementos.push(
      <path
        key={i}
        d={camino}
        transform={`translate(${cursor} 0) scale(${escala})`}
        fill="none"
        stroke={color}
        strokeWidth={GROSOR}
        strokeLinecap="square"
        strokeLinejoin="miter"
        // El trazo NO se escala con el glifo: a 5px de alto, un trazo escalado
        // desaparecía; así queda siempre de ~1px, como grabado.
        vectorEffect="non-scaling-stroke"
      />,
    )
    cursor += avance
    i++
  }

  if (elementos.length === 0) return null
  return <g transform={`translate(${x} ${y})`} opacity={opacidad} aria-hidden="true">{elementos}</g>
}

/**
 * AUREBESH — la escritura galáctica REAL, dibujada a mano como paths SVG.
 *
 * El Aurebesh es el alfabeto que se ve escrito en pantallas, cascos y naves de
 * Star Wars: 26 letras (AUREK, BESH, CRESH, DORN, ESK, FORN, GREK, HERF, ISK,
 * JENTH, KRILL, LETH, MERN, NERN, OSK, PETH, QEK, RESH, SENTH, TRILL, USK, VEV,
 * WESK, XESH, YIRT, ZEREK) que corresponden una a una con la A-Z latina. Es
 * ANGULAR: casi todo son trazos rectos y quiebres duros. Las ÚNICAS curvas
 * son las patas del dígrafo EO (Onith) y el gancho del signo de
 * interrogación, que en la lámina y en el font de referencia son curvas de
 * verdad — dibujarlas rectas sería el error contrario.
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
export const GLIFO_ANCHO = 10
export const GLIFO_ALTO = 10

/** Grosor del trazo en píxeles de pantalla (no se escala: ver `vectorEffect`). */
export const GROSOR = 1.1

/**
 * Tabla de glifos: letra latina → camino SVG, medido sobre la lámina.
 * Casi solo `M` y `L` (con `Q`/`C` en las dos excepciones curvas: EO y `?`) — el Aurebesh no tiene curvas, y una curva acá se vería mal.
 */
export const GLIFOS: Record<string, string> = {
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
export function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 * D\u00cdGRAFOS (ligaduras) y PUNTUACI\u00d3N
 * \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 *
 * DE D\u00d3NDE SALEN. De la MISMA fuente que la l\u00e1mina de arriba. Se comprob\u00f3 que
 * el archivo `Aurebesh.otf` que aurebesh.org publica para descargar es el que
 * dibuja esa l\u00e1mina: se rindieron sus 26 letras y salen glifo por glifo iguales
 * a la imagen (Cresh son tres barras sueltas, Wesk el rect\u00e1ngulo, Xesh el
 * tri\u00e1ngulo\u2026). Eso lo vuelve una referencia VISIBLE para lo que la l\u00e1mina no
 * muestra de cerca, y ah\u00ed est\u00e1n las 8 ligaduras que el propio sitio enumera en
 * su portada (\u00abThis also works for ae, eo, kh, ng, oo, sh, th\u00bb adem\u00e1s de ch).
 *
 * C\u00d3MO SE MIDI\u00d3. De cada glifo se sac\u00f3 su contorno real y se calcul\u00f3 la L\u00cdNEA
 * MEDIA de cada trazo (el contorno es el trazo ya engordado: dos bordes por
 * cada palo). Con la fuente en su rejilla de 1000, los trazos son de 105 de
 * grueso y las letras van de la base y=0 al capitel y=510; las l\u00edneas medias de
 * esa caja se llevaron a la caja 0..10 de ac\u00e1. Se verific\u00f3 dibujando nuestro
 * trazo ENCIMA del glifo relleno: cae por el centro del palo en los 20 casos.
 * No se copi\u00f3 ni se empaqueta el .otf \u2014 igual que con las letras, lo que hay
 * ac\u00e1 son coordenadas propias medidas mirando la forma.
 *
 * DOS GLIFOS TIENEN CURVA, y no es licencia nuestra: las patas del Onith (EO) y
 * el gancho del signo de interrogaci\u00f3n son curvos en la referencia. Se
 * aproximan con Q/C ajustados a la l\u00ednea media (error medido: menos de 1,3
 * unidades de las 1000 de la rejilla). El resto sigue siendo M/L puro.
 *
 * LAS LIGADURAS NO SON OBLIGATORIAS. El propio sitio lo aclara: en material
 * can\u00f3nico a veces se escriben las dos letras sueltas y tambi\u00e9n est\u00e1 bien. Por
 * eso `aGlifos` las trae como opci\u00f3n y no como ley.
 */

/**
 * Los 8 d\u00edgrafos: dos letras latinas \u2192 UN glifo propio (no la suma de dos).
 * Clave en may\u00fascula, mismo lienzo 0 0 10 10 que las letras.
 */
export const DIGRAFOS: Record<string, string> = {
  // CHEREK \u2014 dos barras horizontales unidas por una diagonal que baja hacia la
  // derecha: una \u00abZ\u00bb al rev\u00e9s, sin ning\u00fan palo vertical.
  CH: 'M0 0 L6.6 0 L9.45 10 L0 10',
  // ENTH \u2014 marco casi cerrado (techo, base y asta derecha) con el asta
  // izquierda PARTIDA en dos mu\u00f1ones y un hueco al medio, m\u00e1s una lengua
  // horizontal que entra desde el asta derecha hasta pasada la mitad.
  AE: 'M0 3.89 L0 0 L10 0 L10 10 L0 10 L0 6.11 M4.06 5 L10 5',
  // ONITH \u2014 un arco: techo plano del que bajan dos patas CURVAS que se abren
  // hacia afuera, y debajo, suelta, una barra horizontal que no las toca.
  EO: 'M0 6.6 Q2.03 5.37 3.14 0 L6.86 0 Q7.97 5.37 10 6.6 M0.41 10 L9.59 10',
  // KRENTH \u2014 asta derecha de altura completa, y a media altura una barra que
  // sale de ella hacia la izquierda y sigue en diagonal hasta la base.
  KH: 'M10 0 L10 10 M0.25 10 L3.98 4.9 L10 4.9',
  // NEN \u2014 techo con asta derecha que baja hasta la base (una \u00ab\u03a0\u00bb coja) y una
  // diagonal que cae del techo a la esquina inferior izquierda.
  NG: 'M0.7 0 L10 0 L10 10 M4.37 0 L0.16 10',
  // ORENTH \u2014 dos corchetes enfrentados, \u00ab[ ]\u00bb, separados por un hueco.
  OO: 'M4.03 0 L0.01 0 L0.01 10 L4.03 10 M5.99 0 L10 0 L10 10 L5.99 10',
  // ESH \u2014 el mismo trazo en \u00abZ\u00bb del Cherek, corrido a la derecha, con una u\u00f1eta
  // corta colgando del arranque de cada barra y dos bloques sueltos a la
  // izquierda (arriba y abajo) que son lo que lo distingue del Cherek.
  SH: 'M1.45 0 L9.53 0 L7.07 10 L1.45 10 M2.1 0 L2.1 2.11 M2.1 10 L2.1 7.89 M0 0 L0 2.11 M0 10 L0 7.89',
  // THESH \u2014 rect\u00e1ngulo cerrado con una lengua horizontal que entra desde el
  // lado izquierdo y muere pasada la mitad.
  TH: 'M0 0 L10 0 L10 10 L0 10 Z M0 5 L5.81 5',
}

/**
 * La puntuaci\u00f3n que la l\u00e1mina trae abajo a la derecha: doce signos, en dos
 * filas de seis, con su equivalente latino impreso debajo. Se dibujan en la
 * misma caja 0 0 10 10 pero SIN estirarse al ancho completo \u2014 una coma ocupa
 * lo que ocupa; el ancho se escal\u00f3 con la misma vara que una letra normal para
 * que un signo no salga del tama\u00f1o de un car\u00e1cter.
 *
 * Lo que la l\u00e1mina NO trae y por eso ac\u00e1 tampoco est\u00e1: apertura de interrogaci\u00f3n
 * y admiraci\u00f3n (\u00bf \u00a1), \u00ab\u00f1\u00bb y vocales acentuadas. La fuente adem\u00e1s dibuja & @ % $
 * # + = < > [ ] { } ~ ^ _ \ y acento grave, que quedaron fuera a prop\u00f3sito
 * porque no aparecen en la l\u00e1mina; est\u00e1n vistos y se pueden agregar si hacen
 * falta.
 */
export const PUNTUACION: Record<string, string> = {
  // COMA \u2014 una barra corta que cuelga de media altura hasta la base.
  ',': 'M0.02 5 L0.02 10',
  // PUNTO \u2014 dos barras iguales a la de la coma, lado a lado.
  '.': 'M0.02 5 L0.02 10 M2.24 5 L2.24 10',
  // PUNTO Y COMA \u2014 una sola barra, pero de altura completa.
  ';': 'M0.02 0 L0.02 10',
  // DOS PUNTOS \u2014 diagonal que baja hacia la derecha hasta topar con una barra
  // que corre por la l\u00ednea base: parece una flecha apoyada.
  ':': 'M0 3.86 L2.86 10 M0 10 L3.29 10',
  // INTERROGACI\u00d3N \u2014 barra corta arriba a la izquierda y, al lado, el gancho
  // curvo que se abre a la derecha y vuelve a la base.
  '?': 'M0.04 0 L0.04 5.17 M1.73 0.85 C2.63 4.44 2.49 6.23 1.09 10',
  // ADMIRACI\u00d3N \u2014 dos rayas paralelas inclinadas, una sobre otra.
  // Las dos rayas van a ~46,6°, no a 71°: el ancho estaba en 1.3 cuando
  // debía ser 145/40.5 = 3.58 (las Y sí estaban bien). Con el valor viejo casi
  // la mitad del trazo caía fuera del glifo.
  '!': 'M0 4.8 L3.58 1.02 M0 9.44 L3.58 5.67',
  // GUION \u2014 barra horizontal ARRIBA, a la altura del capitel: en Aurebesh no va
  // a media altura como el nuestro (medido, no es un desliz).
  '-': 'M0 0 L3.86 0',
  // COMILLAS DOBLES \u2014 un palomeo: asta corta a la izquierda, base plana y una
  // diagonal larga que sube a la derecha.
  '"': 'M0 0 L0 2.09 L1.45 2.09 L3.49 0',
  // AP\u00d3STROFO \u2014 bander\u00edn corto arriba a la izquierda y asta que baja de \u00e9l.
  "'": 'M0 0 L1.1 0 L1.1 6.46',
  // PAR\u00c9NTESIS QUE ABRE \u2014 asta de altura completa con un mu\u00f1\u00f3n que sale a media
  // altura hacia la IZQUIERDA.
  '(': 'M1.45 0 L1.45 10 M1.45 4.84 L0 4.84',
  // PAR\u00c9NTESIS QUE CIERRA \u2014 el mismo asta, con el mu\u00f1\u00f3n hacia la DERECHA.
  ')': 'M0 0 L0 10 M0 4.84 L2.18 4.84',
  // BARRA \u2014 dos astas desplazadas unidas por un escal\u00f3n diagonal.
  '/': 'M0 10 L0 6.26 L1.28 4.38 L1.28 0',
}

/** Una unidad de escritura: el trozo de latino y el glifo que le toca. */
export interface UnidadAurebesh {
  /** El latino ya normalizado: 'A', 'CH', ' ', '5'\u2026 */
  latino: string
  /** El camino SVG en la caja 0 0 10 10, o `null` si no hay glifo para esto. */
  path: string | null
}

/**
 * Parte un texto en unidades de escritura Aurebesh.
 *
 * Con `usarDigrafos` mira PRIMERO si los dos pr\u00f3ximos caracteres forman una
 * ligadura (CH, SH, TH\u2026) y solo si no, avanza letra por letra. Es codicioso a
 * prop\u00f3sito y de izquierda a derecha, que es como se lee.
 *
 * Lo que no tiene glifo \u2014el espacio, un signo que la l\u00e1mina no trae\u2014 vuelve con
 * `path: null` pero CONSERVANDO su car\u00e1cter latino: quien pinta necesita saber
 * que ah\u00ed va un hueco y de qu\u00e9 tama\u00f1o, no que ah\u00ed no hab\u00eda nada.
 */
export function aGlifos(texto: string, usarDigrafos: boolean): UnidadAurebesh[] {
  // Mismo trato que la subl\u00ednea: sin tildes y en may\u00fascula, porque el Aurebesh
  // no tiene caja alta y baja y las claves de las tablas est\u00e1n en may\u00fascula.
  const caracteres = Array.from(sinAcentos(texto).toUpperCase())
  const unidades: UnidadAurebesh[] = []

  let i = 0
  while (i < caracteres.length) {
    if (usarDigrafos && i + 1 < caracteres.length) {
      const par = caracteres[i] + caracteres[i + 1]
      const ligadura = DIGRAFOS[par]
      if (ligadura !== undefined) {
        unidades.push({ latino: par, path: ligadura })
        i += 2
        continue
      }
    }
    const caracter = caracteres[i]
    unidades.push({ latino: caracter, path: GLIFOS[caracter] ?? PUNTUACION[caracter] ?? null })
    i += 1
  }

  return unidades
}

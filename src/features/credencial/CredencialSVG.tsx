/**
 * CredencialSVG — la placa de identificación galáctica, dibujada entera.
 *
 * TODO es un solo <svg> (proporción ~1.6:1, tarjeta CR80): nitidez infinita
 * en pantalla y en papel, sin imágenes de fondo. La silueta es un <path>
 * con esquinas biseladas y muescas escalonadas; el agujero de llavero es un
 * subcamino circular con fillRule="evenodd" — un recorte de verdad, no un
 * círculo pintado del color del fondo (la credencial se ve bien sobre
 * cualquier superficie, también impresa).
 *
 * Capas, de atrás hacia adelante: base (color del tema) → panel oscuro
 * interior con su propia silueta escalonada → decoraciones grabadas
 * (código de barras, circuitos, emblema) → ventana de foto → banda del
 * nombre, que SOBRESALE del panel a ambos lados → textos.
 *
 * Debajo de CADA texto va su sublínea en glifos «Aurebesh» procedural
 * (aurebesh.tsx): decorativa, más chica y translúcida.
 */

import { useId } from 'react'
import { getAvatarSrc } from '../../services/avatars'
import { SublineaAurebesh } from './aurebesh'
import { emblemaDe } from './emblemasCredencial'
import type { TemaCredencial, EmblemaCredencialId } from './credencialTemas'
import { ACABADOS, type AcabadoCredencial } from './acabadosCredencial'
import { DefsCredencial } from './DefsCredencial'
import { BANDA, FUENTE, SILUETA_BASE, SILUETA_PANEL, barrasDe, hashCadena, idPlacaDe } from './geometriaCredencial'

export interface DatosCredencial {
  nombre: string
  /** Apodo entre comillas. */
  apodo: string
  /**
   * La línea chica bajo el apodo. `profiles.subnombre`.
   *
   * No sale de `settings` como el apodo y la ubicación: la credencial se
   * exporta a PNG y se comparte, así que quién puede llamarse cómo tiene que
   * decidirlo el servidor. El disparador `trg_profiles_subnombre` reserva
   * «The Creator» y sus disfraces para el creador de la plataforma.
   */
  subnombre?: string | null
  ubicacion: string
  rango: string
  /** Fecha de despliegue YA formateada («12 ENE 2026»). */
  desplegado: string
  /**
   * El avatar CRUDO de profiles.avatar (gotcha §2x): foto data-URI, id de
   * ícono del juego, o un emoji. Acá se resuelve con getAvatarSrc — nunca
   * se pinta el valor crudo.
   */
  avatar: string
  /** Nombre del líder del mazo favorito; null/undefined = no se muestra. */
  mazo?: string | null
}

interface Props {
  datos: DatosCredencial
  tema: TemaCredencial
  emblema: EmblemaCredencialId
  /** El acabado ganado por nivel. Sin él, la placa va mate. */
  acabado?: AcabadoCredencial
  /** El nivel del jugador. Sin él, el riel de nivel no se dibuja. */
  nivel?: number
  className?: string
}



export function CredencialSVG({ datos, tema, emblema, acabado, nivel, className }: Props) {
  // Sin acabado explícito, mate: la placa se ve igual que siempre y ninguna
  // pantalla que todavía no lo pase se rompe.
  const fin = acabado ?? ACABADOS[0]
  // Ids únicos por instancia: el banco pinta 8 credenciales en la misma
  // página y un clipPath con id repetido recorta la foto equivocada.
  const uid = useId()
  const clipFoto = `cred-foto-${uid}`

  // `emblemaDe` y no un acceso directo: un id retirado no puede tumbar la
  // pantalla (ver el comentario en emblemasCredencial.ts).
  const { url: urlEmblema } = emblemaDe(emblema)
  const srcAvatar = getAvatarSrc(datos.avatar)

  const nombre = datos.nombre.toUpperCase()
  const apodo = `"${datos.apodo.toUpperCase()}"`
  /* Se corta a 24 acá además del CHECK de la base: la placa la dibujan también
     los bancos y las vistas previas, que no pasan por Postgres. */
  const subnombre = (datos.subnombre ?? '').trim().slice(0, 24)
  const ubicacion = datos.ubicacion.toUpperCase()
  const rango = datos.rango.toUpperCase()
  const mazo = datos.mazo ? datos.mazo.toUpperCase() : null

  const semilla = hashCadena(datos.nombre)
  const idPlaca = idPlacaDe(semilla)
  const barras = barrasDe(semilla)

  // ── El nombre: cuerpo por ANCHO DISPONIBLE, no por una escalera de tres
  // peldaños ──
  // La escalera vieja (26 / 19 / 15 según pasara de 16 o de 24 caracteres)
  // daba 15 para cualquier cosa de 25 a 30, y con los 30 que permite el campo
  // el nombre se salía de la banda. Acá se calcula el cuerpo que CABE: hay 304
  // unidades de x=196 a x=500, la mono avanza 0,6 em por carácter más 1,5 de
  // letterSpacing. El piso de 11 es para que un nombre absurdo no se vuelva
  // invisible; de ahí para abajo sí se trunca.
  const cuerpoNombre = Math.max(11, Math.min(26, Math.floor(((304 / Math.max(1, nombre.length)) - 1.5) / 0.6)))

  // La LÍNEA BASE del nombre, y por qué 232 y no 228.
  //
  // Las mayúsculas ACENTUADAS —JOSÉ, MARÍA, NÚÑEZ, HERNÁNDEZ, que en una
  // comunidad salvadoreña son la mitad de los nombres— suben hasta 0,95 em
  // por encima de la línea base (medido en el .woff de JetBrains Mono que ya
  // trae el proyecto; la mayúscula sin acento llega a 0,73 em). Con la base en
  // 228 y cuerpo 26, la tilde llegaba a y=203,3 y el borde de la banda está en
  // y=206: la tilde quedaba FUERA, pintada con tema.panel sobre el propio
  // panel. Contraste 1,00:1 — no se veía cortada, se veía borrada.
  //
  // Con base 232 la tilde llega a 207,3, dentro de la banda. Y la fórmula
  // RESTA al achicar el cuerpo (la vieja sumaba), para que el texto chico no
  // se despegue del renglón.
  const baseNombre = 232 - (26 - cuerpoNombre) / 2

  return (
    <svg
      viewBox="0 0 512 320"
      className={className}
      role="img"
      data-cara="frente"
      aria-label={`Credencial de jugador de ${datos.nombre}`}
    >
      <defs>
        <DefsCredencial uid={uid} tema={tema} />
        <clipPath id={clipFoto}>
          <rect x="64" y="84" width="108" height="108" rx="5" />
        </clipPath>
      </defs>

      {/* ── Base: el material de la placa, con el agujero recortado ── */}
      {/* El halo va DEBAJO de todo: es luz que la placa proyecta hacia atrás.
          Encima taparía el resto. */}
      {fin.halo && (
        <path d={SILUETA_BASE} fill={tema.base} fillRule="evenodd" filter={`url(#${uid}-halo)`} />
      )}
      <path d={SILUETA_BASE} fill={tema.base} fillRule="evenodd" />
      {/* ── Acabados ganados por nivel ──
          Cada capa va recortada a la silueta de la placa y en este orden:
          primero la textura del material (cepillado), después los tintes
          (prisma), y al final la luz (lustre, destello, barrido). Al revés,
          el brillo quedaría debajo de la textura y no se vería. */}
      {fin.cepillado && (
        <path d={SILUETA_BASE} fillRule="evenodd" fill="#fff" filter={`url(#${uid}-cepillo)`} opacity="0.9" />
      )}
      {fin.prisma && (
        <path d={SILUETA_BASE} fill={`url(#${uid}-prisma)`} fillRule="evenodd" />
      )}

      {/* Barniz y destello sobre la placa, recortados a su silueta. */}
      {/* El reflejo especular va DEBAJO del barniz y del destello: es la luz
          del material, y encima de ella todavía tiene que ir la del laminado.
          Al revés, el barniz lo aplastaría. */}
      {fin.cromo && (
        <path
          d={SILUETA_BASE} fillRule="evenodd" fill="#fff"
          filter={`url(#${uid}-especular)`} className="mix-blend-screen"
        />
      )}
      <path d={SILUETA_BASE} fill={`url(#${uid}-lustre)`} fillRule="evenodd" />
      <path d={SILUETA_BASE} fill={`url(#${uid}-destello)`} fillRule="evenodd" />

      {fin.barrido && (
        // El barrido se apaga con `prefers-reduced-motion` desde el CSS de la
        // app (`.animate-*` ya están cubiertos); acá la clase lo engancha.
        <path
          d={SILUETA_BASE}
          fill={`url(#${uid}-barrido)`}
          fillRule="evenodd"
          className="motion-reduce:hidden"
        />
      )}
      {fin.cantoLuz && (
        // Un filo de color en el borde de ARRIBA. Es donde pega la luz en el
        // resto de la placa, así que es donde un canto pulido brillaría.
        <path
          d={SILUETA_BASE}
          fill="none"
          fillRule="evenodd"
          stroke={tema.acento}
          strokeWidth="1.6"
          opacity="0.75"
          clipPath={`url(#${uid}-mitadArriba)`}
        />
      )}
      {/* Filo grabado del canto, para que la silueta se lea sobre cualquier fondo. */}
      <path d={SILUETA_BASE} fill="none" fillRule="evenodd" stroke={tema.grabado} strokeWidth="1" opacity="0.45" />

      {/* ── Panel oscuro interior ── */}
      {/* El panel, HUNDIDO en la placa. El bisel le da el canto. */}
      <path data-fondo d={SILUETA_PANEL} fill={tema.panel} filter={`url(#${uid}-bisel)`} />
      <path d={SILUETA_PANEL} fill={`url(#${uid}-hundido)`} />
      <path d={SILUETA_PANEL} fill="none" stroke={tema.grabado} strokeWidth="0.75" opacity="0.3" />

      {/* ── Emblema, grabado en el material ──
          Es el ícono de perfil (PNG en public/avatars). Va con `filter` de
          escala de grises + el color del tema encima en `multiply`, para que
          se lea como grabado y no como una calcomanía a color pegada. */}
      {/* 98×98 en (366,76) y no 118×118 en (372,54): a la medida vieja el
          emblema se salía del panel por la muesca del borde derecho y además
          quedaba debajo del sello holográfico y de los dos circuitos — tres
          decoraciones apiladas en la misma caja sin que ninguna ganara. Así
          libra el sello por 9 unidades y el circuito por 1,5. */}
      <g transform="translate(366 76)" opacity="0.2">
        <image href={urlEmblema} width="98" height="98" filter={`url(#${uid}-grabado)`} />
      </g>

      {/* ── Código de barras del borde izquierdo ── */}
      <g data-deco fill={tema.grabado} opacity="0.5">
        {barras.map((ancho, i) => (
          <rect key={i} x="24" y={78 + i * 9} width={ancho} height="3.5" />
        ))}
      </g>

      {/* ── Circuitos del lado derecho ── */}
      <g data-deco stroke={tema.grabado} strokeWidth="1" fill="none" opacity="0.45">
        <path d="M478 56 V96 L466 108 V148" />
        <path d="M488 70 V134 L479 143 V176" />
      </g>
      <g fill={tema.grabado} opacity="0.55">
        <circle cx="478" cy="56" r="2" />
        <circle cx="466" cy="148" r="2" />
        <circle cx="488" cy="176" r="2" />
      </g>

      {/* ── Remaches ──
          Cuatro tornillos hundidos en las esquinas del panel. Son el detalle
          que más barato compra la lectura de «placa atornillada»: un anillo
          claro arriba y uno oscuro abajo bastan para que el ojo lea un hueco.
          Van con el `filter` de bisel para que compartan la misma luz que
          el resto de la placa y no parezcan pegatinas. */}
      {/* Los de abajo van en y=308 y NO en 292. En 292 el tornillo caía justo
          sobre la sublínea Aurebesh de RANGO y la de MAZO —se veía el remache
          pintado encima de las letras, que es el choque que reportó el
          usuario—. En 308 quedan por DEBAJO del panel (que termina en 304),
          apoyados en la chapa, que además es donde un tornillo de verdad
          sujeta una placa. Comprobado que las cuatro cajas caen dentro de la
          silueta: el borde inferior está en y=320 tanto en x=36 como en x=478
          (la muesca del pie solo sube a 310 entre x=204 y x=328). */}
      <g opacity="0.9" filter={`url(#${uid}-bisel)`}>
        {[[36, 60], [36, 308], [478, 308], [402, 44]].map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r="4.6" fill="#000" opacity="0.42" />
            <circle cx={cx} cy={cy - 0.6} r="3.6" fill={tema.grabado} opacity="0.55" />
            <circle cx={cx} cy={cy - 1.1} r="1.7" fill="#fff" opacity="0.28" />
            <path
              d={`M ${cx - 2.4} ${cy} H ${cx + 2.4}`}
              stroke={tema.base} strokeWidth="1.1" opacity="0.8"
            />
          </g>
        ))}
      </g>

      {/* ── Sello holográfico ──
          El disco de seguridad que llevan las identificaciones de verdad. Los
          anillos concéntricos y la retícula son lo que se ve al inclinarlas;
          acá quedan grabados, así que también sobreviven a la impresión en
          blanco y negro.

          Va arriba a la derecha y no abajo: abajo lo tapaba la banda del
          nombre, que se pinta después. Este hueco (x 420-480, y 30-75) es el
          único aire grande que le queda a la placa.

          ANTES ACÁ HABÍA UNA REGLILLA DE TICS en el borde inferior. Se quitó:
          la silueta tiene una MUESCA entre x 212 y x 320 —el borde sube a
          y 310— así que las marcas se salían de la placa justo en el medio. */}
      <g transform="translate(450 52)" opacity="0.7">
        <circle r="15" fill={tema.panel} opacity="0.5" />
        <circle r="15" fill="none" stroke={tema.acento} strokeWidth="1.1" />
        <circle r="10" fill="none" stroke={tema.acento} strokeWidth="0.6" opacity="0.8" />
        <circle r="5.5" fill="none" stroke={tema.acento} strokeWidth="0.6" opacity="0.6" />
        {[0, 45, 90, 135].map((g) => (
          <path key={g} d="M -15 0 H 15" stroke={tema.grabado} strokeWidth="0.5"
                opacity="0.5" transform={`rotate(${g})`} />
        ))}
        <circle r="2" fill={tema.acento} />
      </g>

      {/* ── Todo lo GRABADO en el panel ──
          Un solo <g> con el filtro para las cuatro decenas de textos, y no un
          filtro por texto: cada filtro obliga al navegador a rasterizar una
          capa aparte, y en /banco-credencial hay 27 placas a la vez. Dos
          grupos por placa (este y el de la fila inferior) es el costo mínimo
          que permite el orden de pintado, porque la banda del nombre va en
          medio y su texto lleva repujado, no grabado. */}
      <g filter={`url(#${uid}-grabadoTexto)`}>
        {/* ── Cabecera ── */}
        {/* `acentoTexto` y no `acento`: a 13 px el acento crudo daba 3,17 en
            Sith y 3,06 en Rebelde, por debajo del 4,5 de WCAG. Mismo matiz,
            más luz. Ver `scripts/contraste-credencial.mjs`. */}
        <text x="84" y="46" fontFamily={FUENTE} fontSize="13" fontWeight="700" letterSpacing="3" fill={tema.acentoTexto}>
          HOLOCRON SWU
        </text>
        <text x="84" y="59" fontFamily={FUENTE} fontSize="9" letterSpacing="1.6" fill={tema.texto} opacity="0.7">
          CREDENCIAL DE JUGADOR
        </text>
        <SublineaAurebesh texto="CREDENCIAL DE JUGADOR" x={84} y={62} alto={7} color={tema.grabado} maxAncho={260} />

        {/* ── Ventana de la foto: doble marco + avatar recortado ── */}
        <rect x="56" y="76" width="124" height="124" fill="none" stroke={tema.grabado} strokeWidth="1" opacity="0.4" />
        <rect x="60" y="80" width="116" height="116" fill="none" stroke={tema.acento} strokeWidth="2" />
        {/* `tema.panel` y no `tema.base`: base es el color de la CHAPA, y en los
            temas rebelde (#E8DFC9) y hoth (#D7DEE4) es casi blanco — el pozo de
            la foto salía como un parche claro en medio del panel oscuro. */}
        <rect x="64" y="84" width="108" height="108" rx="5" fill={tema.panel} opacity="0.55" />
        {/* Oclusión del rebaje: sin esto la ventana es un cuadrado pintado. */}
        <rect x="64" y="84" width="108" height="108" rx="5" fill={`url(#${uid}-pozo)`} />
        {srcAvatar ? (
          <image
            href={srcAvatar}
            x="64" y="84" width="108" height="108"
            clipPath={`url(#${clipFoto})`}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          /* Tercera forma del avatar (gotcha §2x): un emoji suelto se pinta
             como texto centrado en la ventana.

             Con RECORTE y con guarda de longitud, las dos por el mismo motivo:
             esta rama recibe cualquier cosa que no sea ni foto ni uno de los 24
             íconos, y sin ellas una cadena larga se dibujaba entera a cuerpo 56
             cruzando media placa. `dominantBaseline="central"` lo centra sobre
             la caja em y no sobre la línea base, que es lo que hacía que el
             emoji se viera caído dentro de la ventana. */
          <text
            x="118" y="138"
            textAnchor="middle" dominantBaseline="central"
            fontSize="56"
            clipPath={`url(#${clipFoto})`}
          >
            {[...datos.avatar].length <= 2 ? datos.avatar : '?'}
          </text>
        )}

        {/* Escuadras en las esquinas de la ventana: el encuadre de cámara que
            llevan las fotos de identificación. Cuatro trazos y la ventana deja
            de ser un rectángulo genérico. */}
        <g stroke={tema.acento} strokeWidth="2" fill="none" opacity="0.9">
          <path d="M 60 96 V 80 H 76" />
          <path d="M 160 80 H 176 V 96" />
          <path d="M 176 180 V 196 H 160" />
          <path d="M 76 196 H 60 V 180" />
        </g>

        {/* ── Columna de datos, a la derecha de la foto ── */}
        <text x="196" y="100" fontFamily={FUENTE} fontSize="9" letterSpacing="1.2" fill={tema.grabado}>APODO</text>
        <text x="196" y="118" fontFamily={FUENTE} fontSize="13" fontStyle="italic" fill={tema.texto}>{apodo}</text>
        {/* ── El sub-nombre OCUPA el lugar de la sublínea Aurebesh del apodo ──
            No caben los dos, y no es cuestión de apretar: medidas las cajas
            reales en `/banco-credencial`, entre la Aurebesh (termina en 132) y
            el rótulo UBICACION (arranca en 140,9) quedan **8,9 unidades**, y un
            renglón de cuerpo 10 mide 13,6 de alto. El primer intento lo puso
            igual en y=140 y el DetectorChoques lo cazó en las 27 placas:
            pisaba la Aurebesh por 2,6 y UBICACION por 2,1.
            Sin la Aurebesh el hueco es de 121,8 a 140,9 —19,1— y a cuerpo 12 la
            caja mide 16,3, o sea 1,4 de aire arriba y abajo.
            Se cambia una por otro y no se elige de una vez: la Aurebesh es el
            MISMO apodo transliterado, o sea adorno; el sub-nombre es un dato.
            Quien no se ponga uno conserva su sublínea intacta.
            En ACENTO y no en `tema.texto`: si compartiera color con el apodo,
            los dos renglones se leerían como una sola frase partida. */}
        {subnombre ? (
          <text
            x="196" y="136" fontFamily={FUENTE} fontSize="12" fontWeight="700"
            letterSpacing="0.4" fill={tema.acentoTexto}
          >
            {subnombre}
          </text>
        ) : (
          <SublineaAurebesh texto={datos.apodo} x={196} y={124} alto={8} color={tema.grabado} maxAncho={172} />
        )}

        <text x="196" y="150" fontFamily={FUENTE} fontSize="9" letterSpacing="1.2" fill={tema.grabado}>UBICACION</text>
        <text x="196" y="166" fontFamily={FUENTE} fontSize="12" fill={tema.texto}>{ubicacion}</text>
        <SublineaAurebesh texto={datos.ubicacion} x={196} y={172} alto={8} color={tema.grabado} maxAncho={172} />

        {/* ── Riel de identidad ──
            Ocupa la L vacía del centro-derecha (9,3% de la placa que no decía
            nada) y muestra lo único que la credencial no mostraba: el NIVEL y el
            nombre del ACABADO. Hasta ahora el acabado solo se deducía del brillo
            del metal, o sea que quien no se fijaba nunca supo que lo había
            ganado. Va acá y no abajo porque abajo ya hay tres columnas. */}
        {nivel !== undefined && (
          <g>
            <path d="M 314 66 V 200" stroke={tema.grabado} strokeWidth="1" opacity="0.35" />
            <text x="326" y="82" fontFamily={FUENTE} fontSize="9" letterSpacing="1.2" fill={tema.grabado}>
              NIVEL
            </text>
            {/* Este SÍ va con el acento crudo: 26 px es texto grande (umbral
                WCAG 3,0) y los veinte temas lo pasan de sobra. */}
            <text x="326" y="112" fontFamily={FUENTE} fontSize="26" fontWeight="800" fill={tema.acento}>
              {nivel}
            </text>
            <text x="326" y="140" fontFamily={FUENTE} fontSize="9" letterSpacing="1.2" fill={tema.grabado}>
              ACABADO
            </text>
            <text x="326" y="156" fontFamily={FUENTE} fontSize="11" fill={tema.texto}>
              {fin.nombre.toUpperCase()}
            </text>
          </g>
        )}
        <text x="326" y="192" fontFamily={FUENTE} fontSize="11" letterSpacing="1.2" fill={tema.grabado}>
          {idPlaca}
        </text>

      </g>
      {/* ── Banda del nombre (sobresale del panel) ──
          La sublínea va en y=241 y no en 238: a cuerpo 26 la caja de la fuente
          baja hasta 239,8 (la línea base está en 232 y el descendente de
          JetBrains Mono ocupa 0,3 em, aunque el nombre vaya en mayúsculas y no
          tenga tinta ahí). Con 238 el renglón Aurebesh arrancaba dentro de esa
          caja. En 241 termina en 249, con 3 unidades de aire contra el borde
          inferior de la banda. */}
      {/* La banda es una CHAPA APOYADA sobre el panel, no un rectángulo de
          color: sombra de contacto abajo, canto de luz arriba y su propio
          barniz. Es la pieza más grande de la placa y era la más plana. */}
      <path data-fondo d={BANDA} fill={tema.acento} filter={`url(#${uid}-apoyado)`} />
      {/* La banda pasa a chapa de cromo. Va ENCIMA del color del tema, no en
          su lugar: el cromo refleja lo que tiene debajo, así que conserva el
          tinte de la facción en vez de volver todo gris. */}
      {fin.cromo && <path d={BANDA} fill={`url(#${uid}-cromo)`} />}
      {/* Barniz de la banda + el filo de luz de su canto superior. */}
      <path d={BANDA} fill={`url(#${uid}-lustre)`} />
      <path
        d={BANDA} fill="none" stroke="#fff" strokeWidth="0.9" opacity="0.4"
        clipPath={`url(#${uid}-mitadArriba)`}
      />
      {/* EL ID YA NO VA EN LA BANDA. Ahí iba con fill={tema.panel} sobre
          tema.acento y daba 2,46:1 en seis de los catorce temas — por debajo
          de cualquier umbral de lectura, y no hay tinta que lo salve porque
          los dos colores son del tema. Ahora va sobre el panel, en el hueco
          vacío de la derecha, donde da 3,56:1 como mínimo. En la banda queda
          SOLO el nombre, que es lo que la banda tiene que gritar. */}
      <text x="196" y={baseNombre} fontFamily={FUENTE} fontSize={cuerpoNombre} fontWeight="800" letterSpacing="1.5" fill={tema.panel} filter={`url(#${uid}-repujado)`}>
        {nombre}
      </text>
      <SublineaAurebesh texto={datos.nombre} x={196} y={241} alto={8} color={tema.panel} opacidad={0.55} maxAncho={290} />

      <g filter={`url(#${uid}-grabadoTexto)`}>
        {/* ── Fila inferior: rango, despliegue y mazo ──
            Tres cambios. (1) Las columnas se re-reparten a x=24 / x=214 / x=320
            —antes eran 24 / 236 / 366—: MAZO, que es la que lleva el texto más
            largo (el nombre del líder), era la más angosta y la única que
            truncaba, y con el cuerpo subido a 12 «GRAND ADMIRAL THRAWN» se salía
            del panel por la derecha. Ahora tiene 166 unidades y entran 23
            caracteres sin cortar. (2) Los cuerpos suben de 9/10 a 12: a 10 el
            texto medía 6,7 px en un teléfono de 390 y 2,4 mm impreso. (3) Va 8
            unidades más arriba de donde estaba. SILUETA_PANEL tiene una
            MUESCA —entre x=216 y x=324 su borde inferior sube a y=294— y la
            sublínea Aurebesh de DESPLEGADO, que arranca en x=236, se caía por
            ahí: el 66% de cada glifo quedaba sobre la chapa clara en vez del
            panel oscuro, partido a media altura. Subiendo la fila entera la
            sublínea termina en y=292, con 2 unidades de aire contra la muesca. */}
        <text x="24" y="264" fontFamily={FUENTE} fontSize="9" letterSpacing="1.2" fill={tema.grabado}>RANGO</text>
        <text x="24" y="278" fontFamily={FUENTE} fontSize="11" fontWeight="700" fill={tema.texto}>{rango}</text>
        <SublineaAurebesh texto={datos.rango} x={24} y={284} alto={8} color={tema.grabado} maxAncho={178} />

        <text x="214" y="264" fontFamily={FUENTE} fontSize="9" letterSpacing="1.2" fill={tema.grabado}>DESPLEGADO</text>
        <text x="214" y="278" fontFamily={FUENTE} fontSize="11" fill={tema.texto}>{datos.desplegado.toUpperCase()}</text>
        <SublineaAurebesh texto={datos.desplegado} x={214} y={284} alto={8} color={tema.grabado} maxAncho={88} />

        {mazo && (
          <>
            <text x="320" y="264" fontFamily={FUENTE} fontSize="9" letterSpacing="1.2" fill={tema.grabado}>MAZO / LIDER</text>
            <text x="320" y="278" fontFamily={FUENTE} fontSize="11" fill={tema.texto}>
              {mazo.length > 23 ? `${mazo.slice(0, 22)}…` : mazo}
            </text>
            <SublineaAurebesh texto={mazo} x={320} y={284} alto={8} color={tema.grabado} maxAncho={150} />
          </>
        )}
      </g>
    </svg>
  )
}

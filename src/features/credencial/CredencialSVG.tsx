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
  className?: string
}



export function CredencialSVG({ datos, tema, emblema, acabado, className }: Props) {
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
  const ubicacion = datos.ubicacion.toUpperCase()
  const rango = datos.rango.toUpperCase()
  const mazo = datos.mazo ? datos.mazo.toUpperCase() : null

  const semilla = hashCadena(datos.nombre)
  const idPlaca = idPlacaDe(semilla)
  const barras = barrasDe(semilla)

  // Un nombre largo no puede desbordar la banda: se achica el cuerpo.
  const cuerpoNombre = nombre.length > 16 ? (nombre.length > 24 ? 15 : 19) : 26

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
      <path d={SILUETA_PANEL} fill={tema.panel} filter={`url(#${uid}-bisel)`} />
      <path d={SILUETA_PANEL} fill={`url(#${uid}-hundido)`} />
      <path d={SILUETA_PANEL} fill="none" stroke={tema.grabado} strokeWidth="0.75" opacity="0.3" />

      {/* ── Emblema, grabado en el material ──
          Es el ícono de perfil (PNG en public/avatars). Va con `filter` de
          escala de grises + el color del tema encima en `multiply`, para que
          se lea como grabado y no como una calcomanía a color pegada. */}
      <g transform="translate(372 54)" opacity="0.2">
        <image href={urlEmblema} width="118" height="118" filter={`url(#${uid}-grabado)`} />
      </g>

      {/* ── Código de barras del borde izquierdo ── */}
      <g fill={tema.grabado} opacity="0.5">
        {barras.map((ancho, i) => (
          <rect key={i} x="24" y={78 + i * 9} width={ancho} height="3.5" />
        ))}
      </g>

      {/* ── Circuitos del lado derecho ── */}
      <g stroke={tema.grabado} strokeWidth="1" fill="none" opacity="0.45">
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
      <g opacity="0.9">
        {[[36, 60], [36, 292], [478, 292], [402, 44]].map(([cx, cy]) => (
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

      {/* ── Cabecera ── */}
      <text x="84" y="46" fontFamily={FUENTE} fontSize="13" fontWeight="700" letterSpacing="3" fill={tema.acento}>
        HOLOCRON SWU
      </text>
      <text x="84" y="59" fontFamily={FUENTE} fontSize="7" letterSpacing="2.4" fill={tema.texto} opacity="0.7">
        CREDENCIAL DE JUGADOR
      </text>
      <SublineaAurebesh texto="CREDENCIAL DE JUGADOR" x={84} y={62} alto={7} color={tema.grabado} maxAncho={260} />

      {/* ── Ventana de la foto: doble marco + avatar recortado ── */}
      <rect x="56" y="76" width="124" height="124" fill="none" stroke={tema.grabado} strokeWidth="1" opacity="0.4" />
      <rect x="60" y="80" width="116" height="116" fill="none" stroke={tema.acento} strokeWidth="2" />
      <rect x="64" y="84" width="108" height="108" rx="5" fill={tema.base} opacity="0.6" />
      {srcAvatar ? (
        <image
          href={srcAvatar}
          x="64" y="84" width="108" height="108"
          clipPath={`url(#${clipFoto})`}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : (
        /* Tercera forma del avatar (gotcha §2x): un emoji suelto se pinta
           como texto centrado en la ventana, nunca crudo en otra parte. */
        <text x="118" y="157" fontSize="56" textAnchor="middle">{datos.avatar}</text>
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
      <text x="196" y="100" fontFamily={FUENTE} fontSize="7" letterSpacing="2" fill={tema.grabado}>APODO</text>
      <text x="196" y="118" fontFamily={FUENTE} fontSize="13" fontStyle="italic" fill={tema.texto}>{apodo}</text>
      <SublineaAurebesh texto={datos.apodo} x={196} y={124} alto={8} color={tema.grabado} maxAncho={172} />

      <text x="196" y="150" fontFamily={FUENTE} fontSize="7" letterSpacing="2" fill={tema.grabado}>UBICACION</text>
      <text x="196" y="166" fontFamily={FUENTE} fontSize="11" fill={tema.texto}>{ubicacion}</text>
      <SublineaAurebesh texto={datos.ubicacion} x={196} y={172} alto={8} color={tema.grabado} maxAncho={172} />

      {/* ── Banda del nombre (sobresale del panel) ── */}
      <path d={BANDA} fill={tema.acento} />
      {/* La banda pasa a chapa de cromo. Va ENCIMA del color del tema, no en
          su lugar: el cromo refleja lo que tiene debajo, así que conserva el
          tinte de la facción en vez de volver todo gris. */}
      {fin.cromo && <path d={BANDA} fill={`url(#${uid}-cromo)`} />}
      <text x="24" y="233" fontFamily={FUENTE} fontSize="9" letterSpacing="1.5" fill={tema.panel} opacity="0.75">
        {idPlaca}
      </text>
      <SublineaAurebesh texto={idPlaca} x={24} y={238} alto={7} color={tema.panel} opacidad={0.55} maxAncho={140} />
      <text x="196" y={228 + (26 - cuerpoNombre) / 3} fontFamily={FUENTE} fontSize={cuerpoNombre} fontWeight="800" letterSpacing="1.5" fill={tema.panel}>
        {nombre}
      </text>
      <SublineaAurebesh texto={datos.nombre} x={196} y={238} alto={8} color={tema.panel} opacidad={0.55} maxAncho={290} />

      {/* ── Fila inferior: rango, despliegue y mazo ── */}
      <text x="24" y="272" fontFamily={FUENTE} fontSize="7" letterSpacing="2" fill={tema.grabado}>RANGO</text>
      <text x="24" y="286" fontFamily={FUENTE} fontSize="10" fontWeight="700" fill={tema.texto}>{rango}</text>
      <SublineaAurebesh texto={datos.rango} x={24} y={292} alto={8} color={tema.grabado} maxAncho={200} />

      <text x="236" y="272" fontFamily={FUENTE} fontSize="7" letterSpacing="2" fill={tema.grabado}>DESPLEGADO</text>
      <text x="236" y="286" fontFamily={FUENTE} fontSize="10" fill={tema.texto}>{datos.desplegado.toUpperCase()}</text>
      <SublineaAurebesh texto={datos.desplegado} x={236} y={292} alto={8} color={tema.grabado} maxAncho={122} />

      {mazo && (
        <>
          <text x="366" y="272" fontFamily={FUENTE} fontSize="7" letterSpacing="2" fill={tema.grabado}>MAZO / LIDER</text>
          <text x="366" y="286" fontFamily={FUENTE} fontSize="9" fill={tema.texto}>
            {mazo.length > 22 ? `${mazo.slice(0, 21)}…` : mazo}
          </text>
          <SublineaAurebesh texto={mazo} x={366} y={292} alto={8} color={tema.grabado} maxAncho={118} />
        </>
      )}
    </svg>
  )
}

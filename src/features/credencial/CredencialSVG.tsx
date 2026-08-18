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
  className?: string
}

/**
 * Hash chiquito y determinista: alimenta el «código de barras» del borde y
 * el ID corto de la placa. Determinista a propósito — la credencial de una
 * persona tiene que imprimirse IGUAL hoy y el mes que viene.
 */
function hashCadena(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Silueta exterior: escalonada, biselada, con el agujero de llavero. */
const SILUETA_BASE = [
  'M 24 0',
  'L 148 0 L 156 10 L 244 10 L 252 0', // muesca escalonada superior
  'L 416 0 L 428 14 L 512 14',         // escalón hacia la esquina derecha
  'L 512 118 L 504 126 L 504 192 L 512 200', // muesca del borde derecho
  'L 512 298 L 490 320',               // bisel inferior derecho
  'L 328 320 L 320 310 L 212 310 L 204 320', // muesca inferior
  'L 18 320 L 0 302',
  'L 0 24 Z',
  // Subcamino del agujero de llavero (evenodd lo convierte en recorte).
  'M 42 30 A 10 10 0 1 0 22 30 A 10 10 0 1 0 42 30 Z',
].join(' ')

/** Panel interior oscuro, con su propia silueta escalonada (esquiva el agujero). */
const SILUETA_PANEL = [
  'M 76 24 L 408 24 L 420 38 L 496 38',
  'L 496 114 L 488 122 L 488 196 L 496 204',
  'L 496 286 L 478 304',
  'L 332 304 L 324 294 L 216 294 L 208 304',
  'L 30 304 L 14 288',
  'L 14 82 L 28 68 L 60 68 L 76 52 Z',
].join(' ')

/** Banda del nombre: cruza la placa entera y sobresale del panel. */
const BANDA = 'M 4 206 L 508 206 L 508 244 L 496 252 L 18 252 L 4 240 Z'

const FUENTE = 'var(--font-mono)'

export function CredencialSVG({ datos, tema, emblema, className }: Props) {
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
  // ID corto de la placa, derivado del nombre: decorativo pero estable.
  const idPlaca = `ID-${(semilla % 0x10000).toString(16).toUpperCase().padStart(4, '0')}`

  // Código de barras del borde izquierdo: anchos pseudoaleatorios pero
  // deterministas (mismo nombre = mismas barras, también en papel).
  //
  // `>>>` y NO `>>`. El corrimiento con signo convierte el hash a int32, y con
  // el bit alto prendido el resultado es NEGATIVO: `6 + (neg % 13)` daba anchos
  // de hasta -6, y un `<rect>` de ancho ≤ 0 sencillamente no se dibuja. Medido
  // con los nombres reales de la comunidad: Vara perdía 5 de 13 barras, ElDaigo
  // 8, Marlin 7. Se veía como una credencial a medio grabar, y solo para
  // algunas personas — que es la peor clase de bug, porque el que lo prueba con
  // su propio nombre puede no verlo nunca.
  const barras: number[] = []
  for (let i = 0; i < 13; i++) barras.push(6 + (((semilla >>> (i % 27)) * (i + 3)) >>> 0) % 13)

  // Un nombre largo no puede desbordar la banda: se achica el cuerpo.
  const cuerpoNombre = nombre.length > 16 ? (nombre.length > 24 ? 15 : 19) : 26

  return (
    <svg
      viewBox="0 0 512 320"
      className={className}
      role="img"
      aria-label={`Credencial de jugador de ${datos.nombre}`}
    >
      <defs>
        <clipPath id={clipFoto}>
          <rect x="64" y="84" width="108" height="108" rx="5" />
        </clipPath>

        {/* ── El relieve ──
            Una placa de verdad tiene VOLUMEN: la luz le pega desde arriba a la
            izquierda, así que los bordes de arriba brillan y los de abajo caen
            en sombra, y lo hundido invierte esa relación. Todo se hace con
            degradados y desenfoques: cuesta poco y, a diferencia de un PNG con
            el relieve pintado, escala y se imprime nítido a cualquier tamaño. */}

        {/* Barniz de la placa: claro arriba, oscuro abajo. */}
        <linearGradient id={`${uid}-lustre`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="42%" stopColor="#fff" stopOpacity="0.03" />
          <stop offset="60%" stopColor="#000" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>

        {/* Brillo diagonal: la lamida de luz que tiene todo lo laminado. */}
        <linearGradient id={`${uid}-destello`} x1="0" y1="0" x2="1" y2="0.9">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="38%" stopColor="#fff" stopOpacity="0" />
          <stop offset="47%" stopColor="#fff" stopOpacity="0.13" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>

        {/* El panel interior va HUNDIDO: sombra arriba, luz abajo. Es la
            inversión de la placa, y es lo que hace que se lea como rebaje. */}
        <linearGradient id={`${uid}-hundido`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.4" />
          <stop offset="30%" stopColor="#000" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.05" />
        </linearGradient>

        {/* Bisel: desenfoca la silueta y la desplaza, para tener un labio de
            luz arriba y otro de sombra abajo sin dibujar cada borde a mano. */}
        <filter id={`${uid}-bisel`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.4" result="b" />
          <feOffset in="b" dx="0.9" dy="1.4" result="abajo" />
          <feFlood floodColor="#000" floodOpacity="0.5" result="oscuro" />
          <feComposite in="oscuro" in2="abajo" operator="in" result="sombra" />
          <feOffset in="b" dx="-0.7" dy="-1.1" result="arriba" />
          <feFlood floodColor="#fff" floodOpacity="0.42" result="claro" />
          <feComposite in="claro" in2="arriba" operator="in" result="luz" />
          <feMerge>
            <feMergeNode in="sombra" />
            <feMergeNode in="luz" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* El emblema, a escala de grises: el color se lo pone la placa. */}
        <filter id={`${uid}-grabado`} x="0" y="0" width="100%" height="100%">
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>

      {/* ── Base: el material de la placa, con el agujero recortado ── */}
      <path d={SILUETA_BASE} fill={tema.base} fillRule="evenodd" />
      {/* Barniz y destello sobre la placa, recortados a su silueta. */}
      <path d={SILUETA_BASE} fill={`url(#${uid}-lustre)`} fillRule="evenodd" />
      <path d={SILUETA_BASE} fill={`url(#${uid}-destello)`} fillRule="evenodd" />
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

      {/* ── Cabecera ── */}
      <text x="84" y="46" fontFamily={FUENTE} fontSize="13" fontWeight="700" letterSpacing="3" fill={tema.acento}>
        HOLOCRON SWU
      </text>
      <text x="84" y="59" fontFamily={FUENTE} fontSize="7" letterSpacing="2.4" fill={tema.texto} opacity="0.7">
        CREDENCIAL DE JUGADOR
      </text>
      <SublineaAurebesh texto="CREDENCIAL DE JUGADOR" x={84} y={63} alto={4.5} color={tema.grabado} maxAncho={250} />

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

      {/* ── Columna de datos, a la derecha de la foto ── */}
      <text x="196" y="100" fontFamily={FUENTE} fontSize="7" letterSpacing="2" fill={tema.grabado}>APODO</text>
      <text x="196" y="118" fontFamily={FUENTE} fontSize="13" fontStyle="italic" fill={tema.texto}>{apodo}</text>
      <SublineaAurebesh texto={datos.apodo} x={196} y={124} alto={5} color={tema.grabado} maxAncho={168} />

      <text x="196" y="150" fontFamily={FUENTE} fontSize="7" letterSpacing="2" fill={tema.grabado}>UBICACION</text>
      <text x="196" y="166" fontFamily={FUENTE} fontSize="11" fill={tema.texto}>{ubicacion}</text>
      <SublineaAurebesh texto={datos.ubicacion} x={196} y={172} alto={5} color={tema.grabado} maxAncho={168} />

      {/* ── Banda del nombre (sobresale del panel) ── */}
      <path d={BANDA} fill={tema.acento} />
      <text x="24" y="233" fontFamily={FUENTE} fontSize="9" letterSpacing="1.5" fill={tema.panel} opacity="0.75">
        {idPlaca}
      </text>
      <SublineaAurebesh texto={idPlaca} x={24} y={238} alto={4.5} color={tema.panel} opacidad={0.5} maxAncho={120} />
      <text x="196" y={228 + (26 - cuerpoNombre) / 3} fontFamily={FUENTE} fontSize={cuerpoNombre} fontWeight="800" letterSpacing="1.5" fill={tema.panel}>
        {nombre}
      </text>
      <SublineaAurebesh texto={datos.nombre} x={196} y={240} alto={6} color={tema.panel} opacidad={0.5} maxAncho={290} />

      {/* ── Fila inferior: rango, despliegue y mazo ── */}
      <text x="24" y="272" fontFamily={FUENTE} fontSize="7" letterSpacing="2" fill={tema.grabado}>RANGO</text>
      <text x="24" y="286" fontFamily={FUENTE} fontSize="10" fontWeight="700" fill={tema.texto}>{rango}</text>
      <SublineaAurebesh texto={datos.rango} x={24} y={292} alto={4.5} color={tema.grabado} maxAncho={190} />

      <text x="236" y="272" fontFamily={FUENTE} fontSize="7" letterSpacing="2" fill={tema.grabado}>DESPLEGADO</text>
      <text x="236" y="286" fontFamily={FUENTE} fontSize="10" fill={tema.texto}>{datos.desplegado.toUpperCase()}</text>
      <SublineaAurebesh texto={datos.desplegado} x={236} y={292} alto={4.5} color={tema.grabado} maxAncho={110} />

      {mazo && (
        <>
          <text x="366" y="272" fontFamily={FUENTE} fontSize="7" letterSpacing="2" fill={tema.grabado}>MAZO / LIDER</text>
          <text x="366" y="286" fontFamily={FUENTE} fontSize="9" fill={tema.texto}>
            {mazo.length > 22 ? `${mazo.slice(0, 21)}…` : mazo}
          </text>
          <SublineaAurebesh texto={mazo} x={366} y={292} alto={4.5} color={tema.grabado} maxAncho={116} />
        </>
      )}
    </svg>
  )
}

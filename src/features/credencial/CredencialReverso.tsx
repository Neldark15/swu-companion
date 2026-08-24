/**
 * El REVERSO de la credencial.
 *
 * Una placa de identificación real tiene dos caras, y el dorso es donde van
 * las cosas que no caben adelante: la banda magnética, el sello de propiedad,
 * la firma del portador y el bloque de datos legible por máquina. Sin él, girar
 * la tarjeta mostraba un rectángulo vacío — o sea que el giro no valía la pena.
 *
 * Comparte silueta, material y acabados con el anverso (`geometriaCredencial` y
 * `DefsCredencial`): tiene que sentirse la MISMA tarjeta vista por atrás, no
 * otra tarjeta.
 */

import { useId } from 'react'
import { emblemaDe } from './emblemasCredencial'
import type { TemaCredencial, EmblemaCredencialId } from './credencialTemas'
import { ACABADOS, type AcabadoCredencial } from './acabadosCredencial'
import { DefsCredencial } from './DefsCredencial'
import { FUENTE, SILUETA_BASE, SILUETA_PANEL, barrasDe, hashCadena, idPlacaDe } from './geometriaCredencial'
import { SublineaAurebesh } from './aurebesh'
import type { DatosCredencial } from './CredencialSVG'

interface Props {
  datos: DatosCredencial
  tema: TemaCredencial
  emblema: EmblemaCredencialId
  acabado?: AcabadoCredencial
  className?: string
}

/**
 * Cuadrícula pseudoaleatoria pero determinista: el «código de máquina» del
 * dorso. Mismo nombre, mismo dibujo — igual que el código de barras del frente.
 */
function celdasDe(semilla: number, lado: number): boolean[] {
  const celdas: boolean[] = []
  let x = semilla || 1
  for (let i = 0; i < lado * lado; i++) {
    // LCG chiquito. `>>> 0` en cada paso: sin él, `Math.imul` devuelve enteros
    // con signo y la mitad de las celdas salían siempre apagadas.
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0
    celdas.push((x >>> 16) % 100 < 46)
  }
  return celdas
}

export function CredencialReverso({ datos, tema, emblema, acabado, className }: Props) {
  const fin = acabado ?? ACABADOS[0]
  const uid = useId()
  const { url: urlEmblema } = emblemaDe(emblema)

  const semilla = hashCadena(datos.nombre)
  const idPlaca = idPlacaDe(semilla)
  const barras = barrasDe(semilla, 22)
  const celdas = celdasDe(semilla, 11)

  return (
    <svg
      viewBox="0 0 512 320"
      className={className}
      role="img"
      data-cara="dorso"
      aria-label={`Reverso de la credencial de ${datos.nombre}`}
    >
      <defs>
        <DefsCredencial uid={uid} tema={tema} />
        {/* Banda magnética: no es negro plano, es una cinta con brillo. */}
        <linearGradient id={`${uid}-cinta`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.92" />
          <stop offset="38%" stopColor="#2a2a30" stopOpacity="0.95" />
          <stop offset="46%" stopColor="#4a4a55" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.95" />
        </linearGradient>
      </defs>

      {/* ── El mismo material que el anverso ── */}
      {fin.halo && <path d={SILUETA_BASE} fill={tema.base} fillRule="evenodd" filter={`url(#${uid}-halo)`} />}
      <path d={SILUETA_BASE} fill={tema.base} fillRule="evenodd" />
      {fin.cepillado && (
        <path d={SILUETA_BASE} fillRule="evenodd" fill="#fff" filter={`url(#${uid}-cepillo)`} opacity="0.9" />
      )}
      {fin.prisma && <path d={SILUETA_BASE} fill={`url(#${uid}-prisma)`} fillRule="evenodd" />}
      <path d={SILUETA_BASE} fill={`url(#${uid}-lustre)`} fillRule="evenodd" />
      <path d={SILUETA_BASE} fill={`url(#${uid}-destello)`} fillRule="evenodd" />
      {fin.barrido && (
        <path d={SILUETA_BASE} fill={`url(#${uid}-barrido)`} fillRule="evenodd" className="motion-reduce:hidden" />
      )}
      {fin.cantoLuz && (
        <path
          d={SILUETA_BASE} fill="none" fillRule="evenodd"
          stroke={tema.acento} strokeWidth="1.6" opacity="0.75"
          clipPath={`url(#${uid}-mitadArriba)`}
        />
      )}

      {/* ── Banda magnética ── Cruza la placa entera, como en cualquier tarjeta. */}
      <rect data-fondo x="0" y="52" width="512" height="44" fill={`url(#${uid}-cinta)`} />
      {/* Los dos cantos de la cinta: labio de luz arriba, sombra abajo. Una
          cinta magnética está PEGADA sobre la chapa, no impresa en ella. */}
      <rect x="0" y="52" width="512" height="1.5" fill="#fff" opacity="0.16" />
      <rect x="0" y="94.5" width="512" height="1.5" fill="#000" opacity="0.55" />
      <rect x="0" y="96" width="512" height="3" fill="#000" opacity="0.3" />

      {/* ── Panel hundido para los textos ── */}
      {/* ── Panel del dorso ──
          Rectángulo propio, no la SILUETA_PANEL del anverso aplastada con
          `scale(1 0.68)`. Esa silueta tiene un ESCALÓN en la esquina superior
          izquierda —está recortada para esquivar la ventana de la foto y el
          agujero de llavero del ANVERSO— y en el dorso no esquiva nada: solo
          dejaba «PROPIEDAD DE» medio afuera del panel, sobre la chapa.
          Aplastarla además desplazaba todo el borde inferior, que es por lo
          que el código de barras y la fecha terminaban en el bisel.

          Y opaco, no a 0,55: con opacidad el panel se mezclaba con la chapa y
          en los temas de base clara (rebelde #E8DFC9, hoth #D7DEE4) el texto
          grabado caía a 1,2:1. Opaco da 4,5-8,9:1 en los catorce. El rebaje se
          conserva con el degradado `-hundido`, igual que en el anverso. */}
      <rect data-fondo x="20" y="104" width="468" height="182" rx="6" fill={tema.panel} />
      <rect x="20" y="104" width="468" height="182" rx="6" fill={`url(#${uid}-hundido)`} />
      <path
        d={SILUETA_PANEL} fill={`url(#${uid}-hundido)`}
        transform="translate(0 78) scale(1 0.68)"
      />

      {/* ── Emblema como marca de agua, atrás de todo el texto ── */}
      {/* 80×80 en (268,106) y no 160×160 en (176,112). Centrada, la marca de
          agua caía detrás de CINCO elementos a la vez —los tres renglones del
          párrafo, la sublínea y la firma— y no se leía ninguno de los seis.
          Acá vive en el único hueco limpio del dorso: el texto muere en x=199,
          el bloque de máquina arranca en x=360, la cinta termina en y=96 y la
          firma empieza en y=240. */}
      <image
        href={urlEmblema}
        x="268" y="106" width="80" height="80"
        opacity="0.14"
        filter={`url(#${uid}-grabado)`}
        preserveAspectRatio="xMidYMid meet"
      />

      {/* ── Cabecera ──
          Con su propia placa de fondo. Suelta sobre la chapa, en los temas de
          base clara (rebelde, hoth) el texto de acento quedaba a menos de 2:1
          contra el metal. La placa le da un fondo constante en los catorce.
          Y x=56 y no 24: el agujero de llavero vive en (32,30) con radio 10 y
          se comía las primeras letras. */}
      <rect data-fondo x="50" y="22" width="316" height="20" rx="2" fill={tema.panel} opacity="0.85" />
      {/* 9 px: el texto más chico de la placa, así que `acentoTexto`. */}
      <text x="56" y="36" fontFamily={FUENTE} fontSize="9" letterSpacing="3" fill={tema.acentoTexto} opacity="0.9">
        HOLOCRON SWU · ARCHIVO GALACTICO
      </text>

      {/* Todo el texto del dorso, grabado con un solo filtro. Uno por texto
          costaría catorce capas de rasterizado por placa. */}
      <g filter={`url(#${uid}-grabadoTexto)`}>
        {/* ── Sello de propiedad ── */}
        <text x="28" y="124" fontFamily={FUENTE} fontSize="7" letterSpacing="2" fill={tema.grabado}>
          PROPIEDAD DE
        </text>
        <text x="28" y="140" fontFamily={FUENTE} fontSize="12" fontWeight="800" letterSpacing="1" fill={tema.texto}>
          {datos.nombre.toUpperCase()}
        </text>
        <SublineaAurebesh texto={datos.nombre} x={28} y={146} alto={8} color={tema.grabado} maxAncho={230} />

        <text x="28" y="176" fontFamily={FUENTE} fontSize="9" fill={tema.texto} opacity="0.75">
          ESTA PLACA ACREDITA AL PORTADOR COMO
        </text>
        <text x="28" y="188" fontFamily={FUENTE} fontSize="9" fill={tema.texto} opacity="0.75">
          MIEMBRO REGISTRADO DE LA COMUNIDAD.
        </text>
        <text x="28" y="200" fontFamily={FUENTE} fontSize="9" fill={tema.texto} opacity="0.75">
          SI LA ENCONTRAS, DEVOLVELA AL ARCHIVO.
        </text>
        <SublineaAurebesh texto="DEVOLVELA AL ARCHIVO" x={28} y={206} alto={7} color={tema.grabado} maxAncho={230} />

        {/* ── Firma del portador ── */}
        <text
          x="34" y="240" fontFamily={FUENTE} fontSize="16" fontStyle="italic"
          fill={tema.texto} opacity="0.9"
        >
          {datos.apodo}
        </text>
        <line x1="28" y1="246" x2="250" y2="246" stroke={tema.grabado} strokeWidth="1" opacity="0.6" />
        <text x="28" y="257" fontFamily={FUENTE} fontSize="9" letterSpacing="1.2" fill={tema.grabado}>
          FIRMA DEL PORTADOR
        </text>

        {/* ── Bloque legible por máquina ── */}
        {/* 90×90 y en tono de GRABADO. A 126×126 con fill={tema.texto} era el
            objeto de más contraste de toda la tarjeta —más que el nombre— y no
            dice nada: es decoración. */}
        <rect data-fondo x="380" y="140" width="90" height="90" fill={tema.panel} opacity="0.5" />
        <g data-deco fill={tema.grabado} opacity="0.5">
          {celdas.map((prendida, i) => {
            // Las tres esquinas de registro ocupan 3×3 celdas cada una. Los datos
            // NO se pintan ahí: en un código 2D de verdad esa zona está limpia, y
            // dibujar celdas debajo del marco lo ensuciaba.
            const col = i % 11
            const fila = Math.floor(i / 11)
            const enEsquina =
              (col < 3 && fila < 3) || (col > 7 && fila < 3) || (col < 3 && fila > 7)
            if (enEsquina || !prendida) return null
            return <rect key={i} x={385 + col * 7.4} y={145 + fila * 7.4} width="6.4" height="6.4" />
          })}
        </g>
        {/* Las tres esquinas de registro, como cualquier código 2D real. */}
        <g data-deco fill="none" stroke={tema.grabado} strokeWidth="1.5">
          <rect x="385" y="145" width="18.5" height="18.5" />
          <rect x="446.5" y="145" width="18.5" height="18.5" />
          <rect x="385" y="206.5" width="18.5" height="18.5" />
        </g>
        {/* Dos renglones y no uno: «ID-747D · COMANDANTE DEL SECTOR» en una
            línea se salía por el borde derecho de la placa. */}
        {/* Bajo el bloque de máquina solo entran datos CORTOS: de x=380 al borde
            del panel hay 116 unidades, y el rango («COMANDANTE DEL SECTOR») mide
            133 a cuerpo 9 — se salía por la derecha. El rango se fue a la
            columna izquierda, que tiene 330 libres. */}
        <text x="380" y="248" fontFamily={FUENTE} fontSize="9" letterSpacing="1.2" fill={tema.grabado}>
          {idPlaca}
        </text>
        <text x="380" y="262" fontFamily={FUENTE} fontSize="9" letterSpacing="1.2" fill={tema.grabado} opacity="0.85">
          {datos.desplegado.toUpperCase()}
        </text>

        {/* ── Código de barras ──
            Sube a y=262. En 284 caía FUERA del panel (que en el dorso termina en
            y=284,7 por el scale(1 0.68)) y quedaba sobre el bisel de la chapa,
            igual que la fecha — que no es adorno, es un dato. */}
        <g data-deco fill={tema.grabado} opacity="0.55">
          {barras.map((ancho, i) => (
            <rect key={i} x={28 + i * 13} y="266" width={ancho * 0.6} height="14" />
          ))}
        </g>
        {/* ACÁ IBA EL RANGO OTRA VEZ. Se quitó: ya está en el anverso, en su
            propia columna y a cuerpo 11, y en el dorso no había dónde ponerlo
            sin pisar «FIRMA DEL PORTADOR». Repetir un dato no lo hace más claro;
            solo obliga a apretar los dos. */}
      </g>
    </svg>
  )
}

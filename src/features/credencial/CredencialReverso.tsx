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
      <rect x="0" y="52" width="512" height="44" fill={`url(#${uid}-cinta)`} />
      <rect x="0" y="52" width="512" height="1.5" fill="#fff" opacity="0.14" />
      <rect x="0" y="94.5" width="512" height="1.5" fill="#000" opacity="0.5" />

      {/* ── Panel hundido para los textos ── */}
      <path
        d={SILUETA_PANEL} fill={tema.panel} opacity="0.55"
        transform="translate(0 78) scale(1 0.68)"
      />

      {/* ── Emblema como marca de agua, atrás de todo el texto ── */}
      <image
        href={urlEmblema}
        x="176" y="112" width="160" height="160"
        opacity="0.1"
        filter={`url(#${uid}-grabado)`}
        preserveAspectRatio="xMidYMid meet"
      />

      {/* ── Cabecera ── */}
      {/* x=56 y no 24: el agujero de llavero vive en (32, 30) con radio 10 y
          se comía las primeras letras. */}
      <text x="56" y="36" fontFamily={FUENTE} fontSize="9" letterSpacing="3" fill={tema.acento} opacity="0.9">
        HOLOCRON SWU · ARCHIVO GALACTICO
      </text>

      {/* ── Sello de propiedad ── */}
      <text x="28" y="124" fontFamily={FUENTE} fontSize="7" letterSpacing="2" fill={tema.grabado}>
        PROPIEDAD DE
      </text>
      <text x="28" y="140" fontFamily={FUENTE} fontSize="12" fontWeight="800" letterSpacing="1" fill={tema.texto}>
        {datos.nombre.toUpperCase()}
      </text>
      <SublineaAurebesh texto={datos.nombre} x={28} y={146} alto={8} color={tema.grabado} maxAncho={230} />

      <text x="28" y="176" fontFamily={FUENTE} fontSize="7.5" fill={tema.texto} opacity="0.72">
        ESTA PLACA ACREDITA AL PORTADOR COMO
      </text>
      <text x="28" y="188" fontFamily={FUENTE} fontSize="7.5" fill={tema.texto} opacity="0.72">
        MIEMBRO REGISTRADO DE LA COMUNIDAD.
      </text>
      <text x="28" y="200" fontFamily={FUENTE} fontSize="7.5" fill={tema.texto} opacity="0.72">
        SI LA ENCONTRAS, DEVOLVELA AL ARCHIVO.
      </text>
      <SublineaAurebesh texto="DEVOLVELA AL ARCHIVO" x={28} y={206} alto={7} color={tema.grabado} maxAncho={230} />

      {/* ── Firma del portador ── */}
      <text
        x="34" y="252" fontFamily={FUENTE} fontSize="16" fontStyle="italic"
        fill={tema.texto} opacity="0.9"
      >
        {datos.apodo}
      </text>
      <line x1="28" y1="258" x2="268" y2="258" stroke={tema.grabado} strokeWidth="1" opacity="0.6" />
      <text x="28" y="270" fontFamily={FUENTE} fontSize="6.5" letterSpacing="2" fill={tema.grabado}>
        FIRMA DEL PORTADOR
      </text>

      {/* ── Bloque legible por máquina ── */}
      <rect x="360" y="128" width="126" height="126" fill={tema.panel} opacity="0.5" />
      <g fill={tema.texto} opacity="0.75">
        {celdas.map((prendida, i) => {
          // Las tres esquinas de registro ocupan 3×3 celdas cada una. Los datos
          // NO se pintan ahí: en un código 2D de verdad esa zona está limpia, y
          // dibujar celdas debajo del marco lo ensuciaba.
          const col = i % 11
          const fila = Math.floor(i / 11)
          const enEsquina =
            (col < 3 && fila < 3) || (col > 7 && fila < 3) || (col < 3 && fila > 7)
          if (enEsquina || !prendida) return null
          return <rect key={i} x={366 + col * 10.4} y={134 + fila * 10.4} width="9" height="9" />
        })}
      </g>
      {/* Las tres esquinas de registro, como cualquier código 2D real. */}
      <g fill="none" stroke={tema.acento} strokeWidth="3">
        <rect x="366" y="134" width="26" height="26" />
        <rect x="452" y="134" width="26" height="26" />
        <rect x="366" y="220" width="26" height="26" />
      </g>
      {/* Dos renglones y no uno: «ID-747D · COMANDANTE DEL SECTOR» en una
          línea se salía por el borde derecho de la placa. */}
      <text x="360" y="266" fontFamily={FUENTE} fontSize="7" letterSpacing="1.5" fill={tema.grabado}>
        {idPlaca}
      </text>
      <text x="360" y="276" fontFamily={FUENTE} fontSize="6.5" letterSpacing="1" fill={tema.grabado} opacity="0.8">
        {datos.rango.toUpperCase().slice(0, 24)}
      </text>

      {/* ── Código de barras del pie ── */}
      <g fill={tema.grabado} opacity="0.55">
        {barras.map((ancho, i) => (
          <rect key={i} x={28 + i * 13} y="284" width={ancho * 0.6} height="16" />
        ))}
      </g>
      <text x="392" y="298" fontFamily={FUENTE} fontSize="6.5" letterSpacing="1.5" fill={tema.grabado} opacity="0.8">
        {datos.desplegado.toUpperCase()}
      </text>
    </svg>
  )
}

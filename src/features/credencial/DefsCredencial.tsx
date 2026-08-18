/**
 * Los `<defs>` de la credencial: degradados, filtros y recortes que le dan el
 * relieve, el metal y los acabados.
 *
 * Viven acá y no dentro de CredencialSVG porque el REVERSO de la placa es del
 * mismo material. Duplicarlos era garantizar que un día el frente y el dorso
 * dejaran de parecer la misma tarjeta.
 *
 * Todo id lleva el `uid` de quien los usa: la pantalla de personalización
 * pinta varias credenciales a la vez, y un id repetido hace que el filtro se
 * aplique a la placa equivocada.
 */

import type { TemaCredencial } from './credencialTemas'

interface Props {
  /** El `useId()` de la instancia que los va a usar. */
  uid: string
  tema: TemaCredencial
}

export function DefsCredencial({ uid, tema }: Props) {
  return (
    <>

      {/* El canto de luz solo pinta la mitad de arriba: un borde iluminado
          por los cuatro lados se lee como neón, no como metal pulido. */}
      <clipPath id={`${uid}-mitadArriba`}>
        <rect x="0" y="0" width="512" height="150" />
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

      {/* ── Cepillado ──
          Microrrayas paralelas hechas con turbulencia estirada en una sola
          dirección: es lo que distingue el aluminio cepillado del plástico
          pintado. `baseFrequency` muy alta en Y y casi cero en X es lo que
          hace la veta horizontal. */}
      <filter id={`${uid}-cepillo`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.9" numOctaves="2" seed="7" result="ruido" />
        <feColorMatrix in="ruido" type="saturate" values="0" result="gris" />
        <feComponentTransfer in="gris" result="suave">
          <feFuncA type="linear" slope="0.10" intercept="0" />
        </feComponentTransfer>
      </filter>

      {/* ── Cromo ──
          Un degradado de muchas paradas con saltos duros: el cromo no es un
          gris suave, son bandas de cielo y suelo reflejadas. */}
      <linearGradient id={`${uid}-cromo`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#fff" stopOpacity="0.55" />
        <stop offset="18%"  stopColor="#fff" stopOpacity="0.10" />
        <stop offset="34%"  stopColor="#000" stopOpacity="0.18" />
        <stop offset="50%"  stopColor="#fff" stopOpacity="0.42" />
        <stop offset="58%"  stopColor="#fff" stopOpacity="0.05" />
        <stop offset="78%"  stopColor="#000" stopOpacity="0.22" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0.30" />
      </linearGradient>

      {/* ── Prisma ──
          La mancha de aceite del laminado holográfico. Opacidades bajas: lo
          que se busca es un tinte que cambia, no un arcoíris. */}
      <linearGradient id={`${uid}-prisma`} x1="0" y1="0" x2="1" y2="0.6">
        <stop offset="0%"   stopColor="#ff4d6d" stopOpacity="0.16" />
        <stop offset="22%"  stopColor="#ffd166" stopOpacity="0.13" />
        <stop offset="44%"  stopColor="#4cc9f0" stopOpacity="0.16" />
        <stop offset="66%"  stopColor="#8ac926" stopOpacity="0.12" />
        <stop offset="88%"  stopColor="#b892ff" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#ff4d6d" stopOpacity="0.10" />
      </linearGradient>

      {/* ── Barrido ──
          La luz que recorre la placa. Se mueve con `animate` sobre el
          degradado y NO con un transform sobre un rectángulo: así no hay
          nada que recortar ni que se salga de la silueta. */}
      <linearGradient id={`${uid}-barrido`} x1="0" y1="0" x2="1" y2="0.35">
        <stop offset="0%"  stopColor="#fff" stopOpacity="0" />
        <stop offset="46%" stopColor="#fff" stopOpacity="0" />
        <stop offset="50%" stopColor="#fff" stopOpacity="0.30" />
        <stop offset="54%" stopColor="#fff" stopOpacity="0" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        <animate attributeName="x1" values="-1;1" dur="5s" repeatCount="indefinite" />
        <animate attributeName="x2" values="0;2" dur="5s" repeatCount="indefinite" />
      </linearGradient>

      {/* ── Halo ── La placa proyecta luz. Solo el acabado máximo. */}
      <filter id={`${uid}-halo`} x="-14%" y="-14%" width="128%" height="128%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="b" />
        <feFlood floodColor={tema.acento} floodOpacity="0.55" result="c" />
        <feComposite in="c" in2="b" operator="in" result="glow" />
        <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>

      {/* El emblema, a escala de grises: el color se lo pone la placa. */}
      <filter id={`${uid}-grabado`} x="0" y="0" width="100%" height="100%">
        <feColorMatrix type="saturate" values="0" />
      </filter>
    </>
  )
}

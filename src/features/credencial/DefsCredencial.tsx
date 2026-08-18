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

      {/* ── Texto GRABADO ──
          Un texto grabado en metal no es un texto con sombra: es un surco. La
          luz entra desde arriba a la izquierda —la misma dirección que usa el
          bisel de la placa— así que la pared de arriba del surco queda en
          sombra y la de abajo devuelve luz. Se hace con DOS copias
          desplazadas del alfa, media unidad cada una, compuestas por debajo
          del glifo original.

          `stdDeviation="0"`: sin desenfoque. A cuerpo 9 sobre una placa de
          85,6 mm, medio milímetro de desenfoque se come la letra. Y un
          desplazamiento duro SOBREVIVE a la impresión en blanco y negro, que
          es la regla de toda esta placa: un relieve hecho solo de luz
          desaparece en escala de grises. */}
      <filter id={`${uid}-grabadoTexto`} x="-8%" y="-20%" width="116%" height="150%">
        <feOffset in="SourceAlpha" dx="-0.5" dy="-0.5" result="arriba" />
        <feFlood floodColor="#000" floodOpacity="0.55" result="tintaSombra" />
        <feComposite in="tintaSombra" in2="arriba" operator="in" result="surcoSombra" />
        <feOffset in="SourceAlpha" dx="0.5" dy="0.6" result="abajo" />
        <feFlood floodColor="#fff" floodOpacity="0.30" result="tintaLuz" />
        <feComposite in="tintaLuz" in2="abajo" operator="in" result="surcoLuz" />
        <feMerge>
          <feMergeNode in="surcoSombra" />
          <feMergeNode in="surcoLuz" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* ── Texto REPUJADO ──
          Lo contrario del grabado: el glifo SALE de la placa, como el número
          en relieve de una tarjeta de crédito. La sombra cae abajo a la
          derecha y el filo de luz queda arriba a la izquierda. Solo para el
          nombre, que es el único texto lo bastante grande (cuerpo 26) para
          que el relieve se lea en vez de ensuciarlo. */}
      <filter id={`${uid}-repujado`} x="-10%" y="-25%" width="125%" height="160%">
        <feOffset in="SourceAlpha" dx="1.1" dy="1.3" result="cae" />
        <feGaussianBlur in="cae" stdDeviation="0.5" result="caeSuave" />
        <feFlood floodColor="#000" floodOpacity="0.42" result="negro" />
        <feComposite in="negro" in2="caeSuave" operator="in" result="sombra" />
        <feOffset in="SourceAlpha" dx="-0.7" dy="-0.8" result="sube" />
        <feFlood floodColor="#fff" floodOpacity="0.5" result="blanco" />
        <feComposite in="blanco" in2="sube" operator="in" result="filo" />
        <feMerge>
          <feMergeNode in="sombra" />
          <feMergeNode in="filo" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* ── Sombra de contacto ──
          Lo que convierte una forma pegada en una pieza APOYADA sobre otra.
          La usa la banda del nombre, que es una chapa distinta atornillada
          encima del panel. Sin esto la banda es un rectángulo de color; con
          esto tiene grosor. */}
      <filter id={`${uid}-apoyado`} x="-6%" y="-30%" width="112%" height="170%">
        <feDropShadow dx="0" dy="1.8" stdDeviation="1.3" floodColor="#000" floodOpacity="0.5" />
      </filter>

      {/* ── Pozo ──
          Oclusión ambiental de un rebaje: oscuro pegado al borde, aclarándose
          hacia el centro. Es lo que hace que la ventana de la foto se lea como
          un hueco y no como un cuadrado pintado. */}
      <radialGradient id={`${uid}-pozo`} cx="0.5" cy="0.45" r="0.72">
        <stop offset="55%" stopColor="#000" stopOpacity="0" />
        <stop offset="88%" stopColor="#000" stopOpacity="0.28" />
        <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
      </radialGradient>

      {/* El emblema, a escala de grises: el color se lo pone la placa. */}
      <filter id={`${uid}-grabado`} x="0" y="0" width="100%" height="100%">
        <feColorMatrix type="saturate" values="0" />
      </filter>
    </>
  )
}

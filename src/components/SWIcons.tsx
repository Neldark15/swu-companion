/**
 * Star Wars themed SVG icons for HOLOCRON SWU
 * Custom inline SVGs to replace generic lucide-react icons throughout the app.
 * Each icon is a React component accepting size + className props.
 */

interface IconProps {
  size?: number
  className?: string
}

/** Lightsaber — duelos, combate */
export function SaberIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="4" y1="20" x2="6" y2="18" />
      <rect x="5" y="16" width="3" height="4" rx="0.5" transform="rotate(-45 6.5 18)" />
      <line x1="8" y1="16" x2="19" y2="5" strokeWidth="2.5" stroke="currentColor" opacity="0.9" />
      <circle cx="20" cy="4" r="1.5" fill="currentColor" opacity="0.5" />
    </svg>
  )
}

/** Holocron — registros, datos, conocimiento */
export function HolocronIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12,2 22,8 22,16 12,22 2,16 2,8" />
      <polygon points="12,6 18,9.5 18,14.5 12,18 6,14.5 6,9.5" opacity="0.4" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.7" />
    </svg>
  )
}

/** Rebel Alliance symbol — alianza, equipos */
export function RebelIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C12 2 8 6 8 10C8 12 9.5 13.5 11 14V19L9 21H15L13 19V14C14.5 13.5 16 12 16 10C16 6 12 2 12 2ZM12 5C12 5 14 8 14 10C14 11.1 13.1 12 12 12C10.9 12 10 11.1 10 10C10 8 12 5 12 5Z" opacity="0.9" />
    </svg>
  )
}

/** Imperial/Empire symbol */
export function EmpireIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="12" r="10" opacity="0.15" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2V5M12 19V22M2 12H5M19 12H22M4.93 4.93L7.05 7.05M16.95 16.95L19.07 19.07M4.93 19.07L7.05 16.95M16.95 7.05L19.07 4.93" strokeWidth="2" stroke="currentColor" fill="none" />
    </svg>
  )
}

/** Starfighter / X-Wing — naves, eventos */
export function StarfighterIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3L14 8H18L22 12L18 12L14 16H12L10 16H6L2 12L6 12H10L12 8" fill="currentColor" opacity="0.15" />
      <path d="M12 3V21" />
      <path d="M8 10L2 12L8 14" />
      <path d="M16 10L22 12L16 14" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

/** Kyber Crystal — logros, energía */
export function KyberIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12,2 16,8 16,16 12,22 8,16 8,8" fill="currentColor" opacity="0.15" />
      <polygon points="12,2 16,8 16,16 12,22 8,16 8,8" />
      <line x1="8" y1="8" x2="16" y2="8" opacity="0.5" />
      <line x1="8" y1="16" x2="16" y2="16" opacity="0.5" />
      <line x1="12" y1="8" x2="12" y2="16" opacity="0.3" />
    </svg>
  )
}

/** Blaster — combate, acción */
export function BlasterIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 14H12L16 10H20" />
      <rect x="2" y="12" width="6" height="4" rx="1" />
      <path d="M12 14L14 18" />
      <circle cx="21" cy="10" r="1" fill="currentColor" opacity="0.6" />
    </svg>
  )
}

/** Helmet/Trooper — perfil, identidad */
export function HelmetIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12C5 7 8 3 12 3C16 3 19 7 19 12V16C19 18 17 20 15 20H9C7 20 5 18 5 16V12Z" fill="currentColor" opacity="0.1" />
      <path d="M5 12C5 7 8 3 12 3C16 3 19 7 19 12V16C19 18 17 20 15 20H9C7 20 5 18 5 16V12Z" />
      <path d="M8 13H11L12 15L13 13H16" />
      <line x1="5" y1="10" x2="19" y2="10" opacity="0.4" />
    </svg>
  )
}

/** Deck of cards / Sabacc — decks, cartas */
export function DeckCardsIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="5" width="12" height="16" rx="1.5" fill="currentColor" opacity="0.1" />
      <rect x="3" y="5" width="12" height="16" rx="1.5" />
      <rect x="6" y="3" width="12" height="16" rx="1.5" fill="currentColor" opacity="0.05" />
      <rect x="6" y="3" width="12" height="16" rx="1.5" />
      <rect x="9" y="1" width="12" height="16" rx="1.5" />
      <circle cx="15" cy="9" r="2" opacity="0.4" fill="currentColor" />
    </svg>
  )
}

/** Cargo / Crate — colección, botín */
export function CargoIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 8L12 3L22 8V16L12 21L2 16V8Z" fill="currentColor" opacity="0.1" />
      <path d="M2 8L12 3L22 8V16L12 21L2 16V8Z" />
      <path d="M12 3V21" opacity="0.3" />
      <path d="M2 8L12 13L22 8" />
      <circle cx="12" cy="13" r="1" fill="currentColor" opacity="0.5" />
    </svg>
  )
}

/** Death Star / Target — misiones, objetivo */
export function DeathStarIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.08" />
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="10" x2="22" y2="10" opacity="0.4" />
      <circle cx="14" cy="7" r="2.5" />
      <circle cx="14" cy="7" r="1" fill="currentColor" opacity="0.5" />
    </svg>
  )
}

/** Spy / Scout — espionaje */
export function SpyIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="10" r="6" />
      <circle cx="12" cy="10" r="2.5" fill="currentColor" opacity="0.3" />
      <circle cx="12" cy="10" r="1" fill="currentColor" />
      <path d="M6 10H2M22 10H18" />
      <path d="M12 4V2M12 18V16" />
      <path d="M7 16L5 20M17 16L19 20" />
    </svg>
  )
}

/** Shield / Beskar — defensa, ranking */
export function BeskarIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2L20 6V12C20 16.4 16.4 20.4 12 22C7.6 20.4 4 16.4 4 12V6L12 2Z" fill="currentColor" opacity="0.1" />
      <path d="M12 2L20 6V12C20 16.4 16.4 20.4 12 22C7.6 20.4 4 16.4 4 12V6L12 2Z" />
      <path d="M12 6L12 12L8 9" opacity="0.4" fill="currentColor" />
    </svg>
  )
}

/** Trophy / Mandalorian skull — competición */
export function MandoTrophyIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 3H18V8C18 12 15.3 15 12 15C8.7 15 6 12 6 8V3Z" fill="currentColor" opacity="0.1" />
      <path d="M6 3H18V8C18 12 15.3 15 12 15C8.7 15 6 12 6 8V3Z" />
      <path d="M6 5H3V8C3 9.7 4.3 11 6 11" />
      <path d="M18 5H21V8C21 9.7 19.7 11 18 11" />
      <path d="M10 15V18H14V15" />
      <path d="M8 18H16V20H8V18Z" />
    </svg>
  )
}

/** Scroll / Datapad — registros */
export function DatapadIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="2" width="16" height="20" rx="2" fill="currentColor" opacity="0.08" />
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" opacity="0.5" />
      <line x1="8" y1="10" x2="14" y2="10" opacity="0.5" />
      <line x1="8" y1="14" x2="16" y2="14" opacity="0.5" />
      <circle cx="12" cy="19" r="1" fill="currentColor" opacity="0.4" />
    </svg>
  )
}

/** Medal / Badge — mérito, logros */
export function MedalIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 2L10 8H14L16 2" />
      <circle cx="12" cy="14" r="6" fill="currentColor" opacity="0.1" />
      <circle cx="12" cy="14" r="6" />
      <polygon points="12,10 13.5,13 17,13 14.5,15.5 15.5,19 12,17 8.5,19 9.5,15.5 7,13 10.5,13" fill="currentColor" opacity="0.3" />
    </svg>
  )
}

/** Dice / Chance cube — utilidades, azar */
export function ChanceCubeIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" fill="currentColor" opacity="0.08" />
      <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" />
      <path d="M12 2V22" opacity="0.2" />
      <path d="M3 7L12 12L21 7" opacity="0.3" />
      <circle cx="8" cy="10" r="0.8" fill="currentColor" />
      <circle cx="16" cy="10" r="0.8" fill="currentColor" />
      <circle cx="12" cy="17" r="0.8" fill="currentColor" />
    </svg>
  )
}

/** Database / Holonet — búsqueda de cartas */
export function HolonetIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.05" />
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" opacity="0.4" />
      <line x1="3" y1="12" x2="21" y2="12" opacity="0.4" />
      <line x1="4.5" y1="7" x2="19.5" y2="7" opacity="0.2" />
      <line x1="4.5" y1="17" x2="19.5" y2="17" opacity="0.2" />
    </svg>
  )
}

/** Skull — contrabando, peligro */
export function BountyIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2C8 2 5 5.5 5 9.5C5 12 6 14 7.5 15.5L7 20H10L10.5 17H13.5L14 20H17L16.5 15.5C18 14 19 12 19 9.5C19 5.5 16 2 12 2Z" fill="currentColor" opacity="0.1" />
      <path d="M12 2C8 2 5 5.5 5 9.5C5 12 6 14 7.5 15.5L7 20H10L10.5 17H13.5L14 20H17L16.5 15.5C18 14 19 12 19 9.5C19 5.5 16 2 12 2Z" />
      <circle cx="9.5" cy="10" r="1.5" fill="currentColor" opacity="0.6" />
      <circle cx="14.5" cy="10" r="1.5" fill="currentColor" opacity="0.6" />
      <path d="M10 13.5C10 13.5 11 14.5 12 14.5C13 14.5 14 13.5 14 13.5" />
    </svg>
  )
}

/** Matraz de laboratorio — probar un mazo contra el meta antes de llevarlo. */
export function LabIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* El líquido va con el relleno tenue del resto de la familia: en la
          rejilla del Inicio los íconos se leen a 18 px y una silueta hueca se
          pierde contra el panel. */}
      <path d="M8.5 13.5L5 20.2C4.6 20.9 5.1 21.7 5.9 21.7H18.1C18.9 21.7 19.4 20.9 19 20.2L15.5 13.5Z" fill="currentColor" opacity="0.16" />
      <path d="M9.5 2.5V9.4C9.5 9.8 9.4 10.2 9.2 10.5L4.4 19.7C3.9 20.6 4.6 21.7 5.6 21.7H18.4C19.4 21.7 20.1 20.6 19.6 19.7L14.8 10.5C14.6 10.2 14.5 9.8 14.5 9.4V2.5" />
      <line x1="8.2" y1="2.5" x2="15.8" y2="2.5" />
      {/* Dos burbujas: lo que distingue un matraz de un embudo de un vistazo. */}
      <circle cx="10.6" cy="17.4" r="1.05" fill="currentColor" opacity="0.65" />
      <circle cx="13.8" cy="19.1" r="0.75" fill="currentColor" opacity="0.45" />
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════════
 * Segunda tanda: los módulos que todavía se nombraban con un ícono
 * genérico de lucide.
 *
 * Mismo molde que los de arriba —24×24, trazo 1,5, `currentColor`, remates
 * redondos— porque van mezclados con ellos en la misma columna del menú y
 * en la misma cuadrícula de Inicio: uno de otro grosor se ve como un error
 * de imprenta.
 *
 * Regla de dibujo: tienen que leerse a 14 px, que es el tamaño al que los
 * pinta MoreNav. Eso manda más que el detalle — tres trazos que se
 * distinguen valen más que ocho que se empastan.
 * ═══════════════════════════════════════════════════════════════════ */

/** Sobre de cartas — Sobredosis */
export function SobreIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Primera versión: el dentado arriba y dos renglones dentro. Visto a 14
          px en el banco se leía como un BLOC DE NOTAS — los renglones mandaban
          más que el dentado. Fuera los renglones; entra la banda diagonal del
          envoltorio, que es lo que hace «sobre metalizado» y no «papel». */}
      <path d="M5 6.5h14v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5z" />
      <path d="M5 6.5 6.6 4l1.9 2.5L10.4 4l1.6 2.5L13.6 4l1.9 2.5L17.4 4 19 6.5" />
      <path d="M5 15.5 19 9.5" strokeWidth="2.6" opacity="0.35" />
    </svg>
  )
}

/** Hoja de álbum con bolsillos — Binder digital */
export function BinderIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M7.5 3v18" opacity="0.5" />
      <rect x="10" y="6" width="3.6" height="4.6" rx="0.5" fill="currentColor" opacity="0.35" stroke="none" />
      <rect x="15" y="6" width="3.6" height="4.6" rx="0.5" fill="currentColor" opacity="0.35" stroke="none" />
      <rect x="10" y="12.5" width="3.6" height="4.6" rx="0.5" fill="currentColor" opacity="0.35" stroke="none" />
      <rect x="15" y="12.5" width="3.6" height="4.6" rx="0.5" fill="currentColor" opacity="0.35" stroke="none" />
    </svg>
  )
}

/** Placa de identificación con muesca — Mi Credencial */
export function CredencialIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* La esquina cortada es la misma gramática de la credencial de verdad:
          ninguna esquina de 90°. */}
      <path d="M3.5 5.5h13.5L20.5 9v9.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" />
      <circle cx="9" cy="12" r="2.2" />
      <path d="M14 11h4M14 14.5h3" opacity="0.6" />
    </svg>
  )
}

/** Aurek, la primera letra del aurebesh — Traductor */
export function AurebeshIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* El AUREK de verdad, copiado del mismo trazo que la app ya usa para
          escribir en Aurebesh (`features/credencial/aurebeshGlifos.ts`, letra
          A). La primera versión era una «A» latina estilizada y el comentario
          afirmaba que era el aurek: no lo era. El aurek son dos galones
          horizontales encarados, nada parecido a una A.
          El glifo vive en una caja de 10×10 con trazo 1,1; acá se escala 1,8
          para llenar el viewBox de 24, y por eso el trazo va en 0,85 — al
          escalarlo se ve como los 1,5 del resto de los íconos. */}
      <g transform="translate(3 3) scale(1.8)" strokeWidth="0.85">
        <path d="M0.8 0 L0.8 3.2 L6.4 3.2 L9.6 1.2 M0.8 10 L0.8 6.8 L6.4 6.8 L9.6 8.8" />
      </g>
    </svg>
  )
}

/** Datapad con la agenda — Calendario */
export function AgendaIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3.5v3M16 3.5v3" />
      <rect x="6.5" y="12" width="3" height="2.6" rx="0.4" fill="currentColor" opacity="0.5" stroke="none" />
      <rect x="14.5" y="15.4" width="3" height="2.6" rx="0.4" fill="currentColor" opacity="0.3" stroke="none" />
    </svg>
  )
}

/** Transmisión personal — Mensajes */
export function TransmisionIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h10A1.5 1.5 0 0 1 17 6.5v6A1.5 1.5 0 0 1 15.5 14H9l-4 3.5V14H5.5A1.5 1.5 0 0 1 4 12.5z" />
      {/* Las ondas: es una TRANSMISIÓN, no una nota de papel. */}
      <path d="M19 7.5a4.5 4.5 0 0 1 0 6" opacity="0.6" />
      <path d="M21 5.5a7.5 7.5 0 0 1 0 10" opacity="0.3" />
    </svg>
  )
}

/** Contenedor de carga con gancho — Pedidos */
export function PedidoIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Primera versión: cajón con rejilla completa. A 14 px se leía como una
          VENTANA. Las divisiones verticales eran el problema: quedan la tapa y
          una sola correa, y el gancho sube a trazo entero para que se vea que
          es carga colgada y no un mueble. */}
      <path d="M12 2v2.2" />
      <path d="M9.8 4.2a2.2 2.2 0 0 1 4.4 0" />
      <rect x="4" y="7.5" width="16" height="12.5" rx="1.5" />
      <path d="M4 11.5h16" opacity="0.6" />
      <path d="M12 11.5v8.5" opacity="0.3" />
    </svg>
  )
}

/** Antena de transmisión — En Vivo */
export function EmisionIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="8" r="2" fill="currentColor" stroke="none" />
      <path d="M8.5 4.5a5 5 0 0 0 0 7M15.5 4.5a5 5 0 0 1 0 7" />
      <path d="M5.8 2a8.5 8.5 0 0 0 0 12M18.2 2a8.5 8.5 0 0 1 0 12" opacity="0.4" />
      <path d="M10.6 10 9 21h6l-1.6-11" />
    </svg>
  )
}

/** Red de salas enlazadas — Salas de chat */
export function SalasIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="2.6" fill="currentColor" opacity="0.45" stroke="none" />
      <circle cx="12" cy="12" r="2.6" />
      <circle cx="5" cy="6.5" r="2" />
      <circle cx="19" cy="6.5" r="2" />
      <circle cx="6.5" cy="19" r="2" />
      <circle cx="17.5" cy="19" r="2" />
      <path d="M6.6 8 10 10.4M17.4 8 14 10.4M8 17.6l2.3-3.2M16 17.6l-2.3-3.2" opacity="0.55" />
    </svg>
  )
}

/** Datapad con un artículo — Blog */
export function ArticuloIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4.5 4.5h11.5L19.5 8v11.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z" />
      <path d="M15.5 4.5V8h4" opacity="0.6" />
      <path d="M7.5 12h9M7.5 15h9M7.5 18h5.5" opacity="0.7" />
    </svg>
  )
}

/** Proyector con barras — Meta */
export function MetaHoloIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Barras, pero SALIENDO de un proyector: la base y el haz son lo que lo
          separan de una gráfica cualquiera. */}
      <path d="M5 21h14" />
      <path d="M7.5 21 9 18.5h6l1.5 2.5" opacity="0.5" />
      <rect x="7" y="11" width="2.8" height="7.5" rx="0.6" fill="currentColor" opacity="0.35" />
      <rect x="10.6" y="6.5" width="2.8" height="12" rx="0.6" fill="currentColor" opacity="0.55" />
      <rect x="14.2" y="9" width="2.8" height="9.5" rx="0.6" fill="currentColor" opacity="0.35" />
    </svg>
  )
}

/** Hexágono de mando — la Base */
export function BaseIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* El hexágono ya es el motivo de la app —los paneles del HUD, el ícono
          octogonal— así que acá se conserva y se le pone el punto de mando. */}
      <polygon points="12,2.5 21,7.25 21,16.75 12,21.5 3,16.75 3,7.25" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" opacity="0.7" stroke="none" />
      <path d="M12 2.5v3M12 18.5v3M3 7.25l2.6 1.4M18.4 15.35 21 16.75" opacity="0.4" />
    </svg>
  )
}

/** Altavoz de anuncios — comunicados */
export function AnuncioIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 10.5v3a1.5 1.5 0 0 0 1.5 1.5H8l6 4.5V6L8 10.5H5.5A1.5 1.5 0 0 0 4 12z" />
      <path d="M17.5 8.5a5.5 5.5 0 0 1 0 7" opacity="0.55" />
      <path d="M20 6a9 9 0 0 1 0 12" opacity="0.3" />
    </svg>
  )
}

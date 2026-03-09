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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12,2 22,8 22,16 12,22 2,16 2,8" />
      <polygon points="12,6 18,9.5 18,14.5 12,18 6,14.5 6,9.5" opacity="0.4" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.7" />
    </svg>
  )
}

/** Rebel Alliance symbol — alianza, equipos */
export function RebelIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C12 2 8 6 8 10C8 12 9.5 13.5 11 14V19L9 21H15L13 19V14C14.5 13.5 16 12 16 10C16 6 12 2 12 2ZM12 5C12 5 14 8 14 10C14 11.1 13.1 12 12 12C10.9 12 10 11.1 10 10C10 8 12 5 12 5Z" opacity="0.9" />
    </svg>
  )
}

/** Imperial/Empire symbol */
export function EmpireIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="12" r="10" opacity="0.15" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2V5M12 19V22M2 12H5M19 12H22M4.93 4.93L7.05 7.05M16.95 16.95L19.07 19.07M4.93 19.07L7.05 16.95M16.95 7.05L19.07 4.93" strokeWidth="2" stroke="currentColor" fill="none" />
    </svg>
  )
}

/** Starfighter / X-Wing — naves, eventos */
export function StarfighterIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2L20 6V12C20 16.4 16.4 20.4 12 22C7.6 20.4 4 16.4 4 12V6L12 2Z" fill="currentColor" opacity="0.1" />
      <path d="M12 2L20 6V12C20 16.4 16.4 20.4 12 22C7.6 20.4 4 16.4 4 12V6L12 2Z" />
      <path d="M12 6L12 12L8 9" opacity="0.4" fill="currentColor" />
    </svg>
  )
}

/** Trophy / Mandalorian skull — competición */
export function MandoTrophyIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2C8 2 5 5.5 5 9.5C5 12 6 14 7.5 15.5L7 20H10L10.5 17H13.5L14 20H17L16.5 15.5C18 14 19 12 19 9.5C19 5.5 16 2 12 2Z" fill="currentColor" opacity="0.1" />
      <path d="M12 2C8 2 5 5.5 5 9.5C5 12 6 14 7.5 15.5L7 20H10L10.5 17H13.5L14 20H17L16.5 15.5C18 14 19 12 19 9.5C19 5.5 16 2 12 2Z" />
      <circle cx="9.5" cy="10" r="1.5" fill="currentColor" opacity="0.6" />
      <circle cx="14.5" cy="10" r="1.5" fill="currentColor" opacity="0.6" />
      <path d="M10 13.5C10 13.5 11 14.5 12 14.5C13 14.5 14 13.5 14 13.5" />
    </svg>
  )
}

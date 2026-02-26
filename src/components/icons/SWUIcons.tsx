/**
 * Star Wars Unlimited Icon Pack
 * Custom SVG icons for aspects, achievements, ranks and UI elements
 * Inspired by SWU card game aesthetics
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const defaults = (props: IconProps) => ({
  width: props.size || 24,
  height: props.size || 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  ...props,
  size: undefined, // strip from DOM
})

// ─── ASPECT ICONS (6 aspects of SWU) ─────────────────────────────

/** Vigilance — Shield with inner eye */
export function IconVigilance(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <path d="M12 2L3 7v6c0 5.25 3.82 10.15 9 11.25 5.18-1.1 9-6 9-11.25V7l-9-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity="0.15" />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <path d="M8 12c0 0 2-3 4-3s4 3 4 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M8 12c0 0 2 3 4 3s4-3 4-3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

/** Command — Crossed lightsabers with star */
export function IconCommand(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="20" x2="4" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Saber hilts */}
      <rect x="2" y="18" width="4" height="2" rx="0.5" transform="rotate(-45 4 20)" fill="currentColor" fillOpacity="0.5" />
      <rect x="18" y="18" width="4" height="2" rx="0.5" transform="rotate(45 20 20)" fill="currentColor" fillOpacity="0.5" />
      {/* Center star */}
      <path d="M12 8l1 2.5 2.5 0.5-1.8 1.8 0.4 2.7L12 14l-2.1 1.5 0.4-2.7L8.5 11l2.5-0.5L12 8z" fill="currentColor" />
    </svg>
  )
}

/** Aggression — Flame / explosion */
export function IconAggression(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <path d="M12 2C12 2 8 7 8 11c0 1.5 0.5 2.8 1.3 3.8C8.5 13.5 8 12 9 10c1-2 3-3 3-3s2 1 3 3c1 2 0.5 3.5-0.3 4.8 0.8-1 1.3-2.3 1.3-3.8 0-4-4-9-4-9z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 22c-3 0-5-2.2-5-5 0-3 2.5-5.5 5-8 2.5 2.5 5 5 5 8 0 2.8-2 5-5 5z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 18c0-1.5 1-2.5 2-3.5 1 1 2 2 2 3.5 0 1.2-0.9 2-2 2s-2-0.8-2-2z" fill="currentColor" />
    </svg>
  )
}

/** Cunning — Crosshair / target */
export function IconCunning(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.08" />
      <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 2" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <line x1="12" y1="1" x2="12" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="19" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** Heroism — Crystal / gem with rays */
export function IconHeroism(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <polygon points="12,2 16,8 22,9 17.5,14 18.5,21 12,17.5 5.5,21 6.5,14 2,9 8,8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity="0.15" />
      <polygon points="12,6 14.5,9.5 18,10 15.5,13 16,17 12,14.5 8,17 8.5,13 6,10 9.5,9.5" fill="currentColor" fillOpacity="0.25" />
      <circle cx="12" cy="11" r="1.5" fill="currentColor" />
    </svg>
  )
}

/** Villainy — Crescent moon with dark side aura */
export function IconVillainy(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1.3 0 2.5-.2 3.6-.7-1.2 0.4-2.3 0.7-3.6 0.7-4.4 0-8-3.6-8-8s3.6-8 8-8c1.3 0 2.4.3 3.6.7C14.5 2.2 13.3 2 12 2z" fill="currentColor" fillOpacity="0.2" />
      <path d="M21 12.3A9 9 0 0 1 11.7 3 9 9 0 1 0 21 12.3z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
      {/* Small stars */}
      <circle cx="16" cy="6" r="0.8" fill="currentColor" />
      <circle cx="19" cy="9" r="0.6" fill="currentColor" />
      <circle cx="18" cy="4" r="0.5" fill="currentColor" />
    </svg>
  )
}

// ─── ACHIEVEMENT ICONS ──────────────────────────────────────────

/** Sentinel / Guardian — Shield badge */
export function IconSentinel(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <path d="M12 2L4 6v5c0 5.6 3.4 10.8 8 12 4.6-1.2 8-6.4 8-12V6l-8-4z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
      <path d="M10 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Fortress — Castle/tower */
export function IconFortress(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <path d="M4 22V10l3-3V4h2v2h2V4h2v2h2V4h2v3l3 3v12H4z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" strokeLinejoin="round" />
      <rect x="10" y="16" width="4" height="6" fill="currentColor" fillOpacity="0.3" />
      <rect x="6" y="8" width="2" height="2" fill="currentColor" fillOpacity="0.4" />
      <rect x="16" y="8" width="2" height="2" fill="currentColor" fillOpacity="0.4" />
    </svg>
  )
}

/** Calendar / daily streak */
export function IconCalendar(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
      <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.5" />
      <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 13l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Strategy / clipboard */
export function IconStrategy(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
      <rect x="8" y="1" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.2" />
      <line x1="8" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="8" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="8" y1="16" x2="12" y2="16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

/** Medal / ribbon */
export function IconMedal(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <circle cx="12" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
      <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.1" />
      <path d="M12 9l0.9 1.8 2 0.3-1.45 1.4 0.35 2-1.8-0.95-1.8 0.95 0.35-2L9.1 11.1l2-0.3L12 9z" fill="currentColor" />
      <path d="M8.5 14.5L6 22l3.5-1.5L12 22" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="currentColor" fillOpacity="0.2" />
      <path d="M15.5 14.5L18 22l-3.5-1.5L12 22" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="currentColor" fillOpacity="0.2" />
    </svg>
  )
}

/** Star badge */
export function IconStar(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity="0.2" />
    </svg>
  )
}

/** Crown */
export function IconCrown(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <path d="M2 17L5 7l4 5 3-8 3 8 4-5 3 10H2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity="0.2" />
      <rect x="2" y="17" width="20" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
      <circle cx="12" cy="11" r="1" fill="currentColor" />
      <circle cx="7" cy="13" r="0.8" fill="currentColor" />
      <circle cx="17" cy="13" r="0.8" fill="currentColor" />
    </svg>
  )
}

/** Sword / blade — first blood */
export function IconBlade(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <line x1="6" y1="18" x2="18" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 4l2 0 0 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Hilt */}
      <line x1="4" y1="16" x2="8" y2="20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="6" cy="18" r="1.5" fill="currentColor" fillOpacity="0.3" />
    </svg>
  )
}

/** Dual swords — gladiator */
export function IconDualBlades(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <line x1="4" y1="4" x2="14" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="20" y1="4" x2="10" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="2" y1="6" x2="6" y2="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="2" x2="22" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Fire base */}
      <path d="M8 16c0 0 2-2 4-2s4 2 4 2c0 3-2 6-4 6s-4-3-4-6z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

/** Skull — Imparable */
export function IconSkull(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <path d="M12 2C7.5 2 4 5.8 4 10.5c0 2.8 1.3 5.3 3.5 6.8V20h9v-2.7c2.2-1.5 3.5-4 3.5-6.8C20 5.8 16.5 2 12 2z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
      <circle cx="9" cy="10" r="2" fill="currentColor" />
      <circle cx="15" cy="10" r="2" fill="currentColor" />
      <path d="M9 15h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="10" y1="15" x2="10" y2="17" stroke="currentColor" strokeWidth="1" />
      <line x1="12" y1="15" x2="12" y2="17" stroke="currentColor" strokeWidth="1" />
      <line x1="14" y1="15" x2="14" y2="17" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

/** Trophy */
export function IconTrophy(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <path d="M8 2h8v8c0 2.2-1.8 4-4 4s-4-1.8-4-4V2z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
      <path d="M8 4H5c0 3 1.5 5 3 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 4h3c0 3-1.5 5-3 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="14" x2="12" y2="18" stroke="currentColor" strokeWidth="1.5" />
      <rect x="8" y="18" width="8" height="2" rx="1" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1" />
      <path d="M11 7l0.5 1 1 0.2-0.75 0.7 0.18 1L11 9.3 10.07 9.9l0.18-1L9.5 8.2l1-0.2L11 7z" fill="currentColor" />
    </svg>
  )
}

/** Pencil / draft — deck creation */
export function IconDraft(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <path d="M16.5 3.5L20.5 7.5 7 21H3V17L16.5 3.5z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" strokeLinejoin="round" />
      <line x1="14" y1="6" x2="18" y2="10" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

/** Wrench / tool — engineer */
export function IconWrench(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a5 5 0 0 1-6.7 6.7L7 20a2 2 0 1 1-3-3l7.8-7.8a5 5 0 0 1 6.7-6.7L14.7 6.3z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" strokeLinejoin="round" />
    </svg>
  )
}

/** Blueprint / architect */
export function IconBlueprint(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.08" />
      <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 1.5" />
      <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 1.5" />
      <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 1.5" />
      <line x1="15" y1="3" x2="15" y2="21" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 1.5" />
      <rect x="10" y="10" width="4" height="4" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

/** Checkmark circle — valid */
export function IconValid(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
      <path d="M7.5 12l3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Lightbulb — innovator */
export function IconLightbulb(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <path d="M9 21h6M12 3a6 6 0 0 0-4 10.5V16h8v-2.5A6 6 0 0 0 12 3z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" strokeLinejoin="round" strokeLinecap="round" />
      <line x1="9" y1="18" x2="15" y2="18" stroke="currentColor" strokeWidth="1.2" />
      {/* Rays */}
      <line x1="12" y1="1" x2="12" y2="0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="4.22" y1="4.22" x2="3.5" y2="3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="19.78" y1="4.22" x2="20.5" y2="3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

/** Chest / box — collection */
export function IconChest(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <path d="M3 11h18v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.12" />
      <path d="M3 11V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" />
      <line x1="12" y1="11" x2="12" y2="13.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/** Book stack — archivista */
export function IconBooks(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <rect x="4" y="3" width="5" height="18" rx="1" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.15" transform="rotate(-5 6 12)" />
      <rect x="9" y="2" width="5" height="18" rx="1" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.1" />
      <rect x="15" y="4" width="5" height="18" rx="1" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.15" transform="rotate(5 17 13)" />
    </svg>
  )
}

/** Filing cabinet — curador */
export function IconArchive(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <rect x="3" y="3" width="18" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
      <rect x="3" y="11" width="18" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
      <line x1="10" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="5" y="19" width="14" height="2" rx="0.5" fill="currentColor" fillOpacity="0.15" />
    </svg>
  )
}

/** Glowing star — enciclopedista */
export function IconGlowingStar(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <path d="M12 2l2.5 5 5.5 0.8-4 3.9 0.9 5.3L12 14.3 7.1 17l0.9-5.3-4-3.9 5.5-0.8L12 2z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.25" strokeLinejoin="round" />
      {/* Rays */}
      <line x1="12" y1="0" x2="12" y2="1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="22" y1="9" x2="23" y2="9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="1" y1="9" x2="2" y2="9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="19" y1="19" x2="20" y2="20" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="4" y1="19" x2="3" y2="20" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

/** Heart — favorites / bibliófilo */
export function IconHeart(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.2" />
    </svg>
  )
}

/** New moon — iniciado */
export function IconNewMoon(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
      <path d="M12 3a9 9 0 0 0 0 18" fill="currentColor" fillOpacity="0.4" />
    </svg>
  )
}

/** Lock / key — passkey */
export function IconPasskey(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" />
      <line x1="12" y1="17.5" x2="12" y2="19" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/** Theater masks — diversificado */
export function IconMasks(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <path d="M4 5c0 0 2-1 5-1s5 1 5 1v8c0 2-2 4-5 4s-5-2-5-4V5z" stroke="currentColor" strokeWidth="1.3" fill="currentColor" fillOpacity="0.15" />
      <circle cx="7" cy="9" r="1" fill="currentColor" />
      <circle cx="11" cy="9" r="1" fill="currentColor" />
      <path d="M7 12c0 0 1 1.5 2 1.5s2-1.5 2-1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      {/* Second mask offset */}
      <path d="M14 8c0 0 2-1 4.5-1s4.5 1 4.5 1v6c0 1.5-1.8 3-4.5 3s-4.5-1.5-4.5-3V8z" stroke="currentColor" strokeWidth="1.3" fill="currentColor" fillOpacity="0.1" />
      <circle cx="17" cy="11" r="0.8" fill="currentColor" />
      <circle cx="20" cy="11" r="0.8" fill="currentColor" />
      <path d="M17 14c0 0 0.7-1 1.5-1s1.5 1 1.5 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

/** Infinity — completo */
export function IconInfinity(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <path d="M18.178 8c5.096 0 5.096 8 0 8-2.548 0-4.25-2-6.178-4-1.928 2-3.63 4-6.178 4-5.096 0-5.096-8 0-8 2.548 0 4.25 2 6.178 4 1.928-2 3.63-4 6.178-4z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** Dark lord helm — maestro oscuro */
export function IconDarkLord(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <path d="M5 10L12 3l7 7v4c0 4-3 7-7 7s-7-3-7-7v-4z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" strokeLinejoin="round" />
      {/* Visor */}
      <path d="M7 12h10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 12l2 2h4l2-2" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="currentColor" fillOpacity="0.3" />
      {/* Eyes */}
      <path d="M9 10l1.5-1 1.5 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M12 10l1.5-1 1.5 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      {/* Vent lines */}
      <line x1="10" y1="16" x2="14" y2="16" stroke="currentColor" strokeWidth="0.8" />
      <line x1="10.5" y1="18" x2="13.5" y2="18" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  )
}

// ─── RANK ICONS ─────────────────────────────────────────────────

/** Youngling — small figure */
export function IconYoungling(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <circle cx="12" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
      <path d="M8 22v-5a4 4 0 0 1 8 0v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="currentColor" fillOpacity="0.1" />
      {/* Training saber */}
      <line x1="17" y1="10" x2="20" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** Lightsaber — padawan/jedi symbol */
export function IconLightsaber(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <line x1="12" y1="2" x2="12" y2="14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="10" y="14" width="4" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.3" />
      <rect x="10.5" y="17" width="3" height="5" rx="0.5" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.2" />
      <circle cx="12" cy="15.5" r="0.6" fill="currentColor" />
      {/* Glow */}
      <line x1="12" y1="2" x2="12" y2="14" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.15" />
    </svg>
  )
}

/** Jedi Order symbol */
export function IconJediOrder(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      {/* Wings */}
      <path d="M12 2C8 4 4 8 4 14c0 2 0.8 4 2 5.5l2-3c-0.6-1-1-2.3-1-3.5 0-3 2-6.5 5-8" stroke="currentColor" strokeWidth="1.3" fill="currentColor" fillOpacity="0.1" />
      <path d="M12 2C16 4 20 8 20 14c0 2-0.8 4-2 5.5l-2-3c0.6-1 1-2.3 1-3.5 0-3-2-6.5-5-8" stroke="currentColor" strokeWidth="1.3" fill="currentColor" fillOpacity="0.1" />
      {/* Center saber */}
      <line x1="12" y1="5" x2="12" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Star at top */}
      <circle cx="12" cy="4" r="1.5" fill="currentColor" />
    </svg>
  )
}

/** Council seat — Miembro del Consejo */
export function IconCouncil(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      {/* Chair back */}
      <path d="M6 4c0 0 3-1.5 6-1.5s6 1.5 6 1.5v10H6V4z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.12" strokeLinejoin="round" />
      {/* Seat */}
      <rect x="4" y="14" width="16" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
      {/* Legs */}
      <line x1="6" y1="17" x2="5" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="17" x2="19" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Emblem */}
      <circle cx="12" cy="8" r="2" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.2" />
    </svg>
  )
}

/** Grand Master — dual lightsabers with aura */
export function IconGrandMaster(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      {/* Aura */}
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" fill="currentColor" fillOpacity="0.05" />
      {/* Left saber */}
      <line x1="7" y1="3" x2="7" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="5.5" y="15" width="3" height="2" rx="0.5" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="0.8" />
      <rect x="6" y="17" width="2" height="4" rx="0.3" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="0.6" />
      {/* Right saber */}
      <line x1="17" y1="3" x2="17" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="15.5" y="15" width="3" height="2" rx="0.5" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="0.8" />
      <rect x="16" y="17" width="2" height="4" rx="0.3" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="0.6" />
      {/* Center star */}
      <path d="M12 7l1.2 2.4 2.6.4-1.9 1.8.45 2.6L12 12.8l-2.35 1.4.45-2.6-1.9-1.8 2.6-.4L12 7z" fill="currentColor" />
    </svg>
  )
}

// ─── UI ICONS ───────────────────────────────────────────────────

/** XP bolt */
export function IconXp(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <polygon points="13,2 3,14 11,14 10,22 21,10 13,10" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity="0.2" />
    </svg>
  )
}

/** Lock icon — locked achievement */
export function IconLocked(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" />
    </svg>
  )
}

/** Holocron — knowledge cube */
export function IconHolocron(props: IconProps) {
  const p = defaults(props)
  return (
    <svg {...p}>
      {/* Diamond/cube shape */}
      <path d="M12 2L22 12L12 22L2 12Z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" strokeLinejoin="round" />
      <path d="M12 7L17 12L12 17L7 12Z" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.15" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

// ─── ICON MAP ────────────────────────────────────────────────────

/**
 * Maps icon keys to components for easy lookup
 * Usage: const Icon = SWU_ICON_MAP['vigilance']; <Icon size={20} />
 */
export const SWU_ICON_MAP: Record<string, React.ComponentType<IconProps>> = {
  // Aspects
  vigilance: IconVigilance,
  command: IconCommand,
  aggression: IconAggression,
  cunning: IconCunning,
  heroism: IconHeroism,
  villainy: IconVillainy,

  // Achievement icons
  sentinel: IconSentinel,
  fortress: IconFortress,
  calendar: IconCalendar,
  strategy: IconStrategy,
  medal: IconMedal,
  star: IconStar,
  crown: IconCrown,
  blade: IconBlade,
  dual_blades: IconDualBlades,
  skull: IconSkull,
  trophy: IconTrophy,
  draft: IconDraft,
  wrench: IconWrench,
  blueprint: IconBlueprint,
  valid: IconValid,
  lightbulb: IconLightbulb,
  chest: IconChest,
  books: IconBooks,
  archive: IconArchive,
  glowing_star: IconGlowingStar,
  heart: IconHeart,
  new_moon: IconNewMoon,
  passkey: IconPasskey,
  masks: IconMasks,
  infinity: IconInfinity,
  dark_lord: IconDarkLord,

  // Ranks
  youngling: IconYoungling,
  lightsaber: IconLightsaber,
  jedi_order: IconJediOrder,
  council: IconCouncil,
  grand_master: IconGrandMaster,

  // UI
  xp: IconXp,
  locked: IconLocked,
  holocron: IconHolocron,
}

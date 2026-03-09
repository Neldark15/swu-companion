/**
 * GiftIcon — Custom Star Wars themed SVG icons for the Espionaje gift system.
 * Replaces generic emoji with handcrafted icons.
 */
import type { GiftType } from '../../services/giftService'

interface GiftIconProps {
  type: GiftType
  size?: number
  className?: string
}

/** Jedi holocron book — radiating Force knowledge */
function LeccionJediIcon({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      {/* Glow */}
      <defs>
        <radialGradient id="jedi-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="jedi-book" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="20" fill="url(#jedi-glow)" />
      {/* Open book */}
      <path d="M12 14v20c0 1 1 2 2 2h8c1 0 2-1 2-1s1 1 2 1h8c1 0 2-1 2-2V14c0-1-1-2-2-2h-8c-1 0-2 .5-2 .5S23 12 22 12h-8c-1 0-2 1-2 2z" fill="#1e3a5f" stroke="url(#jedi-book)" strokeWidth="1.5" />
      {/* Center spine */}
      <line x1="24" y1="12.5" x2="24" y2="36" stroke="#60a5fa" strokeWidth="1" opacity="0.6" />
      {/* Jedi Order symbol (simplified) */}
      <path d="M24 18l-2 4 2 3 2-3-2-4z" fill="#93c5fd" opacity="0.9" />
      <circle cx="24" cy="28" r="1.5" fill="#93c5fd" opacity="0.7" />
      {/* Force sparkles */}
      <circle cx="18" cy="20" r="0.8" fill="#bfdbfe">
        <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="30" cy="22" r="0.6" fill="#bfdbfe">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="20" cy="30" r="0.5" fill="#bfdbfe">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

/** Imperial credit chip — gold/silver coin with Empire gear symbol */
function CreditosImperialesIcon({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id="credit-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fcd34d" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="credit-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <radialGradient id="credit-shine" cx="35%" cy="35%" r="50%">
          <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Coin body */}
      <ellipse cx="24" cy="25" rx="14" ry="13" fill="url(#credit-rim)" />
      <ellipse cx="24" cy="24" rx="14" ry="13" fill="url(#credit-face)" />
      <ellipse cx="24" cy="24" rx="14" ry="13" fill="url(#credit-shine)" />
      {/* Inner ring */}
      <ellipse cx="24" cy="24" rx="10.5" ry="9.5" fill="none" stroke="#92400e" strokeWidth="0.8" opacity="0.5" />
      {/* Imperial Cog (simplified 6-spoke gear) */}
      <circle cx="24" cy="24" r="3" fill="#92400e" opacity="0.6" />
      <circle cx="24" cy="24" r="1.5" fill="#fcd34d" />
      {[0, 60, 120, 180, 240, 300].map((angle, i) => {
        const rad = (angle * Math.PI) / 180
        const x1 = 24 + Math.cos(rad) * 3.5
        const y1 = 24 + Math.sin(rad) * 3.5
        const x2 = 24 + Math.cos(rad) * 7
        const y2 = 24 + Math.sin(rad) * 7
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#92400e" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      })}
      {/* Sparkle */}
      <circle cx="19" cy="19" r="1" fill="#fef9c3" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

/** Beskar ingot — sleek mandalorian metal bar */
function BeskarIcon({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id="beskar-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="30%" stopColor="#94a3b8" />
          <stop offset="60%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
        <linearGradient id="beskar-shine" x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#f1f5f9" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#94a3b8" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="beskar-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#67e8f9" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="18" fill="url(#beskar-glow)" />
      {/* Ingot shape — trapezoidal bar */}
      <path d="M14 18l4-4h12l4 4v12l-4 4H18l-4-4V18z" fill="url(#beskar-metal)" stroke="#475569" strokeWidth="1" />
      <path d="M14 18l4-4h12l4 4v12l-4 4H18l-4-4V18z" fill="url(#beskar-shine)" />
      {/* Mythosaur skull (simplified — T-visor shape) */}
      <path d="M20 22h8v2h-2l-2 3-2-3h-2v-2z" fill="#334155" opacity="0.7" />
      <circle cx="22" cy="21" r="0.8" fill="#334155" opacity="0.5" />
      <circle cx="26" cy="21" r="0.8" fill="#334155" opacity="0.5" />
      {/* Edge highlight */}
      <line x1="15" y1="19" x2="18" y2="15" stroke="#f1f5f9" strokeWidth="0.8" opacity="0.6" />
      {/* Shimmer */}
      <rect x="20" y="16" width="6" height="1" rx="0.5" fill="#f8fafc" opacity="0.5">
        <animate attributeName="opacity" values="0.5;0.1;0.5" dur="3s" repeatCount="indefinite" />
      </rect>
    </svg>
  )
}

/** Holocron — glowing cube/pyramid device */
function HolocronIcon({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <radialGradient id="holo-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="holo-face1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <linearGradient id="holo-face2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6d28d9" />
          <stop offset="100%" stopColor="#3b0764" />
        </linearGradient>
        <linearGradient id="holo-top" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="20" fill="url(#holo-glow)">
        <animate attributeName="r" values="18;20;18" dur="3s" repeatCount="indefinite" />
      </circle>
      {/* Cube — isometric */}
      {/* Top face */}
      <polygon points="24,12 36,19 24,26 12,19" fill="url(#holo-top)" opacity="0.9" />
      {/* Left face */}
      <polygon points="12,19 24,26 24,38 12,31" fill="url(#holo-face1)" opacity="0.85" />
      {/* Right face */}
      <polygon points="36,19 24,26 24,38 36,31" fill="url(#holo-face2)" opacity="0.85" />
      {/* Glowing core symbol */}
      <circle cx="24" cy="25" r="3" fill="#c084fc" opacity="0.7">
        <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="24" cy="25" r="1.5" fill="#e9d5ff">
        <animate attributeName="r" values="1.5;2;1.5" dur="2s" repeatCount="indefinite" />
      </circle>
      {/* Edge highlights */}
      <line x1="24" y1="12" x2="36" y2="19" stroke="#c4b5fd" strokeWidth="0.5" opacity="0.6" />
      <line x1="24" y1="12" x2="12" y2="19" stroke="#c4b5fd" strokeWidth="0.5" opacity="0.6" />
      <line x1="24" y1="26" x2="24" y2="38" stroke="#7c3aed" strokeWidth="0.5" opacity="0.4" />
    </svg>
  )
}

/** Kyber Crystal — angular glowing shard */
function CristalKyberIcon({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <radialGradient id="kyber-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="kyber-left" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="kyber-right" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id="kyber-core" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="18" fill="url(#kyber-glow)">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="2.5s" repeatCount="indefinite" />
      </circle>
      {/* Crystal shard — hexagonal prism */}
      {/* Left facet */}
      <polygon points="24,8 18,16 18,32 24,40" fill="url(#kyber-left)" opacity="0.9" />
      {/* Right facet */}
      <polygon points="24,8 30,16 30,32 24,40" fill="url(#kyber-right)" opacity="0.9" />
      {/* Core glow line */}
      <line x1="24" y1="10" x2="24" y2="38" stroke="url(#kyber-core)" strokeWidth="2" opacity="0.7">
        <animate attributeName="opacity" values="0.7;1;0.7" dur="1.8s" repeatCount="indefinite" />
      </line>
      {/* Inner facet highlights */}
      <polygon points="24,12 20,18 20,28 24,34" fill="#bae6fd" opacity="0.15" />
      {/* Top point sparkle */}
      <circle cx="24" cy="9" r="1.5" fill="#e0f2fe">
        <animate attributeName="r" values="1;2;1" dur="2s" repeatCount="indefinite" />
      </circle>
      {/* Side sparkles */}
      <circle cx="19" cy="20" r="0.5" fill="#bae6fd">
        <animate attributeName="opacity" values="1;0.2;1" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="29" cy="26" r="0.6" fill="#bae6fd">
        <animate attributeName="opacity" values="0.2;1;0.2" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

/** Main GiftIcon dispatcher */
export function GiftIcon({ type, size = 32, className }: GiftIconProps) {
  switch (type) {
    case 'leccion_jedi':
      return <LeccionJediIcon size={size} className={className} />
    case 'creditos_imperiales':
      return <CreditosImperialesIcon size={size} className={className} />
    case 'beskar':
      return <BeskarIcon size={size} className={className} />
    case 'holocron':
      return <HolocronIcon size={size} className={className} />
    case 'cristal_kyber':
      return <CristalKyberIcon size={size} className={className} />
    default:
      return <HolocronIcon size={size} className={className} />
  }
}

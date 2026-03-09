/**
 * Official SWU Aspect Icons
 * Uses the real game aspect symbols (.webp)
 * Progress aspect uses a fallback emoji since it's a meta-category
 */

import type { Aspect } from '../../services/gamification'

const ASPECT_IMAGES: Partial<Record<Aspect, string>> = {
  Vigilance: '/icons/aspects/vigilance.webp',
  Command: '/icons/aspects/command.webp',
  Aggression: '/icons/aspects/aggression.webp',
  Cunning: '/icons/aspects/cunning.webp',
  Heroism: '/icons/aspects/heroism.webp',
  Villainy: '/icons/aspects/villainy.webp',
}

const ASPECT_EMOJI: Record<Aspect, string> = {
  Vigilance: '🛡️',
  Command: '⚔️',
  Aggression: '🔥',
  Cunning: '🎯',
  Heroism: '💎',
  Villainy: '🌙',
  Progress: '🌟',
  Transmissions: '📡',
}

interface AspectIconProps {
  aspect: Aspect
  size?: number
  className?: string
}

export function AspectIcon({ aspect, size = 24, className = '' }: AspectIconProps) {
  const src = ASPECT_IMAGES[aspect]
  if (src) {
    return (
      <img
        src={src}
        alt={aspect}
        width={size}
        height={size}
        className={`object-contain ${className}`}
        draggable={false}
      />
    )
  }
  // Fallback for aspects without official images (e.g. Progress)
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.7 }}
      role="img"
      aria-label={aspect}
    >
      {ASPECT_EMOJI[aspect] || '⭐'}
    </span>
  )
}

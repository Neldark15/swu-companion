/**
 * Official SWU Aspect Icons
 * Uses the real game aspect symbols (.webp)
 */

import type { Aspect } from '../../services/gamification'

const ASPECT_IMAGES: Record<Aspect, string> = {
  Vigilance: '/icons/aspects/vigilance.webp',
  Command: '/icons/aspects/command.webp',
  Aggression: '/icons/aspects/aggression.webp',
  Cunning: '/icons/aspects/cunning.webp',
  Heroism: '/icons/aspects/heroism.webp',
  Villainy: '/icons/aspects/villainy.webp',
}

interface AspectIconProps {
  aspect: Aspect
  size?: number
  className?: string
}

export function AspectIcon({ aspect, size = 24, className = '' }: AspectIconProps) {
  const src = ASPECT_IMAGES[aspect]
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

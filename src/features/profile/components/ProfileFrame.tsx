/**
 * ProfileFrame — Animated level-based frame around the user avatar.
 * Each rank tier gets a progressively fancier frame with different colors and effects.
 */

interface ProfileFrameProps {
  level: number
  children: React.ReactNode
  size?: number
}

/** Get frame config based on level */
function getFrameConfig(level: number) {
  if (level <= 3) return {
    // Iniciado — simple thin gray ring
    borderWidth: 2,
    colors: ['#6B7280', '#9CA3AF'],
    glow: 'none',
    animate: false,
    corners: false,
    double: false,
    tier: 0,
  }
  if (level <= 6) return {
    // Cadete — blue ring with subtle glow
    borderWidth: 3,
    colors: ['#3B82F6', '#60A5FA'],
    glow: '0 0 8px rgba(59,130,246,0.4)',
    animate: false,
    corners: false,
    double: false,
    tier: 1,
  }
  if (level <= 10) return {
    // Estratega — green ring with glow + pulse
    borderWidth: 3,
    colors: ['#22C55E', '#4ADE80'],
    glow: '0 0 12px rgba(34,197,94,0.5)',
    animate: true,
    corners: false,
    double: false,
    tier: 2,
  }
  if (level <= 15) return {
    // Comandante — gold double ring with corners
    borderWidth: 3,
    colors: ['#EAB308', '#FACC15', '#F59E0B'],
    glow: '0 0 16px rgba(234,179,8,0.5)',
    animate: true,
    corners: true,
    double: true,
    tier: 3,
  }
  if (level <= 20) return {
    // Guardián Kyber — amber with rotating gradient + sparks
    borderWidth: 4,
    colors: ['#F59E0B', '#D97706', '#FBBF24'],
    glow: '0 0 20px rgba(245,158,11,0.6), 0 0 40px rgba(245,158,11,0.2)',
    animate: true,
    corners: true,
    double: true,
    tier: 4,
  }
  if (level <= 25) return {
    // Maestro del Holocrón — bright gold with complex border
    borderWidth: 4,
    colors: ['#FCD34D', '#F59E0B', '#EF4444', '#FCD34D'],
    glow: '0 0 24px rgba(252,211,77,0.6), 0 0 48px rgba(252,211,77,0.2)',
    animate: true,
    corners: true,
    double: true,
    tier: 5,
  }
  // Gran Maestro Galáctico — legendary rainbow shimmer
  return {
    borderWidth: 4,
    colors: ['#FDE047', '#F97316', '#EF4444', '#A855F7', '#3B82F6', '#22C55E', '#FDE047'],
    glow: '0 0 30px rgba(253,224,71,0.5), 0 0 60px rgba(168,85,247,0.3)',
    animate: true,
    corners: true,
    double: true,
    tier: 6,
  }
}

export function ProfileFrame({ level, children, size = 80 }: ProfileFrameProps) {
  const config = getFrameConfig(level)
  const outerSize = size + config.borderWidth * 2 + (config.double ? 8 : 4)
  const gradientId = `frame-grad-${level}`
  const animDuration = config.tier >= 6 ? '3s' : config.tier >= 4 ? '4s' : '6s'

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: outerSize, height: outerSize }}
    >
      {/* SVG Frame */}
      <svg
        className="absolute inset-0"
        viewBox={`0 0 ${outerSize} ${outerSize}`}
        fill="none"
        style={{ filter: config.glow !== 'none' ? `drop-shadow(${config.glow.split(',')[0]})` : undefined }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {config.colors.map((c, i) => (
              <stop key={i} offset={`${(i / (config.colors.length - 1)) * 100}%`} stopColor={c}>
                {config.animate && (
                  <animate
                    attributeName="stop-color"
                    values={`${c};${config.colors[(i + 1) % config.colors.length]};${c}`}
                    dur={animDuration}
                    repeatCount="indefinite"
                  />
                )}
              </stop>
            ))}
          </linearGradient>
        </defs>

        {/* Outer ring (double border) */}
        {config.double && (
          <circle
            cx={outerSize / 2}
            cy={outerSize / 2}
            r={outerSize / 2 - 1}
            stroke={`url(#${gradientId})`}
            strokeWidth={1.5}
            opacity={0.5}
          />
        )}

        {/* Main ring */}
        <circle
          cx={outerSize / 2}
          cy={outerSize / 2}
          r={outerSize / 2 - (config.double ? 5 : 2)}
          stroke={`url(#${gradientId})`}
          strokeWidth={config.borderWidth}
        >
          {config.animate && config.tier >= 4 && (
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to={`${Math.PI * outerSize}`}
              dur="20s"
              repeatCount="indefinite"
            />
          )}
        </circle>

        {/* Corner accents */}
        {config.corners && (
          <>
            {[0, 90, 180, 270].map((angle) => {
              const rad = (angle * Math.PI) / 180
              const cx = outerSize / 2 + (outerSize / 2 - 2) * Math.cos(rad)
              const cy = outerSize / 2 + (outerSize / 2 - 2) * Math.sin(rad)
              return (
                <circle
                  key={angle}
                  cx={cx}
                  cy={cy}
                  r={config.tier >= 5 ? 3 : 2}
                  fill={config.colors[0]}
                  opacity={0.9}
                >
                  {config.animate && (
                    <animate
                      attributeName="opacity"
                      values="0.4;1;0.4"
                      dur="2s"
                      begin={`${angle / 360}s`}
                      repeatCount="indefinite"
                    />
                  )}
                </circle>
              )
            })}
          </>
        )}
      </svg>

      {/* Avatar content */}
      <div
        className="relative rounded-full overflow-hidden bg-swu-bg z-10"
        style={{ width: size, height: size }}
      >
        {children}
      </div>

      {/* Pulse animation for high tiers */}
      {config.animate && config.tier >= 2 && (
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-10"
          style={{
            border: `2px solid ${config.colors[0]}`,
            animationDuration: '3s',
          }}
        />
      )}
    </div>
  )
}

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'accent' | 'amber' | 'red' | 'green' | 'purple'
  className?: string
}

const variants = {
  default: 'bg-swu-accent/15 text-swu-accent',
  accent: 'bg-swu-accent/15 text-swu-accent',
  amber: 'bg-swu-amber/15 text-swu-amber',
  red: 'bg-swu-red/15 text-swu-red',
  green: 'bg-swu-green/15 text-swu-green',
  purple: 'bg-purple-500/15 text-purple-400',
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}

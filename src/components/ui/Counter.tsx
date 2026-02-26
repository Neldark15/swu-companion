import { Minus, Plus } from 'lucide-react'

interface CounterProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  label?: string
  size?: 'sm' | 'md' | 'lg'
  color?: string
}

const sizeClasses = {
  sm: { btn: 'w-8 h-8', text: 'text-lg', label: 'text-[10px]' },
  md: { btn: 'w-12 h-12', text: 'text-2xl', label: 'text-xs' },
  lg: { btn: 'w-16 h-16', text: 'text-5xl', label: 'text-sm' },
}

export function Counter({ value, onChange, min = 0, max = 999, label, size = 'md', color }: CounterProps) {
  const s = sizeClasses[size]
  const colorStyle = color ? { color } : {}

  const decrement = () => {
    if (value > min) onChange(value - 1)
  }

  const increment = () => {
    if (value < max) onChange(value + 1)
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {label && <span className={`${s.label} text-swu-muted font-medium`}>{label}</span>}
      <div className="flex items-center gap-2">
        <button
          onClick={decrement}
          onContextMenu={(e) => { e.preventDefault(); onChange(Math.max(min, value - 5)) }}
          className={`${s.btn} flex items-center justify-center rounded-xl bg-swu-red/10 border border-swu-red/30 text-swu-red active:scale-95 transition-transform`}
        >
          <Minus size={size === 'lg' ? 24 : size === 'md' ? 20 : 16} />
        </button>
        <span className={`${s.text} font-extrabold font-mono min-w-[2ch] text-center tabular-nums`} style={colorStyle}>
          {value}
        </span>
        <button
          onClick={increment}
          onContextMenu={(e) => { e.preventDefault(); onChange(Math.min(max, value + 5)) }}
          className={`${s.btn} flex items-center justify-center rounded-xl bg-swu-green/10 border border-swu-green/30 text-swu-green active:scale-95 transition-transform`}
        >
          <Plus size={size === 'lg' ? 24 : size === 'md' ? 20 : 16} />
        </button>
      </div>
    </div>
  )
}

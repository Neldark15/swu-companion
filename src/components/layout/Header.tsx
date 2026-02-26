import { useState, useRef, useEffect } from 'react'
import { Settings, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const menuItems = [
  { label: 'Configuración', path: '/settings' },
  { label: 'Exportar / Importar', path: '/settings/export' },
  { label: 'Feedback', path: '/settings/feedback' },
  { label: 'Legal / Privacidad', path: '/settings/legal' },
]

export function Header() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <header className="sticky top-0 z-50 bg-swu-surface border-b border-swu-border px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-lg font-extrabold text-swu-amber tracking-tight">SWU</span>
        <span className="text-base font-semibold text-swu-text">Companion</span>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen(!open)}
          className="p-1.5 rounded-lg text-swu-muted hover:text-swu-text hover:bg-swu-surface-hover transition-colors"
          aria-label="Settings"
        >
          {open ? <X size={22} /> : <Settings size={22} />}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-swu-surface border border-swu-border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setOpen(false) }}
                className="w-full text-left px-4 py-3 text-sm font-medium text-swu-text hover:bg-swu-surface-hover transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}

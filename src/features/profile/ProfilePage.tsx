import { ChevronRight, History, Store, Heart, Star, Inbox } from 'lucide-react'

const stats = [
  { n: '12', label: 'Partidas' },
  { n: '3', label: 'Torneos' },
  { n: '5', label: 'Decks' },
]

const menuItems = [
  { icon: History, label: 'Historial de Eventos', desc: 'Ver todos los torneos jugados' },
  { icon: Store, label: 'Tiendas Favoritas', desc: 'Tiendas guardadas' },
  { icon: Heart, label: 'Mi Colección', desc: '42 cartas registradas' },
  { icon: Star, label: 'Wishlist', desc: '8 cartas deseadas' },
  { icon: Inbox, label: 'Inbox', desc: '2 mensajes nuevos' },
]

export function ProfilePage() {
  return (
    <div className="p-4 space-y-6">
      {/* Avatar + Name */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-swu-accent to-swu-amber flex items-center justify-center text-2xl font-bold text-white">
          N
        </div>
        <div>
          <h2 className="text-xl font-bold text-swu-text">Nel</h2>
          <p className="text-sm text-swu-muted">Jugador desde Feb 2026</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-swu-surface rounded-xl p-3.5 text-center border border-swu-border">
            <p className="text-3xl font-extrabold text-swu-accent font-mono">{s.n}</p>
            <p className="text-[11px] text-swu-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Menu */}
      <div className="space-y-1.5">
        {menuItems.map((m) => {
          const Icon = m.icon
          return (
            <button key={m.label} className="w-full bg-swu-surface rounded-xl p-3.5 border border-swu-border flex items-center justify-between active:bg-swu-surface-hover transition-colors">
              <div className="flex items-center gap-3">
                <Icon size={20} className="text-swu-muted" />
                <div className="text-left">
                  <p className="font-semibold text-sm text-swu-text">{m.label}</p>
                  <p className="text-xs text-swu-muted">{m.desc}</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-swu-muted" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'

const sampleCards = [
  { name: 'Luke Skywalker', subtitle: 'Faithful Friend', type: 'Leader' as const, cost: 6, power: 4, hp: 7, rarity: 'Legendary' as const, aspects: ['Heroism', 'Vigilance'], set: 'SOR', arena: 'Ground' },
  { name: 'Darth Vader', subtitle: 'Dark Lord of the Sith', type: 'Leader' as const, cost: 7, power: 5, hp: 8, rarity: 'Legendary' as const, aspects: ['Villainy', 'Aggression'], set: 'SOR', arena: 'Ground' },
  { name: 'Millennium Falcon', subtitle: 'Piece of Junk', type: 'Unit' as const, cost: 5, power: 3, hp: 6, rarity: 'Rare' as const, aspects: ['Heroism', 'Cunning'], set: 'SOR', arena: 'Space' },
  { name: 'Force Throw', subtitle: null, type: 'Event' as const, cost: 2, power: null, hp: null, rarity: 'Uncommon' as const, aspects: ['Aggression'], set: 'SOR', arena: null },
  { name: 'Resilient', subtitle: null, type: 'Upgrade' as const, cost: 1, power: null, hp: null, rarity: 'Common' as const, aspects: ['Vigilance'], set: 'SOR', arena: null },
  { name: 'Admiral Ackbar', subtitle: 'Brilliant Strategist', type: 'Unit' as const, cost: 4, power: 2, hp: 4, rarity: 'Rare' as const, aspects: ['Command', 'Heroism'], set: 'SOR', arena: 'Ground' },
]

const typeVariant: Record<string, 'amber' | 'accent' | 'green' | 'purple' | 'default'> = {
  Leader: 'amber', Unit: 'accent', Event: 'green', Upgrade: 'purple', Base: 'default',
}
const rarityVariant: Record<string, 'default' | 'green' | 'accent' | 'amber' | 'purple'> = {
  Common: 'default', Uncommon: 'green', Rare: 'accent', Legendary: 'amber', Special: 'purple',
}

const filterTypes = ['Leader', 'Base', 'Unit', 'Event', 'Upgrade']
const filterAspects = ['Vigilance', 'Command', 'Aggression', 'Cunning', 'Heroism', 'Villainy']

export function CardsPage() {
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = sampleCards.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.subtitle && c.subtitle.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="p-4 space-y-3">
      {/* Search */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cartas..."
            className="w-full bg-swu-surface border border-swu-border rounded-xl py-3 pl-10 pr-3 text-sm text-swu-text outline-none focus:border-swu-accent transition-colors"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 rounded-xl border text-sm font-semibold transition-colors ${
            showFilters ? 'bg-swu-accent/15 border-swu-accent text-swu-accent' : 'bg-swu-surface border-swu-border text-swu-muted'
          }`}
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-swu-surface rounded-xl p-3 border border-swu-border space-y-3">
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Tipo</p>
            <div className="flex flex-wrap gap-1.5">
              {filterTypes.map((t) => (
                <button key={t} className="bg-swu-bg border border-swu-border rounded-lg px-3 py-1 text-xs font-semibold text-swu-muted hover:text-swu-text transition-colors">
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Aspecto</p>
            <div className="flex flex-wrap gap-1.5">
              {filterAspects.map((a) => (
                <button key={a} className="bg-swu-bg border border-swu-border rounded-lg px-3 py-1 text-xs text-swu-muted hover:text-swu-text transition-colors">
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-swu-muted">{filtered.length} cartas encontradas</p>

      {/* Results */}
      <div className="space-y-1.5">
        {filtered.map((c) => (
          <div key={c.name + c.subtitle} className="bg-swu-surface rounded-xl p-3 border border-swu-border flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-swu-text">{c.name}</span>
                {c.subtitle && <span className="text-xs text-swu-muted">{c.subtitle}</span>}
              </div>
              <div className="flex gap-1.5 mt-1.5">
                <Badge variant={typeVariant[c.type]}>{c.type}</Badge>
                <Badge variant={rarityVariant[c.rarity]}>{c.rarity}</Badge>
                {c.arena && <Badge>{c.arena}</Badge>}
              </div>
            </div>
            <div className="text-right">
              {c.cost !== null && <p className="text-xl font-extrabold text-swu-amber font-mono">{c.cost}</p>}
              {c.power !== null && c.hp !== null && <p className="text-xs text-swu-muted">{c.power}/{c.hp}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

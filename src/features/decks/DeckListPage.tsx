import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, BookOpen, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { db } from '../../services/db'
import type { Deck } from '../../types'

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `Hace ${days}d`
}

function countCards(cards: { quantity: number }[]): number {
  return cards.reduce((s, c) => s + c.quantity, 0)
}

const formatLabels: Record<string, string> = {
  premier: 'Premier',
  twin_suns: 'Twin Suns',
  sealed: 'Sealed',
  draft: 'Draft',
  limited: 'Limited',
}

export function DeckListPage() {
  const navigate = useNavigate()
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.decks.orderBy('updatedAt').reverse().toArray().then((d) => {
      setDecks(d)
      setLoading(false)
    })
  }, [])

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este deck?')) {
      await db.decks.delete(id)
      setDecks((prev) => prev.filter((d) => d.id !== id))
    }
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-swu-text">Mis Decks</h2>
        <button
          onClick={() => navigate('/decks/new')}
          className="px-4 py-2 rounded-xl bg-swu-accent text-white font-bold text-sm flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-pulse text-swu-muted">Cargando...</div>
        </div>
      ) : decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-swu-muted gap-3">
          <BookOpen size={40} className="opacity-40" />
          <p className="text-sm">No tiene decks aún</p>
          <button
            onClick={() => navigate('/decks/new')}
            className="px-5 py-2.5 rounded-xl bg-swu-accent text-white font-bold text-sm"
          >
            Crear Primer Deck
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {decks.map((deck) => {
            const mainCount = countCards(deck.mainDeck)
            const sideCount = countCards(deck.sideboard)
            const leaderName = deck.leaders[0]?.name || 'Sin leader'
            const baseName = deck.base?.name || 'Sin base'

            return (
              <div key={deck.id} className="bg-swu-surface rounded-xl border border-swu-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-swu-text">{deck.name}</span>
                    <Badge variant="accent">{formatLabels[deck.format] || deck.format}</Badge>
                  </div>
                  {deck.isValid ? (
                    <CheckCircle2 size={16} className="text-swu-green" />
                  ) : (
                    <AlertTriangle size={16} className="text-swu-amber" />
                  )}
                </div>

                <p className="text-[10px] text-swu-muted">
                  {leaderName} · {baseName} · {mainCount}/50 mazo · {sideCount} side · {timeAgo(deck.updatedAt)}
                </p>

                {deck.validationErrors.length > 0 && (
                  <p className="text-[10px] text-swu-amber">{deck.validationErrors[0]}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/decks/${deck.id}`)}
                    className="flex-1 py-2 rounded-lg bg-swu-accent/20 border border-swu-accent/40 text-swu-accent text-xs font-bold active:scale-95 transition-transform"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(deck.id)}
                    className="py-2 px-4 rounded-lg bg-swu-red/10 border border-swu-red/30 text-swu-red text-xs font-bold active:scale-95 transition-transform"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

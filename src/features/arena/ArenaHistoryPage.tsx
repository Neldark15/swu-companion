import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Search, X, Trash2, Loader2, ScrollText } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { getMyMatchLogs, deleteMatchLog } from '../../services/arenaService'
import { useAuth } from '../../hooks/useAuth'
import type { MatchLog, GameMode } from '../../types'

const PAGE_SIZE = 20

export function ArenaHistoryPage() {
  const navigate = useNavigate()
  const { currentProfile } = useAuth()

  const [logs, setLogs] = useState<MatchLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Filters
  const [filterMode, setFilterMode] = useState<GameMode | null>(null)
  const [filterResult, setFilterResult] = useState<'win' | 'loss' | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchLogs = useCallback(
    async (reset = true) => {
      if (reset) setLoading(true)
      else setLoadingMore(true)

      const { logs: fetched, total: t } = await getMyMatchLogs(
        PAGE_SIZE,
        reset ? 0 : logs.length,
        {
          mode: filterMode || undefined,
          result: filterResult || undefined,
          search: searchQuery || undefined,
        },
      )

      if (reset) setLogs(fetched)
      else setLogs((prev) => [...prev, ...fetched])
      setTotal(t)
      setLoading(false)
      setLoadingMore(false)
    },
    [filterMode, filterResult, searchQuery, logs.length],
  )

  useEffect(() => {
    fetchLogs(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMode, filterResult, searchQuery])

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro de combate?')) return
    await deleteMatchLog(id, currentProfile?.id)
    setLogs((prev) => prev.filter((l) => l.id !== id))
    setTotal((prev) => prev - 1)
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `Hace ${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `Hace ${hrs}h`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `Hace ${days}d`
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="p-4 lg:p-6 pb-8 lg:pb-8 max-w-5xl mx-auto space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/arena')} className="text-swu-muted">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2 className="text-lg font-extrabold text-swu-text">Archivo de Combate</h2>
          <p className="text-[10px] text-swu-muted font-mono tracking-wider">MI HISTORIAL</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por oponente o deck..."
          className="w-full bg-swu-surface border border-swu-border rounded-xl py-2.5 pl-10 pr-9 text-sm text-swu-text outline-none focus:border-swu-accent"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-swu-muted">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterMode(filterMode === 'premier' ? null : 'premier')}
          className={`rounded-lg px-3 py-1 text-xs font-semibold border transition-colors ${
            filterMode === 'premier' ? 'bg-swu-amber/20 border-swu-amber text-swu-amber' : 'bg-swu-surface border-swu-border text-swu-muted'
          }`}
        >
          Premier
        </button>
        <button
          onClick={() => setFilterMode(filterMode === 'twin_suns' ? null : 'twin_suns')}
          className={`rounded-lg px-3 py-1 text-xs font-semibold border transition-colors ${
            filterMode === 'twin_suns' ? 'bg-swu-amber/20 border-swu-amber text-swu-amber' : 'bg-swu-surface border-swu-border text-swu-muted'
          }`}
        >
          Twin Suns
        </button>
        <div className="w-px bg-swu-border" />
        <button
          onClick={() => setFilterResult(filterResult === 'win' ? null : 'win')}
          className={`rounded-lg px-3 py-1 text-xs font-semibold border transition-colors ${
            filterResult === 'win' ? 'bg-swu-green/20 border-swu-green text-swu-green' : 'bg-swu-surface border-swu-border text-swu-muted'
          }`}
        >
          Victorias
        </button>
        <button
          onClick={() => setFilterResult(filterResult === 'loss' ? null : 'loss')}
          className={`rounded-lg px-3 py-1 text-xs font-semibold border transition-colors ${
            filterResult === 'loss' ? 'bg-swu-red/20 border-swu-red text-swu-red' : 'bg-swu-surface border-swu-border text-swu-muted'
          }`}
        >
          Derrotas
        </button>
      </div>

      {!loading && <p className="text-xs text-swu-muted">{total} combates registrados</p>}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={28} className="text-swu-accent animate-spin" />
        </div>
      )}

      {/* Match List */}
      {!loading && (
        <div className="space-y-1.5 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
          {logs.map((log) => {
            const isWin = log.winnerPlayer === 1
            const expanded = expandedId === log.id

            return (
              <div key={log.id} className="bg-swu-surface rounded-xl border border-swu-border overflow-hidden">
                <button
                  onClick={() => setExpandedId(expanded ? null : log.id)}
                  className="w-full p-3 flex items-center gap-3 text-left"
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 font-extrabold text-sm ${
                      isWin ? 'bg-swu-green/15 text-swu-green' : 'bg-swu-red/15 text-swu-red'
                    }`}
                  >
                    {isWin ? 'WIN' : 'LOSS'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-swu-text truncate">vs {log.player2Name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-extrabold font-mono text-swu-text">
                        {log.finalScore[0]}-{log.finalScore[1]}
                      </span>
                      <Badge variant={log.gameMode === 'premier' ? 'accent' : 'amber'}>{log.gameMode}</Badge>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-swu-muted">{formatDate(log.recordedAt)}</p>
                    {log.player1DeckName && (
                      <p className="text-[9px] text-swu-muted truncate max-w-[80px]">{log.player1DeckName}</p>
                    )}
                  </div>
                </button>

                {expanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-swu-border/50 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-swu-muted text-[10px]">Mi Deck</p>
                        <p className="text-swu-text font-medium">{log.player1DeckName || '—'}</p>
                      </div>
                      <div>
                        <p className="text-swu-muted text-[10px]">Deck Oponente</p>
                        <p className="text-swu-text font-medium">{log.player2DeckName || '—'}</p>
                      </div>
                    </div>
                    {log.notes && (
                      <p className="text-xs text-swu-muted italic">{log.notes}</p>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(log.id)
                      }}
                      className="flex items-center gap-1 text-[10px] text-swu-red"
                    >
                      <Trash2 size={10} />
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Load More */}
      {!loading && logs.length < total && (
        <button
          onClick={() => fetchLogs(false)}
          disabled={loadingMore}
          className="w-full py-3 rounded-xl bg-swu-surface border border-swu-border text-swu-accent font-bold text-sm flex items-center justify-center gap-2"
        >
          {loadingMore ? <Loader2 size={16} className="animate-spin" /> : `Cargar más (${logs.length}/${total})`}
        </button>
      )}

      {/* Empty State */}
      {!loading && logs.length === 0 && (
        <div className="text-center py-12">
          <ScrollText size={36} className="mx-auto text-swu-muted/40 mb-3" />
          <p className="text-sm text-swu-muted">No se encontraron combates</p>
          <button
            onClick={() => navigate('/arena/log')}
            className="mt-3 px-4 py-2 rounded-lg bg-swu-accent text-white text-sm font-bold"
          >
            Registrar Combate
          </button>
        </div>
      )}
    </div>
  )
}

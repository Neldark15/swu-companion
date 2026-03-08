import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Radio, Loader2, WifiOff } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { getPublicMatchFeed } from '../../services/arenaService'
import type { MatchLog } from '../../types'

export function ArenaFeedPage() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState<MatchLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    getPublicMatchFeed(30)
      .then((data) => {
        setLogs(data)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d`
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="p-4 lg:p-6 pb-24 lg:pb-8 max-w-5xl mx-auto space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/arena')} className="text-swu-muted">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2 className="text-lg font-extrabold text-swu-text">Transmisiones Galácticas</h2>
          <p className="text-[10px] text-swu-muted font-mono tracking-wider">FEED PÚBLICO</p>
        </div>
      </div>

      {/* Banner */}
      <div className="bg-swu-surface rounded-xl p-3 border border-swu-border flex items-center gap-2">
        <Radio size={14} className="text-swu-amber animate-pulse" />
        <span className="text-xs text-swu-muted">Partidas recientes de la comunidad SWU</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={28} className="text-swu-accent animate-spin" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-swu-red/10 border border-swu-red/30 rounded-lg px-3 py-3">
          <WifiOff size={14} className="text-swu-red" />
          <span className="text-xs text-swu-red">No se pudo cargar el feed. Verifique su conexión.</span>
        </div>
      )}

      {!loading && !error && logs.length === 0 && (
        <div className="text-center py-12">
          <Radio size={36} className="mx-auto text-swu-muted/40 mb-3" />
          <p className="text-sm text-swu-muted">Sin transmisiones recientes</p>
          <p className="text-xs text-swu-muted mt-1">Las partidas de usuarios públicos aparecerán aquí</p>
        </div>
      )}

      {!loading && (
        <div className="space-y-1.5 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
          {logs.map((log) => (
            <div
              key={log.id}
              className="bg-swu-surface rounded-xl p-3 border border-swu-border"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant={log.gameMode === 'premier' ? 'accent' : 'amber'}>
                    {log.gameMode}
                  </Badge>
                  <span className="text-[10px] text-swu-muted font-mono">{formatDate(log.recordedAt)}</span>
                </div>
                <span className="text-xs font-extrabold font-mono text-swu-text">
                  {log.finalScore[0]}-{log.finalScore[1]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${log.winnerPlayer === 1 ? 'text-swu-green' : 'text-swu-text'}`}>
                    {log.player1Name}
                    {log.winnerPlayer === 1 && <span className="text-[9px] ml-1">★</span>}
                  </p>
                  {log.player1DeckName && (
                    <p className="text-[10px] text-swu-muted truncate">{log.player1DeckName}</p>
                  )}
                </div>
                <span className="text-swu-muted text-xs font-bold">vs</span>
                <div className="flex-1 min-w-0 text-right">
                  <p className={`text-sm font-bold truncate ${log.winnerPlayer === 2 ? 'text-swu-green' : 'text-swu-text'}`}>
                    {log.player2Name}
                    {log.winnerPlayer === 2 && <span className="text-[9px] ml-1">★</span>}
                  </p>
                  {log.player2DeckName && (
                    <p className="text-[10px] text-swu-muted truncate">{log.player2DeckName}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

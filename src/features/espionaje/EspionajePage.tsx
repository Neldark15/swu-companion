import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Users, Eye, Zap, Trophy } from 'lucide-react'
import { searchSpyProfiles } from '../../services/giftService'
import { calculateLevel } from '../../services/gamification'

const swAvatarIds = ['chewbacca','r2d2','c3po','bb8','pilot','boba-fett','stormtrooper','darth-vader','phasma','kylo-ren','jedi-order','phoenix','rebel-alliance','galactic-empire','first-order','first-order-2','starfighter','sith-empire','rebel-alliance-2','jedi-order-2','new-republic','empire-gear','separatist','galactic-republic']

export function EspionajePage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [players, setPlayers] = useState<Array<{
    id: string; name: string; avatar: string; level: number; xp: number; wins: number
  }>>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await searchSpyProfiles(undefined, 50)
        if (!cancelled) setPlayers(data)
      } catch (e) {
        console.warn('[Espionaje] Failed to load profiles:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q)
    setSearching(true)
    try {
      const results = await searchSpyProfiles(q.trim() || undefined, 50)
      setPlayers(results)
    } catch {
      // ignore
    } finally {
      setSearching(false)
    }
  }, [])

  return (
    <div className="min-h-screen bg-swu-bg pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-swu-bg/95 backdrop-blur border-b border-swu-border">
        <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-swu-muted">
            <ArrowLeft size={20} />
          </button>
          <Eye size={20} className="text-indigo-400" />
          <h1 className="text-lg font-bold text-swu-text flex-1">Espionaje</h1>
        </div>
      </div>

      <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 py-4 space-y-4">
        {/* Flavor text */}
        <div className="bg-indigo-500/5 rounded-xl border border-indigo-500/15 p-3">
          <p className="text-xs text-indigo-300/80 font-mono text-center">
            Intercepta transmisiones y envía regalos a otros jugadores de la galaxia
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
          <input
            type="text"
            placeholder="Buscar jugador..."
            value={query}
            onChange={e => handleSearch(e.target.value)}
            className="w-full bg-swu-surface border border-swu-border rounded-xl pl-9 pr-3 py-2.5
                       text-sm text-swu-text placeholder:text-swu-muted focus:border-indigo-400 outline-none"
          />
        </div>

        {/* Section label */}
        <div className="flex items-center gap-2 text-swu-muted">
          <Users size={14} />
          <span className="text-xs font-medium">
            {query.trim() ? `Resultados para "${query}"` : `${players.length} jugadores detectados`}
          </span>
        </div>

        {/* Loading */}
        {(loading || searching) && (
          <div className="text-center py-12 text-swu-muted">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full mx-auto mb-3" />
            Escaneando transmisiones...
          </div>
        )}

        {/* Empty */}
        {!loading && !searching && players.length === 0 && (
          <div className="text-center py-12">
            <Users size={48} className="mx-auto text-swu-muted/30 mb-4" />
            <p className="text-swu-muted text-sm">
              {query.trim()
                ? 'No se detectó ningún jugador con ese nombre'
                : 'No hay jugadores registrados aún'}
            </p>
          </div>
        )}

        {/* Player list */}
        {!loading && !searching && players.length > 0 && (
          <div className="space-y-1.5">
            {players.map(p => {
              const levelInfo = calculateLevel(p.xp)
              return (
                <button
                  key={p.id}
                  onClick={() => navigate(`/espionaje/${p.id}`)}
                  className="w-full bg-swu-surface rounded-xl p-3 border border-swu-border
                             flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-swu-bg flex items-center justify-center
                                  text-lg flex-shrink-0 overflow-hidden">
                    {p.avatar?.startsWith('data:image/')
                      ? <img src={p.avatar} alt="" className="w-10 h-10 object-cover rounded-full" />
                      : swAvatarIds.includes(p.avatar)
                        ? <img src={`/avatars/${p.avatar}.png`} alt="" className="w-8 h-8 object-contain" />
                        : <span>{p.avatar}</span>
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-swu-text truncate block">{p.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold ${levelInfo.rank.color}`}>
                        Nv.{levelInfo.level} {levelInfo.rank.name}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <Zap size={12} className="text-amber-400" />
                      <span className="text-xs font-medium text-amber-400">{p.xp}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Trophy size={12} className="text-green-400" />
                      <span className="text-xs font-medium text-green-400">{p.wins}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

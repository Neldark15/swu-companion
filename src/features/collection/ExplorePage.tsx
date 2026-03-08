import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Users, Skull, Package, Eye, EyeOff } from 'lucide-react'
import {
  searchPublicProfiles,
  getExploreProfiles,
  type PublicProfile,
} from '../../services/collectionService'

/* Avatar helper: detect image-based avatar vs emoji */
const swAvatarIds = ['chewbacca','r2d2','c3po','bb8','pilot','boba-fett','stormtrooper','darth-vader','phasma','kylo-ren','jedi-order','phoenix','rebel-alliance','galactic-empire','first-order','first-order-2','starfighter','sith-empire','rebel-alliance-2','jedi-order-2','new-republic','empire-gear','separatist','galactic-republic']

export function ExplorePage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [profiles, setProfiles] = useState<PublicProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)

  // Load ALL profiles on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await getExploreProfiles(50)
        if (!cancelled) setProfiles(data)
      } catch (e) {
        console.warn('[Contrabando] Failed to load profiles:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Search handler
  const handleSearch = useCallback(async (q: string) => {
    setQuery(q)
    if (!q.trim()) {
      setSearching(true)
      const data = await getExploreProfiles(50)
      setProfiles(data)
      setSearching(false)
      return
    }

    setSearching(true)
    try {
      const results = await searchPublicProfiles(q)
      setProfiles(results)
    } catch {
      // ignore
    } finally {
      setSearching(false)
    }
  }, [])

  return (
    <div className="min-h-screen bg-swu-bg pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-swu-bg/95 backdrop-blur border-b border-swu-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-swu-muted">
            <ArrowLeft size={20} />
          </button>
          <Skull size={20} className="text-red-400" />
          <h1 className="text-lg font-bold text-swu-text flex-1">Contrabando de Cartas</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Flavor text */}
        <div className="bg-red-500/5 rounded-xl border border-red-500/15 p-3">
          <p className="text-xs text-red-300/80 font-mono text-center">
            Todos los contrabandistas de la galaxia y su botín de cartas
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
          <input
            type="text"
            placeholder="Buscar contrabandista..."
            value={query}
            onChange={e => handleSearch(e.target.value)}
            className="w-full bg-swu-surface border border-swu-border rounded-xl pl-9 pr-3 py-2.5
                       text-sm text-swu-text placeholder:text-swu-muted focus:border-red-400 outline-none"
          />
        </div>

        {/* Section label */}
        <div className="flex items-center gap-2 text-swu-muted">
          <Users size={14} />
          <span className="text-xs font-medium">
            {query.trim() ? `Resultados para "${query}"` : `${profiles.length} contrabandistas registrados`}
          </span>
        </div>

        {/* Loading */}
        {(loading || searching) && (
          <div className="text-center py-12 text-swu-muted">
            <div className="animate-spin w-8 h-8 border-2 border-red-400 border-t-transparent rounded-full mx-auto mb-3" />
            Rastreando contrabandistas...
          </div>
        )}

        {/* Empty */}
        {!loading && !searching && profiles.length === 0 && (
          <div className="text-center py-12">
            <Users size={48} className="mx-auto text-swu-muted/30 mb-4" />
            <p className="text-swu-muted text-sm">
              {query.trim()
                ? 'No se encontró ningún contrabandista con ese nombre'
                : 'No hay contrabandistas registrados aún'}
            </p>
          </div>
        )}

        {/* Profile list */}
        {!loading && !searching && profiles.length > 0 && (
          <div className="space-y-1.5">
            {profiles.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/u/${p.id}`)}
                className="w-full bg-swu-surface rounded-xl p-3 border border-swu-border
                           flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-swu-bg flex items-center justify-center
                                text-lg flex-shrink-0 overflow-hidden">
                  {swAvatarIds.includes(p.avatar)
                    ? <img src={`/avatars/${p.avatar}.png`} alt="" className="w-8 h-8 object-contain" />
                    : <span>{p.avatar}</span>
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-swu-text truncate">{p.name}</span>
                    {p.isPublic
                      ? <Eye size={10} className="text-swu-green flex-shrink-0" />
                      : <EyeOff size={10} className="text-swu-muted flex-shrink-0" />
                    }
                  </div>
                  {p.bio && (
                    <div className="text-xs text-swu-muted truncate mt-0.5">{p.bio}</div>
                  )}
                </div>

                {/* Card count */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Package size={12} className={p.cardCount > 0 ? 'text-red-400' : 'text-swu-muted/40'} />
                  <span className={`text-xs font-medium ${p.cardCount > 0 ? 'text-red-400' : 'text-swu-muted/40'}`}>
                    {p.cardCount}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

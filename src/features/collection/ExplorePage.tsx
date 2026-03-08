import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Users, Globe } from 'lucide-react'
import {
  searchPublicProfiles,
  getExploreProfiles,
  type PublicProfile,
} from '../../services/collectionService'

export function ExplorePage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [profiles, setProfiles] = useState<PublicProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)

  // Load featured profiles on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await getExploreProfiles(30)
        if (!cancelled) setProfiles(data)
      } catch (e) {
        console.warn('[Explore] Failed to load profiles:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Search handler with debounce
  const handleSearch = useCallback(async (q: string) => {
    setQuery(q)
    if (!q.trim()) {
      // Reset to explore list
      setSearching(true)
      const data = await getExploreProfiles(30)
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
          <h1 className="text-lg font-bold text-swu-text flex-1">Explorar Coleccionistas</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
          <input
            type="text"
            placeholder="Buscar por nombre de usuario..."
            value={query}
            onChange={e => handleSearch(e.target.value)}
            className="w-full bg-swu-surface border border-swu-border rounded-xl pl-9 pr-3 py-2.5
                       text-sm text-swu-text placeholder:text-swu-muted focus:border-swu-accent outline-none"
          />
        </div>

        {/* Section label */}
        <div className="flex items-center gap-2 text-swu-muted">
          <Globe size={14} />
          <span className="text-xs font-medium">
            {query.trim() ? `Resultados para "${query}"` : 'Coleccionistas recientes'}
          </span>
        </div>

        {/* Loading */}
        {(loading || searching) && (
          <div className="text-center py-12 text-swu-muted">
            <div className="animate-spin w-8 h-8 border-2 border-swu-accent border-t-transparent rounded-full mx-auto mb-3" />
            Buscando...
          </div>
        )}

        {/* Empty */}
        {!loading && !searching && profiles.length === 0 && (
          <div className="text-center py-12">
            <Users size={48} className="mx-auto text-swu-muted/30 mb-4" />
            <p className="text-swu-muted text-sm">
              {query.trim()
                ? 'No se encontraron usuarios con ese nombre'
                : 'No hay perfiles públicos aún'}
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
                <div className="w-10 h-10 rounded-full bg-swu-bg flex items-center justify-center
                                text-lg flex-shrink-0">
                  {p.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-swu-text truncate">{p.name}</div>
                  {p.bio && (
                    <div className="text-xs text-swu-muted truncate mt-0.5">{p.bio}</div>
                  )}
                </div>
                {p.cardCount > 0 && (
                  <div className="text-xs text-swu-accent font-medium flex-shrink-0">
                    {p.cardCount} cartas
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

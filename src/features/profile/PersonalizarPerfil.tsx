/**
 * PersonalizarPerfil — elegir qué muestra mi perfil público.
 *
 * Dos cosas, las dos del juego: hasta 2 ASPECTOS (que es como la gente dice
 * de qué color juega) y hasta 6 cartas en vitrina.
 *
 * ── La vitrina sale de las favoritas ──────────────────────────────────
 *
 * En vez de otro buscador de cartas, se eligen entre las que ya marcaste como
 * favoritas. Reusa algo que la app ya sabe y evita pedir que armes una lista
 * nueva desde cero. Si todavía no marcaste ninguna, lo dice y manda al
 * buscador en vez de mostrar un cuadro vacío.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Check, AlertTriangle, Save, Star } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { CardImage } from '../../components/CardImage'
import { listFaceUrl, listFaceIsLandscape } from '../../services/cardArt'
import { useAuth } from '../../hooks/useAuth'
import {
  getPersonalizacion, guardarPersonalizacion, misFavoritas,
  ASPECTOS, MAX_VITRINA, MAX_ASPECTOS, VACIA,
  type Personalizacion, type Aspecto,
} from '../../services/profileCustomService'
import type { Card } from '../../types'

export function PersonalizarPerfil() {
  const { supabaseUser, currentProfile } = useAuth()
  const uid = supabaseUser?.id ?? ''

  const [p, setP] = useState<Personalizacion>(VACIA)
  const [favoritas, setFavoritas] = useState<Card[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let vivo = true
    void Promise.all([
      uid ? getPersonalizacion(uid) : Promise.resolve(VACIA),
      misFavoritas(currentProfile?.id),
    ]).then(([pers, favs]) => {
      if (!vivo) return
      setP(pers)
      setFavoritas(favs)
      setCargando(false)
    })
    return () => { vivo = false }
  }, [uid, currentProfile?.id])

  const alternarAspecto = (a: Aspecto) => {
    setOk(false)
    setP(prev => {
      const hay = prev.favorite_aspects.includes(a)
      if (hay) return { ...prev, favorite_aspects: prev.favorite_aspects.filter(x => x !== a) }
      // Al pasarse del máximo se descarta el MÁS VIEJO en vez de ignorar el
      // toque: así el control siempre responde a lo último que se tocó.
      const next = [...prev.favorite_aspects, a].slice(-MAX_ASPECTOS)
      return { ...prev, favorite_aspects: next }
    })
  }

  const alternarCarta = (id: string) => {
    setOk(false)
    setP(prev => {
      const hay = prev.showcase_cards.includes(id)
      if (hay) return { ...prev, showcase_cards: prev.showcase_cards.filter(x => x !== id) }
      if (prev.showcase_cards.length >= MAX_VITRINA) return prev
      return { ...prev, showcase_cards: [...prev.showcase_cards, id] }
    })
  }

  const guardar = async () => {
    setError(null)
    setOk(false)
    setGuardando(true)
    const r = await guardarPersonalizacion(uid, p)
    setGuardando(false)
    if (!r.ok) { setError(r.error ?? 'No se pudo guardar.'); return }
    setOk(true)
  }

  if (cargando) {
    return <p className="text-center text-xs text-swu-muted py-6">Cargando…</p>
  }

  return (
    <div className="space-y-4">
      {/* ── Mi planeta ──
          Va primero porque es lo nuevo y lo que más se ve: en /galaxia cada
          jugador ES un planeta, y hasta ahora ninguno tenía nombre. */}
      <section>
        <h3 className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60 mb-2">
          Mi planeta · lo ve toda la galaxia
        </h3>
        <input
          value={p.planet_name ?? ''}
          onChange={e => setP({ ...p, planet_name: e.target.value })}
          maxLength={24}
          placeholder="Ponele nombre a tu mundo"
          aria-label="Nombre de mi planeta"
          className="w-full rounded-lg border border-swu-border bg-swu-bg px-3 py-2 text-sm
                     text-swu-text placeholder:text-swu-muted/60
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
        />
        {/* El contador y el aviso de unicidad se dicen ANTES de guardar: el
            índice de la base rechaza los repetidos, y enterarse recién al
            recibir el error es peor. `maxLength` corta en 24 igual que el CHECK. */}
        <p className="mt-1 text-[10px] text-swu-muted">
          {(p.planet_name ?? '').trim().length}/24 · tiene que ser distinto al de los demás.
          Dejalo vacío y tu planeta queda sin nombre.
        </p>
      </section>

      {/* ── Aspectos ── */}
      <section>
        <h3 className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60 mb-2">
          Mis aspectos · hasta {MAX_ASPECTOS}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {ASPECTOS.map(a => {
            const activo = p.favorite_aspects.includes(a.valor)
            return (
              <button
                key={a.valor}
                onClick={() => alternarAspecto(a.valor)}
                aria-pressed={activo}
                className={`flex items-center gap-1.5 text-[11px] font-semibold rounded-lg border px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent ${
                  activo ? `${a.texto} border-current` : 'text-swu-muted border-swu-border'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${a.punto}`} aria-hidden />
                {a.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Vitrina ── */}
      <section>
        <h3 className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60 mb-2">
          Cartas en vitrina · {p.showcase_cards.length}/{MAX_VITRINA}
        </h3>

        {favoritas.length === 0 ? (
          <EmptyState
            icon={<Star size={26} aria-hidden />}
            title="Todavía no tenés favoritas"
            hint="Marcá cartas con la estrella y después elegí cuáles mostrar acá."
            action={
              <Link to="/cards">
                <Button size="sm" variant="secondary">Buscar cartas</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {favoritas.map(c => {
              const elegida = p.showcase_cards.includes(c.id)
              const lleno = p.showcase_cards.length >= MAX_VITRINA && !elegida
              return (
                <button
                  key={c.id}
                  onClick={() => alternarCarta(c.id)}
                  disabled={lleno}
                  aria-pressed={elegida}
                  aria-label={`${elegida ? 'Quitar' : 'Mostrar'} ${c.name}`}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all disabled:opacity-35 ${
                    elegida ? 'border-swu-cyan scale-[0.97]' : 'border-transparent'
                  }`}
                >
                  {/* Mismo arreglo que la vitrina: si acá se elige desde una
                      miniatura ya recortada, se elige a ciegas. */}
                  <CardImage
                    src={listFaceUrl(c)}
                    orientacion={listFaceIsLandscape(c) ? 'apaisada' : 'vertical'}
                    fit="cover"
                    alt={c.name}
                    className={`w-full ${listFaceIsLandscape(c) ? 'aspect-[400/286]' : 'aspect-[286/400]'}`}
                  />
                  {elegida && (
                    <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-swu-cyan flex items-center justify-center">
                      <Check size={12} className="text-swu-bg" aria-hidden />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {error && (
        <div className="flex items-start gap-2 text-[11px] text-swu-red-texto bg-swu-red/10 border border-swu-red/30 rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" aria-hidden /> {error}
        </div>
      )}
      {ok && (
        <div className="flex items-center gap-2 text-[11px] text-swu-green bg-swu-green/10 border border-swu-green/30 rounded-lg px-3 py-2">
          <Check size={13} aria-hidden /> Guardado. Así se ve tu perfil público.
        </div>
      )}

      <Button block onClick={() => void guardar()} loading={guardando}>
        <Save size={15} aria-hidden /> Guardar
      </Button>
    </div>
  )
}

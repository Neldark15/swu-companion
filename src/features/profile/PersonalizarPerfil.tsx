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

import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { Check, AlertTriangle, Save, Star, Image as ImageIcon } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { CardImage } from '../../components/CardImage'
import { BannerPortada } from './BannerPortada'
import { listFaceUrl, listFaceIsLandscape } from '../../services/cardArt'
import { useAuth } from '../../hooks/useAuth'
import {
  getPersonalizacion, guardarPersonalizacion, misFavoritas,
  ASPECTOS, MAX_VITRINA, MAX_ASPECTOS, VACIA,
  type Personalizacion, type Aspecto,
} from '../../services/profileCustomService'
import type { Card } from '../../types'
import { rasgosDe, FAMILIAS, ORDEN_FAMILIAS } from '../planeta/semilla'

/**
 * La escena va en su propio trozo, igual que en /galaxia y /mesa.
 *
 * Con un `import` normal, `three` (521 KB) entraría estáticamente en el trozo
 * del perfil y se lo bajaría cualquiera que abra Personalizar, mire el planeta
 * o no. Cargándola así, solo la paga quien llega a esta pantalla.
 */
const PlanetaEscena = lazy(() =>
  import('../planeta/PlanetaEscena').then(m => ({ default: m.PlanetaEscena })),
)

/**
 * Un deslizador con estado de «automático».
 *
 * `null` no es cero: es «dejá que lo decida la semilla de tu id». Sin esa
 * distinción, abrir el panel y no tocar nada ya te fijaría un valor, y perderías
 * para siempre el mundo que te tocó. Por eso el botón de volver al automático
 * está SIEMPRE visible cuando hay un valor puesto.
 */
function Deslizador({ etiqueta, valor, onCambio }: {
  etiqueta: string
  valor: number | null
  onCambio: (v: number | null) => void
}) {
  const auto = valor === null
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-swu-muted">{etiqueta}</span>
        {auto ? (
          <span className="text-[10px] text-swu-cyan">automático</span>
        ) : (
          <button onClick={() => onCambio(null)} className="text-[10px] text-swu-muted underline">
            volver al automático
          </button>
        )}
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={valor ?? 50}
        onChange={e => onCambio(Number(e.target.value))}
        aria-label={etiqueta}
        className="w-full accent-swu-cyan"
      />
    </div>
  )
}

/** El mundo tal como va a quedar, en chico y girando. */
function VistaPreviaPlaneta({ userId, familia, mares, crateres, acento }: {
  userId: string
  familia: string | null
  mares: number | null
  crateres: number | null
  acento: string | null
}) {
  /* Se reconstruye la malla en cada cambio, y eso es a propósito: mover el
     deslizador tiene que MOSTRAR el mundo nuevo, no una aproximación. La escena
     elige sola un detalle bajo si el aparato es flojo. */
  const rasgos = useMemo(
    () => rasgosDe(userId, { familia, mares, crateres, acento }),
    [userId, familia, mares, crateres, acento],
  )
  return (
    <div className="overflow-hidden rounded-xl border border-swu-border">
      <Suspense fallback={<div className="h-44 animate-pulse bg-swu-bg" />}>
        <PlanetaEscena rasgos={rasgos} className="h-44 w-full" />
      </Suspense>
    </div>
  )
}

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

  /**
   * La portada es UNA sola carta: tocarla de nuevo la quita.
   *
   * Se guarda AL INSTANTE, no al tocar «Guardar» abajo. Es lo que la gente
   * espera —«elegí la portada» debería quedar elegida— y evita el caso real que
   * reportó Nel: eligió la portada, no volvió a tocar Guardar, y no se guardó.
   */
  const elegirPortada = (id: string) => {
    const nuevo = p.banner_card_id === id ? null : id
    setP(prev => ({ ...prev, banner_card_id: nuevo }))
    setOk(false)
    void guardarPersonalizacion(uid, { banner_card_id: nuevo }).then(r => {
      if (r.ok) setOk(true)
      else setError(r.error ?? 'No se pudo guardar la portada.')
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

        {/* La vista previa VIVE, y es lo que hace que esto se pueda ajustar:
            con muestras de color planas nadie sabe cómo va a quedar su mundo.
            Es la misma escena del modo planeta, en chico. */}
        <VistaPreviaPlaneta
          userId={uid ?? ''}
          familia={p.planet_family}
          mares={p.planet_seas}
          crateres={p.planet_craters}
          acento={p.accent}
        />

        <div className="mt-2.5 space-y-2.5">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-swu-muted">Tipo de mundo</span>
              {/* «Automático» no es una familia más: es volver a heredar del
                  acento del perfil, que es lo que pidió Nel. Se distingue del
                  resto porque borra la elección en vez de fijar otra. */}
              <button
                onClick={() => setP({ ...p, planet_family: null })}
                className={`text-[10px] font-semibold ${
                  p.planet_family === null ? 'text-swu-cyan' : 'text-swu-muted underline'
                }`}
              >
                {p.planet_family === null ? '· hereda tu color ·' : 'volver al automático'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ORDEN_FAMILIAS.map(f => {
                const fam = FAMILIAS[f]
                const activa = p.planet_family === f
                return (
                  <button
                    key={f}
                    onClick={() => setP({ ...p, planet_family: f })}
                    aria-pressed={activa}
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold
                                transition-colors focus-visible:outline-none focus-visible:ring-2
                                focus-visible:ring-swu-accent ${
                      activa ? 'border-swu-cyan text-swu-cyan' : 'border-swu-border text-swu-muted'
                    }`}
                  >
                    <span className="flex">
                      <span className="h-2.5 w-2.5 rounded-l-sm" style={{ background: fam.altiplano }} />
                      <span className="h-2.5 w-2.5 rounded-r-sm" style={{ background: fam.mares }} />
                    </span>
                    {fam.etiqueta}
                  </button>
                )
              })}
            </div>
          </div>

          <Deslizador
            etiqueta="Mares"
            valor={p.planet_seas}
            onCambio={v => setP({ ...p, planet_seas: v })}
          />
          <Deslizador
            etiqueta="Cráteres"
            valor={p.planet_craters}
            onCambio={v => setP({ ...p, planet_craters: v })}
          />
        </div>

        <h4 className="mt-3 mb-1.5 text-[10px] font-mono tracking-wider uppercase text-swu-muted/60">
          Nombre del mundo
        </h4>
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

      {/* ── Portada ── */}
      <section>
        <h3 className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60 mb-2">
          Portada · el arte grande de tu perfil
        </h3>

        {/* Vista previa: así se ve la carta elegida detrás de tu nombre. Cambia
            en el acto al tocar una carta abajo. */}
        {p.banner_card_id ? (
          <div className="relative mb-2 h-28 w-full overflow-hidden rounded-xl border border-swu-border">
            <BannerPortada cardId={p.banner_card_id} className="h-full w-full" />
            <div className="absolute bottom-2 left-3 flex items-center gap-2">
              <span className="text-sm font-black text-white drop-shadow">{currentProfile?.name ?? 'Tu nombre'}</span>
            </div>
            <button
              onClick={() => elegirPortada(p.banner_card_id!)}
              className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-1 text-[10px] font-bold text-white"
            >
              Quitar
            </button>
          </div>
        ) : (
          <p className="mb-2 text-[11px] text-swu-muted">
            Elegí una carta de tus favoritas para que sea el fondo de tu perfil.
          </p>
        )}

        {favoritas.length === 0 ? (
          <EmptyState
            icon={<ImageIcon size={26} aria-hidden />}
            title="Todavía no tenés favoritas"
            hint="Marcá cartas con la estrella y después elegí una como portada."
            action={<Link to="/cards"><Button size="sm" variant="secondary">Buscar cartas</Button></Link>}
          />
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {favoritas.map(c => {
              const elegida = p.banner_card_id === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => elegirPortada(c.id)}
                  aria-pressed={elegida}
                  aria-label={`${elegida ? 'Quitar de portada' : 'Usar de portada'} ${c.name}`}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                    elegida ? 'border-swu-amber scale-[0.97]' : 'border-transparent'
                  }`}
                >
                  <CardImage
                    src={listFaceUrl(c)}
                    orientacion={listFaceIsLandscape(c) ? 'apaisada' : 'vertical'}
                    fit="cover"
                    alt={c.name}
                    className={`w-full ${listFaceIsLandscape(c) ? 'aspect-[400/286]' : 'aspect-[286/400]'}`}
                  />
                  {elegida && (
                    <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-swu-amber flex items-center justify-center">
                      <Check size={12} className="text-swu-bg" aria-hidden />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
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

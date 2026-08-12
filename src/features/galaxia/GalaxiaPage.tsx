/**
 * LA GALAXIA — la comunidad como un sistema solar que se puede observar.
 *
 * El sol es El Salvador y cada cuenta es un planeta en órbita. La pantalla
 * pone el marco (encabezado, estados, emergente, controles) y `GalaxiaEscena`
 * pone el 3D; los datos salen enteros de `galaxiaService`.
 *
 * ── Tres cosas que esta pantalla NO hace ─────────────────────────────
 *
 * 1. No inventa récords. `victorias`/`derrotas` son 0 en las 19 cuentas porque
 *    `matches` está vacía: la tira de duelos solo se dibuja si hay al menos uno.
 *    Es la misma regla del Centro de Mando — tres ceros se leen como un error.
 * 2. No inventa movimientos. El jugador sin nada registrado (hoy, uno) muestra
 *    su ficha completa y dice que no hay movimiento. «Se unió a la comunidad»
 *    sería rellenar un hueco con algo que no pasó.
 * 3. No obliga a usar el 3D. La lista tiene los mismos datos, se puede elegir
 *    a mano y es a donde cae solo si el navegador no trae WebGL.
 */

import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Play, Pause, List, Orbit,
  Tag, Award, ChevronsUp, Layers, MessageSquare, Users, AlertTriangle, ExternalLink,
} from 'lucide-react'
import { hayWebGL } from './webgl'
import { LENTES, metricaDe, magnitudDe, type Lente } from './lentes'

/**
 * La escena va en su propio chunk, como en `MesaPage`.
 *
 * Con el `import` normal, medido sobre el build, `dist/assets/GalaxiaPage-*.js`
 * importaba **estáticamente** `three-*.js`: 534 KB (133 gzip) que se bajaban
 * aunque no hubiera nada que dibujar. Los dos caminos que lo pagaban de gorra
 * son justo los que no usan el 3D — un navegador sin WebGL y quien entra y
 * elige «Lista» —, o sea lo contrario del punto 3 de arriba.
 */
const GalaxiaEscena = lazy(() =>
  import('./GalaxiaEscena').then(m => ({ default: m.GalaxiaEscena })),
)
import { getGalaxia, type Galaxia, type PlanetaJugador } from '../../services/galaxiaService'
import { RANKS } from '../../services/gamification'
import { useAuth } from '../../hooks/useAuth'
import { fechaCorta } from '../../services/horaSV'
import { Avatar } from '../../components/ui/Avatar'

/* Los avatares de la app: id conocido → imagen, `data:` → foto, si no emoji. */

/** Cada 4,5 s el recorrido pasa al siguiente planeta con movimiento. */
const PASO_RECORRIDO = 4500

// ─── Helpers ─────────────────────────────────────────────

function rangoDeNivel(nivel: number) {
  return RANKS.find(r => nivel >= r.minLevel && nivel <= r.maxLevel) ?? RANKS[0]
}

/**
 * Cuánto hace. Pasados dos meses el «hace 74 días» deja de decir algo útil y
 * se muestra la fecha, que además ya viene en hora de El Salvador.
 */
function haceCuanto(iso: string): string {
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 0) return fechaCorta(iso)
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  if (d < 60) return `hace ${d} d`
  return fechaCorta(iso)
}

/** Vocabulario cerrado de `ultimoMovimiento.tipo`, con salida por si crece. */
const PINTA_MOVIMIENTO: Record<string, { Icono: typeof Tag; color: string; rotulo: string }> = {
  venta: { Icono: Tag, color: 'text-swu-amber', rotulo: 'Mercado' },
  logro: { Icono: Award, color: 'text-swu-green', rotulo: 'Logro' },
  nivel: { Icono: ChevronsUp, color: 'text-swu-cyan', rotulo: 'Nivel' },
  mazo: { Icono: Layers, color: 'text-swu-coral', rotulo: 'Mazo' },
  mensaje: { Icono: MessageSquare, color: 'text-swu-muted', rotulo: 'Transmisión' },
}

function pintaDe(tipo: string) {
  return PINTA_MOVIMIENTO[tipo] ?? PINTA_MOVIMIENTO.mensaje
}

// ─── Piezas ──────────────────────────────────────────────

/** El avatar con la forma de esta pantalla: caja de esquinas suaves, no burbuja. */
function AvatarGalaxia({ avatar, size = 40 }: { avatar: string; size?: number }) {
  return <Avatar avatar={avatar} size={size} caja="redondeada" escalaIcono={0.78} />
}

/** El emergente: quién es, en qué rango va y qué hizo de último. */
function Emergente({ planeta, onPerfil, onAbrir }: {
  planeta: PlanetaJugador; onPerfil: () => void; onAbrir: () => void
}) {
  const rango = rangoDeNivel(planeta.nivel)
  const mov = planeta.ultimoMovimiento
  const { Icono, color, rotulo } = pintaDe(mov?.tipo ?? 'mensaje')
  const duelos = planeta.victorias + planeta.derrotas

  return (
    <div className="rounded-2xl border border-swu-border bg-swu-surface/95 backdrop-blur p-3
                    shadow-[0_8px_30px_-8px_rgba(0,0,0,0.8)]">
      <div className="flex items-start gap-2.5">
        <AvatarGalaxia avatar={planeta.avatar} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold text-swu-text">{planeta.nombre}</span>
            {planeta.esYo && (
              <span className="flex-shrink-0 rounded-full border border-swu-cyan/40 px-1.5
                               text-[9px] font-bold text-swu-cyan">TÚ</span>
            )}
          </div>
          {/* El nombre del mundo, debajo del de la persona.
              Sin bautizar NO se dibuja nada: un «Sin nombre» repetido en los 19
              planetas se lee como un campo roto, no como una invitación. El
              único que recibe la invitación es el dueño, y aparece en su ficha
              de perfil. */}
          {planeta.nombrePlaneta && (
            <div className="truncate text-[11px] font-semibold text-swu-cyan">
              {planeta.nombrePlaneta}
            </div>
          )}
          <div className={`text-[11px] font-medium ${rango.color}`}>
            Nv.{planeta.nivel} · {rango.name}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[10px] text-swu-muted">
            {/* Con locale fijo: `toLocaleString()` pelado usa el del
                DISPOSITIVO, así que el mismo XP salía «3,180» en un teléfono en
                inglés y «3.180» en uno en español, dentro de la misma
                comunidad. Es el mismo problema que el de la zona horaria —
                formato local en un dato comunitario—, otra dimensión.
                `MetaLiveView` ya lo hacía bien. */}
            <span>{planeta.xp.toLocaleString('es-SV')} XP</span>
            {/* Sin duelos registrados no se dibuja «0V 0D»: con `matches` vacía
                los 19 dirían lo mismo y se leería como un contador roto. */}
            {duelos > 0 && <span>{planeta.victorias}V · {planeta.derrotas}D</span>}
            <span>Órbita {planeta.orbita + 1}</span>
          </div>
          {/* Las magnitudes de las lentes, siempre visibles: son los datos que
              el planeta codifica. Los ceros SÍ se muestran acá — «0 cartas» es
              información (no registró colección), a diferencia de 0V·0D que es
              una tabla vacía para todos. */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[10px] text-swu-muted">
            <span>🃏 {planeta.cartas.toLocaleString('es-SV')} cartas</span>
            <span>🗂 {planeta.mazos} {planeta.mazos === 1 ? 'mazo' : 'mazos'}</span>
            <span>🏅 {planeta.logros} {planeta.logros === 1 ? 'logro' : 'logros'}</span>
          </div>
          {planeta.titulo && (
            <p className="mt-0.5 truncate text-[10px] italic text-swu-amber/80">«{planeta.titulo}»</p>
          )}
        </div>
        {/* Dos destinos: la ficha del jugador y SU MUNDO.
            «Abrir» va primero y resaltado porque es lo nuevo y lo que se
            entiende solo: el planeta que estás tocando se puede visitar. */}
        <div className="flex flex-shrink-0 flex-col gap-1.5">
          <button
            onClick={onAbrir}
            className="rounded-lg border border-swu-cyan/50 bg-swu-cyan/15 px-2 py-1.5
                       text-[10px] font-bold text-swu-cyan active:scale-95 transition-transform
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-cyan"
          >
            <span className="flex items-center gap-1">Abrir <Orbit size={10} /></span>
          </button>
          <button
            onClick={onPerfil}
            className="rounded-lg border border-swu-border bg-swu-bg px-2 py-1.5
                       text-[10px] font-semibold text-swu-text active:scale-95 transition-transform
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
          >
            <span className="flex items-center gap-1">Perfil <ExternalLink size={10} /></span>
          </button>
        </div>
      </div>

      <div className="mt-2 border-t border-swu-border pt-2">
        {mov ? (
          <div className="flex items-start gap-2">
            <Icono size={13} className={`${color} mt-0.5 flex-shrink-0`} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] leading-snug text-swu-text break-words">{mov.texto}</p>
              <p className="mt-0.5 text-[10px] text-swu-muted">{rotulo} · {haceCuanto(mov.cuando)}</p>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-swu-muted">Sin movimientos registrados todavía.</p>
        )}
      </div>
    </div>
  )
}

/** La misma información sin 3D. Es el respaldo y también la vía accesible. */
function ListaPlanetas({
  planetas, seleccion, onElegir,
}: { planetas: PlanetaJugador[]; seleccion: string | null; onElegir: (id: string) => void }) {
  return (
    <ul className="space-y-1.5">
      {planetas.map(p => {
        const rango = rangoDeNivel(p.nivel)
        const mov = p.ultimoMovimiento
        const { Icono, color } = pintaDe(mov?.tipo ?? 'mensaje')
        return (
          <li key={p.id}>
            <button
              onClick={() => onElegir(p.id)}
              aria-current={seleccion === p.id ? 'true' : undefined}
              className={`w-full rounded-xl border bg-swu-surface p-2.5 text-left transition-colors
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent
                          ${seleccion === p.id ? 'border-swu-amber/50' : 'border-swu-border'}`}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-1 w-5 flex-shrink-0 text-right font-mono text-[10px] text-swu-muted">
                  {p.orbita + 1}
                </span>
                <AvatarGalaxia avatar={p.avatar} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-swu-text">{p.nombre}</span>
                    {p.esYo && (
                      <span className="flex-shrink-0 rounded-full border border-swu-cyan/40 px-1
                                       text-[9px] font-bold text-swu-cyan">TÚ</span>
                    )}
                  </div>
                  <div className={`text-[10px] ${rango.color}`}>Nv.{p.nivel} · {rango.name}</div>
                  {mov ? (
                    <p className="mt-0.5 flex items-start gap-1 text-[10px] text-swu-muted">
                      <Icono size={10} className={`${color} mt-0.5 flex-shrink-0`} />
                      <span className="min-w-0 break-words">{mov.texto}</span>
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[10px] text-swu-muted/70">Sin movimientos</p>
                  )}
                </div>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ─── Pantalla ────────────────────────────────────────────

export function GalaxiaPage() {
  const navigate = useNavigate()
  const { currentProfileId } = useAuth()

  const [galaxia, setGalaxia] = useState<Galaxia | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [recorriendo, setRecorriendo] = useState(false)

  // La sonda de WebGL se resuelve al inicializar el estado, no en un efecto:
  // en un efecto habría un primer render con el lienzo puesto que después se
  // cae a lista. `hayWebGL()` cachea a nivel de módulo, así que llamarla dos
  // veces cuesta una lectura de variable.
  const [sin3D, setSin3D] = useState(() => !hayWebGL())
  const [vista, setVista] = useState<'orbital' | 'lista'>(() => (hayWebGL() ? 'orbital' : 'lista'))

  useEffect(() => {
    let cancelado = false
    getGalaxia(currentProfileId ?? undefined)
      .then(g => {
        if (cancelado) return
        setGalaxia(g)
        // Se arranca en el planeta de quien mira: abrir con la ficha vacía
        // obliga a cazar un punto de 20 px antes de ver nada.
        setSeleccion(g.planetas.find(p => p.esYo)?.id ?? g.planetas[0]?.id ?? null)
        setCargando(false)
      })
      .catch(() => { if (!cancelado) { setError(true); setCargando(false) } })
    return () => { cancelado = true }
  }, [currentProfileId])

  const [lente, setLente] = useState<Lente>('nivel')

  /**
   * La lista que ve TODO lo demás (escena, lista, emergente, recorrido) ya
   * viene re-ordenada por la lente: órbita = puesto en la magnitud elegida,
   * desempate por nivel y después por id — el mismo desempate estable del
   * servicio, para que refrescar no baraje a los empatados.
   *
   * Memoizada porque la escena reconstruye TODO al cambiar la referencia
   * (recompila shaders incluidos): tiene que cambiar solo cuando cambian los
   * datos o la lente, no en cada render.
   */
  const planetas = useMemo(() => {
    const base = galaxia?.planetas ?? []
    if (base.length === 0) return base
    const max = Math.max(...base.map(p => metricaDe(p, lente)))
    return base
      .slice()
      .sort((a, b) =>
        (metricaDe(b, lente) - metricaDe(a, lente)) ||
        (b.nivel - a.nivel) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((p, i) => ({ ...p, orbita: i, magnitud: magnitudDe(p, lente, max) }))
  }, [galaxia, lente])

  /** El recorrido solo pasa por planetas CON movimiento: es lo que va a mostrar. */
  const conMovimiento = useMemo(
    () => planetas.filter(p => p.ultimoMovimiento !== null),
    [planetas],
  )

  const elegido = useMemo(
    () => planetas.find(p => p.id === seleccion) ?? null,
    [planetas, seleccion],
  )

  const mover = useCallback((paso: number) => {
    setSeleccion(actual => {
      if (planetas.length === 0) return actual
      const i = planetas.findIndex(p => p.id === actual)
      const siguiente = (i < 0 ? 0 : i + paso + planetas.length) % planetas.length
      return planetas[siguiente].id
    })
  }, [planetas])

  // ── Recorrido automático ──
  // Arranca SIEMPRE apagado, con o sin `prefers-reduced-motion`: contenido que
  // cambia solo hay que pedirlo, no sufrirlo. Y el mismo botón que lo enciende
  // lo pausa, que es lo que exige cualquier cosa que se mueva sin permiso.
  const recorriendoRef = useRef(recorriendo)
  useEffect(() => { recorriendoRef.current = recorriendo })

  useEffect(() => {
    if (!recorriendo || conMovimiento.length < 2) return
    const id = window.setInterval(() => {
      setSeleccion(actual => {
        const i = conMovimiento.findIndex(p => p.id === actual)
        return conMovimiento[(i + 1 + conMovimiento.length) % conMovimiento.length].id
      })
    }, PASO_RECORRIDO)
    return () => window.clearInterval(id)
  }, [recorriendo, conMovimiento])

  /**
   * Tocar un planeta manda: corta el recorrido y se queda ahí.
   *
   * Tocar el VACÍO no deselecciona, y es a propósito: el emergente vive debajo
   * del lienzo, así que vaciarlo no «cierra» nada — quita una tarjeta de 100 px
   * y los tres botones de abajo saltan hacia arriba justo cuando el dedo va a
   * bajar. Y fallar el planeta por 20 px es lo normal en un teléfono: castigar
   * el error con un salto de layout es peor que no hacer nada. Para cambiar de
   * planeta están el toque, las flechas y la lista.
   */
  const alTocar = useCallback((id: string | null) => {
    if (id) {
      setSeleccion(id)
      if (recorriendoRef.current) setRecorriendo(false)
    }
  }, [])

  const alPerderWebGL = useCallback(() => {
    setSin3D(true)
    setVista('lista')
  }, [])

  const totalTexto = galaxia
    ? `${galaxia.totalJugadores} ${galaxia.totalJugadores === 1 ? 'planeta' : 'planetas'}`
    : '—'

  return (
    <div className="min-h-screen bg-swu-bg">
      {/* ── Encabezado ── */}
      <header className="sticky top-0 z-40 border-b border-swu-border bg-swu-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-3 py-3 lg:max-w-5xl lg:px-6">
          <button
            onClick={() => navigate(-1)}
            aria-label="Volver"
            className="flex-shrink-0 text-swu-muted focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-swu-accent rounded"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-swu-text lg:text-lg">La Galaxia</h1>
            {/*
              A 320 px esta línea medía 215 px de contenido en 199 de caja y el
              `truncate` se comía justo la UNIDAD del conteo: «Sistema El
              Salvador · 19 plan…». Un número sin su sustantivo es medio dato.
              El sistema tiene su propio `truncate` (es el texto largo y
              prescindible) y el conteo va en un `flex-shrink-0` que nunca se
              corta — el mismo patrón min-w-0/flex-shrink-0 de ProximosEventos.
            */}
            <p className="flex items-baseline gap-1 font-mono text-[10px] tracking-wider text-swu-muted">
              <span className="min-w-0 truncate">Sistema {galaxia?.sistema ?? 'El Salvador'}</span>
              <span className="flex-shrink-0">· {totalTexto}</span>
            </p>
          </div>
          {!sin3D && (
            <button
              onClick={() => setVista(v => (v === 'orbital' ? 'lista' : 'orbital'))}
              className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-swu-border
                         bg-swu-surface px-2 py-1.5 text-[10px] font-semibold text-swu-muted
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
            >
              {vista === 'orbital'
                ? <><List size={12} /> Lista</>
                : <><Orbit size={12} /> Órbitas</>}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-lg px-3 py-3 lg:max-w-5xl lg:px-6">

        {/* La pantalla no tenía NI UNA región viva (medido: 0 `[aria-live]`),
            así que ni la carga ni el fallo se anunciaban. Acotada a los dos
            estados y no envolviendo el contenido, que es la lección que ya
            estaba escrita en MetaNacionalView. */}
        <div role="status" aria-live="polite">
          {cargando && (
            <>
              <span className="sr-only">Cargando la galaxia…</span>
              <div className="space-y-3" aria-hidden>
                <div className="h-[52vh] min-h-[280px] animate-pulse rounded-2xl border border-swu-border bg-swu-surface" />
                <div className="h-24 animate-pulse rounded-2xl border border-swu-border bg-swu-surface" />
              </div>
            </>
          )}

          {/* ── Error ── */}
          {!cargando && error && (
            <div className="rounded-2xl border border-swu-red/30 bg-swu-surface p-6 text-center">
              <AlertTriangle size={32} className="mx-auto mb-2 text-swu-red opacity-70" aria-hidden />
              <p className="text-sm text-swu-text">No se pudo leer la galaxia</p>
              <p className="mt-1 text-[11px] text-swu-muted">
                Revisá la conexión y volvé a intentar.
              </p>
            </div>
          )}
        </div>

        {/* ── Vacío ── */}
        {!cargando && !error && planetas.length === 0 && (
          <div className="rounded-2xl border border-swu-border bg-swu-surface p-8 text-center">
            <Users size={36} className="mx-auto mb-2 text-swu-muted opacity-30" />
            <p className="text-sm text-swu-text">Todavía no hay planetas</p>
            <p className="mt-1 text-[11px] text-swu-muted">
              El sistema {galaxia?.sistema ?? 'El Salvador'} está esperando su primera cuenta.
            </p>
          </div>
        )}

        {/* ── Galaxia ── */}
        {!cargando && !error && planetas.length > 0 && (
          <div className="space-y-3">

            {sin3D && (
              <div className="flex items-start gap-2 rounded-xl border border-swu-amber/30
                              bg-swu-amber/10 p-2.5">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-swu-amber" />
                <p className="text-[11px] leading-snug text-swu-text">
                  Este navegador no puede dibujar en 3D, así que la galaxia se muestra
                  como lista. Los datos son exactamente los mismos.
                </p>
              </div>
            )}

            {/* ── Lentes: qué magnitud dibujan la órbita y el tamaño ── */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="Lente de la galaxia">
              {LENTES.map(l => (
                <button
                  key={l.id}
                  role="tab"
                  aria-selected={lente === l.id}
                  onClick={() => setLente(l.id)}
                  className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold
                              transition-colors focus-visible:outline-none focus-visible:ring-2
                              focus-visible:ring-swu-accent ${
                    lente === l.id
                      ? 'border-swu-cyan/60 bg-swu-cyan/15 text-swu-cyan'
                      : 'border-swu-border bg-swu-surface text-swu-muted'
                  }`}
                >
                  {l.rotulo}
                </button>
              ))}
            </div>
            {/* La leyenda dice qué codifica qué, y cambia con la lente: una
                escena con cuatro codificaciones a la vez sin leyenda es un
                adivinanza, no una visualización. */}
            <p className="font-mono text-[10px] leading-snug text-swu-muted">
              tamaño y órbita = {LENTES.find(l => l.id === lente)?.leyenda} · color = rango · lunas = logros
            </p>

            {vista === 'orbital' && (
              <Suspense fallback={
                <div className="h-[46vh] min-h-[260px] max-h-[520px] w-full animate-pulse
                                rounded-2xl border border-swu-border bg-swu-surface lg:h-[58vh]" />
              }>
                <GalaxiaEscena
                  planetas={planetas}
                  seleccion={seleccion}
                  onSeleccionar={alTocar}
                  onSinWebGL={alPerderWebGL}
                  className="h-[46vh] min-h-[260px] max-h-[520px] w-full rounded-2xl
                             border border-swu-border lg:h-[58vh]"
                />
              </Suspense>
            )}

            {/* El emergente va DEBAJO del lienzo, no flotando encima.
                Se probó superpuesto y se comía el tercio inferior de la escena:
                tapaba planetas que además dejaban de poder tocarse. Y flotando
                junto al planeta tampoco: a 320 px una tarjeta al lado de un
                planeta del borde se sale de la pantalla. El vínculo con el
                planeta lo hacen el aro ámbar y el rótulo de la escena. */}
            {elegido && (
              <Emergente
                planeta={elegido}
                onPerfil={() => navigate(`/u/${elegido.id}`)}
                onAbrir={() => navigate(`/planeta/${elegido.id}`)}
              />
            )}

            {/* ── Controles ──
                Además del recorrido, las flechas dan acceso por teclado a todos
                los planetas: el lienzo es una imagen y no se puede tabular. */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setRecorriendo(false); mover(-1) }}
                aria-label="Planeta anterior"
                className="flex-shrink-0 rounded-xl border border-swu-border bg-swu-surface p-2
                           text-swu-muted active:scale-95 transition-transform
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setRecorriendo(r => !r)}
                disabled={conMovimiento.length < 2}
                aria-pressed={recorriendo}
                className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl
                           border border-swu-border bg-swu-surface px-2 py-2 text-[11px]
                           font-semibold text-swu-text disabled:opacity-40
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
              >
                {recorriendo ? <Pause size={13} /> : <Play size={13} />}
                <span className="truncate">
                  {recorriendo ? 'Pausar recorrido' : 'Recorrer movimientos'}
                </span>
              </button>
              <button
                onClick={() => { setRecorriendo(false); mover(1) }}
                aria-label="Planeta siguiente"
                className="flex-shrink-0 rounded-xl border border-swu-border bg-swu-surface p-2
                           text-swu-muted active:scale-95 transition-transform
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {vista === 'orbital' && (
              <p className="px-1 text-center text-[10px] leading-snug text-swu-muted">
                Arrastrá para girar el sistema, pellizcá para acercar y tocá un planeta
                para ver quién es. El aro cian es el tuyo.
              </p>
            )}

            {vista === 'lista' && (
              <ListaPlanetas
                planetas={planetas}
                seleccion={seleccion}
                onElegir={id => { setRecorriendo(false); setSeleccion(id) }}
              />
            )}

            {/* El explorador viejo sigue siendo el sitio para BUSCAR, filtrar
                por país y ver los rankings. Son dos trabajos distintos. */}
            <button
              onClick={() => navigate('/galaxy')}
              className="w-full rounded-xl border border-swu-border bg-swu-surface px-3 py-2.5
                         text-[11px] font-semibold text-swu-muted active:scale-[0.99]
                         transition-transform focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-swu-accent"
            >
              Buscar comandantes y rankings en el Explorador
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

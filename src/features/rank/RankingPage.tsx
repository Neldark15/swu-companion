/**
 * RANKING — uno solo, y mide jugar.
 *
 * ── Qué había acá antes ──────────────────────────────────────────────
 *
 * Cuatro pestañas con cuatro criterios distintos, y ninguna decía qué medía.
 * La pestaña «Global» ordenaba por `torneos·1000 + victorias·100 + xp` — una
 * fórmula que no existe en ninguna tabla ni en ningún servicio, inventada en
 * la línea que la pintaba. Medido en producción antes de tocar nada:
 *
 *   - El primero del «ranking» tenía 3180 puntos con CERO partidas jugadas.
 *     Le venían de 2900 cartas registradas y 8 logros.
 *   - El que ganó el torneo real 3-0 no aparecía en el top 6.
 *   - La suma de `matches_played` de los 25 perfiles era 2.
 *
 * O sea que la app llamaba «Mejores Jugadores del Juego» a una tabla de quién
 * colecciona más. Y «Consejo Jedi» nombraba DOS tablas distintas —esta y la de
 * /community, que ordena por XP— con los mismos jugadores en distinto orden.
 *
 * ── Qué hay ahora ────────────────────────────────────────────────────
 *
 * UNA tabla que mide resultados de juego, y una pestaña aparte de Progreso que
 * dice con todas las letras que no es un ranking. Los puntos salen de
 * `ranking_unificado()`: standings de torneo y amistosas confirmadas, las dos
 * únicas fuentes donde hay partidas de verdad.
 *
 * El podio conserva el nombre «Consejo Jedi» porque le gusta a la comunidad,
 * pero ahora es solo eso: el nombre de los tres primeros de ESTA tabla, no una
 * segunda tabla con otro criterio.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Trophy, RefreshCw, Swords, Info, TrendingUp } from 'lucide-react'
import {
  getRankingUnificado, recordDe, miPosicion, porFuente,
  REGLA_PUNTOS, REGLA_DE, NOMBRE_FUENTE, type FilaRanking, type Fuente,
} from '../../services/rankingUnificado'
import { getGlobalLeaderboard, type GlobalLeaderboardEntry } from '../../services/sync'
import { useAuth } from '../../hooks/useAuth'
import { listarSedes, type Sede } from '../../services/venuesService'
import { Avatar } from '../../components/ui/Avatar'
import { colorDePersona } from '../../services/avatars'
import { IconXp } from '../../components/icons/SWUIcons'

/** Nombres que en realidad son un uid perdido. */
function nombreLimpio(nombre: string): string {
  if (!nombre) return 'Jugador'
  if (nombre.length >= 20 && !/\s/.test(nombre) && /^[a-zA-Z0-9_-]+$/.test(nombre)) return 'Jugador'
  return nombre
}

/* ══════════════════════════════════════════════════════════════════════════
   EL MATERIAL — la credencial traducida a CSS

   Los degradados están copiados parada por parada de DefsCredencial, pero como
   `background-image` en vez de filtros SVG. Un degradado es pintura directa:
   no promueve capa de composición. Un filtro sí, y acá hay hasta 25 filas —
   en la credencial el especular está limitado al nivel 11+ justamente por lo
   que cuesta, y ahí hay UNA placa en pantalla.

   Regla que gobierna todo esto: UN solo efecto caro por PANTALLA, nunca por
   fila.
   ══════════════════════════════════════════════════════════════════════════ */

/** El barniz de toda chapa: claro arriba, oscuro abajo. */
const LUSTRE =
  'linear-gradient(160deg, rgba(255,255,255,.16), rgba(255,255,255,.03) 42%,' +
  ' rgba(0,0,0,.06) 60%, rgba(0,0,0,.28))'

/** El sustituto honesto del filtro `cepillo`. feTurbulence se genera en CPU
 *  sobre toda la superficie; esto es una veta REGULAR en vez de aleatoria, y a
 *  50 px de alto nadie nota la diferencia. Cuesta cero. */
const VETA = 'repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px)'

/** El tinte irisado del laminado. Opacidades bajas a propósito: un tinte que
 *  cambia, no un arcoíris. Solo la placa del primero. */
const PRISMA =
  'linear-gradient(115deg, rgba(255,77,109,.12), rgba(255,209,102,.12) 22%,' +
  ' rgba(76,201,240,.12) 44%, rgba(138,201,38,.10) 62%, rgba(184,146,255,.14) 80%,' +
  ' rgba(255,77,109,.12))'

/** Cara de una placa cualquiera. */
const CARA: React.CSSProperties = {
  backgroundColor: 'var(--color-swu-surface)',
  backgroundImage: `${LUSTRE}, ${VETA}`,
}

/** Tu propia fila. Lleva TINTE, no destello: el destello del laminado es una
 *  franja diagonal que cae justo encima del nombre —medido: en una fila de
 *  341 px el eje de 100° pone la banda clara en x≈131-189, que es donde vive
 *  el nombre— y le come el contraste. */
const CARA_YO: React.CSSProperties = {
  backgroundColor: 'color-mix(in srgb, var(--color-swu-accent) 12%, var(--color-swu-surface))',
  backgroundImage: `${LUSTRE}, ${VETA}`,
}

/**
 * MATE: metal sin barnizar. NO significa «sin cuenta» — significa «esto no es
 * el ranking»: es el material del estado vacío y de toda la pestaña Progreso.
 * Si Progreso se viera igual que el ranking volvería el problema que esta
 * pantalla vino a arreglar.
 */
const CARA_MATE: React.CSSProperties = {
  backgroundColor: 'var(--color-swu-bg)',
  backgroundImage: VETA,
}

/** La del primero. */
const CARA_ORO: React.CSSProperties = {
  backgroundColor: 'var(--color-swu-surface)',
  backgroundImage: `${PRISMA}, ${LUSTRE}, ${VETA}`,
}

/**
 * El canto de la placa: el div de abajo del sándwich, que asoma 1 px.
 *
 * Tiene que llegar a 3:1 contra el fondo de página o la placa no se ve como
 * placa. Medido contra #181825: #2A2A3C da 1,25 · #454560 da 1,90 · #62628F
 * da 3,06. Por eso el canto neutro es una mezcla al 55% con `muted` y no un
 * borde tenue como el resto de la app.
 */
const CANTO_NEUTRO = 'color-mix(in srgb, var(--color-swu-muted) 55%, var(--color-swu-bg))'
const CANTO_PODIO = ['var(--color-swu-amber)', 'var(--color-swu-muted)', 'var(--color-swu-accent)']

const VENTANAS = [
  { dias: null as number | null, etiqueta: 'Siempre' },
  { dias: 90, etiqueta: '90 días' },
  { dias: 30, etiqueta: '30 días' },
]

export function RankingPage() {
  const { currentProfile } = useAuth()
  const [pestana, setPestana] = useState<'ranking' | 'progreso'>('ranking')
  const [dias, setDias] = useState<number | null>(null)
  /** `null` = todas las sedes (el ranking de siempre). */
  const [sede, setSede] = useState<string | null>(null)
  const [sedes, setSedes] = useState<Sede[]>([])
  /** Qué se mide: las dos fuentes juntas, solo torneo, o solo amistosas. */
  const [fuente, setFuente] = useState<Fuente>('todo')
  const [filas, setFilas] = useState<FilaRanking[]>([])
  const [progreso, setProgreso] = useState<GlobalLeaderboardEntry[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const miId = currentProfile?.id ?? ''

  // Las sedes se piden UNA vez: son dos filas y no cambian mientras mirás.
  useEffect(() => {
    let vivo = true
    void (async () => {
      const v = await listarSedes()
      if (vivo) setSedes(v)
    })()
    return () => { vivo = false }
  }, [])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    const r = await getRankingUnificado(dias, sede)
    if (r.ok) setFilas(r.datos)
    else setError(r.mensaje)
    setCargando(false)
  }, [dias, sede])

  // Envuelto en una función asíncrona a propósito: llamarlo en seco desde el
  // cuerpo del efecto encadena un render antes de que React pinte, y el lint
  // del compilador de React lo veta (misma regla que en CommunityPage).
  useEffect(() => { void (async () => { await cargar() })() }, [cargar])

  useEffect(() => {
    if (pestana !== 'progreso' || progreso.length > 0) return
    let vivo = true
    void (async () => {
      const lista = await getGlobalLeaderboard()
      if (vivo) setProgreso(lista)
    })()
    return () => { vivo = false }
  }, [pestana, progreso.length])

  /* Con una sede puesta el ranking YA es solo de torneos —una amistosa se
     juega en la casa de cualquiera y no tiene tienda—, así que «Amistosas»
     ahí daría siempre una tabla vacía.
     Se DERIVA en vez de corregir el estado en un efecto: escribirlo encadena
     un render de más, y además perdería lo que la persona había elegido.
     Así, al soltar la sede vuelve sola a la pestaña en la que estaba. */
  const fuenteViva: Fuente = sede !== null && fuente === 'amistosa' ? 'todo' : fuente

  /* La tabla que se ve. Se reproyecta lo YA traído: pedirle otra consulta al
     servidor por cada fuente es como se llega a que el total no cuadre con
     las partes. */
  const vista = useMemo(() => porFuente(filas, fuenteViva), [filas, fuenteViva])

  const mio = miId ? miPosicion(vista, miId) : null
  const podio = vista.slice(0, 3)
  const resto = vista.slice(3)

  return (
    <div className="p-4 lg:p-6 pb-24 max-w-3xl mx-auto space-y-4">
      {/* La cabecera del archivo. Trae de la credencial: el código de barras
          del borde —acá como UN degradado repetido, no 13 <rect>—, el rótulo
          en versalitas espaciadas y el canto metálico. Es la única instancia
          de cada cosa en la pantalla, así que no cuesta nada. */}
      <div className="clip-placa p-px" style={{ backgroundColor: CANTO_NEUTRO }}>
        <div className="clip-placa flex items-start justify-between gap-3 px-4 py-3" style={CARA}>
          <div className="flex items-stretch gap-3">
            <span
              aria-hidden
              className="w-2 shrink-0"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, var(--color-swu-muted) 0 2px,' +
                  ' transparent 2px 5px, var(--color-swu-muted) 5px 8px, transparent 8px 12px)',
                opacity: 0.45,
              }}
            />
            <div>
              <h1 className="grabado text-lg font-black tracking-[0.18em] text-swu-text">RANKING</h1>
              <p className="text-[11px] text-swu-muted">Quién gana partidas en la comunidad.</p>
            </div>
          </div>
        <button
          onClick={() => void cargar()}
          aria-label="Actualizar"
          className="clip-chapa flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-swu-muted active:scale-95"
          style={{ backgroundColor: 'var(--color-swu-bg)', backgroundImage: LUSTRE }}
        >
          <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} />
        </button>
        </div>
      </div>

      {/* Dos pestañas, y la segunda dice que NO es un ranking. Ese rótulo es
          el arreglo: el problema nunca fue tener dos números, fue que los dos
          se llamaban igual. */}
      <div className="grid grid-cols-2 gap-2 [&>span]:w-full">
        <Pestana activa={pestana === 'ranking'} onClick={() => setPestana('ranking')}
                 icono={<Swords size={14} />} texto="Ranking" />
        <Pestana activa={pestana === 'progreso'} onClick={() => setPestana('progreso')}
                 icono={<TrendingUp size={14} />} texto="Progreso" />
      </div>

      {pestana === 'ranking' ? (
        <>
          {/* ── Sede ──
              Va ARRIBA de la ventana de tiempo porque cambia QUÉ se mide, no
              cuánto: la de tiempo recorta el mismo ranking, esta lo cambia por
              otro. Solo aparece si hay más de una tienda; con una sola, un
              selector de un botón es ruido. */}
          {sedes.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {[{ id: null as string | null, name: 'Todas' }, ...sedes].map((v) => (
                <button
                  key={v.id ?? 'todas'}
                  onClick={() => setSede(v.id)}
                  className={`clip-chapa min-h-[44px] shrink-0 px-3 text-[12px] font-bold transition-colors ${
                    sede === v.id ? 'text-swu-accent-texto' : 'text-swu-muted'
                  }`}
                  style={sede === v.id
                    ? { backgroundColor: 'color-mix(in srgb, var(--color-swu-accent) 18%, var(--color-swu-bg))', backgroundImage: LUSTRE }
                    : { backgroundColor: 'var(--color-swu-bg)', backgroundImage: VETA }}
                >
                  {v.name}
                </button>
              ))}
            </div>
          )}

          {/* Qué se mide. Va con la sede y no con la ventana de tiempo: la
              ventana recorta la misma tabla, esto la cambia por otra. */}
          <div className="flex gap-2">
            {(['todo', 'torneo', 'amistosa'] as Fuente[])
              .filter((f) => !(sede !== null && f === 'amistosa'))
              .map((f) => (
                <button
                  key={f}
                  onClick={() => setFuente(f)}
                  className={`clip-chapa min-h-[44px] flex-1 px-2 text-[12px] font-bold transition-colors ${
                    fuenteViva === f ? 'text-swu-accent-texto' : 'text-swu-muted'
                  }`}
                  style={fuenteViva === f
                    ? { backgroundColor: 'color-mix(in srgb, var(--color-swu-accent) 18%, var(--color-swu-bg))', backgroundImage: LUSTRE }
                    : { backgroundColor: 'var(--color-swu-bg)', backgroundImage: VETA }}
                >
                  {NOMBRE_FUENTE[f]}
                </button>
              ))}
          </div>

          <div className="flex gap-2">
            {VENTANAS.map((v) => (
              <button
                key={v.etiqueta}
                onClick={() => setDias(v.dias)}
                className={`clip-chapa min-h-[44px] flex-1 px-2 text-[12px] font-bold transition-colors ${
                  dias === v.dias ? 'text-swu-accent-texto' : 'text-swu-muted'
                }`}
                style={dias === v.dias
                  ? { backgroundColor: 'color-mix(in srgb, var(--color-swu-accent) 18%, var(--color-swu-bg))', backgroundImage: LUSTRE }
                  : { backgroundColor: 'var(--color-swu-bg)', backgroundImage: VETA }}
              >
                {v.etiqueta}
              </button>
            ))}
          </div>

          <p className="clip-chapa flex items-start gap-1.5 px-3 py-2 text-[11px] text-swu-muted"
             style={{ backgroundColor: 'var(--color-swu-bg)', backgroundImage: VETA }}>
            <Info size={13} className="mt-0.5 shrink-0 text-swu-accent-texto" />
            <span>
              {REGLA_DE[fuenteViva]}
              {fuenteViva === 'todo' && '. Las amistosas cuentan solo si el rival las confirmó'}
              {fuenteViva === 'torneo' && '. Las amistosas no entran acá'}.
              {sede !== null && ' En el ranking de una sede solo cuentan sus torneos: una amistosa no se juega en ninguna tienda.'}
            </span>
          </p>

          {error && (
            <p className="rounded-xl border border-swu-amber/40 bg-swu-amber/10 px-3 py-2 text-[12px] text-swu-amber">
              {error}
            </p>
          )}

          {!cargando && vista.length === 0 && !error && (
            <div className="clip-placa p-px" style={{ backgroundColor: CANTO_NEUTRO }}>
             <div className="clip-placa p-6 text-center" style={CARA_MATE}>
              <Trophy size={26} className="mx-auto mb-2 text-swu-muted" />
              <p className="text-sm font-bold text-swu-text">
                {fuenteViva === 'amistosa' ? 'Todavía no hay amistosas confirmadas en esta ventana'
                  : fuenteViva === 'torneo' ? 'Todavía no hay torneos en esta ventana'
                  : 'Todavía no hay partidas en esta ventana'}
              </p>
              <p className="mt-1 text-[11px] text-swu-muted">
                {fuenteViva === 'amistosa'
                  ? 'Una amistosa entra cuando el rival acepta el marcador que le pusieron.'
                  : fuenteViva === 'torneo'
                  ? 'Se llena con la clasificación de cada torneo que se cierra.'
                  : 'El ranking se llena con los torneos que se juegan y con las amistosas que ambos jugadores confirman.'}
              </p>
             </div>
            </div>
          )}

          {podio.length > 0 && (
            <div className="rounded-2xl border border-swu-accent/20 bg-gradient-to-br from-swu-accent/10 to-transparent p-4">
              <p className="mb-3 text-center text-[11px] font-black uppercase tracking-[0.2em] text-swu-accent-texto">
                Consejo Jedi
              </p>
              {/* Orden visual 2-1-3: el campeón al centro y más grande. */}
              <div className="flex items-end justify-center gap-3">
                {[1, 0, 2].map((i) => podio[i] && (
                  <Podio key={podio[i].clave} fila={podio[i]} puesto={i}
                         grande={i === 0} soyYo={podio[i].userId === miId} />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {resto.map((f, i) => (
              <Fila key={f.clave} fila={f} puesto={i + 4} soyYo={f.userId === miId} />
            ))}
          </div>

          {/* Tu posición, solo si no se ve ya en la lista de arriba. */}
          {mio && mio.puesto > 3 && (
            <div className="pt-1">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-swu-muted">Tu posición</p>
              <Fila fila={mio.fila} puesto={mio.puesto} soyYo />
            </div>
          )}
          {miId && !mio && !cargando && vista.length > 0 && (
            <p className="rounded-xl border border-swu-border bg-swu-surface/60 px-3 py-2.5 text-[11px] text-swu-muted">
              Todavía no aparecés: el ranking cuenta torneos y amistosas confirmadas. Anotá una
              partida en Amistosas y pedile a tu rival que la confirme.
            </p>
          )}
        </>
      ) : (
        <>
          {/* El rótulo más importante de la pantalla. */}
          <div className="clip-placa p-px" style={{ backgroundColor: CANTO_NEUTRO }}>
           <div className="clip-placa p-4" style={CARA_MATE}>
            <p className="grabado text-sm font-bold text-swu-text">Esto no es el ranking</p>
            <p className="mt-1 text-[11px] leading-relaxed text-swu-muted">
              El progreso mide cuánto usás la app: cartas que registrás, mazos que armás, misiones,
              logros y días seguidos. Sube aunque no juegues una sola partida, así que no dice quién
              juega mejor — para eso está la pestaña Ranking.
            </p>
           </div>
          </div>

          <div className="space-y-1.5">
            {progreso.map((p, i) => (
              <div
                key={p.userId}
                /* Mate y con esquinas rectas: la placa recortada es del
                   ranking. Si estas filas llevaran el mismo metal, las dos
                   tablas volverían a parecer lo mismo, que es justo lo que
                   esta pantalla vino a arreglar. */
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                  p.userId === miId ? 'bg-swu-accent/10' : ''
                }`}
                style={{ backgroundImage: VETA }}
              >
                <span className="w-7 text-center font-mono text-[11px] font-bold text-swu-muted">{i + 1}</span>
                <Avatar avatar={p.avatar || ''} size={32} caja="circulo" anillo={p.userId} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-swu-text">{nombreLimpio(p.name)}</p>
                  <p className="font-mono text-[9px] text-swu-muted">Nivel {p.level}</p>
                </div>
                <div className="flex items-center gap-1">
                  <IconXp size={12} className="text-swu-accent-texto" />
                  <span className="font-mono text-sm font-extrabold text-swu-accent-texto">{p.xp}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Pestaña como chapa: la activa va ALZADA (labio de luz arriba) y la otra
 * HUNDIDA (sombra arriba). Es el mismo bisel de la credencial, pero con un par
 * de `box-shadow` inset SIN desenfoque en vez de un filtro de cinco
 * primitivas: la sombra inset la compone la GPU y no promueve capa.
 *
 * El foco va en un ENVOLTORIO sin recorte: `clip-path` se come el `outline`
 * del propio elemento, así que un anillo dibujado sobre la chapa no existiría.
 */
function Pestana({ activa, onClick, icono, texto }: {
  activa: boolean; onClick: () => void; icono: React.ReactNode; texto: string
}) {
  return (
    <span className="chapa-foco has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-swu-accent">
      <button
        onClick={onClick}
        aria-pressed={activa}
        className={`clip-chapa flex min-h-[44px] w-full items-center justify-center gap-1.5 px-3 text-xs font-bold transition-colors focus-visible:outline-none ${
          activa ? 'text-swu-accent-texto' : 'text-swu-muted'
        }`}
        style={{
          backgroundColor: activa
            ? 'color-mix(in srgb, var(--color-swu-accent) 18%, var(--color-swu-bg))'
            : 'var(--color-swu-bg)',
          backgroundImage: activa ? LUSTRE : VETA,
          boxShadow: activa
            ? 'inset 0 1px 0 rgba(255,255,255,.14), inset 0 -1px 0 rgba(0,0,0,.45)'
            : 'inset 0 1px 0 rgba(0,0,0,.5), inset 0 -1px 0 rgba(255,255,255,.05)',
        }}
      >
        {icono} {texto}
      </button>
    </span>
  )
}

/**
 * Sello de quien jugó pero no tiene cuenta.
 *
 * NO cambia el MATERIAL de la placa, y esa fue la corrección más importante
 * del diseño: el acabado se gana por PUESTO, nunca por estar registrado. Hoy
 * el campeón real del torneo no tiene cuenta — degradarle la placa por eso
 * diría exactamente lo contrario de lo que el ranking quiere decir.
 */
function SelloSinCuenta() {
  return (
    <span
      className="clip-chapa shrink-0 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-swu-muted"
      style={{ backgroundColor: 'var(--color-swu-bg)' }}
    >
      sin cuenta
    </span>
  )
}

/** «Sos vos», con PALABRAS y no solo con color: una fila teñida no dice nada
 *  a un lector de pantalla ni a quien no distingue ese tono. */
function SelloVos() {
  return (
    <span
      // Tinta de acento sobre fondo oscuro, y NO al revés: medido, el texto
      // `accent-fg` sobre `accent` da 3,92:1 a 11 px, por debajo del 4,5
      // que pide un texto normal. Así se va a 7 y pico.
      className="clip-chapa shrink-0 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-swu-accent-texto"
      style={{ backgroundColor: 'var(--color-swu-bg)' }}
    >
      vos
    </span>
  )
}

/**
 * El sándwich de la placa: el div de afuera es el CANTO —asoma 1 px— y el de
 * adentro la cara. Hacen falta los dos porque `clip-path` se come el `border`
 * y la sombra exterior del propio elemento: un borde normal sencillamente no
 * se dibujaría.
 */
function Placa({ canto, cara, forma, children, marcada }: {
  canto: string
  cara: React.CSSProperties
  forma: 'clip-placa' | 'clip-placa-podio'
  children: React.ReactNode
  marcada?: boolean
}) {
  return (
    <div className={`${forma} p-px`} style={{ backgroundColor: canto }} aria-current={marcada ? 'true' : undefined}>
      <div className={`${forma} h-full w-full`} style={cara}>{children}</div>
    </div>
  )
}

/** El avatar con su anillo de identidad. El anillo va POR DENTRO (`inset`):
 *  uno exterior lo recortaría el clip-path. Sigue siendo el mismo
 *  `colorDePersona` con que se reconoce a alguien en el resto de la app. */
function Retrato({ fila, size }: { fila: FilaRanking; size: number }) {
  const anillo = colorDePersona(fila.clave)
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{ width: size, height: size, boxShadow: `inset 0 0 0 2px ${anillo}` }}
    >
      {fila.avatar ? (
        <Avatar avatar={fila.avatar} size={size} caja="circulo" />
      ) : (
        /* Quien no tiene cuenta no tiene avatar, y son 3 de cada 10 filas: sin
           esto la ventana queda como un agujero negro y parece que faltó
           cargar algo. Va la inicial grabada, con el mismo anillo de color que
           todos —el color sale de la clave, no del perfil— así que sigue
           siendo la misma persona reconocible. */
        <span
          className="grabado font-mono font-bold text-swu-muted"
          style={{ fontSize: Math.round(size * 0.45) }}
          aria-hidden
        >
          {nombreLimpio(fila.nombre).charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  )
}

/** La banda de la credencial, acá bajo los puntos. Va con LUSTRE y nunca con
 *  el degradado cromado: medido parada por parada, el cromo deja el texto
 *  entre 1,13:1 y 1,74:1 en la franja del medio, que es justo donde cae un
 *  número grande. */
function Puntos({ valor, grande }: { valor: number; grande?: boolean }) {
  return (
    <div
      className={`clip-chapa shrink-0 ${grande ? 'w-full py-0.5 text-center' : 'px-2.5 py-1'}`}
      style={{ backgroundColor: 'var(--color-swu-bg)', backgroundImage: LUSTRE }}
    >
      <span className={`grabado font-mono font-bold leading-none text-swu-text ${grande ? 'text-[17px]' : 'text-[15px]'}`}>
        {valor}
      </span>
    </div>
  )
}

function Podio({ fila, puesto, grande, soyYo }: {
  fila: FilaRanking; puesto: number; grande: boolean; soyYo: boolean
}) {
  return (
    <Placa canto={CANTO_PODIO[puesto]} cara={puesto === 0 ? CARA_ORO : CARA}
           forma="clip-placa-podio" marcada={soyYo}>
      <div className={`flex flex-col items-center gap-1 px-2 pb-2 ${grande ? 'pt-4' : 'pt-3'}`}>
        <span className="grabado font-mono text-[11px] font-extrabold text-swu-muted">{puesto + 1}</span>
        <Retrato fila={fila} size={grande ? 60 : 46} />
        <p className="max-w-[92px] truncate text-center text-[12px] font-bold text-swu-text">
          {nombreLimpio(fila.nombre)}
        </p>
        <div className="w-full px-1"><Puntos valor={fila.puntos} grande /></div>
        <span className="font-mono text-[11px] text-swu-muted">{recordDe(fila)}</span>
        {!fila.userId && <SelloSinCuenta />}
        {soyYo && <SelloVos />}
      </div>
    </Placa>
  )
}

function Fila({ fila, puesto, soyYo }: { fila: FilaRanking; puesto: number; soyYo: boolean }) {
  return (
    <Placa canto={soyYo ? 'var(--color-swu-accent)' : CANTO_NEUTRO}
           cara={soyYo ? CARA_YO : CARA} forma="clip-placa" marcada={soyYo}>
      <div className="flex min-h-[50px] items-center gap-3 py-2 pl-4 pr-3">
        <span className="grabado w-7 shrink-0 text-center font-mono text-sm font-extrabold text-swu-muted">
          {puesto}
        </span>
        <Retrato fila={fila} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {/* En caja baja a propósito. La credencial va en versalitas porque
                son seis datos cortos; 25 nombres en mayúsculas son un muro que
                cuesta escanear, y el ranking se consulta, no se contempla. */}
            <p className={`truncate text-[13px] font-bold ${soyYo ? 'text-swu-accent-texto' : 'text-swu-text'}`}>
              {nombreLimpio(fila.nombre)}
            </p>
            {!fila.userId && <SelloSinCuenta />}
            {soyYo && <SelloVos />}
          </div>
          <p className="font-mono text-[11px] text-swu-muted">
            {recordDe(fila)}
            {fila.torneos > 0 && ` · ${fila.torneos} torneo${fila.torneos > 1 ? 's' : ''}`}
            {fila.amistosas > 0 && ` · ${fila.amistosas} amistosa${fila.amistosas > 1 ? 's' : ''}`}
          </p>
        </div>
        <Puntos valor={fila.puntos} />
      </div>
    </Placa>
  )
}

/**
 * Banco del ranking. Solo desarrollo (`/banco-ranking`).
 *
 * La pantalla real vive detrás de la sesión, así que no había forma de mirarla
 * ni de medirle el contraste sin una cuenta. Acá se pinta con los datos REALES
 * de producción —incluido el caso que rompe cualquier diseño ingenuo: el
 * primero no tiene cuenta— para poder verificar en el navegador.
 *
 * Se cae del bundle de producción: `import.meta.env.DEV` es un literal y el
 * empaquetador poda la rama entera (mismo patrón que BancoCredencial).
 */
/* El desglose del banco se DERIVA de si la fila era de torneo o de amistosa,
   en vez de escribirlo doce veces a mano: el banco existe para mirar la
   pantalla, no para inventar un caso mixto que en producción no se dio. */
const conDesglose = (f: Omit<FilaRanking,
  'puntosTorneo' | 'victoriasTorneo' | 'derrotasTorneo' | 'empatesTorneo' |
  'puntosAmistosa' | 'victoriasAmistosa' | 'derrotasAmistosa'>): FilaRanking => {
  const t = f.torneos > 0
  return {
    ...f,
    puntosTorneo: t ? f.puntos : 0,
    victoriasTorneo: t ? f.victorias : 0,
    derrotasTorneo: t ? f.derrotas : 0,
    empatesTorneo: t ? f.empates : 0,
    puntosAmistosa: t ? 0 : f.puntos,
    victoriasAmistosa: t ? 0 : f.victorias,
    derrotasAmistosa: t ? 0 : f.derrotas,
  }
}

const BANCO: FilaRanking[] = ([
  { clave: 'nombre:marlin', nombre: 'Marlin', userId: null, avatar: null, puntos: 9, victorias: 3, derrotas: 0, empates: 0, torneos: 1, amistosas: 0 },
  { clave: 'u2', nombre: 'iNelo', userId: 'u2', avatar: 'boba-fett', puntos: 6, victorias: 2, derrotas: 1, empates: 0, torneos: 1, amistosas: 0 },
  { clave: 'u3', nombre: 'Jbeltramirez', userId: 'u3', avatar: 'darth-vader', puntos: 6, victorias: 2, derrotas: 1, empates: 0, torneos: 1, amistosas: 0 },
  { clave: 'u4', nombre: 'Vara', userId: 'u4', avatar: 'r2d2', puntos: 6, victorias: 2, derrotas: 1, empates: 0, torneos: 1, amistosas: 0 },
  { clave: 'u5', nombre: 'Nelson', userId: 'u5', avatar: 'jedi-order', puntos: 4, victorias: 1, derrotas: 1, empates: 1, torneos: 1, amistosas: 0 },
  { clave: 'nombre:erasmo', nombre: 'Erasmo', userId: null, avatar: null, puntos: 3, victorias: 1, derrotas: 2, empates: 0, torneos: 1, amistosas: 0 },
  { clave: 'u7', nombre: 'Satou02', userId: 'u7', avatar: 'stormtrooper', puntos: 1, victorias: 1, derrotas: 0, empates: 0, torneos: 0, amistosas: 1 },
  { clave: 'u8', nombre: 'LuisG05', userId: 'u8', avatar: 'phasma', puntos: 1, victorias: 0, derrotas: 2, empates: 1, torneos: 1, amistosas: 0 },
  { clave: 'nombre:cesar', nombre: 'Cesar', userId: null, avatar: null, puntos: 0, victorias: 0, derrotas: 3, empates: 0, torneos: 1, amistosas: 0 },
  { clave: 'u10', nombre: 'WayoMendoza', userId: 'u10', avatar: 'c3po', puntos: 0, victorias: 0, derrotas: 1, empates: 0, torneos: 0, amistosas: 1 },
]).map(conDesglose)

export function BancoRanking() {
  const podio = BANCO.slice(0, 3)
  const resto = BANCO.slice(3)
  const miClave = 'u5'
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
      <p className="text-xs font-mono tracking-wider text-swu-muted">BANCO DEL RANKING · datos reales</p>

      {/* Cabecera */}
      <div className="clip-placa p-px" style={{ backgroundColor: CANTO_NEUTRO }}>
        <div className="clip-placa flex items-start justify-between gap-3 px-4 py-3" style={CARA}>
          <div className="flex items-stretch gap-3">
            <span aria-hidden className="w-2 shrink-0" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, var(--color-swu-muted) 0 2px, transparent 2px 5px, var(--color-swu-muted) 5px 8px, transparent 8px 12px)',
              opacity: 0.45 }} />
            <div>
              <h1 className="grabado text-lg font-black tracking-[0.18em] text-swu-text">RANKING</h1>
              <p className="text-[11px] text-swu-muted">Quién gana partidas en la comunidad.</p>
            </div>
          </div>
          <button className="clip-chapa flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-swu-muted"
                  style={{ backgroundColor: 'var(--color-swu-bg)', backgroundImage: LUSTRE }}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 [&>span]:w-full">
        <Pestana activa onClick={() => {}} icono={<Swords size={14} />} texto="Ranking" />
        <Pestana activa={false} onClick={() => {}} icono={<TrendingUp size={14} />} texto="Progreso" />
      </div>

      <div className="flex gap-2">
        {VENTANAS.map((v, i) => (
          <button key={v.etiqueta}
            className={`clip-chapa min-h-[44px] flex-1 px-2 text-[12px] font-bold ${i === 0 ? 'text-swu-accent-texto' : 'text-swu-muted'}`}
            style={i === 0
              ? { backgroundColor: 'color-mix(in srgb, var(--color-swu-accent) 18%, var(--color-swu-bg))', backgroundImage: LUSTRE }
              : { backgroundColor: 'var(--color-swu-bg)', backgroundImage: VETA }}>
            {v.etiqueta}
          </button>
        ))}
      </div>

      <p className="clip-chapa flex items-start gap-1.5 px-3 py-2 text-[11px] text-swu-muted"
         style={{ backgroundColor: 'var(--color-swu-bg)', backgroundImage: VETA }}>
        <Info size={13} className="mt-0.5 shrink-0 text-swu-accent-texto" />
        <span>{REGLA_PUNTOS}. Las amistosas cuentan solo si el rival las confirmó.</span>
      </p>

      <div className="rounded-2xl border border-swu-accent/20 bg-gradient-to-br from-swu-accent/10 to-transparent p-4">
        <p className="mb-3 text-center text-[11px] font-black uppercase tracking-[0.2em] text-swu-accent-texto">
          Consejo Jedi
        </p>
        <div className="flex items-end justify-center gap-3">
          {[1, 0, 2].map((i) => podio[i] && (
            <Podio key={podio[i].clave} fila={podio[i]} puesto={i}
                   grande={i === 0} soyYo={podio[i].clave === miClave} />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        {resto.map((f, i) => (
          <Fila key={f.clave} fila={f} puesto={i + 4} soyYo={f.clave === miClave} />
        ))}
      </div>

      {/* Progreso: MATE a propósito, para comprobar que NO se confunde. */}
      <div className="clip-placa p-px" style={{ backgroundColor: CANTO_NEUTRO }}>
        <div className="clip-placa p-4" style={CARA_MATE}>
          <p className="grabado text-sm font-bold text-swu-text">Esto no es el ranking</p>
          <p className="mt-1 text-[11px] leading-relaxed text-swu-muted">
            El progreso mide cuánto usás la app. Sube aunque no juegues una sola partida.
          </p>
        </div>
      </div>
    </div>
  )
}


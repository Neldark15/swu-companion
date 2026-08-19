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

import { useCallback, useEffect, useState } from 'react'
import { Trophy, RefreshCw, Swords, Medal, Info, TrendingUp } from 'lucide-react'
import {
  getRankingUnificado, recordDe, miPosicion, REGLA_PUNTOS, type FilaRanking,
} from '../../services/rankingUnificado'
import { getGlobalLeaderboard, type GlobalLeaderboardEntry } from '../../services/sync'
import { useAuth } from '../../hooks/useAuth'
import { Avatar } from '../../components/ui/Avatar'
import { IconXp } from '../../components/icons/SWUIcons'

/** Nombres que en realidad son un uid perdido. */
function nombreLimpio(nombre: string): string {
  if (!nombre) return 'Jugador'
  if (nombre.length >= 20 && !/\s/.test(nombre) && /^[a-zA-Z0-9_-]+$/.test(nombre)) return 'Jugador'
  return nombre
}

const ANILLO_PODIO = ['ring-2 ring-amber-400', 'ring-2 ring-slate-300', 'ring-2 ring-amber-700']
const CHAPA_PODIO = [
  'bg-amber-400/20 text-amber-300',
  'bg-slate-300/20 text-slate-200',
  'bg-amber-700/20 text-amber-500',
]

const VENTANAS = [
  { dias: null as number | null, etiqueta: 'Siempre' },
  { dias: 90, etiqueta: '90 días' },
  { dias: 30, etiqueta: '30 días' },
]

export function RankingPage() {
  const { currentProfile } = useAuth()
  const [pestana, setPestana] = useState<'ranking' | 'progreso'>('ranking')
  const [dias, setDias] = useState<number | null>(null)
  const [filas, setFilas] = useState<FilaRanking[]>([])
  const [progreso, setProgreso] = useState<GlobalLeaderboardEntry[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const miId = currentProfile?.id ?? ''

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    const r = await getRankingUnificado(dias)
    if (r.ok) setFilas(r.datos)
    else setError(r.mensaje)
    setCargando(false)
  }, [dias])

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

  const mio = miId ? miPosicion(filas, miId) : null
  const podio = filas.slice(0, 3)
  const resto = filas.slice(3)

  return (
    <div className="p-4 lg:p-6 pb-24 max-w-3xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-swu-text">RANKING</h1>
          <p className="text-xs text-swu-muted">Quién gana partidas en El Salvador.</p>
        </div>
        <button
          onClick={() => void cargar()}
          aria-label="Actualizar"
          className="rounded-xl border border-swu-border p-2 text-swu-muted active:scale-95"
        >
          <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Dos pestañas, y la segunda dice que NO es un ranking. Ese rótulo es
          el arreglo: el problema nunca fue tener dos números, fue que los dos
          se llamaban igual. */}
      <div className="grid grid-cols-2 gap-2">
        <Pestana activa={pestana === 'ranking'} onClick={() => setPestana('ranking')}
                 icono={<Swords size={14} />} texto="Ranking" />
        <Pestana activa={pestana === 'progreso'} onClick={() => setPestana('progreso')}
                 icono={<TrendingUp size={14} />} texto="Progreso" />
      </div>

      {pestana === 'ranking' ? (
        <>
          <div className="flex gap-2">
            {VENTANAS.map((v) => (
              <button
                key={v.etiqueta}
                onClick={() => setDias(v.dias)}
                className={`flex-1 rounded-xl px-2 py-1.5 text-[11px] font-bold transition-colors ${
                  dias === v.dias
                    ? 'bg-swu-accent text-swu-accent-fg'
                    : 'border border-swu-border text-swu-muted'
                }`}
              >
                {v.etiqueta}
              </button>
            ))}
          </div>

          <p className="flex items-start gap-1.5 rounded-xl border border-swu-border bg-swu-surface/60 px-3 py-2 text-[11px] text-swu-muted">
            <Info size={13} className="mt-0.5 shrink-0 text-swu-accent-texto" />
            <span>{REGLA_PUNTOS}. Las amistosas cuentan solo si el rival las confirmó.</span>
          </p>

          {error && (
            <p className="rounded-xl border border-swu-amber/40 bg-swu-amber/10 px-3 py-2 text-[12px] text-swu-amber">
              {error}
            </p>
          )}

          {!cargando && filas.length === 0 && !error && (
            <div className="rounded-2xl border border-swu-border bg-swu-surface p-6 text-center">
              <Trophy size={26} className="mx-auto mb-2 text-swu-muted" />
              <p className="text-sm font-bold text-swu-text">Todavía no hay partidas en esta ventana</p>
              <p className="mt-1 text-[11px] text-swu-muted">
                El ranking se llena con los torneos que se juegan y con las amistosas que ambos
                jugadores confirman.
              </p>
            </div>
          )}

          {podio.length > 0 && (
            <div className="rounded-2xl border border-swu-accent/20 bg-gradient-to-br from-swu-accent/10 to-transparent p-4">
              <p className="mb-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-swu-accent-texto">
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
          {miId && !mio && !cargando && filas.length > 0 && (
            <p className="rounded-xl border border-swu-border bg-swu-surface/60 px-3 py-2.5 text-[11px] text-swu-muted">
              Todavía no aparecés: el ranking cuenta torneos y amistosas confirmadas. Anotá una
              partida en Amistosas y pedile a tu rival que la confirme.
            </p>
          )}
        </>
      ) : (
        <>
          {/* El rótulo más importante de la pantalla. */}
          <div className="rounded-2xl border border-swu-border bg-swu-surface p-4">
            <p className="text-sm font-bold text-swu-text">Esto no es el ranking</p>
            <p className="mt-1 text-[11px] leading-relaxed text-swu-muted">
              El progreso mide cuánto usás la app: cartas que registrás, mazos que armás, misiones,
              logros y días seguidos. Sube aunque no juegues una sola partida, así que no dice quién
              juega mejor — para eso está la pestaña Ranking.
            </p>
          </div>

          <div className="space-y-1.5">
            {progreso.map((p, i) => (
              <div
                key={p.userId}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
                  p.userId === miId
                    ? 'border border-swu-accent/30 bg-swu-accent/10'
                    : 'border border-swu-border bg-swu-surface/60'
                }`}
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

function Pestana({ activa, onClick, icono, texto }: {
  activa: boolean; onClick: () => void; icono: React.ReactNode; texto: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors ${
        activa ? 'bg-swu-accent text-swu-accent-fg' : 'border border-swu-border text-swu-muted'
      }`}
    >
      {icono} {texto}
    </button>
  )
}

/** La etiqueta de quien jugó pero no tiene cuenta. No es un error: es la
 *  mitad del torneo real, y esconderlos dejaría al campeón fuera. */
function SinCuenta() {
  return (
    <span className="rounded-full bg-swu-bg px-1.5 py-0.5 text-[8px] font-bold text-swu-muted">
      sin cuenta
    </span>
  )
}

function Podio({ fila, puesto, grande, soyYo }: {
  fila: FilaRanking; puesto: number; grande: boolean; soyYo: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${CHAPA_PODIO[puesto]}`}>
        #{puesto + 1}
      </span>
      <div className={`rounded-full ${ANILLO_PODIO[puesto]} bg-swu-bg p-0.5`}>
        <Avatar avatar={fila.avatar || ''} size={grande ? 64 : 48} caja="circulo" anillo={fila.clave} />
      </div>
      <p className={`max-w-[92px] truncate text-center text-[11px] font-bold ${soyYo ? 'text-swu-accent-texto' : 'text-swu-text'}`}>
        {nombreLimpio(fila.nombre)}
      </p>
      <div className="flex items-center gap-0.5">
        <Medal size={10} className="text-swu-accent-texto" />
        <span className="text-[10px] font-bold text-swu-accent-texto">{fila.puntos} pts</span>
      </div>
      <span className="font-mono text-[9px] text-swu-muted">{recordDe(fila)}</span>
      {!fila.userId && <SinCuenta />}
    </div>
  )
}

function Fila({ fila, puesto, soyYo }: { fila: FilaRanking; puesto: number; soyYo: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
        soyYo ? 'border border-swu-accent/30 bg-swu-accent/10' : 'border border-swu-border bg-swu-surface/60'
      }`}
    >
      <span className="w-7 text-center font-mono text-sm font-extrabold text-swu-muted">{puesto}</span>
      <Avatar avatar={fila.avatar || ''} size={32} caja="circulo" anillo={fila.clave} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={`truncate text-xs font-bold ${soyYo ? 'text-swu-accent-texto' : 'text-swu-text'}`}>
            {nombreLimpio(fila.nombre)}
          </p>
          {!fila.userId && <SinCuenta />}
        </div>
        {/* De dónde salen sus puntos, en una línea. Es lo que faltaba: antes
            el número no decía de qué era. */}
        <p className="font-mono text-[9px] text-swu-muted">
          {recordDe(fila)}
          {fila.torneos > 0 && ` · ${fila.torneos} torneo${fila.torneos > 1 ? 's' : ''}`}
          {fila.amistosas > 0 && ` · ${fila.amistosas} amistosa${fila.amistosas > 1 ? 's' : ''}`}
        </p>
      </div>
      <span className="font-mono text-sm font-extrabold text-swu-accent-texto">{fila.puntos}</span>
    </div>
  )
}

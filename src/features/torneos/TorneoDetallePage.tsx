/**
 * El detalle de un torneo: podio, clasificación completa y las partidas por ronda.
 *
 * ── La honestidad de esta pantalla ───────────────────────────────────
 *
 * El puesto que se muestra es el que ANUNCIÓ el organizador. Los porcentajes
 * (OMW, GW) son los REALES calculados de las partidas. Cuando el desempate del
 * organizador no coincide con el orden que darían esos porcentajes —como pasa
 * en el torneo del 15/8, donde el piso del 33 % del OMW pondría a otro 2º— la
 * pantalla NO esconde la diferencia: la explica, con la fuente enlazada.
 *
 * Reescribir el puesto sería mentir sobre lo que pasó; maquillar el porcentaje
 * sería mentir con un número. No se hace ninguna de las dos.
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, Trophy, ExternalLink, Info, CalendarDays, MapPin, Users } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Avatar } from '../../components/ui/Avatar'
import { CardImage } from '../../components/CardImage'
import { Tablero, FilaTablero } from '../../components/ui/Tablero'
import { fechaConDiaLarga, hora } from '../../services/horaSV'
import { ensureCards } from '../../services/swuApi'
import { cargarIndice, resolver, nombreCorto, type IndiceCartas } from '../amistosas/cartasAmistosas'
import {
  verTorneo, type TorneoCompleto, type ClasificadoTorneo, type PartidaTorneo,
} from '../../services/torneosHistoricos'

const pct = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} %`

/** La barra de acento del podio, al estilo del broadcast. */
const ACENTO_PODIO: Record<number, string> = {
  1: 'bg-swu-amber',
  2: 'bg-slate-300',
  3: 'bg-orange-400',
}
const NUMERO_PODIO: Record<number, string> = {
  1: 'text-swu-amber',
  2: 'text-slate-200',
  3: 'text-orange-400',
}

/** El mazo de un jugador: arte del líder + nombre de la base. */
function Mazo({ indice, leader, base, compacto }: {
  indice: IndiceCartas | null; leader: string; base: string; compacto?: boolean
}) {
  const carta = resolver(indice, leader)
  if (!leader && !base) return null
  return (
    <div className="flex items-center gap-1.5">
      {carta
        ? <CardImage src={carta.imageUrl} alt="" className={compacto ? 'h-6 w-8 shrink-0 rounded' : 'h-8 w-11 shrink-0 rounded'} orientacion="apaisada" />
        : <div className={`${compacto ? 'h-6 w-8' : 'h-8 w-11'} shrink-0 rounded border border-white/10 bg-white/5`} />}
      {!compacto && (
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold text-white/80">{leader ? nombreCorto(leader) : '—'}</p>
          {base && <p className="truncate text-[9px] text-white/45">{base}</p>}
        </div>
      )}
    </div>
  )
}

function FilaClasificacion({ c, indice }: { c: ClasificadoTorneo; indice: IndiceCartas | null }) {
  const contenido = (
    <FilaTablero acento={ACENTO_PODIO[c.puesto]} cebra={c.puesto % 2 === 0} onClick={c.perfilId ? () => {} : undefined}>
      {/* El número de puesto, grande, como en el marcador de pantalla. */}
      <span className={`w-6 shrink-0 text-center font-mono text-xl font-black ${NUMERO_PODIO[c.puesto] ?? 'text-white/50'}`}>
        {c.puesto}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-black tracking-tight text-white">{c.nombre}</p>
        <p className="font-mono text-[10px] italic text-white/45">
          {c.victorias}-{c.derrotas}-{c.empates} · juegos {c.juegosGanados}-{c.juegosPerdidos}
        </p>
        {/* El mazo, debajo del nombre: es lo que Nel quiere ver de un vistazo. */}
        <div className="mt-1"><Mazo indice={indice} leader={c.leader} base={c.base} /></div>
      </div>
      {/* OMW/GW: los porcentajes reales, en su columna, como COPIES/% del broadcast. */}
      <div className="hidden shrink-0 text-right sm:block">
        <p className="font-mono text-[10px] text-white/50">OMW {pct(c.omw)}</p>
        <p className="font-mono text-[10px] text-white/50">GW {pct(c.gw)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-xl font-black tabular-nums text-white">{c.puntos}</p>
        <p className="font-mono text-[8px] uppercase tracking-widest text-white/40">pts</p>
      </div>
    </FilaTablero>
  )
  // Solo enlaza a quien tiene cuenta; los invitados van sin enlace.
  return c.perfilId ? <Link to={`/u/${c.perfilId}`} className="block">{contenido}</Link> : contenido
}

function Ronda({ n, partidas, indice }: { n: number; partidas: PartidaTorneo[]; indice: IndiceCartas | null }) {
  return (
    <Tablero titulo={`Ronda ${n}`}>
      {partidas.map((p, i) => {
        // El resaltado del ganador solo se puede pintar cuando quien ganó tiene
        // cuenta (hay `ganadorId` que casar). Entre dos invitados el marcador
        // queda visible pero sin negrita — no se adivina por el texto.
        const ganoA = !!p.ganadorId && p.perfilA === p.ganadorId
        const ganoB = !!p.ganadorId && p.perfilB === p.ganadorId
        return (
          <FilaTablero key={p.id} cebra={i % 2 === 1}>
            {/* Lado A: nombre + mini-arte del líder, alineado a la derecha. */}
            <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
              <span className={`min-w-0 truncate text-right text-[13px] ${ganoA ? 'font-black text-white' : 'text-white/55'}`}>
                {p.jugadorA}
              </span>
              <Mazo indice={indice} leader={p.leaderA} base="" compacto />
            </div>
            <span className="shrink-0 rounded border border-swu-cyan/20 bg-swu-cyan/[0.08] px-2.5 py-1 font-mono text-[13px] font-black tabular-nums text-swu-cyan">
              {p.marcador ?? '—'}
            </span>
            {/* Lado B: mini-arte + nombre. */}
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <Mazo indice={indice} leader={p.leaderB} base="" compacto />
              <span className={`min-w-0 truncate text-[13px] ${ganoB ? 'font-black text-white' : 'text-white/55'}`}>
                {p.jugadorB}
              </span>
            </div>
          </FilaTablero>
        )
      })}
    </Tablero>
  )
}

export function TorneoDetallePage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<TorneoCompleto | null>(null)
  const [indice, setIndice] = useState<IndiceCartas | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  // `cargando` se DERIVA, no se setea dentro del efecto: mientras no haya ni
  // datos ni fallo para el código actual, se está cargando. Setearlo síncrono
  // al entrar al efecto dispararía la regla `set-state-in-effect`.
  const [listo, setListo] = useState<string | null>(null)
  const cargando = listo !== code

  useEffect(() => {
    if (!code) return
    let vivo = true
    void (async () => {
      const r = await verTorneo(code)
      if (!vivo) return
      if (r.ok) { setData(r.datos); setFallo(null) }
      else { setData(null); setFallo(r.mensaje) }
      setListo(code)
    })()
    return () => { vivo = false }
  }, [code])

  // El arte de los mazos se resuelve contra la base local de cartas. Va aparte:
  // si todavía no bajó, el torneo se lee igual, solo que sin miniaturas.
  useEffect(() => {
    let vivo = true
    void (async () => {
      await ensureCards()
      const ix = await cargarIndice()
      if (vivo) setIndice(ix)
    })()
    return () => { vivo = false }
  }, [])

  if (cargando) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-4">
        <div className="h-28 animate-pulse rounded-2xl bg-swu-surface" />
        <div className="h-64 animate-pulse rounded-2xl bg-swu-surface" />
      </div>
    )
  }

  if (fallo || !data) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <EmptyState
          icon={<Trophy size={26} />}
          title="Torneo no encontrado"
          hint={fallo ?? 'Ese código no corresponde a ningún torneo.'}
          action={<Button variant="secondary" onClick={() => navigate('/torneos')}>Ver todos los torneos</Button>}
        />
      </div>
    )
  }

  const { torneo, clasificacion, partidas } = data
  const podio = clasificacion.filter(c => c.puesto <= 3)
  const rondas = [...new Set(partidas.map(p => p.ronda))].sort((a, b) => a - b)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 pb-10">
      <header className="flex items-center gap-2">
        <button onClick={() => navigate('/torneos')} aria-label="Volver" className="rounded-lg p-1 text-swu-muted hover:text-swu-text">
          <ChevronLeft size={20} />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-lg font-black tracking-tight text-swu-text">{torneo.nombre}</h2>
      </header>

      {/* Ficha del torneo */}
      <div className="rounded-2xl border border-swu-border bg-swu-surface p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-swu-muted">
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} />{fechaConDiaLarga(torneo.fecha)} · {hora(torneo.fecha)}</span>
          {torneo.lugar && <span className="inline-flex items-center gap-1.5"><MapPin size={13} />{torneo.lugar}</span>}
          <span className="inline-flex items-center gap-1.5"><Users size={13} />{torneo.jugadores} jugadores</span>
          {torneo.rondas && <span>{torneo.rondas} rondas · {torneo.formato}</span>}
        </div>
        {torneo.descripcion && <p className="mt-2 text-[12px] text-swu-text">{torneo.descripcion}</p>}
      </div>

      {/* Podio */}
      {podio.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[2, 1, 3].map(pos => {
            const c = podio.find(x => x.puesto === pos)
            if (!c) return <div key={pos} />
            const alto = pos === 1 ? 'pt-2' : 'pt-5'
            return (
              <div key={pos} className={`flex flex-col items-center ${alto}`}>
                <Avatar
                  avatar={c.avatar}
                  size={pos === 1 ? 64 : 52}
                  anillo={c.perfilId ?? c.nombre}
                />
                <div className={`mt-1 flex h-7 w-7 items-center justify-center rounded-full border border-current font-mono text-xs font-black ${NUMERO_PODIO[pos]}`}>
                  {pos}
                </div>
                <p className="mt-1 max-w-full truncate text-center text-[12px] font-bold text-swu-text">{c.nombre}</p>
                <p className="font-mono text-[10px] text-swu-muted">{c.puntos} pts</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Nota de desempate: solo si la fuente no es esta app. Es lo que evita
          que la tabla parezca contradecirse. */}
      {torneo.fuente && torneo.desempate && (
        <div className="flex items-start gap-2 rounded-xl border border-swu-border bg-swu-bg p-3">
          <Info size={15} className="mt-0.5 shrink-0 text-swu-accent-texto" />
          <div className="min-w-0 text-[11px] leading-snug text-swu-muted">
            <p>
              Puestos según <span className="font-bold text-swu-text">{torneo.desempate}</span>.
              Los porcentajes OMW y GW son los reales de las partidas y pueden ordenar distinto:
              el estándar competitivo aplica un piso del 33 % al OMW que este torneo no usó.
            </p>
            {torneo.fuenteUrl && (
              <a href={torneo.fuenteUrl} target="_blank" rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 font-semibold text-swu-accent-texto">
                Ver el torneo en la fuente <ExternalLink size={11} />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Clasificación completa, con el estilo del tablero de transmisión */}
      <Tablero titulo="Clasificación" extra={`${torneo.jugadores} jugadores`}>
        {clasificacion.map(c => <FilaClasificacion key={c.puesto} c={c} indice={indice} />)}
      </Tablero>

      {/* Partidas por ronda */}
      {rondas.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-[13px] font-black uppercase tracking-widest text-swu-text">Partidas</h3>
          {rondas.map(n => (
            <Ronda key={n} n={n} partidas={partidas.filter(p => p.ronda === n)} indice={indice} />
          ))}
        </section>
      )}

      <p className="pb-4 text-center text-[10px] leading-relaxed text-swu-muted">
        Cobertura comunitaria hecha por fans. No oficial.
      </p>
    </div>
  )
}

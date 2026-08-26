/**
 * LA LIGA — `/liga/:code` (demo: /liga/puente3-t1)
 *
 * La pantalla pública de una liga de creador: la tabla, el fixture por
 * jornadas con los VODs de YouTube embebidos, y la inscripción. Si el que
 * mira es el creador, cada partida pendiente lleva su formulario de reporte.
 *
 * ── El consentimiento no es un checkbox decorativo ────────────────────
 *
 * En esta comunidad hay menores, y una liga de creador se TRANSMITE y se
 * PUBLICA en YouTube. El servidor rechaza la inscripción sin consentimiento
 * (la RPC lo exige, §3i-bis); esta pantalla lo dice con todas las letras
 * ANTES del botón, no en letra chica.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Lock, Trophy, PlayCircle, Check } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  getLiga, getInscripciones, getPartidas, tablaDe, inscribirse, reportarPartida,
  type Liga, type InscripcionLiga, type PartidaLiga,
} from '../../services/ligaService'

export function LigaPage() {
  const { code } = useParams<{ code: string }>()
  const { supabaseUser } = useAuth()
  const [liga, setLiga] = useState<Liga | null>(null)
  const [inscripciones, setInscripciones] = useState<InscripcionLiga[]>([])
  const [partidas, setPartidas] = useState<PartidaLiga[]>([])
  const [cargando, setCargando] = useState(true)
  const [aviso, setAviso] = useState<string | null>(null)

  const [recarga, setRecarga] = useState(0)
  const recargar = useCallback(() => setRecarga(n => n + 1), [])

  useEffect(() => {
    if (!code) return
    let vivo = true
    void (async () => {
      const l = await getLiga(code)
      if (!vivo) return
      setLiga(l)
      if (l) {
        const [ins, par] = await Promise.all([getInscripciones(l.id), getPartidas(l.id)])
        if (!vivo) return
        setInscripciones(ins)
        setPartidas(par)
      }
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [code, recarga])

  const tabla = useMemo(() => tablaDe(inscripciones, partidas), [inscripciones, partidas])
  const porInsc = useMemo(() => new Map(inscripciones.map(i => [i.id, i])), [inscripciones])
  const soyElCreador = !!liga && supabaseUser?.id === liga.creadorId
  const yaInscrito = useMemo(
    () => inscripciones.some(i => i.userId === supabaseUser?.id && !i.retirado),
    [inscripciones, supabaseUser?.id])
  const jornadas = useMemo(() => {
    const m = new Map<number, PartidaLiga[]>()
    for (const p of partidas) {
      const lista = m.get(p.jornada) ?? []
      lista.push(p)
      m.set(p.jornada, lista)
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [partidas])

  if (cargando) {
    return <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-swu-muted">Buscando la liga…</div>
  }

  if (!liga) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Lock size={26} className="mx-auto mb-3 text-swu-muted" />
        <p className="text-[15px] font-black text-swu-text">El Espacio de Creadores está en pruebas</p>
        <Link to="/" className="mt-5 inline-block text-[13px] text-swu-cyan">Volver a Inicio</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3 pb-28">
      <div className="mb-2 flex items-center gap-2">
        <Link to="/" className="-ml-1 p-1 text-swu-muted hover:text-swu-text"><ChevronLeft size={18} /></Link>
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-black tracking-tight text-swu-text">{liga.nombre}</h1>
          <p className="text-[10px] font-bold uppercase tracking-wider text-swu-amber">
            {liga.estado === 'inscripcion' ? 'Inscripción abierta'
              : liga.estado === 'activa' ? 'En juego'
              : liga.estado === 'borrador' ? 'En preparación' : 'Cerrada'}
          </p>
        </div>
      </div>

      {aviso && (
        <p className="mb-2 rounded-xl border border-swu-border bg-swu-surface px-3 py-2 text-center text-[12px] text-swu-text">{aviso}</p>
      )}

      {/* ── Inscripción ── */}
      {liga.estado === 'inscripcion' && !yaInscrito && supabaseUser && (
        <Inscribirme ligaId={liga.id} alListo={() => { recargar(); setAviso('Estás dentro. Cuando cierre la inscripción vas a ver tu calendario.') }} alAvisar={setAviso} />
      )}
      {liga.estado === 'inscripcion' && yaInscrito && (
        <p className="mb-3 flex items-center justify-center gap-1.5 rounded-2xl border border-swu-green/40 bg-swu-green/10 px-4 py-3 text-[12px] font-bold text-swu-green">
          <Check size={14} /> Ya estás inscrito. {inscripciones.filter(i => !i.retirado).length} / {liga.cupo} lugares.
        </p>
      )}

      {/* ── La tabla ── */}
      {tabla.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-swu-muted">
            <Trophy size={13} /> Tabla de posiciones
          </h2>
          <div className="divide-y divide-swu-border rounded-2xl border border-swu-border bg-swu-surface">
            {tabla.map((f, i) => (
              <div key={f.inscId} className="flex items-center gap-2 px-3 py-2.5">
                <span className={`w-5 text-center text-[12px] font-black ${i === 0 ? 'text-swu-amber' : 'text-swu-muted'}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  {f.userId ? (
                    <Link to={`/u/${f.userId}`} className="truncate text-[13px] font-bold text-swu-accent-texto">{f.nombre}</Link>
                  ) : (
                    <span className="truncate text-[13px] font-bold text-swu-text">{f.nombre}</span>
                  )}
                  {f.lider && <p className="truncate text-[10px] text-swu-muted">{f.lider}</p>}
                </div>
                <span className="text-[11px] tabular-nums text-swu-muted">{f.ganadas}-{f.perdidas}</span>
                <span className={`w-8 text-right text-[14px] font-black tabular-nums ${i === 0 ? 'text-swu-amber' : 'text-swu-text'}`}>{f.puntos}</span>
              </div>
            ))}
          </div>
          <p className="mt-1 px-1 text-[10px] text-swu-muted">3 puntos por victoria · desempate por diferencia de games.</p>
        </section>
      )}

      {/* ── El fixture, jornada por jornada ── */}
      {jornadas.map(([n, lista]) => (
        <section key={n} className="mb-4">
          <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-swu-muted">Jornada {n}</h2>
          <div className="space-y-2">
            {lista.map(p => (
              <Partida
                key={p.id}
                p={p}
                local={porInsc.get(p.localInsc)}
                visita={porInsc.get(p.visitaInsc)}
                puedoReportar={soyElCreador && liga.estado === 'activa' && p.estado === 'programada'}
                alReportar={() => { recargar() }}
                alAvisar={setAviso}
              />
            ))}
          </div>
        </section>
      ))}

      {jornadas.length === 0 && liga.estado === 'inscripcion' && (
        <p className="rounded-2xl border border-swu-border bg-swu-surface px-4 py-6 text-center text-[12px] text-swu-muted">
          El calendario se sortea cuando cierre la inscripción: vas a saber todos
          tus rivales de una vez.
        </p>
      )}
    </div>
  )
}

function Inscribirme({ ligaId, alListo, alAvisar }: {
  ligaId: string; alListo: () => void; alAvisar: (m: string | null) => void
}) {
  const [lider, setLider] = useState('')
  const [consiente, setConsiente] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  return (
    <section className="mb-4 rounded-2xl border border-swu-amber/40 bg-swu-amber/5 p-4">
      <h2 className="text-[13px] font-black uppercase tracking-wider text-swu-text">Inscribirme</h2>
      <input
        value={lider} onChange={e => setLider(e.target.value.slice(0, 60))}
        placeholder="Tu líder (opcional) — ej. Darth Vader"
        className="mt-2 w-full rounded-xl border border-swu-border bg-swu-bg px-3 py-2.5 text-[13px] text-swu-text outline-none focus:border-swu-accent"
      />
      {/* El texto va ANTES del botón y sin letra chica: es la condición de la
          liga, no un término enterrado. El servidor la exige igual. */}
      <label className="mt-3 flex items-start gap-2.5 text-[12px] leading-snug text-swu-text">
        <input
          type="checkbox" checked={consiente} onChange={e => setConsiente(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-amber-400"
        />
        Acepto que mis partidas de esta liga puedan transmitirse en vivo y
        publicarse en YouTube. En pantalla aparece mi nombre de jugador de la
        app, nunca mis datos personales.
      </label>
      <button
        onClick={() => {
          setOcupado(true)
          void inscribirse(ligaId, lider.trim(), '', consiente).then(r => {
            if (r.ok) alListo()
            else alAvisar(r.mensaje ?? null)
            setOcupado(false)
          })
        }}
        disabled={ocupado || !consiente}
        className="mt-3 min-h-[46px] w-full rounded-xl bg-swu-amber text-[13px] font-black uppercase tracking-wider text-swu-bg disabled:opacity-50"
      >Entrar a la liga</button>
    </section>
  )
}

function Partida({ p, local, visita, puedoReportar, alReportar, alAvisar }: {
  p: PartidaLiga
  local: InscripcionLiga | undefined
  visita: InscripcionLiga | undefined
  puedoReportar: boolean
  alReportar: () => void
  alAvisar: (m: string | null) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [vl, setVl] = useState(2)
  const [vv, setVv] = useState(0)
  const [vod, setVod] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const jugada = p.estado === 'jugada' || p.estado === 'wo_local' || p.estado === 'wo_visita'

  return (
    <div className="rounded-xl border border-swu-border bg-swu-surface p-3">
      <div className="flex items-center gap-2">
        <span className={`min-w-0 flex-1 truncate text-right text-[13px] font-bold ${jugada && p.victoriasLocal > p.victoriasVisita ? 'text-swu-amber' : 'text-swu-text'}`}>
          {local?.nombre ?? '—'}
        </span>
        <span className="shrink-0 rounded-lg bg-swu-bg px-2.5 py-1 text-[13px] font-black tabular-nums text-swu-text">
          {jugada ? `${p.victoriasLocal} - ${p.victoriasVisita}` : 'vs'}
        </span>
        <span className={`min-w-0 flex-1 truncate text-[13px] font-bold ${jugada && p.victoriasVisita > p.victoriasLocal ? 'text-swu-amber' : 'text-swu-text'}`}>
          {visita?.nombre ?? '—'}
        </span>
      </div>

      {/* El VOD, embebido con ?start= para caer en el minuto de ESTA partida. */}
      {p.vodYoutubeId && (
        <div className="mt-2 overflow-hidden rounded-lg" style={{ aspectRatio: '16 / 9' }}>
          <iframe
            src={`https://www.youtube.com/embed/${p.vodYoutubeId}?rel=0${p.vodT ? `&start=${p.vodT}` : ''}`}
            title="Partida grabada"
            className="h-full w-full border-0"
            allow="accelerometer; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}

      {p.estado === 'sin_jugar' && (
        <p className="mt-1.5 text-center text-[10px] uppercase tracking-wider text-swu-muted">No se jugó</p>
      )}

      {puedoReportar && (
        abierto ? (
          <div className="mt-2 space-y-2 rounded-lg border border-swu-border bg-swu-bg p-2.5">
            <div className="flex items-center justify-center gap-2 text-[13px] font-black text-swu-text">
              <select value={vl} onChange={e => setVl(Number(e.target.value))} className="rounded-lg border border-swu-border bg-swu-surface px-2 py-1.5">
                {[0, 1, 2].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span>-</span>
              <select value={vv} onChange={e => setVv(Number(e.target.value))} className="rounded-lg border border-swu-border bg-swu-surface px-2 py-1.5">
                {[0, 1, 2].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <input
              value={vod} onChange={e => setVod(e.target.value)}
              placeholder="Enlace de YouTube (opcional)"
              className="w-full rounded-lg border border-swu-border bg-swu-surface px-2.5 py-2 text-[12px] text-swu-text outline-none"
            />
            <button
              onClick={() => {
                setOcupado(true)
                void reportarPartida(p.id, vl, vv, vod.trim(), null).then(r => {
                  if (r.ok) alReportar()
                  else alAvisar(r.mensaje ?? null)
                  setOcupado(false)
                })
              }}
              disabled={ocupado}
              className="min-h-[40px] w-full rounded-lg bg-swu-amber text-[12px] font-black uppercase tracking-wider text-swu-bg disabled:opacity-60"
            >Guardar resultado</button>
          </div>
        ) : (
          <button
            onClick={() => setAbierto(true)}
            className="mt-2 flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-lg border border-swu-border text-[11px] font-bold text-swu-muted"
          >
            <PlayCircle size={13} /> Cargar resultado
          </button>
        )
      )}
    </div>
  )
}

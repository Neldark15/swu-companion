/**
 * LA LIGA — `/liga/:code`
 *
 * La pantalla entera de una liga internacional: mi próxima partida, la
 * inscripción, los grupos y sus jornadas. Sale de UNA llamada (`verLiga`),
 * porque un grupo de 8 son 8 plazas y 28 partidas y pedir cada cosa por
 * separado serían tres viajes para pintar una pantalla.
 *
 * ── El orden no es estético ───────────────────────────────────────────
 *
 * Arriba de todo va MI PRÓXIMA PARTIDA, no la tabla. Anotar y confirmar es la
 * única acción que existe para un jugador; la tabla es lo que mira el
 * espectador. Si el que juega tiene que bajar por 120 filas para encontrar su
 * botón, el resultado lo termina anotando la organización a mano.
 *
 * ── La unidad visible es el GRUPO, nunca la lista de 120 ──────────────
 *
 * Una tabla plana de 120 ordenada por puntos absolutos es ruido con cara de
 * dato: el campeón de Legendario 1 con 15 puntos saldría debajo de alguien de
 * Común 3 con 18 sin haberse cruzado jamás. Y acá no se dibuja un solo sable
 * ni una sola credencial 3D: Chrome corta a ~16 contextos WebGL (§2s), así que
 * una lista de 120 es imposible por construcción. Texto y color de grupo.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronDown, ChevronLeft, Clock, Lock, PlayCircle, Swords } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { InscripcionLiga } from '../liga/InscripcionLiga'
import { PortadaLiga } from './PortadaLiga'
import { TONO_POR_RAREZA } from '../../services/filtrosCarta'
import {
  verLiga, tablaDe, miProximaPartida, reportar, confirmar, disputar,
  TIERS, NOMBRE_TIER,
  type EstadoPartida, type FilaTabla, type GrupoLiga, type LigaCompleta,
  type PartidaLiga, type PlazaLiga,
} from '../../services/ligaService'

/**
 * El color de cada tier sale del mapa de rarezas que ya existe, y la
 * traducción vive ACÁ, en una línea. `TONO_POR_RAREZA` está en inglés porque
 * así vienen las cartas del API; los tiers están en español porque así se
 * llaman en la liga. Copiar el mapa sería tener dos ideas del color de
 * «legendario» y que un día se separen sin que nada falle.
 */
const RAREZA_DEL_TIER: Record<GrupoLiga['tier'], string> = {
  comun: 'Common', infrecuente: 'Uncommon', raro: 'Rare', legendario: 'Legendary',
}
function tonoDelTier(t: GrupoLiga['tier']) {
  return TONO_POR_RAREZA[RAREZA_DEL_TIER[t]] ?? 'default'
}

/**
 * El rótulo de cada estado.
 *
 * `origen === 'silencio'` gana sobre el estado a propósito: ese resultado lo
 * firmó el RELOJ, no las dos personas. Llamarlo «confirmada» en la tabla
 * pública sería fingir que el rival estuvo de acuerdo, y el día que alguien
 * reclame no habrá manera de distinguir un acuerdo de un vencimiento.
 */
const ROTULO: Record<EstadoPartida, { texto: string; clase: string }> = {
  programada: { texto: 'por jugar', clase: 'text-swu-muted' },
  reportada: { texto: 'falta confirmar', clase: 'text-swu-cyan' },
  confirmada: { texto: 'confirmada', clase: 'text-swu-muted' },
  disputada: { texto: 'en disputa', clase: 'text-swu-red-texto' },
  vencida: { texto: 'vencida', clase: 'text-swu-red-texto' },
  wo_local: { texto: 'no se presentó el local', clase: 'text-swu-amber' },
  wo_visita: { texto: 'no se presentó la visita', clase: 'text-swu-amber' },
  anulada: { texto: 'anulada', clase: 'text-swu-muted' },
}
function rotuloDe(m: PartidaLiga): { texto: string; clase: string } {
  if (m.origen === 'silencio') return { texto: 'sin respuesta del rival', clase: 'text-swu-amber' }
  if (m.origen === 'laudo' && m.estado === 'confirmada') {
    return { texto: 'resuelta por la organización', clase: 'text-swu-amber' }
  }
  return ROTULO[m.estado]
}

/** Con marcador se muestra el marcador; sin él, «vs» y no un 0-0 inventado. */
const CON_MARCADOR = new Set<EstadoPartida>(['reportada', 'confirmada', 'disputada', 'wo_local', 'wo_visita'])

/**
 * Cuánto falta para que venza el plazo.
 *
 * Vive fuera del componente porque `Date.now()` dentro del cuerpo rompe la
 * pureza del render (y el linter): el mismo render devolvería dos valores
 * distintos según cuándo se ejecute.
 */
function plazoTexto(iso: string | null): string | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'el plazo ya venció'
  const horas = Math.round(ms / 3_600_000)
  if (horas < 1) return 'vence en menos de una hora'
  if (horas < 48) return `vence en ${horas} h`
  return `vence en ${Math.round(horas / 24)} días`
}

/** El VOD llega normalizado del servidor, pero puede ser id o URL entera. */
function enlaceVod(v: string): string {
  return v.startsWith('http') ? v : `https://www.youtube.com/watch?v=${v}`
}

/** Lo mejor arriba: el orden de la escalera manda sobre el número de grupo. */
function ordenarGrupos(grupos: GrupoLiga[]): GrupoLiga[] {
  return [...grupos].sort((a, b) =>
    TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || a.orden - b.orden)
}

export function LigaSeccion() {
  const { code } = useParams<{ code: string }>()
  const [liga, setLiga] = useState<LigaCompleta | null>(null)
  // `listo` en vez de un `cargando` que arranque en true y se apague dentro
  // del efecto: `null` es «todavía no se sabe» y nadie escribe estado de forma
  // síncrona al montar.
  const [listo, setListo] = useState(false)
  const [recarga, setRecarga] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  /** `null` = «el que decida la pantalla»; `''` = los plegué todos a mano. */
  const [abierto, setAbierto] = useState<string | null>(null)

  const recargar = useCallback(() => setRecarga(n => n + 1), [])

  useEffect(() => {
    let vivo = true
    void Promise.resolve(code ? verLiga(code) : null).then(r => {
      if (!vivo) return
      setLiga(r)
      setListo(true)
    })
    return () => { vivo = false }
  }, [code, recarga])

  const grupos = useMemo(() => ordenarGrupos(liga?.grupos ?? []), [liga])
  const proxima = useMemo(() => (liga ? miProximaPartida(liga) : null), [liga])
  const miGrupo = useMemo(
    () => grupos.find(g => g.plazas.some(p => p.esMia))?.id ?? null,
    [grupos])

  // El afiche mientras carga: entrar a la liga tiene que sentirse como entrar
  // a otro sitio, y ese medio segundo es donde se nota.
  if (!listo) return <PortadaLiga />

  if (!liga) {
    // La policy del demo cerrado devuelve VACÍO, no error: acá «no existe» y
    // «no te toca verlo» son el mismo caso, y la pantalla lo dice sin drama.
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Lock size={26} className="mx-auto mb-3 text-swu-muted" />
        <p className="text-[15px] font-black text-swu-text">Esta liga todavía no es pública</p>
        <p className="mt-1.5 text-[12px] text-swu-muted">
          O el enlace no existe, o la liga sigue en pruebas cerradas.
        </p>
        <Link to="/" className="mt-5 inline-block text-[13px] text-swu-cyan">Volver a Inicio</Link>
      </div>
    )
  }

  const { temporada } = liga
  const grupoAbierto = abierto ?? miGrupo ?? grupos[0]?.id ?? null
  const sinArrancar = grupos.length === 0

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3 pb-28">
      <header className="mb-3 flex items-center gap-2">
        <Link to="/" className="-ml-1 p-1 text-swu-muted hover:text-swu-text" aria-label="Volver">
          <ChevronLeft size={18} />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-black tracking-tight text-swu-text">{liga.liga.nombre}</h1>
          <p className="truncate text-[10px] font-bold uppercase tracking-wider text-swu-amber">
            {temporada
              ? `${temporada.nombre} · ${temporada.estado === 'inscripcion' ? 'Inscripción abierta'
                : temporada.estado === 'en_curso' ? 'En juego' : 'Cerrada'}`
              : 'En preparación'}
          </p>
        </div>
      </header>

      {aviso && (
        <p className="mb-3 rounded-xl border border-swu-border bg-swu-surface px-3 py-2 text-center text-[12px] text-swu-text">
          {aviso}
        </p>
      )}

      {/* 1 · MI PRÓXIMA PARTIDA. Lo único que puedo resolver hoy va primero. */}
      {proxima && (
        <MiPartida
          partida={proxima.partida}
          grupo={proxima.grupo}
          rival={proxima.rival}
          miPlaza={proxima.miPlaza}
          alHacer={() => { setAviso(null); recargar() }}
          alAvisar={setAviso}
        />
      )}

      {/* 2 · La inscripción, solo si no estoy dentro y todavía se puede entrar. */}
      {!liga.miInscripcion && temporada?.estado === 'inscripcion' && (
        <InscripcionLiga
          ligaId={liga.liga.id}
          onListo={() => { setAviso('Estás dentro. Cuando se armen los grupos vas a ver tu calendario.'); recargar() }}
        />
      )}

      {/* Inscrito pero sin grupo todavía: no hay partida que mostrar y hay que
          decir por qué, o parece que la inscripción no quedó. */}
      {liga.miInscripcion && !proxima && sinArrancar && (
        <p className="mb-3 rounded-2xl border border-swu-green/40 bg-swu-green/10 px-4 py-3 text-center text-[12px] font-bold text-swu-green">
          Ya estás inscrito. Los grupos se arman cuando cierre la inscripción.
        </p>
      )}

      {/* 3 · Los grupos. Uno por tarjeta, el mío abierto. */}
      {sinArrancar ? (
        <p className="rounded-2xl border border-swu-border bg-swu-surface px-4 py-6 text-center text-[12px] text-swu-muted">
          {liga.liga.descripcion ?? 'La temporada todavía no está abierta: cuando se armen los grupos, acá va tu calendario.'}
        </p>
      ) : (
        grupos.map(g => (
          <TarjetaGrupo
            key={g.id}
            grupo={g}
            abierto={grupoAbierto === g.id}
            alPlegar={() => setAbierto(grupoAbierto === g.id ? '' : g.id)}
          />
        ))
      )}
    </div>
  )
}

/* ── MI PRÓXIMA PARTIDA ─────────────────────────────────────────────── */

/** En un BO3 solo hay cuatro marcadores posibles, y se leen en primera persona. */
const MARCADORES = [
  { rotulo: 'Gané 2-0', mis: 2, sus: 0 },
  { rotulo: 'Gané 2-1', mis: 2, sus: 1 },
  { rotulo: 'Perdí 1-2', mis: 1, sus: 2 },
  { rotulo: 'Perdí 0-2', mis: 0, sus: 2 },
] as const

function MiPartida({ partida, grupo, rival, miPlaza, alHacer, alAvisar }: {
  partida: PartidaLiga
  grupo: GrupoLiga
  rival: PlazaLiga
  miPlaza: PlazaLiga
  alHacer: () => void
  alAvisar: (m: string | null) => void
}) {
  const [anotando, setAnotando] = useState(false)
  const [vod, setVod] = useState('')
  const [motivo, setMotivo] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  // El marcador viaja como local-visita, pero se LEE como mío-suyo: nadie
  // recuerda si le tocó de local en la jornada 4.
  const soyLocal = partida.localPlaza === miPlaza.id
  const mis = soyLocal ? partida.vl : partida.vv
  const sus = soyLocal ? partida.vv : partida.vl
  const laReporteYo = partida.reportadaPor === miPlaza.id
  const plazo = plazoTexto(partida.venceEl)

  const enviar = (accion: Promise<{ ok: boolean; mensaje?: string }>) => {
    setOcupado(true)
    void accion.then(r => {
      setOcupado(false)
      if (r.ok) { setAnotando(false); setMotivo(null); alHacer() }
      else alAvisar(r.mensaje ?? 'No se pudo')
    })
  }

  return (
    <section className="mb-4 rounded-2xl border border-swu-amber/40 bg-swu-amber/5 p-4">
      <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-swu-amber">
        <Swords size={11} /> Te toca — jornada {partida.jornada}
        <span className="font-bold normal-case tracking-normal text-swu-muted">
          · {NOMBRE_TIER[grupo.tier]} {grupo.orden}
        </span>
      </p>

      <p className="mt-1 truncate text-[17px] font-black text-swu-text">{rival.nombre}</p>
      {rival.lider && <p className="truncate text-[11px] text-swu-muted">{rival.lider}</p>}

      {plazo && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-swu-muted">
          <Clock size={11} /> {plazo}
        </p>
      )}

      {/* ── Nadie anotó todavía ── */}
      {partida.estado === 'programada' && (
        anotando ? (
          <div className="mt-3 space-y-2 rounded-xl border border-swu-border bg-swu-bg p-2.5">
            <div className="grid grid-cols-2 gap-2">
              {MARCADORES.map(m => (
                <button
                  key={m.rotulo}
                  disabled={ocupado}
                  onClick={() => enviar(reportar(
                    partida.id,
                    soyLocal ? m.mis : m.sus,
                    soyLocal ? m.sus : m.mis,
                    vod.trim() || undefined,
                  ))}
                  className="min-h-[46px] rounded-xl border border-swu-border bg-swu-surface text-[13px] font-black text-swu-text disabled:opacity-50"
                >{m.rotulo}</button>
              ))}
            </div>
            <input
              value={vod} onChange={e => setVod(e.target.value)}
              placeholder="Enlace de YouTube (opcional)"
              className="w-full rounded-xl border border-swu-border bg-swu-surface px-3 py-2.5 text-[12px] text-swu-text outline-none focus:border-swu-accent"
            />
            <button onClick={() => setAnotando(false)} className="w-full py-1 text-[11px] font-bold text-swu-muted">
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAnotando(true)}
            className="mt-3 min-h-[46px] w-full rounded-xl bg-swu-amber text-[13px] font-black uppercase tracking-wider text-swu-bg"
          >Anotar resultado</button>
        )
      )}

      {/* ── Lo anotó el rival: confirmo o lo peleo ── */}
      {partida.estado === 'reportada' && !laReporteYo && (
        <div className="mt-3">
          <p className="text-center text-[12px] text-swu-muted">
            {rival.nombre} anotó <span className="font-black tabular-nums text-swu-text">{sus}-{mis}</span> a su favor.
          </p>
          {motivo === null ? (
            <>
              {/* El marcador va EN el botón y viaja otra vez a la RPC: si el
                  botón solo dijera «Aceptar», se acepta sin leer. */}
              <button
                disabled={ocupado}
                onClick={() => enviar(confirmar(partida.id, partida.vl, partida.vv))}
                className="mt-2 min-h-[46px] w-full rounded-xl bg-swu-amber text-[13px] font-black uppercase tracking-wider text-swu-bg disabled:opacity-50"
              >Confirmar {mis}-{sus}</button>
              <button
                onClick={() => setMotivo('')}
                className="mt-2 min-h-[40px] w-full rounded-xl border border-swu-border text-[12px] font-bold text-swu-red-texto"
              >No fue así</button>
            </>
          ) : (
            <div className="mt-2 space-y-2 rounded-xl border border-swu-red/40 bg-swu-bg p-2.5">
              <textarea
                value={motivo} onChange={e => setMotivo(e.target.value.slice(0, 300))}
                rows={3} placeholder="¿Qué pasó? Lo lee la organización."
                className="w-full resize-none rounded-lg border border-swu-border bg-swu-surface px-3 py-2 text-[12px] text-swu-text outline-none focus:border-swu-accent"
              />
              <button
                disabled={ocupado || motivo.trim().length < 5}
                onClick={() => enviar(disputar(partida.id, motivo.trim()))}
                className="min-h-[44px] w-full rounded-lg bg-swu-red text-[12px] font-black uppercase tracking-wider text-white disabled:opacity-50"
              >Mandar a la organización</button>
              <button onClick={() => setMotivo(null)} className="w-full py-1 text-[11px] font-bold text-swu-muted">
                Volver
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Lo anoté yo: la pelota está del otro lado ── */}
      {partida.estado === 'reportada' && laReporteYo && (
        <p className="mt-3 rounded-xl border border-swu-border bg-swu-bg px-3 py-3 text-center text-[12px] text-swu-muted">
          Anotaste <span className="font-black tabular-nums text-swu-text">{mis}-{sus}</span>.
          Esperando a {rival.nombre}{plazo ? ` — ${plazo}` : ''}.
        </p>
      )}

      {/* ── Se pasó el plazo: no hay botón que apretar y hay que decirlo ── */}
      {partida.estado === 'vencida' && (
        <p className="mt-3 rounded-xl border border-swu-red/40 bg-swu-red/10 px-3 py-3 text-center text-[12px] font-bold text-swu-red-texto">
          Se venció el plazo sin resultado: esto lo destraba la organización.
        </p>
      )}
    </section>
  )
}

/* ── LOS GRUPOS ─────────────────────────────────────────────────────── */

const CERRADAS = new Set<EstadoPartida>(['confirmada', 'wo_local', 'wo_visita', 'anulada'])

function TarjetaGrupo({ grupo, abierto, alPlegar }: {
  grupo: GrupoLiga
  abierto: boolean
  alPlegar: () => void
}) {
  const filas = useMemo(
    () => tablaDe(grupo.plazas, grupo.partidas, grupo.id),
    [grupo])
  const jornadas = useMemo(() => {
    const m = new Map<number, PartidaLiga[]>()
    for (const p of grupo.partidas) {
      const lista = m.get(p.jornada) ?? []
      lista.push(p)
      m.set(p.jornada, lista)
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [grupo.partidas])

  const jugadas = grupo.partidas.filter(p => CERRADAS.has(p.estado)).length
  const estoyAca = grupo.plazas.some(p => p.esMia)
  const porPlaza = new Map(grupo.plazas.map(p => [p.id, p]))

  return (
    <section className={`mb-2.5 overflow-hidden rounded-2xl border bg-swu-surface ${estoyAca ? 'border-swu-amber/40' : 'border-swu-border'}`}>
      <button
        onClick={alPlegar}
        aria-expanded={abierto}
        className="flex min-h-[56px] w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <Badge variant={tonoDelTier(grupo.tier)}>{NOMBRE_TIER[grupo.tier]} {grupo.orden}</Badge>
        <span className="min-w-0 flex-1 truncate text-[11px] text-swu-muted">
          {grupo.plazas.filter(p => p.estado === 'activa').length} jugando · {jugadas} de {grupo.partidas.length} partidas
        </span>
        {estoyAca && (
          <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-swu-amber">Acá juego yo</span>
        )}
        <ChevronDown size={16} className={`shrink-0 text-swu-muted transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div className="border-t border-swu-border p-3">
          <TablaGrupo filas={filas} />

          {/* 4 · Las jornadas del grupo abierto, con su estado y su VOD. */}
          {jornadas.map(([n, lista]) => (
            <div key={n} className="mt-3">
              <h3 className="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-swu-muted">Jornada {n}</h3>
              <div className="space-y-1.5">
                {lista.map(p => (
                  <Encuentro
                    key={p.id}
                    partida={p}
                    local={porPlaza.get(p.localPlaza)}
                    visita={porPlaza.get(p.visitaPlaza)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function TablaGrupo({ filas }: { filas: FilaTabla[] }) {
  // Quien abandona se va AL FINAL y apagado, pero no desaparece: sus partidas
  // ya jugadas siguen contando para el rival, y borrar la fila haría que el
  // que ganó ese encuentro tuviera puntos de una partida que no se ve.
  const activas = filas.filter(f => !f.abandonada)
  const idas = filas.filter(f => f.abandonada)

  if (filas.length === 0) {
    return <p className="py-4 text-center text-[12px] text-swu-muted">Este grupo todavía no tiene plazas.</p>
  }

  return (
    <div className="overflow-hidden rounded-xl border border-swu-border bg-swu-bg">
      <div className="flex items-center gap-2 border-b border-swu-border px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-swu-muted">
        <span className="w-5 text-center">#</span>
        <span className="min-w-0 flex-1">Jugador</span>
        <span className="w-6 text-right">PJ</span>
        <span className="w-10 text-right">G-P</span>
        <span className="w-8 text-right">Dif</span>
        <span className="w-8 text-right">Pts</span>
      </div>

      {activas.map((f, i) => (
        <FilaGrupo key={f.plazaId} f={f} puesto={i + 1} />
      ))}
      {idas.map(f => (
        <FilaGrupo key={f.plazaId} f={f} puesto={null} />
      ))}

      <p className="border-t border-swu-border px-2.5 py-1.5 text-[9px] text-swu-muted">
        3 puntos por victoria · desempate: enfrentamiento directo, después diferencia de games.
      </p>
    </div>
  )
}

function FilaGrupo({ f, puesto }: { f: FilaTabla; puesto: number | null }) {
  return (
    <div className={`flex items-center gap-2 border-t border-swu-border px-2.5 py-2 first:border-t-0 ${
      f.esMia ? 'bg-swu-accent/10' : ''} ${f.abandonada ? 'opacity-45' : ''}`}>
      <span className={`w-5 text-center text-[12px] font-black tabular-nums ${
        puesto === 1 ? 'text-swu-amber' : 'text-swu-muted'}`}>
        {puesto ?? '—'}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[13px] font-bold ${f.esMia ? 'text-swu-accent-texto' : 'text-swu-text'}`}>
          {f.nombre}
        </p>
        {f.abandonada
          ? <p className="text-[10px] font-bold uppercase tracking-wider text-swu-muted">abandonó</p>
          : f.lider && <p className="truncate text-[10px] text-swu-muted">{f.lider}</p>}
      </div>
      <span className="w-6 text-right text-[11px] tabular-nums text-swu-muted">{f.jugadas}</span>
      <span className="w-10 text-right text-[11px] tabular-nums text-swu-muted">{f.ganadas}-{f.perdidas}</span>
      <span className="w-8 text-right text-[11px] tabular-nums text-swu-muted">
        {f.difGames > 0 ? `+${f.difGames}` : f.difGames}
      </span>
      <span className="w-8 text-right text-[14px] font-black tabular-nums text-swu-text">{f.puntos}</span>
    </div>
  )
}

function Encuentro({ partida, local, visita }: {
  partida: PartidaLiga
  local: PlazaLiga | undefined
  visita: PlazaLiga | undefined
}) {
  const rot = rotuloDe(partida)
  const conMarcador = CON_MARCADOR.has(partida.estado)
  const ganoLocal = conMarcador && partida.vl > partida.vv
  const ganoVisita = conMarcador && partida.vv > partida.vl
  const soyParte = local?.esMia || visita?.esMia

  return (
    <div className={`rounded-xl border px-2.5 py-2 ${soyParte ? 'border-swu-accent/40 bg-swu-accent/5' : 'border-swu-border bg-swu-bg'}`}>
      <div className="flex items-center gap-2">
        <span className={`min-w-0 flex-1 truncate text-right text-[12px] font-bold ${ganoLocal ? 'text-swu-amber' : 'text-swu-text'}`}>
          {local?.nombre ?? '—'}
        </span>
        <span className="shrink-0 rounded-lg bg-swu-surface px-2 py-0.5 text-[12px] font-black tabular-nums text-swu-text">
          {conMarcador ? `${partida.vl}-${partida.vv}` : 'vs'}
        </span>
        <span className={`min-w-0 flex-1 truncate text-[12px] font-bold ${ganoVisita ? 'text-swu-amber' : 'text-swu-text'}`}>
          {visita?.nombre ?? '—'}
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-center gap-3">
        <span className={`text-[9px] font-bold uppercase tracking-wider ${rot.clase}`}>{rot.texto}</span>
        {/* El VOD va como ENLACE, no como iframe: un grupo son 28 encuentros y
            28 reproductores de YouTube incrustados cuestan más que la pantalla
            entera. */}
        {partida.vod && (
          <a
            href={enlaceVod(partida.vod)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-swu-cyan"
          >
            <PlayCircle size={11} /> Ver
          </a>
        )}
      </div>
    </div>
  )
}

/**
 * TORNEOS — una sola puerta: lo que viene, lo que se jugó, y cómo llevarlo.
 *
 * ── Por qué esta pantalla se comió a «Próximos Eventos» ───────────────
 *
 * Había DOS pantallas para el mismo trabajo. `/events` listaba los eventos
 * abiertos con una tarjeta buena —insignia de estado, fila de detalles,
 * organizador, código, botón de inscripción— y `/torneos` listaba el archivo
 * y daba el tablero. El menú las ofrecía como si fueran cosas distintas, y
 * había que saber de antemano en cuál de las dos estaba lo que uno buscaba.
 *
 * Acá viven las dos. La tarjeta es la de `/events`; el resto —lo público, el
 * archivo, el estado de error, la separación por rol— es de `/torneos`.
 *
 * ── Por qué gana `/torneos` y no `/events` ───────────────────────────
 *
 * No es gusto, son tres cosas medidas:
 *
 *  · `/torneos` es PÚBLICA y está en `rutaLibre`, así que un visitante sin
 *    cuenta ni app instalada la abre desde un enlace de WhatsApp. Mudar la
 *    pantalla a `/events` obligaba a tocar dos listas a mano, y olvidar una
 *    rompe ese enlace sin que nadie se entere.
 *  · `/torneos` está en `UpdatePrompt.SEGURAS` (se recarga sola, es lectura).
 *    `/events` NO está, y a propósito: abajo cuelga el tablero, que tiene una
 *    ronda a medio anotar. Ganar `/events` obligaba a elegir entre romper la
 *    recarga silenciosa o volver segura una rama que no debe serlo.
 *  · Los push ya enviados apuntan a `/torneos/:code`. Están en el centro de
 *    notificaciones de la gente; si la ruta muere, quedan huérfanos.
 *
 * `/events` queda como redirección EXACTA. Nunca `/events/*`: ahí cuelgan
 * `join`, `create`, `lobby`, `play`, `dashboard`, `live`, `tournament` y
 * `melee`, y un comodín se las tragaría todas.
 *
 * ── Tres pestañas, tres públicos ──────────────────────────────────────
 *
 * · **Próximos** — pública. Lo que se juega y cómo entrar.
 * · **Archivo** — pública. Lo que se jugó y quién ganó.
 * · **Organizar** — solo admin. Crear, llevar, editar y borrar.
 *
 * El nivel de acceso es ESTRUCTURA, no una condición repartida por el JSX.
 * `/events` tenía seis `isAdmin &&` sueltos dentro de la lista; acá el lápiz y
 * el tacho viven en la pestaña de admin y no hay que acordarse de gatearlos.
 * La de organizar no consulta nada si no sos admin: esta ruta es la que trae
 * gente nueva y no puede empezar a fallar para un visitante.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Trophy, Users, CalendarDays, Plus, Play, Radio,
  QrCode, Swords, MapPin, Pencil, Trash2, X, Save, Loader2, CheckCircle2,
  LogIn, ListOrdered, DoorOpen, ImagePlus,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { Avatar } from '../../components/ui/Avatar'
import { fechaConDiaLarga, fechaCorta, hora, aISOdesdeSV, aInputsSV } from '../../services/horaSV'
import { listarTorneos, type TorneoResumen } from '../../services/torneosHistoricos'
import {
  listarEnCurso, partirPorFecha, joinOfficialEvent, leaveOfficialEvent,
  deleteOfficialEvent, updateOfficialEvent, subirLogoTorneo,
  getLogosPorFormato, fijarLogoDeFormato, logoDe,
  type OfficialEvent, type MazoDeclarado,
} from '../../services/events'
import { DeclararMazo } from '../events/DeclararMazo'
import { LogoTorneo } from './LogoTorneo'
import { etiquetaTipo } from '../../services/tipoTorneo'
import { db } from '../../services/db'
import { useAuth } from '../../hooks/useAuth'

type Pestana = 'proximos' | 'archivo' | 'organizar'

/** Un valor desconocido cae en Próximos, no en pantalla en blanco. */
function leerPestana(v: string | null): Pestana {
  return v === 'archivo' || v === 'organizar' ? v : 'proximos'
}

/* El estado sale de un MAPA y no de un ternario. `status === 'active' ? … : 'Abierto'`
   rotula «Abierto» por descarte a cualquier estado que entre nuevo a la consulta,
   y eso es exactamente cómo un torneo cancelado se anuncia como abierto. */
const ESTADO: Record<string, { texto: string; clase: string; insignia: 'accent' | 'green' | 'amber' | 'red' }> = {
  open: { texto: 'inscripción abierta', clase: 'text-swu-cyan', insignia: 'green' },
  active: { texto: 'en curso', clase: 'text-swu-green', insignia: 'accent' },
  finished: { texto: 'terminado', clase: 'text-swu-amber', insignia: 'amber' },
  cancelled: { texto: 'cancelado', clase: 'text-swu-red-texto', insignia: 'red' },
}

export function TorneosPage() {
  const navigate = useNavigate()
  const { isAdmin, supabaseUser } = useAuth()
  const [params, setParams] = useSearchParams()

  const pestana = leerPestana(params.get('t'))
  const irA = (p: Pestana) => setParams(p === 'proximos' ? {} : { t: p }, { replace: true })

  const [torneos, setTorneos] = useState<TorneoResumen[] | null>(null)
  const [falloArchivo, setFalloArchivo] = useState<string | null>(null)
  const [enCurso, setEnCurso] = useState<OfficialEvent[] | null>(null)
  const [falloCurso, setFalloCurso] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  /** Cuántos torneos caseros hay EN ESTE APARATO. Dexie, no la nube. */
  const [caseros, setCaseros] = useState(0)
  /** El logo por defecto de cada formato, para los torneos sin uno propio. */
  const [logos, setLogos] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    let vivo = true
    void (async () => {
      const r = await listarTorneos()
      if (!vivo) return
      if (r.ok) { setTorneos(r.datos); setFalloArchivo(null) }
      else { setTorneos([]); setFalloArchivo(r.mensaje) }
    })()
    return () => { vivo = false }
  }, [recarga])

  // El conteo de inscritos solo se PIDE si quien mira puede verlo de verdad.
  // Un jugador normal lee 0 filas por RLS, así que contarlo sería fabricar un
  // cero (§3l).
  useEffect(() => {
    let vivo = true
    void (async () => {
      const r = await listarEnCurso(supabaseUser?.id, isAdmin)
      if (!vivo) return
      if (r.ok) { setEnCurso(r.datos); setFalloCurso(null) }
      else { setEnCurso([]); setFalloCurso(r.mensaje) }
    })()
    return () => { vivo = false }
  }, [recarga, supabaseUser?.id, isAdmin])

  useEffect(() => {
    db.tournaments.count().then(setCaseros).catch(() => {})
  }, [])

  useEffect(() => {
    let vivo = true
    void getLogosPorFormato().then(m => { if (vivo) setLogos(m) })
    return () => { vivo = false }
  }, [recarga])

  const recargarTodo = () => setRecarga(n => n + 1)

  const pestanas: { id: Pestana; label: string }[] = [
    { id: 'proximos', label: 'Próximos' },
    { id: 'archivo', label: 'Archivo' },
    ...(isAdmin ? [{ id: 'organizar' as const, label: 'Organizar' }] : []),
  ]

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 p-4 pb-10">
      <header className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} aria-label="Volver" className="rounded-lg p-1 text-swu-muted hover:text-swu-text">
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black tracking-tight text-swu-text">Torneos</h2>
          <p className="text-[10px] font-mono uppercase tracking-wider text-swu-muted">
            {isAdmin ? 'Lo que viene, el archivo y la organización' : 'Lo que viene y el archivo'}
          </p>
        </div>
      </header>

      <div className="flex gap-1 border-b border-swu-border">
        {pestanas.map(p => (
          <button
            key={p.id}
            onClick={() => irA(p.id)}
            className={`-mb-px min-h-[44px] border-b-2 px-4 text-sm font-semibold transition-colors ${
              pestana === p.id
                ? 'border-swu-amber text-swu-amber'
                : 'border-transparent text-swu-muted hover:text-swu-text'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {pestana === 'proximos' && (
        <Proximos
          eventos={enCurso} fallo={falloCurso} onReintentar={recargarTodo}
          userId={supabaseUser?.id} esAdmin={isAdmin} caseros={caseros} logos={logos}
          onCambio={recargarTodo} navigate={navigate}
        />
      )}

      {pestana === 'archivo' && (
        <Archivo torneos={torneos} fallo={falloArchivo} onReintentar={recargarTodo} />
      )}

      {pestana === 'organizar' && isAdmin && (
        <Organizar eventos={enCurso} fallo={falloCurso} onCambio={recargarTodo} />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   PRÓXIMOS — la tarjeta que venía de /events, ya sin los botones de admin
   ══════════════════════════════════════════════════════════════════════════ */

function Proximos({ eventos, fallo, onReintentar, userId, esAdmin, caseros, logos, onCambio, navigate }: {
  eventos: OfficialEvent[] | null; fallo: string | null; onReintentar: () => void
  userId: string | undefined; esAdmin: boolean; caseros: number
  logos: Map<string, string>
  onCambio: () => void; navigate: (to: string) => void
}) {
  const { vienen, pasados } = partirPorFecha(eventos ?? [])
  const conSesion = !!userId

  return (
    <>
      {/* Los accesos solo con sesión: las tres rutas están detrás de la puerta,
          y ofrecer un botón que lleva a «Acceso restringido» es peor que no
          ofrecerlo. */}
      {conSesion ? (
        <div className="grid grid-cols-3 gap-2">
          <Acceso icono={<QrCode size={16} />} texto="Unirse" sub="con código o QR"
                  onClick={() => navigate('/events/join')} />
          <Acceso icono={<Swords size={16} />} texto="Casero"
                  sub={caseros > 0 ? `${caseros} en este aparato` : 'suizo sin conexión'}
                  onClick={() => navigate('/events/tournament')} />
          <Acceso icono={<ListOrdered size={16} />} texto="Melee" sub="registrar uno"
                  onClick={() => navigate('/events/melee')} />
        </div>
      ) : (
        <Link to="/profile"
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border
                         border-swu-border bg-swu-surface text-[12px] font-semibold text-swu-muted">
          <LogIn size={14} /> Iniciá sesión para inscribirte o registrar un torneo
        </Link>
      )}

      {eventos === null && (
        <div className="space-y-2">
          {[0, 1].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-swu-surface" />)}
        </div>
      )}

      {eventos !== null && fallo && (
        <EmptyState
          icon={<Trophy size={26} />}
          title="No se pudieron cargar los torneos"
          hint={fallo}
          action={<Button variant="secondary" onClick={onReintentar}>Reintentar</Button>}
        />
      )}

      {eventos !== null && !fallo && eventos.length === 0 && (
        <EmptyState
          icon={<CalendarDays size={26} />}
          title="No hay torneos abiertos"
          hint="Acá aparecen los que están con inscripción abierta o jugándose ahora. Los que ya terminaron están en el Archivo."
        />
      )}

      {vienen.length > 0 && (
        <ul className="space-y-2.5">
          {vienen.map(e => (
            <li key={e.id}>
              <TarjetaEvento evento={e} userId={userId} esAdmin={esAdmin} logo={logoDe(e, logos)} onCambio={onCambio} />
            </li>
          ))}
        </ul>
      )}

      {pasados.length > 0 && (
        <>
          <p className="pt-2 text-[10px] font-mono uppercase tracking-wider text-swu-muted">
            Sin fecha o ya pasaron
          </p>
          <ul className="space-y-2.5">
            {pasados.map(e => (
              <li key={e.id}>
                <TarjetaEvento evento={e} userId={userId} esAdmin={esAdmin} logo={logoDe(e, logos)} onCambio={onCambio} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

function Acceso({ icono, texto, sub, onClick }: {
  icono: React.ReactNode; texto: string; sub: string; onClick: () => void
}) {
  return (
    <button onClick={onClick}
            className="flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-xl
                       border border-swu-border bg-swu-surface px-2 py-2 text-swu-text
                       transition-colors hover:border-swu-accent/40 active:scale-[0.98]">
      <span className="text-swu-accent-texto">{icono}</span>
      <span className="text-[12px] font-bold leading-none">{texto}</span>
      <span className="text-center text-[9px] leading-tight text-swu-muted">{sub}</span>
    </button>
  )
}

/**
 * La tarjeta de un evento abierto o en curso.
 *
 * NO es un enlace envolvente: tiene botones adentro. Un `<Link>` alrededor de
 * un botón que te saca de un torneo es cómo se navega sin querer justo cuando
 * uno intenta salirse.
 */
function TarjetaEvento({ evento, userId, esAdmin, logo, onCambio }: {
  evento: OfficialEvent; userId: string | undefined; esAdmin: boolean
  logo: string | null
  onCambio: () => void
}) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pidiendoMazo, setPidiendoMazo] = useState(false)
  const est = ESTADO[evento.status]
  const conSesion = !!userId

  const alternar = async (mazo?: MazoDeclarado) => {
    if (!userId) return
    setOcupado(true); setError(null)
    const r = evento.is_registered
      ? await leaveOfficialEvent(evento.id, userId)
      : await joinOfficialEvent(evento.id, userId, mazo)
    // El resultado SÍ se mira. Antes se descartaba: una inscripción rechazada
    // por RLS recargaba la lista igual y no decía nada, y el botón volvía a
    // «Inscribirse» como si no hubieras tocado nada.
    if (!r.ok) setError(r.error || 'No se pudo, probá de nuevo.')
    setOcupado(false)
    setPidiendoMazo(false)
    onCambio()
  }

  return (
    <div className={`space-y-3 rounded-2xl border bg-swu-surface p-4 ${
      evento.is_registered ? 'border-swu-green/50' : 'border-swu-border'
    }`}>
      <div className="flex items-start justify-between gap-2">
        {/* El logo del torneo. `image_url` existía en la fila desde siempre y
            no se pintaba en ningún lado. */}
        {logo && <LogoTorneo src={logo} lado={64} />}
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-bold text-swu-text">{evento.name}</h4>
          {evento.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-swu-muted">{evento.description}</p>
          )}
        </div>
        <Badge variant={est?.insignia ?? 'default'}>
          {est?.texto ?? evento.status}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-swu-muted">
        <span className="flex items-center gap-1">
          <Swords size={12} />
          <span className="capitalize">{evento.format}</span> · <span className="uppercase">{evento.match_type}</span>
        </span>
        <span className="flex items-center gap-1">
          <Trophy size={12} />{etiquetaTipo(evento.tournament_type)}
        </span>
        {evento.date && (
          <span className="flex items-center gap-1">
            <CalendarDays size={12} />{fechaCorta(evento.date)} {hora(evento.date)}
          </span>
        )}
        {evento.location && (
          <span className="flex items-center gap-1"><MapPin size={12} />{evento.location}</span>
        )}
        {/* El cupo es público y es verdad. El conteo de inscritos NO: la policy
            devuelve 0 filas sin error a quien no es admin, así que a todos se
            les dice el cupo y solo el admin ve cuántos hay dentro. */}
        <span className="flex items-center gap-1">
          <Users size={12} />
          {esAdmin
            ? `${evento.registered_count ?? '—'}/${evento.max_players} inscritos`
            : `Cupo ${evento.max_players}`}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-swu-muted">
          Org:
          <Avatar avatar={evento.organizer_avatar} size={20} escalaEmoji={0.7}
                  anillo={evento.organizer_id ?? evento.organizer_name} />
          <span className="truncate font-medium text-swu-text">{evento.organizer_name}</span>
        </span>
        <span className="shrink-0 rounded bg-swu-accent/10 px-2 py-0.5 font-mono text-xs font-bold text-swu-accent-texto">
          {evento.code}
        </span>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-400">
          {error}
        </p>
      )}

      {/* El lobby: la sala de espera donde se ve llegar a la gente y sale la
          rifa de mesas. Existía y solo se alcanzaba desde el panel de admin,
          o sea que para un jugador no existía. Se ofrece con sesión, esté o
          no inscrito: mirar la rifa no pide estar jugando. */}
      {conSesion && evento.status !== 'finished' && (
        <Link to={`/events/lobby/${evento.code}`}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border
                         border-swu-border bg-swu-bg text-xs font-bold text-swu-text">
          <DoorOpen size={14} /> Entrar al lobby
        </Link>
      )}

      {evento.status === 'active' && (
        <Link to={`/events/live/${evento.code}`}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border
                         border-swu-cyan/40 bg-swu-cyan/10 text-xs font-bold text-swu-cyan">
          <Radio size={14} /> Ver en vivo
        </Link>
      )}

      {/* Inscribirse pregunta el mazo; salirse no pregunta nada. */}
      {evento.status === 'open' && conSesion && pidiendoMazo && !evento.is_registered && (
        <div className="rounded-xl border border-swu-accent/30 bg-swu-bg p-3">
          <DeclararMazo
            dosLideres={evento.tournament_type === 'mesas' || evento.match_type === 'twin_suns'}
            etiquetaAceptar="Inscribirme"
            ocupado={ocupado}
            onAceptar={(m) => void alternar(m)}
            onCancelar={() => setPidiendoMazo(false)}
          />
        </div>
      )}

      {evento.status === 'open' && !pidiendoMazo && (conSesion ? (
        <button
          onClick={() => { if (evento.is_registered) void alternar(); else setPidiendoMazo(true) }}
          disabled={ocupado}
                className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl
                            text-xs font-bold transition-transform active:scale-[0.98] disabled:opacity-60 ${
                  evento.is_registered
                    ? 'border border-swu-green/40 bg-swu-green/10 text-swu-green'
                    : 'bg-swu-accent text-white'
                }`}>
          {ocupado ? <Loader2 size={14} className="animate-spin" />
            : evento.is_registered ? <CheckCircle2 size={14} /> : <Plus size={14} />}
          {ocupado ? 'Un momento…' : evento.is_registered ? 'Inscrito — tocá para salir' : 'Inscribirse'}
        </button>
      ) : (
        <Link to="/profile"
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border
                         border-swu-border text-xs font-bold text-swu-muted">
          <LogIn size={14} /> Iniciá sesión para inscribirte
        </Link>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   ARCHIVO — lo que ya se jugó. Público, y no se le tocó la consulta.
   ══════════════════════════════════════════════════════════════════════════ */

function Archivo({ torneos, fallo, onReintentar }: {
  torneos: TorneoResumen[] | null; fallo: string | null; onReintentar: () => void
}) {
  return (
    <>
      {torneos === null && (
        <div className="space-y-2">
          {[0, 1].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-swu-surface" />)}
        </div>
      )}

      {torneos !== null && fallo && (
        <EmptyState
          icon={<Trophy size={26} />}
          title="No se pudieron cargar los torneos"
          hint={fallo}
          action={<Button variant="secondary" onClick={onReintentar}>Reintentar</Button>}
        />
      )}

      {torneos !== null && !fallo && torneos.length === 0 && (
        <EmptyState
          icon={<Trophy size={26} />}
          title="Todavía no hay torneos en el archivo"
          hint="Cuando se cierre un torneo, queda acá con su clasificación y todas sus partidas."
        />
      )}

      {torneos !== null && !fallo && torneos.length > 0 && (
        <ul className="space-y-2.5">
          {torneos.map(t => (
            <li key={t.id}>
              <Link to={`/torneos/${t.code}`}
                    className="block rounded-2xl border border-swu-border bg-swu-surface p-4 transition-colors hover:border-swu-accent/40">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-swu-amber/15 text-swu-amber">
                    <Trophy size={19} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[14px] font-black tracking-tight text-swu-text">{t.nombre}</p>
                      <span className="shrink-0 rounded bg-swu-accent/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-swu-accent-texto">
                        {t.code}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-swu-muted">
                      <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{fechaConDiaLarga(t.fecha)}</span>
                      <span className="inline-flex items-center gap-1"><Users size={12} />{t.jugadores} jugadores</span>
                      {t.tipo && <span className="inline-flex items-center gap-1"><Trophy size={12} />{etiquetaTipo(t.tipo)}</span>}
                    </div>
                    {t.campeon && (
                      <p className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-swu-amber/10 px-2 py-0.5 text-[11px] font-bold text-swu-amber">
                        <Trophy size={11} /> {t.campeon}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={18} className="mt-2 shrink-0 text-swu-muted" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   ORGANIZAR — solo admin, y acá vive TODO lo destructivo.

   El lápiz y el tacho estaban sueltos en la lista pública de /events con un
   `isAdmin &&` cada uno. Acá el gate es la pestaña: no hay que acordarse de
   ponerlo en el botón que se agregue mañana.
   ══════════════════════════════════════════════════════════════════════════ */

function Organizar({ eventos, fallo, onCambio }: {
  eventos: OfficialEvent[] | null; fallo: string | null; onCambio: () => void
}) {
  return (
    <div className="space-y-3">
      <Link to="/admin/events/new"
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-swu-accent text-sm font-bold text-white">
        <Plus size={17} /> Crear torneo
      </Link>

      <p className="text-[11px] leading-relaxed text-swu-muted">
        «Llevar el torneo» abre el tablero: sembrar la clasificación, tirar
        pareos o el cuadro, armar las mesas de Twin Suns, llevar las rondas
        con el temporizador, y cerrar repartiendo premios.
      </p>

      {eventos === null && (
        <div className="space-y-2">
          {[0, 1].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-swu-surface" />)}
        </div>
      )}

      {eventos !== null && fallo && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-400">
          {fallo}
        </p>
      )}

      {eventos !== null && !fallo && eventos.length === 0 && (
        <EmptyState icon={<Trophy size={26} />} title="No hay torneos para llevar"
                    hint="Creá uno con el botón de arriba." />
      )}

      <LogosPorFormato onCambio={onCambio} />

      {eventos?.map(e => <FilaOrganizar key={e.id} evento={e} onCambio={onCambio} />)}
    </div>
  )
}

function FilaOrganizar({ evento, onCambio }: { evento: OfficialEvent; onCambio: () => void }) {
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  const [fecha, setFecha] = useState('')
  const [horaTxt, setHoraTxt] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [borrando, setBorrando] = useState(false)

  const est = ESTADO[evento.status]

  const abrir = () => {
    // Se descompone EN ZONA SV. Si se descompusiera en la del aparato, abrir
    // el editor desde otra zona ya mostraba otra hora, y darle Guardar sin
    // tocar nada movía el evento — y se acumulaba en cada pasada.
    const { fecha: f, hora: h } = aInputsSV(evento.date)
    setNombre(evento.name)
    setLogo(evento.image_url ?? null)
    setFecha(f); setHoraTxt(h); setError(''); setEditando(true)
  }

  const guardar = async () => {
    setGuardando(true); setError('')
    // Lo tecleado es hora de El Salvador, igual que al crear. Los dos caminos
    // tienen que convertir IGUAL.
    const iso = fecha ? aISOdesdeSV(fecha, horaTxt) : null
    if (fecha && !iso) {
      setError('La fecha o la hora no son válidas'); setGuardando(false); return
    }
    /* El nombre vacío NO se guarda: un torneo sin nombre se vuelve
       imposible de distinguir en la lista y en el archivo, y el código no
       alcanza —nadie lo recuerda—. Se avisa en vez de guardar el vacío. */
    if (!nombre.trim()) {
      setError('El torneo necesita un nombre'); setGuardando(false); return
    }
    const r = await updateOfficialEvent(evento.id, {
      date: iso, name: nombre.trim(), image_url: logo,
    })
    setGuardando(false)
    if (!r.ok) { setError(r.error ?? 'No se pudo guardar'); return }
    setEditando(false)
    onCambio()
  }

  const borrar = async () => {
    setBorrando(true); setError('')
    const r = await deleteOfficialEvent(evento.id)
    setBorrando(false)
    // El error SÍ se muestra. Antes se descartaba y un borrado rechazado por
    // RLS no decía absolutamente nada: el evento seguía ahí y parecía un fallo
    // de la app.
    if (!r.ok) { setError(r.error ?? 'No se pudo eliminar'); setConfirmar(false); return }
    setConfirmar(false)
    onCambio()
  }

  return (
    <div className="rounded-2xl border border-swu-border bg-swu-surface p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-black tracking-tight text-swu-text">{evento.name}</p>
          <p className="mt-0.5 font-mono text-[11px] text-swu-muted">
            {evento.code} · <span className={est?.clase}>{est?.texto ?? evento.status}</span>
            {' · '}{etiquetaTipo(evento.tournament_type)}
            {' · '}{evento.registered_count === undefined ? '—' : evento.registered_count} inscritos
          </p>
        </div>
        {!editando && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button onClick={abrir} title="Editar el torneo"
                    className="rounded-lg bg-swu-accent/10 p-1.5 text-swu-accent-texto active:scale-95">
              <Pencil size={14} />
            </button>
            {confirmar ? (
              <div className="flex items-center gap-1">
                <button onClick={() => void borrar()} disabled={borrando}
                        className="rounded bg-red-500/20 px-2 py-1 text-[10px] font-bold text-red-400">
                  {borrando ? '…' : 'Sí, eliminar'}
                </button>
                <button onClick={() => setConfirmar(false)}
                        className="rounded bg-swu-border px-2 py-1 text-[10px] font-bold text-swu-muted">
                  No
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmar(true)} title="Eliminar evento"
                      className="rounded-lg bg-red-500/10 p-1.5 text-red-400 active:scale-95">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {editando && (
        <div className="mt-3 space-y-3 rounded-xl border border-swu-accent/20 bg-swu-bg p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-swu-accent-texto">
            Editar torneo
          </p>
          <label className="block">
            <span className="mb-1 block text-[10px] text-swu-muted">Nombre</span>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Nombre del torneo"
              className="w-full rounded-lg border border-swu-border bg-swu-surface px-2.5 py-2 text-sm text-swu-text outline-none placeholder:text-swu-muted focus:border-swu-accent"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[10px] text-swu-muted">Fecha</span>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                     className="w-full rounded-lg border border-swu-border bg-swu-surface px-2.5 py-2 text-sm text-swu-text outline-none focus:border-swu-accent" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] text-swu-muted">Hora</span>
              <input type="time" value={horaTxt} onChange={e => setHoraTxt(e.target.value)}
                     className="w-full rounded-lg border border-swu-border bg-swu-surface px-2.5 py-2 text-sm text-swu-text outline-none focus:border-swu-accent" />
            </label>
          </div>
          <LogoDelTorneo
            actual={evento.image_url ?? null}
            onSubido={(url) => setLogo(url)}
            onFallo={setError}
          />

          <div className="flex gap-2">
            <button onClick={() => void guardar()} disabled={guardando}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-swu-accent py-2 text-xs font-bold text-white disabled:opacity-50">
              {guardando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => { setEditando(false); setError('') }}
                    className="flex items-center gap-1.5 rounded-lg bg-swu-border px-4 py-2 text-xs font-bold text-swu-muted">
              <X size={12} /> Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-400">
          {error}
        </p>
      )}

      {/* Sin condición de estado: era el candado circular que impedía arrancar
          un torneo que alguien había «activado» desde el panel. */}
      <Link to={`/events/dashboard/${evento.code}`}
            className="mt-2.5 flex min-h-[44px] items-center justify-center gap-2 rounded-xl
                       border border-swu-amber/40 bg-swu-amber/10 text-xs font-bold text-swu-amber">
        <Play size={14} /> Llevar el torneo
      </Link>
    </div>
  )
}

/**
 * El logo del torneo.
 *
 * Se sube a Storage y en la fila queda solo la URL. Guardarlo como data URI
 * —que es lo que hacen los avatares— haría que el logo entero viajara en CADA
 * carga de la lista de torneos, sin caché, por cada torneo (§4m).
 */
function LogoDelTorneo({ actual, onSubido, onFallo }: {
  actual: string | null
  onSubido: (url: string | null) => void
  onFallo: (m: string) => void
}) {
  const { supabaseUser } = useAuth()
  const [subiendo, setSubiendo] = useState(false)
  const [vista, setVista] = useState<string | null>(actual)

  const elegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f || !supabaseUser) return
    setSubiendo(true)
    const r = await subirLogoTorneo(f, supabaseUser.id)
    setSubiendo(false)
    if (!r.ok || !r.url) { onFallo(r.error ?? 'No se pudo subir el logo.'); return }
    setVista(r.url)
    onSubido(r.url)
  }

  return (
    <div>
      <span className="mb-1 block text-[10px] text-swu-muted">Logo del torneo</span>
      <div className="flex items-center gap-2">
        {vista
          ? <img src={vista} alt="" className="h-12 w-12 shrink-0 rounded-xl object-contain" />
          : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-swu-border text-swu-muted">
              <ImagePlus size={16} />
            </div>}
        <label className="flex-1 cursor-pointer rounded-lg border border-dashed border-swu-border px-3 py-2 text-center text-[11px] font-semibold text-swu-accent-texto">
          {subiendo ? 'Subiendo…' : vista ? 'Cambiar imagen' : 'Elegir imagen'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/avif"
                 className="hidden" onChange={(e) => void elegir(e)} />
        </label>
        {vista && (
          <button
            type="button"
            onClick={() => { setVista(null); onSubido(null) }}
            className="shrink-0 rounded-lg p-2 text-swu-muted hover:text-red-400"
            aria-label="Quitar el logo"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

/** Los formatos que tienen logo propio. Los rótulos son los que usa la gente. */
const FORMATOS_CON_LOGO: { clave: string; rotulo: string }[] = [
  { clave: 'premier', rotulo: 'Premier' },
  { clave: 'twin_suns', rotulo: 'Twin Suns' },
]

/**
 * El logo por defecto de cada formato.
 *
 * Se sube UNA vez y todos los torneos de ese formato lo toman, incluidos los
 * que se creen después — que es justo lo que se pidió. Un torneo que suba el
 * suyo lo pisa: el propio siempre gana, o subirlo no serviría de nada.
 */
function LogosPorFormato({ onCambio }: { onCambio: () => void }) {
  const { supabaseUser } = useAuth()
  const [logos, setLogos] = useState<Map<string, string>>(new Map())
  const [subiendo, setSubiendo] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)

  useEffect(() => { void getLogosPorFormato().then(setLogos) }, [])

  const elegir = async (formato: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f || !supabaseUser) return
    setSubiendo(formato); setFallo(null)
    const sub = await subirLogoTorneo(f, supabaseUser.id)
    if (!sub.ok || !sub.url) { setFallo(sub.error ?? 'No se pudo subir.'); setSubiendo(null); return }
    const r = await fijarLogoDeFormato(formato, sub.url)
    setSubiendo(null)
    if (!r.ok) { setFallo(r.error ?? 'No se pudo guardar.'); return }
    setLogos(await getLogosPorFormato())
    onCambio()
  }

  return (
    <div className="rounded-2xl border border-swu-border bg-swu-surface p-3">
      <button onClick={() => setAbierto(v => !v)} className="flex w-full items-center justify-between">
        <span className="text-[12px] font-bold text-swu-text">Logos por formato</span>
        <span className="text-[10px] text-swu-muted">{abierto ? 'ocultar' : 'ver'}</span>
      </button>

      {abierto && (
        <div className="mt-2.5 space-y-2">
          <p className="text-[11px] leading-relaxed text-swu-muted">
            Se sube una vez y lo toman todos los torneos de ese formato, también
            los que crees después. Un torneo con logo propio usa el suyo.
          </p>
          {FORMATOS_CON_LOGO.map(f => (
            <div key={f.clave} className="flex items-center gap-2">
              {logos.get(f.clave)
                ? <img src={logos.get(f.clave)} alt="" className="h-10 w-10 shrink-0 rounded-lg object-contain" />
                : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-swu-border text-swu-muted">
                    <ImagePlus size={14} />
                  </div>}
              <span className="w-20 shrink-0 text-[12px] font-semibold text-swu-text">{f.rotulo}</span>
              <label className="flex-1 cursor-pointer rounded-lg border border-dashed border-swu-border px-2 py-1.5 text-center text-[11px] font-semibold text-swu-accent-texto">
                {subiendo === f.clave ? 'Subiendo…' : logos.get(f.clave) ? 'Cambiar' : 'Subir logo'}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/avif"
                       className="hidden" onChange={(e) => void elegir(f.clave, e)} />
              </label>
              {logos.get(f.clave) && (
                <button
                  onClick={() => void fijarLogoDeFormato(f.clave, null).then(async () => {
                    setLogos(await getLogosPorFormato()); onCambio()
                  })}
                  aria-label={`Quitar el logo de ${f.rotulo}`}
                  className="shrink-0 rounded-lg p-1.5 text-swu-muted hover:text-red-400"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
          {fallo && <p className="text-[11px] text-red-400">{fallo}</p>}
        </div>
      )}
    </div>
  )
}

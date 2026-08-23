/**
 * TORNEOS — el archivo, los que están en curso, y la puerta para organizar.
 *
 * ── Por qué dejó de ser solo el archivo ───────────────────────────────
 *
 * En el menú, «Torneos» era «Archivo de la comunidad»: solo lectura. Y la
 * capacidad de LLEVAR un torneo —sembrar, pareos suizos, cuadro de
 * eliminación, mesas de Twin Suns, rondas, cerrar y repartir— existía
 * entera en `/events/dashboard/:code` **sin una sola entrada de menú**: se
 * llegaba desde el panel de admin o tecleando el código de memoria.
 *
 * Faltaba puerta, no capacidad. Esta pantalla es la puerta.
 *
 * ── Y el candado circular que lo hacía peor ───────────────────────────
 *
 * El botón hacia el tablero estaba condicionado a `status === 'active'` en
 * las dos listas que lo ofrecían. Para activar un torneo había que entrar al
 * tablero; para entrar al tablero, tenía que estar activo. Acá el botón
 * «Llevar el torneo» **no mira el estado**: abre siempre.
 *
 * ── Tres pestañas, tres públicos ──────────────────────────────────────
 *
 * · **Archivo** — pública, lo de siempre. Es la que abre por defecto para
 *   quien no organiza, y la que se comparte por WhatsApp: la ruta está en
 *   `rutaLibre`, así que un visitante sin cuenta ni app instalada la ve.
 * · **En curso** — también pública. Antes un torneo abierto y uno cerrado
 *   vivían en listas distintas y no había dónde verlos juntos.
 * · **Organizar** — solo admin. Crear, y entrar a llevar cualquiera.
 *
 * La pestaña de organizar **no consulta nada** si no sos admin: esta ruta
 * es la que trae gente nueva desde un enlace, y no puede empezar a fallar
 * para un visitante anónimo.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Trophy, Users, CalendarDays, Plus, Play, Radio,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { fechaConDiaLarga } from '../../services/horaSV'
import { listarTorneos, type TorneoResumen } from '../../services/torneosHistoricos'
import { getOfficialEvents, type OfficialEvent } from '../../services/events'
import { etiquetaTipo } from '../../services/tipoTorneo'
import { useAuth } from '../../hooks/useAuth'

type Pestana = 'archivo' | 'curso' | 'organizar'

const ESTADO: Record<string, { texto: string; clase: string }> = {
  open: { texto: 'inscripción abierta', clase: 'text-swu-cyan' },
  active: { texto: 'en curso', clase: 'text-swu-green' },
  finished: { texto: 'terminado', clase: 'text-swu-amber' },
  cancelled: { texto: 'cancelado', clase: 'text-swu-red-texto' },
}

export function TorneosPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [pestana, setPestana] = useState<Pestana>('archivo')
  const [torneos, setTorneos] = useState<TorneoResumen[] | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [enCurso, setEnCurso] = useState<OfficialEvent[] | null>(null)

  useEffect(() => {
    let vivo = true
    void (async () => {
      const r = await listarTorneos()
      if (!vivo) return
      if (r.ok) { setTorneos(r.datos); setFallo(null) }
      else { setTorneos([]); setFallo(r.mensaje) }
    })()
    return () => { vivo = false }
  }, [recarga])

  // Los que vienen y los que están corriendo. `getOfficialEvents` ya filtra a
  // open + active, así que esta lista es exactamente «lo que no es archivo».
  useEffect(() => {
    let vivo = true
    void (async () => {
      const e = await getOfficialEvents().catch(() => [] as OfficialEvent[])
      if (vivo) setEnCurso(e)
    })()
    return () => { vivo = false }
  }, [recarga])

  const pestanas: { id: Pestana; label: string }[] = [
    { id: 'archivo', label: 'Archivo' },
    { id: 'curso', label: 'En curso' },
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
            {isAdmin ? 'Archivo y organización' : 'El archivo de la comunidad'}
          </p>
        </div>
      </header>

      <div className="flex gap-1 border-b border-swu-border">
        {pestanas.map(p => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id)}
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

      {/* ── Archivo ── */}
      {pestana === 'archivo' && (
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
              action={<Button variant="secondary" onClick={() => setRecarga(n => n + 1)}>Reintentar</Button>}
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
                  <Link
                    to={`/torneos/${t.code}`}
                    className="block rounded-2xl border border-swu-border bg-swu-surface p-4 transition-colors hover:border-swu-accent/40"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-swu-amber/15 text-swu-amber">
                        <Trophy size={19} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-black tracking-tight text-swu-text">{t.nombre}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-swu-muted">
                          <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{fechaConDiaLarga(t.fecha)}</span>
                          <span className="inline-flex items-center gap-1"><Users size={12} />{t.jugadores} jugadores</span>
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
      )}

      {/* ── En curso ── */}
      {pestana === 'curso' && (
        <>
          {enCurso === null && (
            <div className="space-y-2">
              {[0, 1].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-swu-surface" />)}
            </div>
          )}
          {enCurso !== null && enCurso.length === 0 && (
            <EmptyState
              icon={<Radio size={26} />}
              title="No hay torneos abiertos"
              hint="Acá aparecen los que están con inscripción abierta o jugándose ahora."
            />
          )}
          {enCurso !== null && enCurso.length > 0 && (
            <ul className="space-y-2.5">
              {enCurso.map(e => {
                const est = ESTADO[e.status]
                return (
                  <li key={e.id}>
                    <Link
                      to={`/events/live/${e.code}`}
                      className="block rounded-2xl border border-swu-border bg-swu-surface p-4 transition-colors hover:border-swu-accent/40"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-swu-cyan/15 text-swu-cyan">
                          <Radio size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-black tracking-tight text-swu-text">{e.name}</p>
                          <p className="mt-1 font-mono text-[11px] text-swu-muted">
                            {e.code} · <span className={est?.clase}>{est?.texto}</span>
                            {' · '}{etiquetaTipo(e.tournament_type)}
                            {/* El conteo de inscritos SOLO se muestra a un admin.
                                Medido con RLS de verdad: la policy `reg_select`
                                deja ver las inscripciones únicamente a los admin
                                — un jugador normal y un visitante anónimo ven
                                CERO filas. La consulta no falla, devuelve 0, así
                                que pintarlo anunciaría vacío un torneo con gente
                                dentro. Para quien no puede saberlo, no se dice. */}
                            {isAdmin && (
                              <>{' · '}{e.registered_count === undefined ? '—' : e.registered_count} inscritos</>
                            )}
                          </p>
                        </div>
                        <ChevronRight size={18} className="mt-2 shrink-0 text-swu-muted" />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {/* ── Organizar ── */}
      {pestana === 'organizar' && isAdmin && (
        <div className="space-y-3">
          <Link
            to="/admin/events/new"
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-swu-accent
                       text-sm font-bold text-white"
          >
            <Plus size={17} /> Crear torneo
          </Link>

          <p className="text-[11px] leading-relaxed text-swu-muted">
            «Llevar el torneo» abre el tablero: sembrar la clasificación, tirar
            pareos o el cuadro, armar las mesas de Twin Suns, llevar las rondas
            con el temporizador, y cerrar repartiendo premios.
          </p>

          {enCurso === null && (
            <div className="space-y-2">
              {[0, 1].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-swu-surface" />)}
            </div>
          )}
          {enCurso !== null && enCurso.length === 0 && (
            <EmptyState
              icon={<Trophy size={26} />}
              title="No hay torneos para llevar"
              hint="Creá uno con el botón de arriba."
            />
          )}
          {enCurso !== null && enCurso.map(e => {
            const est = ESTADO[e.status]
            return (
              <div key={e.id} className="rounded-2xl border border-swu-border bg-swu-surface p-3.5">
                <p className="truncate text-[14px] font-black tracking-tight text-swu-text">{e.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-swu-muted">
                  {e.code} · <span className={est?.clase}>{est?.texto}</span>
                  {' · '}{etiquetaTipo(e.tournament_type)}
                  {' · '}{e.registered_count === undefined ? '—' : e.registered_count} inscritos
                </p>
                {/* Sin condición de estado: era el candado que impedía arrancar
                    un torneo que alguien había «activado» desde el panel. */}
                <Link
                  to={`/events/dashboard/${e.code}`}
                  className="mt-2.5 flex min-h-[44px] items-center justify-center gap-2 rounded-xl
                             border border-swu-amber/40 bg-swu-amber/10 text-xs font-bold text-swu-amber"
                >
                  <Play size={14} /> Llevar el torneo
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

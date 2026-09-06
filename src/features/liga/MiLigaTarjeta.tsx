/**
 * «MI LIGA» — la tarjeta del jugador de liga, en su perfil.
 *
 * Pedido de Nel: «al inscribirse en la liga, que el perfil tenga un espacio de
 * cómo van sus stats, contra quién le tocaría jugar, e incluso dónde estarían
 * colgados los videos de YouTube de cada partida».
 *
 * ── Lo primero es la ACCIÓN, no la tabla ─────────────────────────────
 *
 * Si hay una partida esperando MI respuesta, eso va arriba de todo: es lo
 * único que puedo resolver hoy. El puesto es información; confirmar un
 * marcador es trabajo pendiente, y trabajo pendiente enterrado bajo una tabla
 * es trabajo que no se hace.
 *
 * No se dibuja nada si no juego ninguna liga — el caso de casi todo el mundo.
 * Una tarjeta que dice «no tenés liga» es una fila más de ruido en un perfil
 * que ya es largo.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Trophy, Swords, PlayCircle, ChevronRight, Clock, CalendarClock, Eye, EyeOff, Check,
} from 'lucide-react'
import {
  getMiEstadoLiga, guardarDisponibilidad, guardarNombrePublico, tablaDe, NOMBRE_TIER,
  type MiLiga, type CarneLiga,
} from '../../services/ligaService'
import { RejillaDisponibilidad, FRANJAS_VACIAS, horasDe } from './RejillaDisponibilidad'

export function MiLigaTarjeta() {
  const [datos, setDatos] = useState<MiLiga | null>(null)
  const [carne, setCarne] = useState<CarneLiga | null>(null)

  useEffect(() => {
    let vivo = true
    void getMiEstadoLiga().then(r => {
      if (!vivo) return
      setDatos(r.liga)
      setCarne(r.carne)
    })
    return () => { vivo = false }
  }, [])

  const tabla = useMemo(
    () => (datos ? tablaDe(datos.plazas, datos.partidas, datos.grupo.id) : []),
    [datos])

  /* Sin plaza pero CON carné: estás anotado y todavía no armaron los grupos.
     Ese hueco dura semanas y hasta hoy se veía igual que no estar inscrito. */
  if (!datos) return carne ? <TarjetaCarne carne={carne} alCambiar={setCarne} /> : null

  const puesto = tabla.findIndex(f => f.plazaId === datos.miPlaza) + 1
  const yo = tabla.find(f => f.plazaId === datos.miPlaza)
  const porPlaza = new Map(datos.plazas.map(p => [p.id, p]))

  const mias = datos.partidas.filter(
    m => m.localPlaza === datos.miPlaza || m.visitaPlaza === datos.miPlaza)

  // La que espera MI respuesta primero; si no, la próxima sin jugar.
  const esperaMi = mias.find(m => m.estado === 'reportada' && m.reportadaPor !== datos.miPlaza)
  const proxima = esperaMi ?? mias.find(m => m.estado === 'programada')
  const rival = proxima
    ? porPlaza.get(proxima.localPlaza === datos.miPlaza ? proxima.visitaPlaza : proxima.localPlaza)
    : undefined

  const misVods = mias.filter(m => m.vod)

  return (
    <section className="rounded-2xl border border-swu-amber/40 bg-swu-amber/5 p-4">
      <Link to={`/liga/${datos.liga.code}`} className="flex items-center gap-2.5">
        <Trophy size={18} className="shrink-0 text-swu-amber" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-swu-amber">
            {NOMBRE_TIER[datos.grupo.tier] ?? datos.grupo.tier} {datos.grupo.orden}
          </p>
          <p className="truncate text-[13px] font-black text-swu-text">{datos.liga.nombre}</p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-swu-muted" />
      </Link>

      {/* Lo que espera una respuesta mía va ARRIBA de la tabla. */}
      {esperaMi && rival && (
        <Link
          to={`/liga/${datos.liga.code}`}
          className="mt-3 flex items-center gap-2.5 rounded-xl border border-swu-accent/50 bg-swu-accent/10 px-3 py-2.5"
        >
          <Clock size={15} className="shrink-0 text-swu-accent-texto" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black text-swu-accent-texto">
              {rival.nombre} anotó {esperaMi.vl}-{esperaMi.vv}
            </p>
            <p className="text-[10px] text-swu-muted">
              Confirmalo o decí que no fue así{esperaMi.venceEl ? ` · vence el ${esperaMi.venceEl}` : ''}
            </p>
          </div>
        </Link>
      )}

      {yo && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ['Puesto', puesto > 0 ? `${puesto}º de ${tabla.length}` : '—'],
            ['Récord', `${yo.ganadas}-${yo.perdidas}`],
            ['Puntos', String(yo.puntos)],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="rounded-xl border border-swu-border bg-swu-bg px-2 py-2 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-swu-muted">{rotulo}</p>
              <p className="text-[15px] font-black tabular-nums text-swu-text">{valor}</p>
            </div>
          ))}
        </div>
      )}

      {!esperaMi && proxima && rival && (
        <div className="mt-2.5 rounded-xl border border-swu-border bg-swu-bg px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-swu-muted">
            <Swords size={11} /> Te toca — jornada {proxima.jornada}
          </p>
          <p className="mt-0.5 truncate text-[14px] font-black text-swu-text">{rival.nombre}</p>
          {rival.lider && <p className="truncate text-[11px] text-swu-muted">{rival.lider}</p>}
        </div>
      )}

      {misVods.length > 0 && (
        <div className="mt-2.5">
          <p className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-swu-muted">
            <PlayCircle size={11} /> Mis partidas grabadas
          </p>
          <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
            {misVods.map(m => (
              <a
                key={m.id}
                href={`https://www.youtube.com/watch?v=${m.vod}`}
                target="_blank" rel="noopener noreferrer"
                className="w-40 shrink-0 snap-start overflow-hidden rounded-lg border border-swu-border bg-swu-bg"
              >
                <img src={`https://i.ytimg.com/vi/${m.vod}/mqdefault.jpg`} alt="" className="aspect-video w-full object-cover" />
                <p className="truncate px-2 py-1 text-[10px] font-bold text-swu-text">
                  J{m.jornada} · {m.vl}-{m.vv}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   EL CARNÉ — «estás dentro», antes de que existan los grupos

   Entre inscribirse y el sorteo pasan SEMANAS. En ese hueco la app no tenía
   nada que decir: el perfil de alguien recién inscrito se veía idéntico al de
   alguien que nunca entró. Ese es el paso donde se pierde a la gente, no el
   formulario — y no se arregla con un cartel, se arregla dándole algo que
   HACER mientras espera.

   Por eso acá hay dos cosas accionables y ninguna decorativa:

   · EDITAR LOS HORARIOS. Es el dato que más se pudre —cambia el turno, el
     colegio, el trabajo— y hasta hoy se declaraba UNA vez en la vida:
     `guardarDisponibilidad` estaba exportada y no la llamaba ni un componente,
     y la rejilla solo se montaba en el alta, que desaparece en cuanto te
     inscribís. La RPC ya existía, probada y con permisos. Faltaba el botón.

   · MOSTRAR O ESCONDER EL NOMBRE. La misma decisión del alta, reversible. No
     es simétrica: quien se escondió puede querer mostrarse cuando gane, y
     quien se mostró puede querer esconderse — y eso último no puede esperar a
     que exista una pantalla de ajustes.
   ══════════════════════════════════════════════════════════════════════ */

function TarjetaCarne(
  { carne, alCambiar }: { carne: CarneLiga; alCambiar: (c: CarneLiga) => void },
) {
  const [abierta, setAbierta] = useState(false)
  /* La rejilla arranca con lo que YA declaró esta persona, no en blanco.
     Abrir en blanco y guardar le borraría la semana sin decirle nada. */
  const [franjas, setFranjas] = useState(carne.franjas ?? FRANJAS_VACIAS)
  const [zona, setZona] = useState(carne.zona ?? undefined)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const horas = horasDe(franjas)
  const cambio = franjas !== (carne.franjas ?? FRANJAS_VACIAS) || zona !== (carne.zona ?? undefined)

  const guardar = () => {
    setGuardando(true)
    setAviso(null)
    void guardarDisponibilidad(carne.ligaId, zona ?? carne.zona ?? '', franjas)
      .then(r => {
        setGuardando(false)
        if (r.ok) {
          alCambiar({ ...carne, franjas, zona: zona ?? carne.zona })
          setAviso('Horarios guardados.')
        } else setAviso(r.mensaje ?? 'No se pudo guardar.')
      })
  }

  const cambiarNombre = () => {
    const nuevo = !carne.consientePerfil
    setGuardando(true)
    setAviso(null)
    void guardarNombrePublico(carne.ligaId, nuevo).then(r => {
      setGuardando(false)
      if (r.ok) {
        // El nombre que vale es el que devolvió el SERVIDOR: lo calcula él
        // desde el perfil, y adivinarlo acá sería una segunda regla que algún
        // día no coincide con la suya.
        const visible = (r.extra?.nombreVisible as string | undefined) ?? carne.nombreVisible
        alCambiar({ ...carne, consientePerfil: nuevo, nombreVisible: visible })
      } else setAviso(r.mensaje ?? 'No se pudo cambiar.')
    })
  }

  return (
    <section className="rounded-2xl border border-swu-amber/40 bg-swu-amber/5 p-4">
      <Link to={`/liga/${carne.code}`} className="flex items-center gap-2.5">
        <Trophy size={18} className="shrink-0 text-swu-amber" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-swu-amber">
            Estás dentro
          </p>
          <p className="truncate text-[13px] font-black text-swu-text">{carne.nombre}</p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-swu-muted" />
      </Link>

      {/* «Sos el 12» a secas no dice nada. Las dos cifras van juntas, y el cupo
          solo si existe: sin tope, «de 128» sería un número inventado. */}
      <p className="mt-2 text-[12px] leading-snug text-swu-text">
        Sos el inscrito <span className="font-black">{carne.puesto}</span> de{' '}
        <span className="font-black">{carne.total}</span>
        {carne.cupo ? ` · cupo ${carne.cupo}` : ''}.
      </p>
      <p className="mt-0.5 text-[10px] leading-snug text-swu-muted">
        Los grupos se arman cuando cierre la inscripción. Te avisamos.
      </p>

      {/* El nombre, con el resultado a la vista y no la promesa en abstracto. */}
      <button
        onClick={cambiarNombre}
        disabled={guardando}
        className="mt-3 flex w-full items-center gap-2.5 rounded-xl border border-swu-border bg-swu-bg px-3 py-2.5 text-left disabled:opacity-50"
      >
        {carne.consientePerfil
          ? <Eye size={15} className="shrink-0 text-swu-cyan" />
          : <EyeOff size={15} className="shrink-0 text-swu-muted" />}
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-black text-swu-text">
            En la tabla salís como «{carne.nombreVisible}»
          </span>
          <span className="block text-[10px] text-swu-muted">
            {carne.consientePerfil
              ? 'Tocá para salir solo con tus iniciales.'
              : 'Tocá para salir con tu nombre completo.'}
          </span>
        </span>
      </button>

      {/* Los horarios. Plegado por defecto: es una rejilla grande y el caso
          normal es no tocarla. */}
      <button
        onClick={() => setAbierta(a => !a)}
        className="mt-2 flex w-full items-center gap-2.5 rounded-xl border border-swu-border bg-swu-bg px-3 py-2.5 text-left"
      >
        <CalendarClock size={15} className="shrink-0 text-swu-amber" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-black text-swu-text">
            {abierta ? 'Cerrar mis horarios' : 'Cambiar mis horarios'}
          </span>
          <span className="block text-[10px] text-swu-muted">
            {carne.franjas
              ? `${horasDe(carne.franjas)} h por semana declaradas`
              : 'Todavía no declaraste ninguno'}
          </span>
        </span>
      </button>

      {abierta && (
        <div className="mt-2">
          <RejillaDisponibilidad
            valor={franjas}
            onCambio={setFranjas}
            zona={zona}
            onZona={setZona}
          />
          <button
            onClick={guardar}
            disabled={guardando || !cambio || horas < 6}
            className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-swu-amber text-[12px] font-black uppercase tracking-wider text-swu-bg disabled:opacity-50"
          >
            <Check size={14} /> {guardando ? 'Guardando…' : 'Guardar horarios'}
          </button>
          {horas < 6 && (
            <p className="mt-1.5 text-center text-[10px] text-swu-muted">
              La liga pide 6 horas por semana. Llevás {horas}.
            </p>
          )}
        </div>
      )}

      {aviso && (
        <p className="mt-2 rounded-xl border border-swu-border bg-swu-bg px-3 py-2 text-center text-[11px] text-swu-text">
          {aviso}
        </p>
      )}
    </section>
  )
}

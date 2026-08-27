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
import { Trophy, Swords, PlayCircle, ChevronRight, Clock } from 'lucide-react'
import { getMiLiga, tablaDe, NOMBRE_TIER, type MiLiga } from '../../services/ligaService'

export function MiLigaTarjeta() {
  const [datos, setDatos] = useState<MiLiga | null>(null)

  useEffect(() => {
    let vivo = true
    void getMiLiga().then(r => { if (vivo) setDatos(r) })
    return () => { vivo = false }
  }, [])

  const tabla = useMemo(
    () => (datos ? tablaDe(datos.plazas, datos.partidas, datos.grupo.id) : []),
    [datos])

  if (!datos) return null

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

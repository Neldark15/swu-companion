/**
 * «MI LIGA» — la tarjeta del jugador inscrito, en su perfil.
 *
 * Es el pedido literal de Nel: «al inscribirse en la liga, que el perfil tenga
 * un espacio de cómo van sus stats, contra quién le tocaría jugar, e incluso
 * dónde estarían colgados los videos de YouTube de cada partida».
 *
 * ── Las tres cosas, en ese orden ──────────────────────────────────────
 *
 * 1. CÓMO VOY: posición, récord y puntos.
 * 2. CONTRA QUIÉN ME TOCA: el próximo rival —la primera partida programada
 *    donde estoy— con su credencial a un toque.
 * 3. MIS VIDEOS: solo los de MIS partidas, no los de la liga entera.
 *
 * No se dibuja nada si no estás en ninguna liga, que es el caso de casi todo
 * el mundo: una tarjeta vacía diciendo «no tenés liga» sería una fila más de
 * ruido en un perfil que ya es largo.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Swords, PlayCircle, ChevronRight } from 'lucide-react'
import { getMiLiga, tablaDe, type MiLiga } from '../../services/ligaService'

export function MiLigaTarjeta() {
  const [datos, setDatos] = useState<MiLiga | null>(null)

  useEffect(() => {
    let vivo = true
    void getMiLiga().then(r => { if (vivo) setDatos(r) })
    return () => { vivo = false }
  }, [])

  const tabla = useMemo(
    () => (datos ? tablaDe(datos.inscripciones, datos.partidas) : []),
    [datos])

  const porInsc = useMemo(
    () => new Map((datos?.inscripciones ?? []).map(i => [i.id, i])),
    [datos])

  if (!datos) return null

  const yo = tabla.find(f => f.inscId === datos.miInscripcion)
  const puesto = tabla.findIndex(f => f.inscId === datos.miInscripcion) + 1

  // El próximo rival: la primera partida programada donde estoy.
  const proxima = datos.partidas.find(
    p => p.estado === 'programada' &&
      (p.localInsc === datos.miInscripcion || p.visitaInsc === datos.miInscripcion))
  const rival = proxima
    ? porInsc.get(proxima.localInsc === datos.miInscripcion ? proxima.visitaInsc : proxima.localInsc)
    : undefined

  // Solo MIS videos, no los de la liga entera.
  const misVods = datos.partidas.filter(
    p => p.vodYoutubeId &&
      (p.localInsc === datos.miInscripcion || p.visitaInsc === datos.miInscripcion))

  return (
    <section className="rounded-2xl border border-swu-amber/40 bg-swu-amber/5 p-4">
      <div className="flex items-center gap-2.5">
        {datos.liga.creadorLogo ? (
          <img src={datos.liga.creadorLogo} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
        ) : (
          <Trophy size={18} className="shrink-0 text-swu-amber" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-swu-amber">Mi liga</p>
          <p className="truncate text-[13px] font-black text-swu-text">{datos.liga.nombre}</p>
        </div>
        <Link to={`/liga/${datos.liga.code}`} className="shrink-0 text-swu-muted">
          <ChevronRight size={18} />
        </Link>
      </div>

      {/* 1 · Cómo voy */}
      {yo && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ['Puesto', puesto > 0 ? `${puesto}º` : '—'],
            ['Récord', `${yo.ganadas}-${yo.perdidas}`],
            ['Puntos', String(yo.puntos)],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="rounded-xl border border-swu-border bg-swu-bg px-2 py-2 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-swu-muted">{rotulo}</p>
              <p className="text-[16px] font-black tabular-nums text-swu-text">{valor}</p>
            </div>
          ))}
        </div>
      )}

      {/* 2 · Contra quién me toca */}
      {rival ? (
        <div className="mt-2.5 rounded-xl border border-swu-border bg-swu-bg px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-swu-muted">
            <Swords size={11} /> Te toca — jornada {proxima?.jornada}
          </p>
          {rival.userId ? (
            <Link to={`/u/${rival.userId}`} className="mt-0.5 block truncate text-[14px] font-black text-swu-accent-texto">
              {rival.nombre}
            </Link>
          ) : (
            <p className="mt-0.5 truncate text-[14px] font-black text-swu-text">{rival.nombre}</p>
          )}
          {rival.lider && <p className="truncate text-[11px] text-swu-muted">{rival.lider}</p>}
        </div>
      ) : datos.liga.estado === 'inscripcion' ? (
        <p className="mt-2.5 rounded-xl border border-swu-border bg-swu-bg px-3 py-2.5 text-center text-[11px] text-swu-muted">
          El calendario se sortea cuando cierre la inscripción.
        </p>
      ) : null}

      {/* 3 · Mis videos */}
      {misVods.length > 0 && (
        <div className="mt-2.5">
          <p className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-swu-muted">
            <PlayCircle size={11} /> Mis partidas grabadas
          </p>
          <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
            {misVods.map(p => (
              <a
                key={p.id}
                href={`https://www.youtube.com/watch?v=${p.vodYoutubeId}${p.vodT ? `&t=${p.vodT}` : ''}`}
                target="_blank" rel="noopener noreferrer"
                className="w-40 shrink-0 snap-start overflow-hidden rounded-lg border border-swu-border bg-swu-bg"
              >
                <img src={`https://i.ytimg.com/vi/${p.vodYoutubeId}/mqdefault.jpg`} alt="" className="aspect-video w-full object-cover" />
                <p className="truncate px-2 py-1 text-[10px] font-bold text-swu-text">
                  J{p.jornada} · {p.victoriasLocal}-{p.victoriasVisita}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

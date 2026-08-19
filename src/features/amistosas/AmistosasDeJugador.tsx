/**
 * Las amistosas de OTRO jugador.
 *
 * ── Solo las confirmadas, y no es una decisión de esta pantalla ──────
 *
 * La base solo deja leer las que están en `confirmada` a quien no participó
 * (política `duelos_publicos`). Una pendiente es una partida que el rival
 * todavía no aceptó publicar: enseñarla desde el perfil de otro sería
 * publicarla por él, que es exactamente lo que la máquina de estados existe
 * para impedir (§3a).
 *
 * Por eso el contador dice «confirmadas» y no «duelos»: alguien puede tener
 * veinte anotadas y una sola acá, y sin la palabra parecería que jugó una vez.
 *
 * ── El punto de vista ────────────────────────────────────────────────
 *
 * Se usa el MISMO `vistaDe` del historial propio, pasándole el id del perfil
 * que se está mirando. En esta tabla el marcador está guardado desde el lado
 * de quien anotó el duelo, así que la mitad de las filas hay que voltearlas —
 * y como los dos números son plausibles, un volteo mal hecho no se nota. Tener
 * un solo sitio donde se decide es lo que impide ese error.
 */

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Swords, RefreshCw } from 'lucide-react'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { supabase } from '../../services/supabase'
import { fechaCorta } from '../../services/horaSV'
import { amistosasDePerfil, agruparCaraACara, type DueloVisto } from '../../services/amistosas'

const RESULTADO: Record<DueloVisto['resultado'], { texto: string; clase: string }> = {
  gane: { texto: 'Ganó', clase: 'text-swu-green' },
  perdi: { texto: 'Perdió', clase: 'text-swu-red-texto' },
  empate: { texto: 'Empate', clase: 'text-swu-amber' },
  'sin-marcador': { texto: 'Sin marcador', clase: 'text-swu-muted' },
}

export function AmistosasDeJugador() {
  const { userId = '' } = useParams()
  const [duelos, setDuelos] = useState<DueloVisto[] | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [quien, setQuien] = useState<{ name: string; avatar: string | null } | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    if (!userId) return
    let vivo = true
    void (async () => {
      const [r, perfil] = await Promise.all([
        amistosasDePerfil(userId),
        supabase.from('profiles').select('name, avatar').eq('id', userId).maybeSingle(),
      ])
      if (!vivo) return
      if (r.ok) { setDuelos(r.datos); setFallo(null) }
      else { setDuelos([]); setFallo(r.mensaje) }
      // `error` no se mira a propósito: si el perfil no carga, la pantalla
      // funciona igual con el nombre que traen los propios duelos.
      if (perfil.data) setQuien(perfil.data as { name: string; avatar: string | null })
    })()
    return () => { vivo = false }
  }, [userId, recarga])

  const cara = agruparCaraACara(duelos ?? [])
  const ganados = (duelos ?? []).filter(d => d.resultado === 'gane').length
  const perdidos = (duelos ?? []).filter(d => d.resultado === 'perdi').length
  const nombre = quien?.name ?? duelos?.[0]?.yo.nombre ?? 'Jugador'

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pt-3 pb-24">
      <Link
        to="/amistosas"
        className="-ml-1 flex items-center gap-1 p-1 text-sm text-swu-muted hover:text-swu-text"
      >
        <ChevronLeft size={18} />
        Amistosas
      </Link>

      <header className="flex items-center gap-3">
        <Avatar avatar={quien?.avatar} size={52} anillo={userId} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black tracking-tight text-swu-text">{nombre}</h1>
          <p className="text-xs text-swu-muted tabular-nums">
            {duelos === null
              ? 'Cargando…'
              : `${duelos.length} ${duelos.length === 1 ? 'amistosa confirmada' : 'amistosas confirmadas'}`}
            {duelos !== null && duelos.length > 0 && ` · ${ganados}-${perdidos} · ${cara.length} ${cara.length === 1 ? 'rival' : 'rivales'}`}
          </p>
        </div>
      </header>

      {duelos === null && (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-swu-surface" />)}
        </div>
      )}

      {duelos !== null && fallo && (
        <EmptyState
          icon={<RefreshCw size={26} />}
          title="No se pudo cargar el historial"
          hint={fallo}
          action={<Button variant="secondary" onClick={() => setRecarga(n => n + 1)}>Reintentar</Button>}
        />
      )}

      {duelos !== null && !fallo && duelos.length === 0 && (
        <EmptyState
          icon={<Swords size={26} />}
          title="Sin amistosas confirmadas"
          hint="Puede que haya jugado y que nadie haya confirmado todavía: solo se publican las que el rival acepta."
        />
      )}

      {duelos !== null && !fallo && duelos.length > 0 && (
        <>
          {/* Cara a cara primero: la pregunta que trae a alguien acá casi
              siempre es «¿cómo le va contra fulano?», no «¿qué jugó el martes?». */}
          <section>
            <h2 className="mb-1.5 px-1 text-[10px] font-black tracking-[0.22em] text-swu-muted uppercase">
              Contra quién
            </h2>
            <ul className="divide-y divide-swu-border overflow-hidden rounded-xl bg-swu-surface">
              {cara.map(c => (
                <li key={c.rivalId ?? `n:${c.nombre}`} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar avatar={c.avatar} size={32} anillo={c.rivalId ?? c.nombre} />
                  <span className="min-w-0 flex-1 truncate text-sm text-swu-text">{c.nombre}</span>
                  <span className="shrink-0 text-sm font-black tabular-nums">
                    <span className="text-swu-green">{c.ganados}</span>
                    <span className="text-swu-muted">-</span>
                    <span className="text-swu-red-texto">{c.perdidos}</span>
                    {c.sinMarcador > 0 && (
                      <span className="ml-1.5 text-[10px] font-normal text-swu-muted">
                        +{c.sinMarcador} sin marcar
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-1.5 px-1 text-[10px] font-black tracking-[0.22em] text-swu-muted uppercase">
              Historial
            </h2>
            <ul className="divide-y divide-swu-border overflow-hidden rounded-xl bg-swu-surface">
              {duelos.map(d => (
                <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar avatar={d.rival.avatar} size={28} anillo={d.rival.perfilId ?? d.rival.nombre} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-swu-text">contra {d.rival.nombre}</span>
                    <span className="block text-[10px] text-swu-muted">{fechaCorta(d.cuando)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`block text-xs font-bold ${RESULTADO[d.resultado].clase}`}>
                      {RESULTADO[d.resultado].texto}
                    </span>
                    {d.resultado !== 'sin-marcador' && (
                      <span className="block text-[11px] tabular-nums text-swu-muted">
                        {d.yo.victorias}-{d.rival.victorias}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

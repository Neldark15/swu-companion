/**
 * META AMISTOSO — qué se juega de verdad cuando nadie está compitiendo.
 *
 * El meta de torneo dice qué lleva la gente cuando hay premio. Este dice qué
 * lleva cuando juega por gusto, que en una comunidad de 25 personas es el 90%
 * de las partidas y hasta ahora no se medía en ningún lado.
 *
 * SOLO entra lo que las DOS personas aceptaron publicar. Una amistosa la
 * anota una sola, así que sin el consentimiento del rival esto sería una lista
 * de mazos ajenos publicada por terceros. Con él, es un dato.
 *
 * Y agrega los DOS lados de cada duelo, no solo el de quien anotó: quien anota
 * es siempre el mismo tipo de persona —la que lleva el teléfono a la mesa— y
 * mirar solo su lado daría un meta sesgado hacia sus mazos.
 */

import { useEffect, useState } from 'react'
import { Handshake, RefreshCw } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { metaAmistoso, type MetaAmistoso } from '../../services/amistosas'

/** Debajo de esto un porcentaje es ruido, no una tendencia. */
const MINIMO_PARA_WINRATE = 4

export function MetaAmistosoView() {
  const [filas, setFilas] = useState<MetaAmistoso[] | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vivo = true
    void (async () => {
      const r = await metaAmistoso(90)
      if (!vivo) return
      if (r.ok) { setFilas(r.datos); setFallo(null) }
      else { setFilas([]); setFallo(r.mensaje) }
    })()
    return () => { vivo = false }
  }, [recarga])

  if (filas === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-swu-surface" />)}
      </div>
    )
  }

  // Un fallo de red NO se puede ver igual que «nadie ha publicado nada».
  if (fallo) {
    return (
      <EmptyState
        icon={<RefreshCw size={26} />}
        title="No se pudo leer el meta amistoso"
        hint={fallo}
        action={<Button variant="secondary" onClick={() => setRecarga((n) => n + 1)}>Reintentar</Button>}
      />
    )
  }

  if (filas.length === 0) {
    return (
      <EmptyState
        icon={<Handshake size={26} />}
        title="Todavía no hay partidas publicadas"
        hint="Cuando anotes una amistosa y tu rival la confirme, el mazo de los dos empieza a contar acá."
      />
    )
  }

  const total = filas.reduce((n, f) => n + f.partidas, 0)

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-swu-muted">
        {total} {total === 1 ? 'aparición' : 'apariciones'} de mazo en los últimos 90 días, de partidas
        que los dos jugadores aceptaron publicar.
      </p>

      <ul className="space-y-1.5">
        {filas.map((f) => {
          const parte = Math.round((f.partidas / total) * 100)
          const conMarcador = f.ganadas + f.perdidas
          return (
            <li
              key={`${f.lider}|${f.base}`}
              className="rounded-xl border border-swu-border bg-swu-surface p-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-swu-text">{f.lider}</p>
                <span className="shrink-0 text-[11px] font-bold text-swu-accent-texto">{parte}%</span>
              </div>
              <p className="truncate text-[11px] text-swu-muted">{f.base || 'Sin base anotada'}</p>

              {/* Barra de presencia. El ancho es el % de apariciones. */}
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-swu-bg">
                <div className="h-full rounded-full bg-swu-accent" style={{ width: `${parte}%` }} />
              </div>

              <p className="mt-1.5 text-[10px] text-swu-muted">
                {f.partidas} {f.partidas === 1 ? 'partida' : 'partidas'}
                {/* El winrate se calla cuando no tiene con qué: hoy la mayoría
                    de los duelos están 0-0 porque se usó el Contador para
                    llevar la vida y nadie marcó quién ganó. Un «0%» ahí sería
                    una mentira con cara de dato. */}
                {conMarcador === 0
                  ? ' · sin marcador anotado'
                  : conMarcador < MINIMO_PARA_WINRATE
                    ? ` · ${f.ganadas}-${f.perdidas} (pocas para un %)`
                    : ` · ${f.winrate}% de victorias en ${conMarcador}`}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

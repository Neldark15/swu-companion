/**
 * SelectorCarta — elegir UNA carta, y su impresión concreta.
 *
 * Hoy este patrón está copiado en tres pantallas (CompartirEnChat.tsx:59,
 * DeckBuilderPage.tsx:199, TrackerPage.tsx:209) y ninguna lo exporta. Acá va
 * una sola vez, con el añadido que el blog necesita y las otras tres no: el
 * SEGUNDO paso, elegir la impresión.
 *
 * ── Los dos pasos ─────────────────────────────────────────────────────
 *
 * 1. Buscar con `canonicalOnly: true`. El 74% de las 9.057 filas son
 *    impresiones alternativas: sin esto, «Krennic» devuelve ocho Krennic
 *    iguales (CLAUDE.md §2d).
 * 2. Elegir la impresión, que es lo que fija `|SET-NUM`. Y el `|SET-NUM` no
 *    es un adorno: «Cad Bane» son CINCO cartas distintas —dos de ellas
 *    líderes, con habilidades que no se parecen— y «Pre Vizsla» cuatro
 *    (Articulo.tsx:113-122). Sin fijar la impresión, el artículo dibuja la
 *    carta equivocada.
 *
 * La búsqueda es LOCAL: `searchCards()` nunca va al API (CLAUDE.md §2b).
 */

import { useState, useEffect } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { CardImage } from './CardImage'
import { Sheet } from './ui/Sheet'
import { searchCards } from '../services/swuApi'
import { listFaceUrl, listFaceIsLandscape } from '../services/cardArt'
import type { Card } from '../types'

export interface SelectorCartaProps {
  abierto: boolean
  onCerrar: () => void
  /** Devuelve la carta ELEGIDA, con su `setCode` y `setNumber` ya fijados. */
  onElegir: (c: Card) => void
  /** Filtra por tipo: 'Leader' o 'Base' para las ranuras del bloque de mazo. */
  tipo?: string
  titulo?: string
}

export function SelectorCarta({ abierto, onCerrar, onElegir, tipo, titulo }: SelectorCartaProps) {
  return (
    <Sheet open={abierto} onClose={onCerrar} title={titulo ?? 'Elegir carta'}>
      <div className="p-3">
        {abierto && <Buscador tipo={tipo} onElegir={onElegir} />}
      </div>
    </Sheet>
  )
}

function Buscador({ tipo, onElegir }: { tipo?: string; onElegir: (c: Card) => void }) {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<Card[]>([])
  const [buscando, setBuscando] = useState(false)
  const [elegida, setElegida] = useState<Card | null>(null)

  useEffect(() => {
    const texto = q.trim()
    if (texto.length < 2) { setResultados([]); return }
    // 300 ms: el mismo retardo que el buscador de cartas. Se teclea, no se pulsa.
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const r = await searchCards({ query: texto, type: tipo, canonicalOnly: true, limit: 20, offset: 0 })
        setResultados(r.cards)
      } finally { setBuscando(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [q, tipo])

  if (elegida) {
    return <ElegirImpresion carta={elegida} onVolver={() => setElegida(null)} onElegir={onElegir} />
  }

  return (
    <div>
      <div className="relative mb-2">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" aria-hidden />
        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar una carta…"
          className="w-full rounded-xl border border-swu-border bg-swu-bg py-2.5 pl-9 pr-3 text-sm
                     text-swu-text placeholder:text-swu-muted/60 focus:border-swu-accent focus:outline-none"
        />
      </div>

      {buscando && <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-swu-muted" /></div>}

      {!buscando && q.trim().length >= 2 && resultados.length === 0 && (
        <p className="py-6 text-center text-[12px] text-swu-muted">Ninguna carta con ese nombre</p>
      )}

      <div className="grid max-h-[46vh] grid-cols-3 gap-2 overflow-y-auto overscroll-contain sm:grid-cols-4">
        {resultados.map(c => (
          <button key={c.id} onClick={() => setElegida(c)} className="text-left" title={c.name}>
            <CardImage
              src={listFaceUrl(c)}
              orientacion={listFaceIsLandscape(c) ? 'apaisada' : 'vertical'}
              alt={c.name}
              className="w-full"
            />
            <p className="mt-1 truncate text-[10px] font-semibold text-swu-text">{c.name}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Paso 2: las impresiones de esa carta.
 *
 * Se buscan por NOMBRE con `canonicalOnly: false` para que salgan todas las
 * variantes. La primera opción es siempre «la que el buscador considera la
 * carta», que es la canónica, para que quien no sepa ni quiera saber de sets
 * pueda apretar y salir.
 */
function ElegirImpresion(
  { carta, onVolver, onElegir }: { carta: Card; onVolver: () => void; onElegir: (c: Card) => void },
) {
  const [todas, setTodas] = useState<Card[] | null>(null)

  useEffect(() => {
    let vivo = true
    void searchCards({ query: carta.name, canonicalOnly: false, limit: 60, offset: 0 }).then(r => {
      if (!vivo) return
      setTodas(r.cards.filter(c => c.name === carta.name))
    })
    return () => { vivo = false }
  }, [carta.name])

  return (
    <div>
      <button onClick={onVolver} className="mb-2 text-[11px] text-swu-cyan">← Otra carta</button>
      <p className="mb-2 text-sm font-bold text-swu-text">{carta.name}</p>
      {!todas && <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-swu-muted" /></div>}
      <div className="max-h-[46vh] space-y-1 overflow-y-auto overscroll-contain">
        {(todas ?? []).map(c => (
          <button
            key={c.id}
            onClick={() => onElegir(c)}
            className="flex w-full items-center justify-between rounded-lg border border-swu-border
                       bg-swu-bg px-3 py-2 text-left hover:border-swu-accent"
          >
            <span className="min-w-0 flex-1 truncate text-[12px] text-swu-text">
              {c.subtitle ? `${c.name} — ${c.subtitle}` : c.name}
              <span className="ml-2 text-swu-muted">{c.variantType ?? 'Standard'}</span>
            </span>
            {/* Sin ceros a la izquierda: `Card.setNumber` es number y el
                renderizador compara contra `String(setNumber)`. */}
            <span className="ml-2 flex-shrink-0 font-mono text-[11px] text-swu-cyan">
              {c.setCode}-{c.setNumber}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

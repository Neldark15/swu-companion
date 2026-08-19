/**
 * SelectorCarta — elegir UNA carta, y si hace falta UNA impresión concreta.
 *
 * Es el hueco que el repo no tenía: había tres buscadores de carta copiados en
 * tres pantallas (CompartirEnChat.tsx:59, DeckBuilderPage.tsx:199,
 * TrackerPage.tsx:209), ninguno exportado. Este sale del que ya estaba bien
 * hecho —antirrebote de 300 ms, `searchCards` local, `canonicalOnly`— y se
 * envuelve en `Sheet`, que ya resuelve foco, Escape y bloqueo de scroll.
 *
 * El paso de IMPRESIÓN existe porque el blog escribe `Nombre|SET-NUM`: sin
 * fijar la impresión, «Cad Bane» son cinco cartas distintas y el artículo
 * dibuja la que le toque (Articulo.tsx:113-122).
 */

import { useEffect, useState } from 'react'
import { Search, Loader2, ArrowLeft } from 'lucide-react'
import { Sheet } from '../../../components/ui/Sheet'
import { CardImage } from '../../../components/CardImage'
import { searchCards } from '../../../services/swuApi'
import { listFaceUrl, listFaceIsLandscape } from '../../../services/cardArt'
import { impresionesDe } from './resolucionCarta'
import { codigoImpresion } from './sintaxisSalida'
import type { Card } from '../../../types'

// ── El buscador, sin modal (para reusarlo dentro de otros paneles) ───

export function BuscadorCartas(
  { tipo, onElegir, autoFoco = true }:
  { tipo?: string; onElegir: (c: Card) => void; autoFoco?: boolean },
) {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<Card[]>([])
  const [buscando, setBuscando] = useState(false)

  // Los resultados se DERIVAN al pintar: vaciarlos con un setState dentro del
  // efecto es justo lo que el lint de este repo prohíbe
  // (react-hooks/set-state-in-effect), y encadena un render de más.
  const visibles = q.trim().length >= 2 ? resultados : []

  useEffect(() => {
    const texto = q.trim()
    if (texto.length < 2) return
    // Se teclea, no se pulsa: el mismo retardo que el buscador de cartas.
    const t = setTimeout(() => {
      setBuscando(true)
      void searchCards({ query: texto, type: tipo, canonicalOnly: true, limit: 24, offset: 0 })
        .then(r => setResultados(r.cards))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false))
    }, 300)
    return () => clearTimeout(t)
  }, [q, tipo])

  return (
    <div>
      <div className="relative mb-2">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" aria-hidden />
        <input
          autoFocus={autoFoco}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={tipo ? `Buscar ${tipo.toLowerCase()}…` : 'Buscar una carta…'}
          className="w-full rounded-xl border border-swu-border bg-swu-bg py-2.5 pl-9 pr-3
                     text-sm text-swu-text placeholder:text-swu-muted/60 focus:border-swu-accent focus:outline-none"
        />
      </div>

      {buscando && (
        <div className="flex justify-center py-6">
          <Loader2 size={20} className="animate-spin text-swu-muted" aria-hidden />
        </div>
      )}

      {!buscando && q.trim().length >= 2 && visibles.length === 0 && (
        <p className="py-6 text-center text-[12px] text-swu-muted">Ninguna carta con ese nombre</p>
      )}

      <div className="grid max-h-[46vh] grid-cols-3 gap-2 overflow-y-auto overscroll-contain sm:grid-cols-4">
        {visibles.map(c => (
          <button key={c.id} onClick={() => onElegir(c)} className="text-left" title={c.name}>
            <CardImage
              src={listFaceUrl(c)}
              orientacion={listFaceIsLandscape(c) ? 'apaisada' : 'vertical'}
              alt={c.name}
              className="w-full"
            />
            <p className="mt-1 truncate text-[10px] font-semibold text-swu-text">{c.name}</p>
            {c.subtitle && <p className="truncate text-[9px] text-swu-muted">{c.subtitle}</p>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Elegir la impresión ──────────────────────────────────────────────

export function ElegirImpresion(
  { carta, onElegir }: { carta: Card; onElegir: (c: Card) => void },
) {
  const [impresiones, setImpresiones] = useState<Card[] | null>(null)

  useEffect(() => {
    let vivo = true
    void impresionesDe(carta)
      .then(l => { if (vivo) setImpresiones(l) })
      .catch(() => { if (vivo) setImpresiones([carta]) })
    return () => { vivo = false }
  }, [carta])

  if (!impresiones) {
    return <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-swu-muted" aria-hidden /></div>
  }

  return (
    <div className="grid max-h-[46vh] grid-cols-3 gap-2 overflow-y-auto overscroll-contain sm:grid-cols-4">
      {impresiones.map(c => {
        const codigo = codigoImpresion(c)
        return (
          <button key={c.id} onClick={() => onElegir(c)} className="text-left" title={c.variantType ?? ''}>
            <CardImage
              src={listFaceUrl(c)}
              orientacion={listFaceIsLandscape(c) ? 'apaisada' : 'vertical'}
              alt={`${c.name} ${c.variantType ?? ''}`}
              className="w-full"
            />
            <p className="mt-1 truncate font-mono text-[10px] font-semibold text-swu-cyan">
              {codigo ?? 'sin código'}
            </p>
            <p className="truncate text-[9px] text-swu-muted">{c.variantType ?? '—'}</p>
          </button>
        )
      })}
    </div>
  )
}

// ── El selector completo, en su propio panel ─────────────────────────

export interface SelectorCartaProps {
  abierto: boolean
  onCerrar: () => void
  onElegir: (carta: Card) => void
  titulo?: string
  /** Filtra el buscador: 'Leader', 'Base', 'Unit'… */
  tipo?: string
  /** Pide elegir la impresión concreta antes de devolver la carta. */
  conImpresion?: boolean
}

export function SelectorCarta(
  { abierto, onCerrar, onElegir, titulo = 'Elegir carta', tipo, conImpresion = true }: SelectorCartaProps,
) {
  const [elegida, setElegida] = useState<Card | null>(null)

  const cerrar = () => { setElegida(null); onCerrar() }
  const devolver = (c: Card) => { setElegida(null); onElegir(c); onCerrar() }

  return (
    <Sheet open={abierto} onClose={cerrar} title={elegida ? `Impresión de ${elegida.name}` : titulo}>
      <div className="p-4">
        {elegida ? (
          <>
            <button
              onClick={() => setElegida(null)}
              className="mb-3 flex items-center gap-1.5 text-[12px] text-swu-muted"
            >
              <ArrowLeft size={13} aria-hidden /> Otra carta
            </button>
            <ElegirImpresion carta={elegida} onElegir={devolver} />
          </>
        ) : (
          <BuscadorCartas tipo={tipo} onElegir={c => (conImpresion ? setElegida(c) : devolver(c))} />
        )}
      </div>
    </Sheet>
  )
}

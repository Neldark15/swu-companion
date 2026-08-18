/**
 * Elegir qué compartir en el chat: una carta o uno de tus mazos.
 *
 * La decisión que gobierna esta pantalla: **compartir un mazo privado no
 * comparte nada**. Su política de lectura solo devuelve mazos públicos o
 * propios, así que quien lo reciba ve un hueco mientras el dueño lo ve
 * perfecto y cree que lo mandó. Medido: 24 de 25 mazos son públicos, o sea que
 * es el caso raro — y por eso mismo el que nadie entendería cuando pasara. Se
 * avisa ANTES y se ofrece publicarlo en el mismo gesto.
 */

import { useEffect, useState } from 'react'
import { Search, Loader2, Layers, Globe, Lock } from 'lucide-react'
import { CardImage } from '../../components/CardImage'
import { Sheet } from '../../components/ui/Sheet'
import { listFaceUrl, listFaceIsLandscape } from '../../services/cardArt'
import { searchCards } from '../../services/swuApi'
import { misMazos, publicarMazo, type MazoCompartible } from '../../services/galaxiaCompartir'
import type { AdjuntoMensaje } from '../../services/galaxiaChat'
import type { Card } from '../../types'

interface Props {
  abierto: boolean
  miId: string
  onCerrar: () => void
  /** Devuelve el adjunto y un texto por defecto para el cuerpo. */
  onElegir: (adjunto: AdjuntoMensaje, textoSugerido: string) => void
}

export function CompartirEnChat({ abierto, miId, onCerrar, onElegir }: Props) {
  const [pestana, setPestana] = useState<'carta' | 'mazo'>('carta')

  return (
    <Sheet open={abierto} onClose={onCerrar} title="Compartir">
      <div className="p-3">
        <div className="mb-3 flex rounded-lg border border-swu-border bg-swu-bg p-0.5">
          {([['carta', 'Una carta'], ['mazo', 'Un mazo']] as const).map(([id, txt]) => (
            <button
              key={id}
              onClick={() => setPestana(id)}
              className={`flex-1 rounded-md py-1.5 text-[12px] font-semibold transition-colors ${
                pestana === id ? 'bg-swu-accent/15 text-swu-accent-texto' : 'text-swu-muted'
              }`}
            >
              {txt}
            </button>
          ))}
        </div>

        {pestana === 'carta'
          ? <BuscarCarta onElegir={onElegir} />
          : <ElegirMazo miId={miId} onElegir={onElegir} />}
      </div>
    </Sheet>
  )
}

// ─── Carta ───────────────────────────────────────────────────────────

function BuscarCarta({ onElegir }: { onElegir: Props['onElegir'] }) {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<Card[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    const texto = q.trim()
    if (texto.length < 2) { setResultados([]); return }
    // El mismo retardo que el buscador de cartas: se teclea, no se pulsa.
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        // `canonicalOnly` porque el 74% de las filas son variantes de la misma
        // carta: sin esto, buscar «Krennic» daría ocho Krennic iguales.
        const r = await searchCards({ query: texto, canonicalOnly: true, limit: 20, offset: 0 })
        setResultados(r.cards)
      } finally { setBuscando(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div>
      <div className="relative mb-2">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar una carta…"
          className="w-full rounded-xl border border-swu-border bg-swu-bg py-2.5 pl-9 pr-3
                     text-sm text-swu-text placeholder:text-swu-muted/60 focus:border-swu-accent focus:outline-none"
        />
      </div>

      {buscando && (
        <div className="flex justify-center py-6">
          <Loader2 size={20} className="animate-spin text-swu-muted" />
        </div>
      )}

      {!buscando && q.trim().length >= 2 && resultados.length === 0 && (
        <p className="py-6 text-center text-[12px] text-swu-muted">Ninguna carta con ese nombre</p>
      )}

      <div className="grid max-h-[46vh] grid-cols-3 gap-2 overflow-y-auto overscroll-contain sm:grid-cols-4">
        {resultados.map(c => (
          <button
            key={c.id}
            onClick={() => onElegir({ tipo: 'carta', id: c.id }, c.name)}
            className="text-left"
            title={c.name}
          >
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

// ─── Mazo ────────────────────────────────────────────────────────────

function ElegirMazo({ miId, onElegir }: { miId: string; onElegir: Props['onElegir'] }) {
  const [mazos, setMazos] = useState<MazoCompartible[] | null>(null)
  const [publicando, setPublicando] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    void misMazos(miId).then(m => { if (vivo) setMazos(m) })
    return () => { vivo = false }
  }, [miId])

  async function compartir(m: MazoCompartible) {
    if (!m.publico) {
      const ok = confirm(
        `«${m.nombre}» es privado: quien lo reciba no va a poder abrirlo.\n\n` +
        '¿Publicarlo y compartirlo?',
      )
      if (!ok) return
      setPublicando(m.id)
      const publicado = await publicarMazo(m.id)
      setPublicando(null)
      if (!publicado) { alert('No se pudo publicar el mazo.'); return }
      setMazos(xs => (xs ?? []).map(x => (x.id === m.id ? { ...x, publico: true } : x)))
    }
    onElegir({ tipo: 'deck', id: m.id }, m.nombre)
  }

  if (mazos === null) {
    return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-swu-muted" /></div>
  }

  if (mazos.length === 0) {
    return (
      <div className="py-8 text-center">
        <Layers size={30} className="mx-auto mb-2 text-swu-muted/30" />
        <p className="text-[12px] text-swu-muted">Todavía no tenés mazos guardados</p>
      </div>
    )
  }

  return (
    <div className="max-h-[46vh] space-y-1.5 overflow-y-auto overscroll-contain">
      {mazos.map(m => (
        <button
          key={m.id}
          onClick={() => void compartir(m)}
          disabled={publicando === m.id}
          className="flex w-full items-center gap-2.5 rounded-xl border border-swu-border
                     bg-swu-bg p-2.5 text-left disabled:opacity-50"
        >
          <Layers size={16} className="flex-shrink-0 text-swu-accent-texto" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-swu-text">{m.nombre}</span>
            <span className="block text-[10px] text-swu-muted">{m.cartas} cartas</span>
          </span>
          {publicando === m.id
            ? <Loader2 size={13} className="animate-spin text-swu-muted" />
            : m.publico
              ? <Globe size={13} className="flex-shrink-0 text-swu-green" aria-label="Público" />
              /* El candado no es decoración: avisa que compartirlo tal cual no
                 lo hace visible para nadie más. */
              : <Lock size={13} className="flex-shrink-0 text-swu-amber" aria-label="Privado" />}
        </button>
      ))}
    </div>
  )
}

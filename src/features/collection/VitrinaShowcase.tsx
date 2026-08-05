/**
 * VitrinaShowcase — las impresiones especiales, para mirarlas.
 *
 * No es un buscador ni un inventario: es una vitrina. Por eso la rejilla es de
 * dos columnas y no de cuatro —una Showcase con arte extendido a 90px de ancho
 * no se aprecia—, y por eso cada carta se inclina y saca brillo al tocarla.
 *
 * ── Qué entra ─────────────────────────────────────────────────────────
 *
 * Contado sobre el export: 144 `Showcase`, 211 `Standard Prestige`, 253
 * `Serialized Prestige` y 211 `Foil Prestige`. Son las impresiones cuyo
 * acabado cambia con el ángulo, que es justo lo que el efecto imita. Las
 * `Standard Foil` e `Hyperspace Foil` NO entran: comparten arte con su
 * versión normal —medido, quedan a 12-28 bits— así que llenarían la vitrina
 * de repetidos.
 */

import { useState, useEffect, useMemo } from 'react'
import { Sparkles, Search, X } from 'lucide-react'
import { CardImage } from '../../components/CardImage'
import { Carta3D } from '../../components/Carta3D'
import { CardPreviewSheet } from '../../components/CardPreviewSheet'
import { EmptyState } from '../../components/ui/EmptyState'
import { isLandscapeFace } from '../../services/cardArt'
import { ensureCards } from '../../services/swuApi'
import { compareCardsBySetNumber } from '../../services/cardSort'
import type { Card } from '../../types'

/** Las impresiones cuyo acabado cambia con el ángulo. */
const ACABADOS = ['Showcase', 'Standard Prestige', 'Serialized Prestige', 'Foil Prestige'] as const
type Acabado = (typeof ACABADOS)[number] | 'todas'

const ETIQUETAS: Record<string, string> = {
  todas: 'Todas',
  'Showcase': 'Showcase',
  'Standard Prestige': 'Prestige',
  'Serialized Prestige': 'Serializadas',
  'Foil Prestige': 'Prestige Foil',
}

export function VitrinaShowcase() {
  const [cartas, setCartas] = useState<Card[]>([])
  const [estado, setEstado] = useState<'cargando' | 'listo'>('cargando')
  const [acabado, setAcabado] = useState<Acabado>('Showcase')
  const [q, setQ] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    void (async () => {
      await ensureCards()
      const { db } = await import('../../services/db')
      const todas = await db.cards
        .filter(c => ACABADOS.includes((c.variantType ?? '') as (typeof ACABADOS)[number]))
        .toArray()
      if (!vivo) return
      setCartas(todas.sort(compareCardsBySetNumber))
      setEstado('listo')
    })()
    return () => { vivo = false }
  }, [])

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase()
    return cartas.filter(c => {
      if (acabado !== 'todas' && c.variantType !== acabado) return false
      if (!t) return true
      return c.name.toLowerCase().includes(t)
        || (c.subtitle ?? '').toLowerCase().includes(t)
    })
  }, [cartas, acabado, q])

  const cuentas = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of cartas) m.set(c.variantType ?? '', (m.get(c.variantType ?? '') ?? 0) + 1)
    return m
  }, [cartas])

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Sparkles size={16} className="text-swu-amber flex-shrink-0 mt-0.5" aria-hidden />
        <p className="text-[11px] text-swu-muted leading-snug">
          Las impresiones cuyo acabado cambia con el ángulo. Tocá una carta y movéla
          para verle el brillo.
        </p>
      </div>

      {/* Filtros por acabado, con la cantidad real de cada uno. */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {(['todas', ...ACABADOS] as Acabado[]).map(a => {
          const n = a === 'todas' ? cartas.length : (cuentas.get(a) ?? 0)
          if (a !== 'todas' && n === 0) return null
          return (
            <button
              key={a}
              onClick={() => setAcabado(a)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                acabado === a
                  ? 'bg-swu-amber/15 border-swu-amber/50 text-swu-amber'
                  : 'bg-swu-surface border-swu-border text-swu-muted'
              }`}
            >
              {ETIQUETAS[a] ?? a}
              <span className="ml-1 font-mono opacity-70">{n}</span>
            </button>
          )
        })}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-swu-muted" aria-hidden />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nombre…"
          className="w-full bg-swu-surface border border-swu-border rounded-lg pl-8 pr-8 py-2 text-sm
                     text-swu-text placeholder:text-swu-muted/50
                     focus:outline-none focus:ring-2 focus:ring-swu-accent"
        />
        {q && (
          <button
            onClick={() => setQ('')}
            aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-swu-muted"
          >
            <X size={14} aria-hidden />
          </button>
        )}
      </div>

      {estado === 'cargando' ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="aspect-[286/400] radio-carta carta-esqueleto" />
          ))}
        </div>
      ) : visibles.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={28} aria-hidden />}
          title="Nada con ese nombre"
          hint="Probá con otro acabado o limpiá la búsqueda."
        />
      ) : (
        <>
          <p className="text-[10px] text-swu-muted font-mono">{visibles.length} cartas</p>
          {/* Dos columnas: a cuatro por fila el arte extendido de una Showcase
              no se aprecia, que es justo para lo que existe esta pantalla. */}
          <div className="grid grid-cols-2 gap-3">
            {visibles.map(c => {
              // La vitrina muestra el FRENTE (`c.imageUrl`), y el frente de un
              // líder es APAISADO. Con `listFaceIsLandscape` —que responde por
              // la cara que se usa en las listas, o sea el reverso vertical—
              // los líderes Showcase entraban en una caja vertical y salían
              // recortados por los lados, con el texto cortado a la mitad.
              const apaisada = isLandscapeFace(c, false)
              return (
                <button
                  key={c.id}
                  onClick={() => setAbierta(c.id)}
                  aria-label={`Ver ${c.name}`}
                  className="text-left"
                >
                  <Carta3D brillo iridiscente intensidad={12}>
                    <CardImage
                      src={c.imageUrl}
                      orientacion={apaisada ? 'apaisada' : 'vertical'}
                      fit="cover"
                      elevacion="realce"
                      alt={c.name}
                      className={`w-full ${apaisada ? 'aspect-[400/286]' : 'aspect-[286/400]'}`}
                      rootMargin={300}
                    />
                  </Carta3D>
                  <p className="text-[11px] font-medium text-swu-text truncate mt-1.5">{c.name}</p>
                  <p className="text-[9px] text-swu-muted truncate">
                    {ETIQUETAS[c.variantType ?? ''] ?? c.variantType} · {c.setCode} {c.setNumber}
                  </p>
                </button>
              )
            })}
          </div>
        </>
      )}

      <CardPreviewSheet cardId={abierta} onClose={() => setAbierta(null)} />
    </div>
  )
}

/**
 * PerfilVitrina — las cartas y aspectos que alguien eligió mostrar.
 *
 * Se usa igual en el perfil propio y en el público, a propósito: si fueran dos
 * componentes, uno estaría personalizando algo distinto de lo que ve el resto.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CardImage } from '../../components/CardImage'
import {
  cartasDeVitrina, ASPECTOS,
  type Personalizacion, type Aspecto,
} from '../../services/profileCustomService'
import type { Card } from '../../types'

export function AspectosDe({ aspectos }: { aspectos: Aspecto[] }) {
  if (aspectos.length === 0) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {aspectos.map(a => {
        const info = ASPECTOS.find(x => x.valor === a)
        if (!info) return null
        return (
          <span
            key={a}
            className={`flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider ${info.texto} border border-current/30 rounded-full px-2 py-0.5`}
          >
            <span className={`w-2 h-2 rounded-full ${info.punto}`} aria-hidden />
            {info.label}
          </span>
        )
      })}
    </div>
  )
}

/**
 * Banda con el arte de la carta elegida.
 *
 * Va muy oscurecida a propósito: es fondo, y encima tiene que leerse el
 * nombre. Un arte a pleno color se come el texto.
 */
export function BannerDeCarta({ carta }: { carta: Card | null }) {
  if (!carta?.imageUrl) return null
  return (
    <div className="absolute inset-0" aria-hidden>
      <img src={carta.imageUrl} alt="" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-swu-bg via-swu-bg/85 to-swu-bg/55" />
    </div>
  )
}

export function Vitrina({ ids, titulo = 'Cartas favoritas' }: { ids: string[]; titulo?: string }) {
  const [cartas, setCartas] = useState<Card[]>([])

  useEffect(() => {
    let vivo = true
    void cartasDeVitrina(ids).then(c => { if (vivo) setCartas(c) })
    return () => { vivo = false }
  }, [ids])

  if (ids.length === 0) return null

  return (
    <section>
      <h3 className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60 mb-2">
        {titulo}
      </h3>
      {/* Scroll horizontal PROPIO: el cuerpo de la página nunca scrollea de
          lado en móvil. */}
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        {cartas.map(c => (
          <Link
            key={c.id}
            to={`/cards/${c.id}`}
            className="w-20 flex-shrink-0 active:scale-[0.97] transition-transform"
          >
            <div className="rounded-lg overflow-hidden bg-swu-surface border border-swu-border">
              <CardImage src={c.imageUrl} alt={c.name} className="w-full aspect-[5/7]" />
            </div>
            <p className="text-[9px] text-swu-muted truncate mt-1 text-center">{c.name}</p>
          </Link>
        ))}
        {/* Mientras Dexie resuelve, huecos del mismo tamaño: sin esto la
            pantalla salta cuando aparecen las cartas. */}
        {cartas.length === 0 && ids.map(id => (
          <div key={id} className="w-20 flex-shrink-0 aspect-[5/7] rounded-lg bg-swu-surface border border-swu-border animate-pulse" />
        ))}
      </div>
    </section>
  )
}

/** Todo junto, como se ve en un perfil. */
export function PerfilPersonalizado({ p }: { p: Personalizacion }) {
  return (
    <div className="space-y-3">
      <AspectosDe aspectos={p.favorite_aspects} />
      <Vitrina ids={p.showcase_cards} />
    </div>
  )
}

/**
 * CardPreviewSheet — ver una carta en grande sin salir de donde estás.
 *
 * Nació porque dentro de un mazo las cartas solo tenían botones de + y −: se
 * podía cambiar la cantidad pero no LEER la carta, que es justo lo que hace
 * falta mientras se arma. Salir al detalle y volver perdía el hilo.
 *
 * Muestra el arte grande y además el texto de reglas transcrito: en una foto
 * de carta a 300 px el texto no se lee, y el objetivo es revisar efectos.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, RotateCcw } from 'lucide-react'
import { Sheet } from './ui/Sheet'
import { CardImage } from './CardImage'
import { db } from '../services/db'
import type { Card } from '../types'

/** Color de cada aspecto, el mismo que usa el resto de la app. */
const ASPECTO_COLOR: Record<string, string> = {
  Vigilance: 'text-blue-400 border-blue-400/40',
  Command: 'text-green-400 border-green-400/40',
  Aggression: 'text-red-400 border-red-400/40',
  Cunning: 'text-yellow-400 border-yellow-400/40',
  Heroism: 'text-slate-200 border-slate-200/40',
  Villainy: 'text-zinc-400 border-zinc-400/40',
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | number | null | undefined }) {
  if (valor === null || valor === undefined || valor === '') return null
  return (
    <div className="text-center">
      <p className="text-[9px] font-mono uppercase tracking-wider text-swu-muted/60">{etiqueta}</p>
      <p className="text-sm font-bold text-swu-text font-mono">{valor}</p>
    </div>
  )
}

function Bloque({ titulo, texto }: { titulo: string; texto: string | null | undefined }) {
  if (!texto) return null
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-swu-muted/60 mb-0.5">{titulo}</p>
      <p className="text-xs text-swu-text leading-relaxed whitespace-pre-line">{texto}</p>
    </div>
  )
}

export function CardPreviewSheet({
  cardId, onClose,
}: {
  /** Carta a mostrar. `null` cierra la hoja. */
  cardId: string | null
  onClose: () => void
}) {
  const [carta, setCarta] = useState<Card | null>(null)
  /** De qué carta se está mirando el dorso. Se guarda el id y no un booleano
   *  para que al abrir otra carta vuelva sola al frente, sin tener que
   *  reiniciar el estado dentro del efecto. */
  const [dorsoDe, setDorsoDe] = useState<string | null>(null)
  const dorso = dorsoDe !== null && dorsoDe === cardId

  useEffect(() => {
    if (!cardId) return
    let vivo = true
    void db.cards.get(cardId).then(c => { if (vivo) setCarta(c ?? null) })
    return () => { vivo = false }
  }, [cardId])

  const abierta = cardId !== null
  // Los líderes y algunas cartas son apaisados; con `cover` se verían recortados.
  const apaisada = carta?.isLeader || carta?.isBase
  const src = dorso && carta?.backImageUrl ? carta.backImageUrl : carta?.imageUrl

  return (
    <Sheet open={abierta} onClose={onClose} title={carta?.name ?? 'Carta'}>
      {carta && (
        <div className="p-4 space-y-3">
          <div className="relative">
            <div className={`mx-auto ${apaisada ? 'max-w-sm' : 'max-w-[220px]'}`}>
              <CardImage
                src={src}
                alt={carta.name}
                fit="contain"
                className={`w-full ${apaisada ? 'aspect-[7/5]' : 'aspect-[5/7]'} rounded-xl`}
              />
            </div>
            {carta.backImageUrl && (
              <button
                onClick={() => setDorsoDe(d => (d === cardId ? null : cardId))}
                className="absolute top-1 right-1 flex items-center gap-1 text-[10px] text-swu-cyan bg-swu-bg/85 border border-swu-border rounded-lg px-2 py-1"
              >
                <RotateCcw size={11} aria-hidden /> {dorso ? 'Frente' : 'Dorso'}
              </button>
            )}
          </div>

          <div>
            <p className="text-base font-bold text-swu-text leading-tight">{carta.name}</p>
            {carta.subtitle && <p className="text-xs text-swu-muted">{carta.subtitle}</p>}
            <p className="text-[10px] font-mono text-swu-muted mt-0.5">
              {carta.type}{carta.arena ? ` · ${carta.arena}` : ''} · {carta.setCode} {carta.setNumber} · {carta.rarity}
            </p>
          </div>

          {carta.aspects.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {carta.aspects.map((a, i) => (
                <span key={`${a}-${i}`}
                  className={`text-[10px] font-mono uppercase tracking-wider border rounded-full px-2 py-0.5 ${ASPECTO_COLOR[a] ?? 'text-swu-muted border-swu-border'}`}>
                  {a}
                </span>
              ))}
            </div>
          )}

          <div className="flex justify-around bg-swu-bg rounded-lg border border-swu-border py-2">
            <Dato etiqueta="Coste" valor={carta.cost} />
            <Dato etiqueta="Poder" valor={carta.power} />
            <Dato etiqueta="PV" valor={carta.hp} />
          </div>

          <Bloque titulo="Texto" texto={carta.text} />
          <Bloque titulo="Al desplegar" texto={carta.deployBox} />
          <Bloque titulo="Acción épica" texto={carta.epicAction} />

          {carta.keywords.length > 0 && (
            <p className="text-[11px] text-swu-muted">
              <span className="font-semibold text-swu-text">Palabras clave: </span>
              {carta.keywords.join(', ')}
            </p>
          )}
          {carta.traits.length > 0 && (
            <p className="text-[11px] text-swu-muted">
              <span className="font-semibold text-swu-text">Rasgos: </span>
              {carta.traits.join(', ')}
            </p>
          )}

          <Link
            to={`/cards/${carta.id}`}
            onClick={onClose}
            className="flex items-center justify-center gap-1.5 text-[11px] text-swu-cyan py-2"
          >
            Ver ficha completa <ExternalLink size={11} aria-hidden />
          </Link>
        </div>
      )}
    </Sheet>
  )
}

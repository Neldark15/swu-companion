/**
 * TradeMatches — el cruce de intercambios, arriba de todo en el Mercado.
 *
 * Antes que el listado general va lo que te toca a VOS: quién tiene lo que
 * buscás y quién busca lo que te sobra. Un listado de todo lo publicado es
 * un catálogo; esto es una lista de tratos posibles.
 *
 * ── Por qué no hay mensajería adentro ──────────────────────────────────
 *
 * El grupo ya usa WhatsApp y se ve en persona los sábados. En vez de
 * construir una bandeja de entrada que competiría con eso, la app hace la
 * parte que WhatsApp no puede: encontrar el cruce y redactar la propuesta.
 * El cierre salta al canal que ya usan.
 *
 * Y no se guarda NINGÚN teléfono: se usa la API de compartir del navegador,
 * así que el contacto lo elige la persona en su propio WhatsApp. Cero datos
 * personales nuevos en la base, cero decisión de privacidad que tomar.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, Send, Check, HandCoins, Search } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Chip } from '../../components/ui/Chip'
import { EmptyState } from '../../components/ui/EmptyState'
import type { TradeMatch, CardMatch } from '../../services/tradeService'
import type { Card } from '../../types'

interface TradeMatchesProps {
  matches: TradeMatch[]
  /** cardId → carta, para poder mostrar nombres y no uuids. */
  cards: Map<string, Card>
  myName: string
  loading?: boolean
}

/** Nombre legible; si la carta aún no hidrató, al menos no muestra un uuid. */
function nameOf(cards: Map<string, Card>, m: CardMatch): string {
  const c = cards.get(m.cardId)
  if (!c) return 'Carta'
  return c.subtitle ? `${c.name} — ${c.subtitle}` : c.name
}

function buildMessage(
  match: TradeMatch,
  cards: Map<string, Card>,
  myName: string,
): string {
  const lines: string[] = [`¡Hola ${match.trader.name}! Te escribo por HOLOCRON SWU.`]

  if (match.theyOffer.length > 0) {
    lines.push('', 'Me interesan estas que tenés:')
    for (const m of match.theyOffer.slice(0, 10)) {
      lines.push(`· ${nameOf(cards, m)}${m.price ? ` ($${m.price})` : ''}`)
    }
    if (match.theyOffer.length > 10) lines.push(`· …y ${match.theyOffer.length - 10} más`)
  }

  if (match.iOffer.length > 0) {
    lines.push('', 'Y de las que buscás, yo tengo:')
    for (const m of match.iOffer.slice(0, 10)) {
      lines.push(`· ${nameOf(cards, m)}`)
    }
    if (match.iOffer.length > 10) lines.push(`· …y ${match.iOffer.length - 10} más`)
  }

  lines.push('', `¿Armamos cambio? — ${myName}`)
  return lines.join('\n')
}

export function TradeMatches({ matches, cards, myName, loading }: TradeMatchesProps) {
  const navigate = useNavigate()
  const [sent, setSent] = useState<string | null>(null)
  // TS tipa navigator.share como siempre definido; hay que mirar el runtime.
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const propose = async (match: TradeMatch) => {
    const text = buildMessage(match, cards, myName)

    // Si esa persona compartió su WhatsApp, se abre el chat con ella
    // directamente y con el mensaje ya escrito. El número NUNCA se dibuja en
    // pantalla: solo se usa acá para armar el enlace.
    if (match.trader.whatsapp) {
      window.open(
        `https://wa.me/${match.trader.whatsapp}?text=${encodeURIComponent(text)}`,
        '_blank',
        'noopener,noreferrer',
      )
      setSent(match.trader.userId)
      setTimeout(() => setSent(null), 2500)
      return
    }

    // Si no lo compartió, se cae al modo compartir: vos elegís el contacto.
    try {
      if (canShare) {
        await navigator.share({ text })
      } else {
        await navigator.clipboard.writeText(text)
      }
      setSent(match.trader.userId)
      setTimeout(() => setSent(null), 2500)
    } catch {
      // El usuario canceló el diálogo de compartir — no es un error.
    }
  }

  if (loading) {
    return (
      <div className="bg-swu-surface rounded-xl border border-swu-border p-4">
        <div className="h-3 w-32 bg-swu-border/40 rounded animate-pulse" />
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <EmptyState
        icon={<ArrowLeftRight size={28} aria-hidden />}
        title="Todavía no hay cruces"
        hint="Un cruce aparece cuando alguien ofrece una carta que buscás, o busca una que te sobra. Marcá lo que buscás con el corazón de búsqueda, y poné en venta tus repetidas."
        action={
          <Button size="sm" variant="secondary" onClick={() => navigate('/cards')}>
            <Search size={13} aria-hidden /> Buscar cartas
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-2">
      {matches.map(match => {
        const both = match.theyOffer.length > 0 && match.iOffer.length > 0
        const justSent = sent === match.trader.userId

        return (
          <div
            key={match.trader.userId}
            className={`rounded-xl border p-3 space-y-3 ${
              both ? 'bg-swu-surface border-swu-green/40' : 'bg-swu-surface border-swu-border'
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/u/${match.trader.userId}`)}
                className="text-sm font-bold text-swu-text hover:text-swu-accent-texto transition-colors"
              >
                {match.trader.name}
              </button>
              {both && (
                <Chip tone="green" active>
                  <ArrowLeftRight size={10} aria-hidden /> Cambio directo
                </Chip>
              )}
            </div>

            {match.theyOffer.length > 0 && (
              <div>
                <p className="text-[10px] font-mono tracking-wider uppercase text-swu-coral mb-1">
                  Tiene {match.theyOffer.length} que buscás
                </p>
                <div className="flex flex-wrap gap-1">
                  {match.theyOffer.slice(0, 6).map(m => (
                    <Chip key={m.cardId} tone="coral" active title={nameOf(cards, m)}>
                      {cards.get(m.cardId)?.name ?? 'Carta'}
                    </Chip>
                  ))}
                  {match.theyOffer.length > 6 && (
                    <Chip tone="neutral" active>+{match.theyOffer.length - 6}</Chip>
                  )}
                </div>
              </div>
            )}

            {match.iOffer.length > 0 && (
              <div>
                <p className="text-[10px] font-mono tracking-wider uppercase text-swu-green mb-1">
                  Busca {match.iOffer.length} que tenés
                </p>
                <div className="flex flex-wrap gap-1">
                  {match.iOffer.slice(0, 6).map(m => (
                    <Chip key={m.cardId} tone="green" active title={nameOf(cards, m)}>
                      {cards.get(m.cardId)?.name ?? 'Carta'}
                    </Chip>
                  ))}
                  {match.iOffer.length > 6 && (
                    <Chip tone="neutral" active>+{match.iOffer.length - 6}</Chip>
                  )}
                </div>
              </div>
            )}

            <Button size="sm" variant={both ? 'primary' : 'secondary'} block onClick={() => propose(match)}>
              {justSent
                ? <><Check size={13} aria-hidden /> {match.trader.whatsapp ? 'Abriendo WhatsApp' : canShare ? 'Compartido' : 'Copiado'}</>
                : <><Send size={13} aria-hidden /> {match.trader.whatsapp ? 'Escribir por WhatsApp' : 'Proponer cambio'}</>}
            </Button>
            {justSent && !match.trader.whatsapp && !canShare && (
              <p className="text-[10px] text-swu-muted text-center">
                Mensaje copiado — pegalo en WhatsApp
              </p>
            )}
          </div>
        )
      })}

      <p className="text-[10px] text-swu-muted/60 leading-relaxed px-1 flex items-start gap-1.5">
        <HandCoins size={12} className="flex-shrink-0 mt-0.5" aria-hidden />
        Se ofrece una carta si está publicada o si tenés más de {3} copias. La app
        arma el mensaje; el contacto lo elegís vos en WhatsApp.
      </p>
    </div>
  )
}

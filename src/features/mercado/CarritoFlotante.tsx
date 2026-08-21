/**
 * EL CARRITO, sin salir de la mercancía.
 *
 * ── Por qué flota acá y no vive solo en /pedidos ─────────────────────
 *
 * Comprar es un ciclo: mirás, agregás, y querés saber cuánto llevás ANTES de
 * seguir mirando. Con el carrito en otra ruta, ese «cuánto llevo» cuesta salir
 * de la vitrina, mirar, y volver a buscar dónde estabas — y en una lista de 203
 * publicaciones con filtros aplicados, volver no es gratis.
 *
 * La burbuja dice el total sin abrir nada; la hoja enseña el detalle y deja
 * mandarlo ahí mismo.
 *
 * ── No se dibuja si está vacío ───────────────────────────────────────
 *
 * Un carrito en cero flotando sobre la vitrina es un botón que no hace nada
 * tapando mercancía. Aparece cuando hay algo.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Send, ChevronRight } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { CardImage } from '../../components/CardImage'
import {
  totalDe, enviarPedido, ponerEnCarrito,
  type Pedido, type ProblemaEnvio,
} from '../../services/mercadoPedidos'
import type { Card } from '../../types'

const PRECIO = (n: number) => `$${n.toFixed(2)}`

interface Props {
  /** Los carritos abiertos, uno por vendedor. */
  carritos: Pedido[]
  /** Fichas ya resueltas por quien llama: acá no se va a Dexie por carta. */
  cartas: Map<string, Card>
  /** Para releer después de tocar algo. */
  alCambiar: () => void
}

export function CarritoFlotante({ carritos, cartas, alCambiar }: Props) {
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [problemas, setProblemas] = useState<ProblemaEnvio[] | null>(null)

  const unidades = carritos.reduce((s, p) => s + p.lineas.reduce((t, l) => t + l.cantidad, 0), 0)
  const total = carritos.reduce((s, p) => s + totalDe(p), 0)

  if (unidades === 0) return null

  const enviar = async (p: Pedido) => {
    setOcupado(p.id); setAviso(null); setProblemas(null)
    const r = await enviarPedido(p.id)
    setOcupado(null)
    if (!r.ok) {
      if (r.problemas?.length) setProblemas(r.problemas)
      else setAviso(r.mensaje)
    }
    alCambiar()
  }

  const cambiar = async (p: Pedido, cardId: string, cantidad: number) => {
    setOcupado(p.id); setAviso(null)
    const r = await ponerEnCarrito(p.vendedorId, cardId, cantidad)
    setOcupado(null)
    if (!r.ok) setAviso(r.mensaje)
    alCambiar()
  }

  return (
    <>
      {/* La burbuja va sobre la barra de abajo para no taparla, y el
          `env(safe-area-inset-bottom)` la sube por encima de la franja del
          iPhone: sin eso, en un iPhone con gesto queda medio comida. Va en
          `style` y no en una clase porque Tailwind no puede generar un
          `calc()` con `env()` como utilidad arbitraria fiable. */}
      <button
        onClick={() => setAbierto(true)}
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
        className="clip-hud fixed right-4 z-40 flex items-center gap-2 bg-swu-amber px-4 py-3 text-black shadow-lg active:scale-[0.98]"
        aria-label={`Carrito: ${unidades} ${unidades === 1 ? 'carta' : 'cartas'}, ${PRECIO(total)}`}
      >
        <ShoppingCart size={18} />
        <span className="font-mono text-sm font-black tabular-nums">{PRECIO(total)}</span>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-black/25 px-1 text-[11px] font-black">
          {unidades}
        </span>
      </button>

      <Sheet open={abierto} onClose={() => setAbierto(false)} title="Tu carrito">
        <div className="space-y-3">
          <p className="rounded-lg bg-swu-amber/12 px-3 py-2 text-[11px] leading-snug text-swu-muted">
            Todavía <strong className="text-swu-amber">no está reservado</strong>. La carta se aparta
            cuando mandás el pedido y el vendedor lo ve.
          </p>

          {aviso && (
            <p className="rounded-lg bg-swu-red/15 px-3 py-2 text-[11px] text-swu-red-texto">{aviso}</p>
          )}
          {problemas && (
            <div className="rounded-lg bg-swu-amber/15 px-3 py-2 text-[11px] leading-snug text-swu-text">
              <p className="font-bold">No se mandó nada: algo cambió mientras tanto.</p>
              <ul className="mt-1 space-y-0.5 text-swu-muted">
                {problemas.map(pr => (
                  <li key={pr.card_id}>
                    · {cartas.get(pr.card_id)?.name ?? 'Una carta'}
                    {pr.que === 'retirada' ? ' — el vendedor la retiró'
                      : ` — pediste ${pr.pediste} y quedan ${pr.quedan}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Un bloque por VENDEDOR: cada uno se manda por separado porque
              aceptar es un acto de una persona. */}
          {carritos.map(p => {
            const trabajando = ocupado === p.id
            return (
              <div key={p.id} className="rounded-xl bg-swu-surface p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-swu-text">
                    {p.otro?.name ?? 'Vendedor'}
                  </span>
                  <span className="shrink-0 font-mono text-sm font-black text-swu-amber tabular-nums">
                    {PRECIO(totalDe(p))}
                  </span>
                </div>

                <ul className="space-y-1.5">
                  {p.lineas.map(l => {
                    const c = cartas.get(l.cardId)
                    return (
                      <li key={l.cardId} className="flex items-center gap-2">
                        <span className="w-[30px] shrink-0">
                          <span className="relative block aspect-[286/400] w-full">
                            {c?.imageUrl
                              ? <CardImage src={c.imageUrl} alt={c.name}
                                  orientacion={c.isLeader || c.isBase ? 'apaisada' : 'vertical'}
                                  className="h-full w-full" />
                              : <span className="block h-full w-full rounded bg-swu-surface-hover" />}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12px] text-swu-text">
                          {/* Sin ficha no se enseña el uuid crudo: no le dice
                              nada a nadie. Pasa con las promo que Dexie
                              todavia no bajo (§2b). */}
                          {c?.name ?? <span className="text-swu-muted">Carta sin ficha</span>}
                        </span>
                        <span className="flex shrink-0 items-center gap-0.5">
                          {/* 44 px de alto de área táctil, no el tamaño del signo. */}
                          <button
                            aria-label="Quitar una" disabled={trabajando}
                            onClick={() => cambiar(p, l.cardId, l.cantidad - 1)}
                            className="flex h-11 w-7 items-center justify-center text-swu-muted"
                          >−</button>
                          <span className="w-4 text-center font-mono text-xs tabular-nums text-swu-text">
                            {l.cantidad}
                          </span>
                          <button
                            aria-label="Agregar una" disabled={trabajando}
                            onClick={() => cambiar(p, l.cardId, l.cantidad + 1)}
                            className="flex h-11 w-7 items-center justify-center text-swu-muted"
                          >+</button>
                        </span>
                      </li>
                    )
                  })}
                </ul>

                <Button
                  size="sm" className="mt-2 w-full" disabled={trabajando}
                  onClick={() => enviar(p)}
                >
                  <Send size={14} /> {trabajando ? 'Mandando…' : `Mandarle el pedido`}
                </Button>
              </div>
            )
          })}

          <button
            onClick={() => { setAbierto(false); navigate('/pedidos') }}
            className="flex w-full items-center justify-between rounded-lg bg-swu-surface px-3 py-2.5 text-sm text-swu-muted"
          >
            Ver todos mis pedidos
            <ChevronRight size={16} />
          </button>
        </div>
      </Sheet>
    </>
  )
}

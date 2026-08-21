/**
 * PEDIDOS — el carrito, lo que te llega como vendedor, y el historial.
 *
 * ── Por qué UNA pantalla y no cuatro ─────────────────────────────────
 *
 * Carrito, mis compras, mis ventas e historial son cuatro listas del MISMO
 * objeto en distinto estado. Cuatro rutas obligarían a adivinar en cuál está lo
 * que uno busca, y en un teléfono son cuatro sitios adonde ir. Acá son tres
 * pestañas sobre la misma consulta, y la que trae trabajo pendiente lleva el
 * número encima.
 *
 * ── El carrito NO reserva, y hay que decirlo ─────────────────────────
 *
 * Es la confusión que esta pantalla tiene que evitar: mientras algo está en el
 * carrito, cualquiera te lo puede ganar. La reserva empieza al ENVIAR. Si eso
 * no se dice, alguien deja el carrito una semana creyendo que le guardaron la
 * carta.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Inbox, Archive, Check, X, Send, Trash2, Store } from 'lucide-react'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Avatar'
import { CardImage } from '../../components/CardImage'
import { useAuth } from '../../hooks/useAuth'
import { getCardsByIds } from '../../services/swuApi'
import { fechaCorta } from '../../services/horaSV'
import {
  misPedidos, totalDe, enviarPedido, responderPedido, cerrarPedido,
  cancelarPedido, ponerEnCarrito, ROTULO,
  type Pedido, type ProblemaEnvio,
} from '../../services/mercadoPedidos'
import type { Card } from '../../types'

type Vista = 'carrito' | 'bandeja' | 'historial'

const PRECIO = (n: number) => `$${n.toFixed(2)}`

export function PedidosPage() {
  const navigate = useNavigate()
  const { supabaseUser } = useAuth()
  const yo = supabaseUser?.id ?? ''

  const [pedidos, setPedidos] = useState<Pedido[] | null>(null)
  const [cartas, setCartas] = useState<Map<string, Card>>(new Map())
  const [vista, setVista] = useState<Vista>('carrito')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [problemas, setProblemas] = useState<ProblemaEnvio[] | null>(null)

  const cargar = useCallback(async () => {
    // Sin sesión no se pregunta: la RLS responde «permission denied for table
    // pedidos» y ese texto crudo no le sirve a nadie. En producción la ruta va
    // detrás del login, pero el banco entra sin sesión y ahí se vio.
    if (!yo) { setPedidos([]); return }
    const r = await misPedidos()
    if (!r.ok) { setAviso(r.mensaje); setPedidos([]); return }
    setPedidos(r.datos)
    // Las fichas de todas las cartas de todos los pedidos, de un viaje.
    const ids = [...new Set(r.datos.flatMap(p => p.lineas.map(l => l.cardId)))]
    if (ids.length > 0) setCartas(await getCardsByIds(ids))
  }, [yo])

  useEffect(() => {
    // Envuelto en una función asíncrona a propósito: llamarlo en seco desde el
    // cuerpo del efecto encadena un render antes de que React pinte, y el lint
    // del repo lo marca. Mismo patrón que PushNotificationToggle.
    let vivo = true
    void (async () => { if (vivo) await cargar() })()
    return () => { vivo = false }
  }, [cargar])

  const { carritos, bandeja, historial } = useMemo(() => {
    const t = pedidos ?? []
    return {
      carritos: t.filter(p => p.estado === 'carrito' && p.compradorId === yo),
      // Lo que espera un acto MÍO: pedidos que me mandaron sin responder, y
      // los aceptados de los dos lados, que alguien tiene que cerrar.
      bandeja: t.filter(p =>
        (p.estado === 'enviado' && p.vendedorId === yo) ||
        (p.estado === 'enviado' && p.compradorId === yo) ||
        p.estado === 'aceptado'),
      historial: t.filter(p => ['completado', 'rechazado', 'cancelado', 'vencido'].includes(p.estado)),
    }
  }, [pedidos, yo])

  const conAccion = bandeja.filter(p =>
    (p.estado === 'enviado' && p.vendedorId === yo) || p.estado === 'aceptado').length

  const hacer = async (id: string, fn: () => Promise<{ ok: boolean; mensaje?: string }>) => {
    setOcupado(id); setAviso(null); setProblemas(null)
    const r = await fn()
    setOcupado(null)
    if (!r.ok) setAviso(r.mensaje ?? 'No se pudo')
    await cargar()
  }

  const enviar = async (p: Pedido) => {
    setOcupado(p.id); setAviso(null); setProblemas(null)
    const r = await enviarPedido(p.id)
    setOcupado(null)
    if (!r.ok) {
      if (r.problemas && r.problemas.length > 0) setProblemas(r.problemas)
      else setAviso(r.mensaje)
    }
    await cargar()
  }

  const lista = vista === 'carrito' ? carritos : vista === 'bandeja' ? bandeja : historial

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3 pb-24">
      <h1 className="mb-3 text-xl font-black tracking-tight text-swu-text">Pedidos</h1>

      <SegmentedControl<Vista>
        label="Vista"
        value={vista}
        onChange={setVista}
        options={[
          { value: 'carrito', label: carritos.length ? `Carrito (${carritos.length})` : 'Carrito' },
          { value: 'bandeja', label: conAccion ? `Pedidos (${conAccion})` : 'Pedidos' },
          { value: 'historial', label: 'Historial' },
        ]}
      />

      {vista === 'carrito' && carritos.length > 0 && (
        <p className="mt-2 rounded-lg bg-swu-amber/12 px-3 py-2 text-[11px] leading-snug text-swu-muted">
          Lo del carrito <strong className="text-swu-amber">todavía no está reservado</strong>.
          La carta se te aparta cuando mandás el pedido y el vendedor lo ve.
        </p>
      )}

      {aviso && (
        <p className="mt-2 rounded-lg bg-swu-red/15 px-3 py-2 text-[11px] text-swu-red-texto">{aviso}</p>
      )}

      {problemas && (
        <div className="mt-2 rounded-lg bg-swu-amber/15 px-3 py-2 text-[11px] leading-snug text-swu-text">
          <p className="font-bold">No se mandó nada: algo cambió mientras tanto.</p>
          <ul className="mt-1 space-y-0.5 text-swu-muted">
            {problemas.map(pr => (
              <li key={pr.card_id}>
                · {cartas.get(pr.card_id)?.name ?? 'Una carta'}
                {pr.que === 'retirada'
                  ? ' — el vendedor la retiró'
                  : ` — pediste ${pr.pediste} y quedan ${pr.quedan}`}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-swu-muted">Ajustá las cantidades y volvé a mandarlo.</p>
        </div>
      )}

      {pedidos === null && (
        <div className="mt-3 space-y-2">
          {[0, 1].map(i => <div key={i} className="h-28 animate-pulse rounded-xl bg-swu-surface" />)}
        </div>
      )}

      {pedidos !== null && lista.length === 0 && (
        <div className="mt-3">
          <EmptyState
            icon={vista === 'carrito' ? <ShoppingCart size={26} /> : vista === 'bandeja' ? <Inbox size={26} /> : <Archive size={26} />}
            title={
              vista === 'carrito' ? 'El carrito está vacío'
              : vista === 'bandeja' ? 'Nada pendiente'
              : 'Todavía no hay historial'
            }
            hint={
              vista === 'carrito'
                ? 'Buscá cartas en el Mercado y tocá «Al carrito».'
                : vista === 'bandeja'
                ? 'Acá caen los pedidos que mandás y los que te mandan.'
                : 'Los pedidos cerrados quedan acá.'
            }
            action={vista === 'carrito'
              ? <Button variant="secondary" onClick={() => navigate('/explore?tab=market')}>Ir al Mercado</Button>
              : undefined}
          />
        </div>
      )}

      <ul className="mt-3 space-y-3">
        {lista.map(p => {
          const soyVendedor = p.vendedorId === yo
          const total = totalDe(p)
          const trabajando = ocupado === p.id
          return (
            <li key={p.id} className="clip-hud bg-swu-surface p-3">
              <div className="flex items-center gap-2.5">
                <Avatar avatar={p.otro?.avatar ?? null} size={32} anillo={p.otro?.id ?? p.id} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-swu-text">
                    {soyVendedor ? `Te compra ${p.otro?.name ?? 'alguien'}` : `Le comprás a ${p.otro?.name ?? 'alguien'}`}
                  </span>
                  <span className="block text-[10px] text-swu-muted">
                    {ROTULO[p.estado]}
                    {p.enviadoEn && p.estado === 'enviado' && ` · ${fechaCorta(p.enviadoEn)}`}
                    {p.cerradoEn && ` · ${fechaCorta(p.cerradoEn)}`}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm font-black text-swu-amber tabular-nums">{PRECIO(total)}</span>
                  <span className="block text-[9px] text-swu-muted">{p.lineas.length} {p.lineas.length === 1 ? 'carta' : 'cartas'}</span>
                </span>
              </div>

              {p.motivo && (
                <p className="mt-1.5 text-[11px] text-swu-muted">{p.motivo}</p>
              )}

              <ul className="mt-2.5 space-y-1.5">
                {p.lineas.map(l => {
                  const c = cartas.get(l.cardId)
                  const u = l.precioUnitario
                  return (
                    <li key={l.cardId} className="flex items-center gap-2">
                      <span className="w-[34px] shrink-0">
                        <span className="relative block aspect-[286/400] w-full">
                          {c?.imageUrl
                            ? <CardImage src={c.imageUrl} alt={c.name} orientacion={c.isLeader || c.isBase ? 'apaisada' : 'vertical'} className="h-full w-full" />
                            : <span className="block h-full w-full rounded bg-swu-surface-hover" />}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-swu-text">
                        {c?.name ?? <span className="text-swu-muted">Carta sin ficha</span>}
                        {c?.subtitle && <span className="text-swu-muted"> · {c.subtitle}</span>}
                      </span>
                      {p.estado === 'carrito' ? (
                        <span className="flex shrink-0 items-center gap-1">
                          {/* 44×44 de área táctil en los dos, no el tamaño del glifo. */}
                          <button
                            aria-label="Quitar una"
                            disabled={trabajando}
                            onClick={() => hacer(p.id, () => ponerEnCarrito(p.vendedorId, l.cardId, l.cantidad - 1))}
                            className="flex h-11 w-8 items-center justify-center text-swu-muted"
                          >−</button>
                          <span className="w-5 text-center font-mono text-xs tabular-nums text-swu-text">{l.cantidad}</span>
                          <button
                            aria-label="Agregar una"
                            disabled={trabajando}
                            onClick={() => hacer(p.id, () => ponerEnCarrito(p.vendedorId, l.cardId, l.cantidad + 1))}
                            className="flex h-11 w-8 items-center justify-center text-swu-muted"
                          >+</button>
                        </span>
                      ) : (
                        <span className="shrink-0 font-mono text-[11px] text-swu-muted tabular-nums">
                          ×{l.cantidad}{u != null && ` · ${PRECIO(u * l.cantidad)}`}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>

              {/* Las acciones. Cada botón solo aparece para quien de verdad
                  puede hacerlo — el servidor lo comprueba igual, pero un botón
                  que siempre falla es peor que no tenerlo. */}
              <div className="mt-2.5 flex flex-wrap gap-2">
                {p.estado === 'carrito' && (
                  <>
                    <Button size="sm" disabled={trabajando} onClick={() => enviar(p)}>
                      <Send size={14} /> Mandar el pedido
                    </Button>
                    <Button size="sm" variant="secondary" disabled={trabajando}
                      onClick={() => hacer(p.id, () => cancelarPedido(p.id))}>
                      <Trash2 size={14} /> Vaciar
                    </Button>
                  </>
                )}
                {p.estado === 'enviado' && soyVendedor && (
                  <>
                    <Button size="sm" disabled={trabajando}
                      onClick={() => hacer(p.id, () => responderPedido(p.id, true))}>
                      <Check size={14} /> Aceptar la venta
                    </Button>
                    <Button size="sm" variant="secondary" disabled={trabajando}
                      onClick={() => hacer(p.id, () => responderPedido(p.id, false, 'El vendedor no pudo'))}>
                      <X size={14} /> Rechazar
                    </Button>
                  </>
                )}
                {p.estado === 'enviado' && !soyVendedor && (
                  <Button size="sm" variant="secondary" disabled={trabajando}
                    onClick={() => hacer(p.id, () => cancelarPedido(p.id))}>
                    Cancelar
                  </Button>
                )}
                {p.estado === 'aceptado' && (
                  <>
                    <Button size="sm" disabled={trabajando}
                      onClick={() => hacer(p.id, () => cerrarPedido(p.id, true))}>
                      <Check size={14} /> Ya nos vimos, listo
                    </Button>
                    <Button size="sm" variant="secondary" disabled={trabajando}
                      onClick={() => hacer(p.id, () => cerrarPedido(p.id, false))}>
                      No se hizo
                    </Button>
                  </>
                )}
                {p.estado === 'aceptado' && (
                  <span className="flex items-center gap-1 text-[10px] text-swu-muted">
                    <Store size={11} /> Se entrega en la sede que acuerden
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * MENSAJES — mis conversaciones de a dos.
 *
 * ── Lo que esta pantalla NO hace ─────────────────────────────────────
 *
 * No dibuja el chat: eso lo hace `SalaChat`, el mismo componente que usan las
 * salas de país, de tienda y de La Galaxia. Una conversación privada es un
 * ALCANCE más, no un chat aparte, y por eso los adjuntos de carta y de mazo, el
 * borrado, la moderación y el tiempo real vienen ya puestos.
 *
 * ── Y una cosa que sí decide ─────────────────────────────────────────
 *
 * Cortar a alguien NO borra el historial. El bloqueado sigue leyendo lo que ya
 * se dijeron; lo que pierde es poder escribir. Borrar la conversación al
 * bloquear le quitaría a quien bloquea la prueba de lo que pasó, que es
 * justamente lo que se querría conservar.
 */

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MessageCircle, ChevronLeft, Ban, RotateCcw } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { SalaChat } from '../galaxy/SalaChat'
import { useAuth } from '../../hooks/useAuth'
import { fechaCorta } from '../../services/horaSV'
import {
  misConversaciones, abrirConversacion, bloquearConversacion, salaDe,
  type Conversacion,
} from '../../services/chatPrivado'

export function MensajesPage() {
  // `isAdmin` sale del store: es el mismo que usa La Galaxia, no una
  // segunda forma de averiguar lo mismo (§2x, el despacho duplicado).
  const { supabaseUser, currentProfile, isAdmin } = useAuth()
  const miId = supabaseUser?.id ?? ''
  const [params, setParams] = useSearchParams()
  /** Con quién abrir al entrar. Es lo que permite el botón «escribirle» de
   *  otras pantallas: `/mensajes?con=<uuid>`. */
  const con = params.get('con')
  const abierta = params.get('sala')
  /** Una carta que viene enganchada desde el Mercado: `?carta=<uuid>`. Es lo
   *  que hace que «escribirle por esta carta» abra el chat con la carta ya
   *  puesta, en vez de obligar a buscarla otra vez. */
  const carta = params.get('carta')

  const [convs, setConvs] = useState<Conversacion[] | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!miId) { setConvs([]); return }
    const r = await misConversaciones(miId)
    if (r.ok) { setConvs(r.datos); setFallo(null) }
    else { setConvs([]); setFallo(r.mensaje) }
  }, [miId])

  useEffect(() => {
    let vivo = true
    void (async () => { if (vivo) await cargar() })()
    return () => { vivo = false }
  }, [cargar])

  // `?con=<uuid>` abre (o recupera) la conversación y se queda en ella. El
  // parámetro se cambia por `?sala=` para que recargar no vuelva a llamar a la
  // RPC — es idempotente, pero pedirla de más no aporta nada.
  useEffect(() => {
    if (!con || !miId) return
    let vivo = true
    void (async () => {
      const r = await abrirConversacion(con)
      if (!vivo) return
      if (r.ok) {
        // La carta se ARRASTRA al cambiar de parámetro: si se perdiera acá, el
        // adjunto desaparecería justo al abrir la conversación.
        setParams(carta ? { sala: r.datos, carta } : { sala: r.datos }, { replace: true })
        await cargar()
      }
      else setFallo(r.mensaje)
    })()
    return () => { vivo = false }
  }, [con, carta, miId, setParams, cargar])

  const actual = convs?.find(c => c.id === abierta) ?? null

  // ── Dentro de una conversación ──
  if (actual) {
    const cortadaPorMi = actual.bloqueadaPor === miId
    const meCortaron = actual.bloqueadaPor !== null && !cortadaPorMi
    return (
      <div className="mx-auto flex h-full max-w-2xl flex-col px-4 pt-3 pb-24">
        <div className="mb-2 flex items-center gap-2">
          <button
            onClick={() => setParams({}, { replace: true })}
            aria-label="Volver a mis mensajes"
            className="-ml-2 flex h-11 w-11 items-center justify-center text-swu-muted hover:text-swu-text"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="min-w-0 flex-1 truncate text-sm font-black text-swu-text">
            {actual.otro.name}
          </span>
          <Button
            size="xs"
            variant="secondary"
            onClick={async () => {
              await bloquearConversacion(actual.id, !cortadaPorMi)
              await cargar()
            }}
          >
            {cortadaPorMi ? <><RotateCcw size={13} /> Reabrir</> : <><Ban size={13} /> Cortar</>}
          </Button>
        </div>

        {meCortaron && (
          <p className="mb-2 rounded-lg bg-swu-amber/15 px-3 py-2 text-[11px] leading-snug text-swu-muted">
            Esta persona cortó la conversación. Podés seguir leyendo lo que se
            dijeron, pero no escribirle.
          </p>
        )}
        {cortadaPorMi && (
          <p className="mb-2 rounded-lg bg-swu-surface px-3 py-2 text-[11px] leading-snug text-swu-muted">
            Cortaste esta conversación: no te puede escribir. El historial queda.
          </p>
        )}

        <SalaChat
          sala={salaDe(actual)}
          miId={miId}
          miNombre={currentProfile?.name ?? 'Yo'}
          miAvatar={currentProfile?.avatar ?? ''}
          soyAdmin={isAdmin}
          // En una sala de a dos no hay «cuánta gente puede leer»: son dos.
          alcanceGente={0}
          silenciada={false}
          onSilenciar={() => {}}
          adjuntoInicial={carta ? { tipo: 'carta', id: carta } : null}
        />
      </div>
    )
  }

  // ── La lista ──
  return (
    <div className="mx-auto max-w-2xl px-4 pt-3 pb-24">
      <h1 className="mb-3 text-xl font-black tracking-tight text-swu-text">Mensajes</h1>

      {fallo && (
        <p className="mb-2 rounded-lg bg-swu-red/15 px-3 py-2 text-[11px] text-swu-red-texto">{fallo}</p>
      )}

      {convs === null && (
        <div className="space-y-2">
          {[0, 1].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-swu-surface" />)}
        </div>
      )}

      {convs !== null && convs.length === 0 && (
        <EmptyState
          icon={<MessageCircle size={26} />}
          title="Todavía no hay conversaciones"
          hint="Se abre una tocando «Escribirle» en el perfil de alguien o en una publicación del Mercado."
        />
      )}

      <ul className="divide-y divide-swu-border overflow-hidden rounded-xl bg-swu-surface">
        {(convs ?? []).map(c => (
          <li key={c.id}>
            <button
              onClick={() => setParams({ sala: c.id })}
              className="flex w-full items-center gap-3 px-3 py-3 text-left"
            >
              <Avatar avatar={c.otro.avatar} size={38} anillo={c.otro.id} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={`min-w-0 flex-1 truncate text-sm ${
                    c.noLeidos > 0 ? 'font-black text-swu-text' : 'font-bold text-swu-text'}`}>
                    {c.otro.name}
                  </span>
                  <span className="flex-shrink-0 text-[10px] text-swu-muted">
                    {c.bloqueadaPor ? 'Cortada' : fechaCorta(c.ultimo?.en ?? c.creadaEn)}
                  </span>
                </span>
                {/* La vista previa es lo que convierte una lista de nombres en
                    un buzón: sin ella hay que entrar a cada una para saber si
                    pasó algo. El «Vos:» distingue lo que dije de lo que me
                    dijeron, que es la mitad de la información de un renglón. */}
                <span className={`block truncate text-[11px] ${
                  c.noLeidos > 0 ? 'font-semibold text-swu-text' : 'text-swu-muted'}`}>
                  {c.ultimo
                    ? `${c.ultimo.mio ? 'Vos: ' : ''}${c.ultimo.cuerpo}`
                    : 'Sin mensajes todavía'}
                </span>
              </span>
              {c.noLeidos > 0 && (
                <span className="flex-shrink-0 rounded-full bg-swu-cyan px-1.5 py-0.5
                                 text-[10px] font-black leading-none text-swu-bg">
                  {c.noLeidos > 99 ? '99+' : c.noLeidos}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

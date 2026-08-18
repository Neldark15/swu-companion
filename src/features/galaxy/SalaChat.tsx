/**
 * SalaChat — una sala del chat de La Galaxia.
 *
 * Las decisiones de acá salen de cómo se USA un chat, no de qué es más fácil
 * de dibujar. Las que costaron pensarlas:
 *
 * 1. **El día se separa.** Sin una marca de día, «10:42» de ayer y «10:42» de
 *    hoy se leen igual y la conversación miente sobre cuándo pasó.
 * 2. **Nunca se te mueve el texto que estás leyendo.** El auto-scroll al fondo
 *    solo ocurre si YA estabas al fondo. Si subiste a leer, llega una píldora
 *    «N nuevos» y bajás vos cuando querés. Un chat que te arrastra mientras
 *    leés es el defecto más odiado de la categoría.
 * 3. **Quién está en línea, arriba.** Es lo que separa una sala viva de un
 *    buzón. Sale de la presencia de Realtime, que no cuesta ni una fila.
 * 4. **El envío es optimista, y el fallo se puede reintentar.** Esperar el
 *    viaje de ida y vuelta se siente roto en una red lenta; perder el texto
 *    escrito cuando falla es peor.
 * 5. **Sin `filter: blur()` por mensaje.** Es una lista que puede tener 80
 *    filas y vive en un teléfono.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Send, Loader2, MessageSquare, BellOff, Bell, Trash2, ArrowDown, RotateCw, Paperclip, X } from 'lucide-react'
import { Avatar } from '../../components/ui/Avatar'
import { hora, diaCalendarioSV } from '../../services/horaSV'
import {
  leerSala, enviar, retirar, escucharSala, escucharPresencia, marcarLeida,
  type Sala, type MensajeGalaxia, type AdjuntoMensaje,
} from '../../services/galaxiaChat'
import { CompartirEnChat } from './CompartirEnChat'
import { AdjuntoBurbuja } from './AdjuntoBurbuja'

interface Props {
  sala: Sala
  miId: string
  miNombre: string
  miAvatar: string
  soyAdmin: boolean
  /** Cuánta gente puede leer esta sala. Da contexto al vacío. */
  alcanceGente: number
  silenciada: boolean
  onSilenciar: (v: boolean) => void
}

/** Un mensaje que todavía no confirmó el servidor. */
interface EnVuelo {
  clave: string
  cuerpo: string
  /** Se guarda con el mensaje en vuelo para que un reintento no lo pierda. */
  adjunto: AdjuntoMensaje | null
  estado: 'enviando' | 'falló'
}

/** Separador de día, o `null` si el mensaje va en el mismo día que el anterior. */
function etiquetaDeDia(actual: string, anterior: string | null): string | null {
  const d = diaCalendarioSV(new Date(actual))
  if (anterior && diaCalendarioSV(new Date(anterior)) === d) return null

  const hoy = diaCalendarioSV(new Date())
  if (d === hoy) return 'Hoy'
  const ayer = diaCalendarioSV(new Date(Date.now() - 86_400_000))
  if (d === ayer) return 'Ayer'
  // `d` es AAAA-MM-DD; se muestra en el orden que se lee en El Salvador.
  const [a, m, dd] = d.split('-')
  return `${dd}/${m}/${a}`
}

/**
 * Convierte los enlaces del texto en enlaces de verdad.
 *
 * Se hace por partición del texto y NO con `dangerouslySetInnerHTML`: el
 * cuerpo lo escribe cualquiera con cuenta, así que pasarlo como HTML sería
 * entregarle el DOM de la pantalla a quien escriba `<img onerror=…>`.
 */
function conEnlaces(texto: string) {
  const partes = texto.split(/(https?:\/\/[^\s]+)/g)
  return partes.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a
        key={i}
        href={p}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="underline underline-offset-2 text-swu-cyan break-all"
        onClick={e => e.stopPropagation()}
      >
        {p}
      </a>
    ) : (
      <span key={i}>{p}</span>
    ),
  )
}

export function SalaChat({
  sala, miId, miNombre, miAvatar, soyAdmin, alcanceGente, silenciada, onSilenciar,
}: Props) {
  const [mensajes, setMensajes] = useState<MensajeGalaxia[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [borrador, setBorrador] = useState('')
  const [enVuelo, setEnVuelo] = useState<EnVuelo[]>([])
  const [enLinea, setEnLinea] = useState<string[]>([])
  /** Lo que se va a mandar pegado al próximo mensaje, si hay algo. */
  const [adjunto, setAdjunto] = useState<AdjuntoMensaje | null>(null)
  const [abriendoCompartir, setAbriendoCompartir] = useState(false)
  const [alFondo, setAlFondo] = useState(true)
  const [nuevosAbajo, setNuevosAbajo] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const finRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  /**
   * Espejo de `alFondo` para leerlo dentro de callbacks que no deben
   * recrearse cuando cambia (el de Realtime, sobre todo: recrearlo por cada
   * scroll significaría desuscribirse y volver a suscribirse a la sala).
   *
   * Se sincroniza en un efecto y no durante el render: escribir un ref
   * mientras se renderiza rompe el render concurrente de React.
   */
  const alFondoRef = useRef(true)
  useEffect(() => { alFondoRef.current = alFondo }, [alFondo])

  const recargar = useCallback(async () => {
    const r = await leerSala(sala.alcance, sala.ambito)
    if (r.ok) {
      setMensajes(prev => {
        // Si llegó algo estando arriba, se cuenta para la píldora en vez de
        // arrastrar la vista. La cuenta es contra lo que YA había, no contra
        // el total, porque el total incluye lo que ya habías leído.
        if (!alFondoRef.current && r.datos.length > prev.length) {
          setNuevosAbajo(n => n + (r.datos.length - prev.length))
        }
        return r.datos
      })
      setError(null)
    } else setError(r.mensaje)
    setCargando(false)
  }, [sala.alcance, sala.ambito])

  // Cargar la sala.
  //
  // No hace falta limpiar el estado acá: quien monta este componente le pasa
  // la clave de la sala como `key`, así que cambiar de sala lo REMONTA y todo
  // nace de cero. Hacerlo además a mano era, encima de redundante, cuatro
  // `setState` seguidos dentro de un efecto — un render en cascada por cada
  // cambio de sala.
  useEffect(() => { void recargar() }, [recargar])

  // Realtime. Se recarga la sala entera en vez de insertar el mensaje suelto:
  // el `payload` no trae nombre ni avatar del autor, y pedirlos por mensaje
  // sería una consulta por cada tecla ajena.
  useEffect(() => escucharSala(sala.alcance, sala.ambito, () => { void recargar() }),
    [sala.alcance, sala.ambito, recargar])

  // Quién está mirando esta sala AHORA.
  useEffect(
    () => escucharPresencia(sala.alcance, sala.ambito, miId, miNombre, miAvatar, setEnLinea),
    [sala.alcance, sala.ambito, miId, miNombre, miAvatar],
  )

  useEffect(() => {
    if (!miId || cargando) return
    void marcarLeida(miId, sala.alcance, sala.ambito)
  }, [miId, sala.alcance, sala.ambito, cargando, mensajes.length])

  // Bajar SOLO si ya estabas abajo. Ver la regla 2 de la cabecera.
  //
  // Acá NO se pone el contador a cero: si estás al fondo ya vale cero —solo
  // sube dentro de `recargar` cuando NO lo estás, y `alScroll` lo borra al
  // volver—, así que ponerlo era un `setState` de más dentro de un efecto.
  useEffect(() => {
    if (alFondoRef.current) finRef.current?.scrollIntoView({ block: 'end' })
  }, [mensajes.length, enVuelo.length])

  function alScroll() {
    const el = scrollRef.current
    if (!el) return
    // 24 px de margen: pegado al píxel, un rebote de scroll lo daría por falso.
    const abajo = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    // También al toque: si un mensaje llega en el mismo cuadro en que soltás
    // el scroll, el efecto todavía no corrió y el ref estaría atrasado.
    alFondoRef.current = abajo
    setAlFondo(abajo)
    if (abajo) setNuevosAbajo(0)
  }

  function irAlFondo() {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    setNuevosAbajo(0)
  }

  /** El área crece con el texto, hasta un tope. */
  function ajustarAlto() {
    const el = areaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  const mandar = useCallback(async (
    texto: string,
    adj: AdjuntoMensaje | null,
    claveExistente?: string,
  ) => {
    const limpio = texto.trim()
    // Sin texto Y sin adjunto no hay nada que mandar. Con adjunto, el texto
    // sobra: compartir una carta sin comentario es un mensaje completo.
    if (!limpio && !adj) return
    const clave = claveExistente ?? `${Date.now()}-${Math.min(limpio.length, 99)}`

    setEnVuelo(v =>
      claveExistente
        ? v.map(m => (m.clave === clave ? { ...m, estado: 'enviando' } : m))
        : [...v, { clave, cuerpo: limpio, adjunto: adj, estado: 'enviando' }],
    )

    const r = await enviar(sala.alcance, sala.ambito, miId, limpio, adj)
    if (r.ok) {
      setEnVuelo(v => v.filter(m => m.clave !== clave))
      setError(null)
      await recargar()
    } else {
      // El texto NO se pierde: queda en la burbuja fallida con su reintento.
      setEnVuelo(v => v.map(m => (m.clave === clave ? { ...m, estado: 'falló' } : m)))
      setError(r.mensaje)
    }
  }, [sala.alcance, sala.ambito, miId, recargar])

  const otrosEnLinea = useMemo(() => enLinea.filter(id => id !== miId).length, [enLinea, miId])

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-swu-border bg-swu-surface">
      {/* ── Cabecera ── */}
      <div className="flex items-center gap-2 border-b border-swu-border px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-swu-text">{sala.titulo}</p>
          <p className="flex items-center gap-1.5 truncate text-[10px] text-swu-muted">
            {/* En línea PRIMERO: es el dato vivo. «19 personas» es un censo;
                «3 en línea» es una invitación a escribir ahora. */}
            {otrosEnLinea > 0 && (
              <span className="flex items-center gap-1 text-swu-green">
                <span className="h-1.5 w-1.5 rounded-full bg-swu-green" />
                {otrosEnLinea} en línea
              </span>
            )}
            {otrosEnLinea > 0 && alcanceGente > 0 && <span>·</span>}
            {alcanceGente > 0 && <span>{alcanceGente} {alcanceGente === 1 ? 'persona' : 'personas'}</span>}
            {otrosEnLinea === 0 && alcanceGente === 0 && <span>{sala.detalle}</span>}
          </p>
        </div>
        {/* Silenciar por SALA. Sin esto, la primera persona ruidosa hace que la
            gente apague todos los avisos de la app, no solo los del chat. */}
        <button
          onClick={() => onSilenciar(!silenciada)}
          aria-pressed={silenciada}
          title={silenciada ? 'Activar avisos de esta sala' : 'Silenciar esta sala'}
          className={`rounded-lg p-2 transition-colors ${silenciada ? 'text-swu-muted' : 'text-swu-accent-texto'}`}
        >
          {silenciada ? <BellOff size={15} /> : <Bell size={15} />}
        </button>
      </div>

      {/* ── Mensajes ── */}
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={alScroll}
          className="h-[52vh] min-h-[300px] space-y-1 overflow-y-auto overscroll-contain px-3 py-3"
        >
          {cargando && (
            <div className="flex justify-center py-10">
              <Loader2 size={22} className="animate-spin text-swu-muted" />
            </div>
          )}

          {!cargando && mensajes.length === 0 && enVuelo.length === 0 && (
            <div className="py-10 text-center">
              <MessageSquare size={34} className="mx-auto mb-3 text-swu-muted/30" />
              <p className="text-sm font-semibold text-swu-text">Nadie ha escrito todavía</p>
              {/* Un vacío que solo dice «no hay nada» hace que nadie vuelva.
                  Este dice cuánta gente hay del otro lado. */}
              <p className="mx-auto mt-1 max-w-[17rem] text-[11px] text-swu-muted">
                {alcanceGente > 1
                  ? `Hay ${alcanceGente} personas que van a leer lo que escribas.`
                  : 'Cuando llegue más gente a esta sala, tu mensaje va a estar acá esperándola.'}
              </p>
            </div>
          )}

          {mensajes.map((m, i) => {
            const anterior = i > 0 ? mensajes[i - 1] : null
            const dia = etiquetaDeDia(m.creadoEn, anterior?.creadoEn ?? null)
            const mio = m.autorId === miId
            // Se agrupa por autor Y por cercanía en el tiempo: dos mensajes de
            // la misma persona con horas de diferencia son dos momentos, no uno.
            const seguido =
              !dia && anterior?.autorId === m.autorId &&
              new Date(m.creadoEn).getTime() - new Date(anterior.creadoEn).getTime() < 5 * 60_000

            return (
              <div key={m.id}>
                {dia && (
                  <div className="my-3 flex items-center gap-2">
                    <span className="h-px flex-1 bg-swu-border" />
                    <span className="font-mono text-[9px] uppercase tracking-wider text-swu-muted">{dia}</span>
                    <span className="h-px flex-1 bg-swu-border" />
                  </div>
                )}

                <div className={`flex gap-2 ${mio ? 'flex-row-reverse' : ''} ${seguido ? 'mt-0.5' : 'mt-2'}`}>
                  <div className="w-7 flex-shrink-0">
                    {!seguido && <Avatar avatar={m.autorAvatar} size={28} anillo={m.autorId} />}
                  </div>
                  <div className={`flex min-w-0 max-w-[78%] flex-col ${mio ? 'items-end' : 'items-start'}`}>
                    {!seguido && (
                      <p className="mb-0.5 px-1 text-[10px] font-semibold text-swu-muted">
                        {mio ? 'Vos' : m.autorNombre}
                      </p>
                    )}
                    <div
                      /* `max-w-full min-w-0` para que un adjunto ancho no
                         estire la burbuja más allá del 78% que le toca. */
                      className={`group relative max-w-full min-w-0 rounded-2xl px-3 py-1.5 text-[13px] leading-snug ${
                        m.borrado
                          ? 'border border-dashed border-swu-border italic text-swu-muted'
                          : mio
                            ? 'bg-swu-accent/20 text-swu-text'
                            : 'bg-swu-bg text-swu-text'
                      }`}
                    >
                      {/* Un mensaje puede ser SOLO el adjunto. Pintar un
                          `<span>` vacío deja una línea de aire arriba de la
                          tarjeta que se ve como un error. */}
                      {(m.borrado || m.cuerpo.trim()) && (
                        <span className="whitespace-pre-wrap break-words">
                          {m.borrado ? 'Mensaje retirado' : conEnlaces(m.cuerpo)}
                        </span>
                      )}
                      {m.adjunto && <AdjuntoBurbuja adjunto={m.adjunto} />}
                      {!m.borrado && (mio || soyAdmin) && (
                        <button
                          onClick={async () => {
                            if (!confirm('¿Retirar este mensaje?')) return
                            await retirar(m.id, miId)
                            await recargar()
                          }}
                          title="Retirar"
                          className="absolute -right-2 -top-2 hidden rounded-full bg-swu-surface p-1
                                     text-swu-muted shadow hover:text-swu-red group-hover:block"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 px-1 font-mono text-[9px] text-swu-muted/70">{hora(m.creadoEn)}</p>
                  </div>
                </div>
              </div>
            )
          })}

          {enVuelo.map(m => (
            <div key={m.clave} className="mt-2 flex flex-row-reverse gap-2">
              <div className="w-7 flex-shrink-0" />
              <div className="flex max-w-[78%] flex-col items-end">
                <div className={`rounded-2xl px-3 py-1.5 text-[13px] leading-snug ${
                  m.estado === 'falló'
                    ? 'border border-swu-red/50 bg-swu-red/10 text-swu-text'
                    : 'bg-swu-accent/10 text-swu-muted'
                }`}>
                  <span className="whitespace-pre-wrap break-words">{m.cuerpo}</span>
                </div>
                {m.estado === 'falló' ? (
                  <button
                    onClick={() => void mandar(m.cuerpo, m.adjunto, m.clave)}
                    className="mt-0.5 flex items-center gap-1 px-1 text-[9px] text-swu-red-texto underline"
                  >
                    <RotateCw size={9} /> No se envió · reintentar
                  </button>
                ) : (
                  <p className="mt-0.5 px-1 text-[9px] text-swu-muted">Enviando…</p>
                )}
              </div>
            </div>
          ))}

          <div ref={finRef} />
        </div>

        {/* Píldora de bajada. Aparece solo si te alejaste del fondo, y dice
            cuántos llegaron mientras leías arriba. */}
        {!alFondo && (
          <button
            onClick={irAlFondo}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5
                       rounded-full border border-swu-border bg-swu-surface px-3 py-1.5
                       text-[11px] font-semibold text-swu-text shadow-lg"
          >
            <ArrowDown size={12} />
            {nuevosAbajo > 0 ? `${nuevosAbajo} nuevo${nuevosAbajo === 1 ? '' : 's'}` : 'Ir al final'}
          </button>
        )}
      </div>

      {error && (
        <p className="border-t border-swu-red/30 bg-swu-red/10 px-3 py-1.5 text-[11px] text-swu-red-texto">
          {error}
        </p>
      )}

      {/* ── Escribir ── */}
      {/* Lo que se va a mandar pegado, con su aspa. Va ARRIBA del área de
          texto y no dentro: adentro competiría con el cursor y en un teléfono
          es donde cae el teclado. */}
      {adjunto && (
        <div className="flex items-center gap-2 border-t border-swu-border bg-swu-bg/50 px-3 py-2">
          {adjunto.tipo === 'carta'
            ? <MessageSquare size={13} className="text-swu-accent-texto" />
            : <MessageSquare size={13} className="text-swu-accent-texto" />}
          <span className="flex-1 truncate text-[11px] text-swu-muted">
            Vas a compartir {adjunto.tipo === 'carta' ? 'una carta' : 'un mazo'}
          </span>
          <button onClick={() => setAdjunto(null)} aria-label="Quitar lo adjunto"
                  className="rounded p-1 text-swu-muted hover:text-swu-text">
            <X size={13} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 border-t border-swu-border p-2">
        <button
          onClick={() => setAbriendoCompartir(true)}
          aria-label="Compartir una carta o un mazo"
          title="Compartir una carta o un mazo"
          className="rounded-xl border border-swu-border bg-swu-bg p-2.5 text-swu-muted
                     transition-colors hover:text-swu-accent-texto"
        >
          <Paperclip size={16} />
        </button>
        <textarea
          ref={areaRef}
          value={borrador}
          onChange={e => { setBorrador(e.target.value); ajustarAlto() }}
          onKeyDown={e => {
            // Enter manda; Shift+Enter parte la línea. En táctil el teclado
            // trae su propio Enter de salto, así que no se pierde nada.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              const t = borrador
              const a = adjunto
              setBorrador(''); setAdjunto(null)
              requestAnimationFrame(ajustarAlto)
              void mandar(t, a)
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder={`Escribir en ${sala.titulo}…`}
          className="max-h-[120px] min-h-[38px] flex-1 resize-none rounded-xl border border-swu-border
                     bg-swu-bg px-3 py-2 text-sm text-swu-text placeholder:text-swu-muted/60
                     focus:border-swu-accent focus:outline-none"
        />
        <button
          onClick={() => {
            const t = borrador; const a = adjunto
            setBorrador(''); setAdjunto(null)
            requestAnimationFrame(ajustarAlto)
            void mandar(t, a)
          }}
          disabled={!borrador.trim() && !adjunto}
          aria-label="Enviar"
          className="rounded-xl bg-swu-accent p-2.5 text-swu-accent-fg transition-opacity disabled:opacity-30"
        >
          <Send size={16} />
        </button>
      </div>

      <CompartirEnChat
        abierto={abriendoCompartir}
        miId={miId}
        onCerrar={() => setAbriendoCompartir(false)}
        onElegir={adj => {
          setAdjunto(adj)
          setAbriendoCompartir(false)
          // El cuerpo NO se autocompleta con el nombre. Se hacía porque la base
          // exigía texto, y el resultado era el nombre del mazo dos veces —una
          // como mensaje y otra en la tarjeta— que además, siendo largo,
          // desbordaba la burbuja. Ahora la base acepta un mensaje que es solo
          // el adjunto, así que el comentario es tuyo o no hay.
        }}
      />
    </div>
  )
}

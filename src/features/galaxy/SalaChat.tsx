/**
 * SalaChat — una sala del chat de La Galaxia.
 *
 * Decisiones que vienen de cómo se usa un chat, no de cómo es más fácil:
 *
 * - **Una sala vacía NO es un callejón sin salida.** Medido: hay 0 sedes
 *   registradas y 1 sola persona fuera de El Salvador, así que las salas de
 *   tienda y de continente van a nacer vacías. Un vacío que solo dice «no hay
 *   mensajes» hace que nadie vuelva; acá se ofrece romper el hielo y se dice
 *   cuánta gente hay del otro lado.
 * - **El envío es optimista.** El mensaje aparece en cuanto lo mandás, con su
 *   estado; si el servidor lo rechaza se marca en rojo y se puede reintentar.
 *   Esperar el viaje de ida y vuelta se siente roto en una red lenta.
 * - **Nada de `filter: blur()` por mensaje.** Es una lista que puede tener
 *   ochenta filas.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Send, Loader2, MessageSquare, BellOff, Bell, Trash2 } from 'lucide-react'
import { Avatar } from '../../components/ui/Avatar'
import { hora } from '../../services/horaSV'
import {
  leerSala, enviar, retirar, escucharSala, marcarLeida,
  type Sala, type MensajeGalaxia,
} from '../../services/galaxiaChat'

interface Props {
  sala: Sala
  miId: string
  soyAdmin: boolean
  /** Cuánta gente puede leer esta sala. Se muestra para que el vacío tenga contexto. */
  alcanceGente: number
  silenciada: boolean
  onSilenciar: (v: boolean) => void
}

/** Un mensaje que todavía no confirmó el servidor. */
interface EnVuelo {
  clave: string
  cuerpo: string
  estado: 'enviando' | 'falló'
}

export function SalaChat({ sala, miId, soyAdmin, alcanceGente, silenciada, onSilenciar }: Props) {
  const [mensajes, setMensajes] = useState<MensajeGalaxia[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [borrador, setBorrador] = useState('')
  const [enVuelo, setEnVuelo] = useState<EnVuelo[]>([])
  const finRef = useRef<HTMLDivElement>(null)

  const recargar = useCallback(async () => {
    const r = await leerSala(sala.alcance, sala.ambito)
    if (r.ok) { setMensajes(r.datos); setError(null) }
    else setError(r.mensaje)
    setCargando(false)
  }, [sala.alcance, sala.ambito])

  // Al cambiar de sala se empieza de cero, y eso lo resuelve el `key` por sala
  // que pone quien nos monta: React desmonta y vuelve a montar, así que el
  // estado nace limpio solo. Hacerlo con un efecto que llama a cuatro
  // `setState` era, además de redundante, un render en cascada.
  useEffect(() => {
    let vivo = true
    void (async () => {
      const r = await leerSala(sala.alcance, sala.ambito)
      if (!vivo) return
      if (r.ok) { setMensajes(r.datos); setError(null) }
      else setError(r.mensaje)
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [sala.alcance, sala.ambito])

  // Realtime. Se recarga la sala entera en vez de insertar el mensaje suelto:
  // el `payload` no trae el nombre ni el avatar del autor, y pedirlos por
  // mensaje sería una consulta por cada tecla ajena.
  useEffect(() => {
    const parar = escucharSala(sala.alcance, sala.ambito, () => { void recargar() })
    return parar
  }, [sala.alcance, sala.ambito, recargar])

  // Marcar leída al abrirla y cada vez que llega algo estando adentro.
  useEffect(() => {
    if (!miId || cargando) return
    void marcarLeida(miId, sala.alcance, sala.ambito)
  }, [miId, sala.alcance, sala.ambito, cargando, mensajes.length])

  // Al fondo, que es donde está lo nuevo.
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' })
  }, [mensajes.length, enVuelo.length])

  async function mandar() {
    const texto = borrador.trim()
    if (!texto) return
    const clave = `${Date.now()}-${texto.length}`
    setBorrador('')
    setEnVuelo(v => [...v, { clave, cuerpo: texto, estado: 'enviando' }])

    const r = await enviar(sala.alcance, sala.ambito, miId, texto)
    if (r.ok) {
      setEnVuelo(v => v.filter(m => m.clave !== clave))
      await recargar()
    } else {
      setEnVuelo(v => v.map(m => (m.clave === clave ? { ...m, estado: 'falló' } : m)))
      setError(r.mensaje)
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-swu-border bg-swu-surface overflow-hidden">
      {/* Cabecera de la sala */}
      <div className="flex items-center gap-2 border-b border-swu-border px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-swu-text">{sala.titulo}</p>
          <p className="truncate text-[10px] text-swu-muted">
            {sala.detalle}
            {alcanceGente > 0 && ` · ${alcanceGente} ${alcanceGente === 1 ? 'persona' : 'personas'}`}
          </p>
        </div>
        {/* Silenciar por SALA. Sin esto, la primera persona ruidosa hace que la
            gente apague todos los avisos de la app, no solo los del chat. */}
        <button
          onClick={() => onSilenciar(!silenciada)}
          aria-pressed={silenciada}
          title={silenciada ? 'Activar avisos de esta sala' : 'Silenciar esta sala'}
          className={`rounded-lg p-2 transition-colors ${
            silenciada ? 'text-swu-muted' : 'text-swu-accent-texto'
          }`}
        >
          {silenciada ? <BellOff size={15} /> : <Bell size={15} />}
        </button>
      </div>

      {/* Los mensajes */}
      <div className="h-[52vh] min-h-[280px] overflow-y-auto overscroll-contain px-3 py-3 space-y-2.5">
        {cargando && (
          <div className="flex justify-center py-8">
            <Loader2 size={22} className="animate-spin text-swu-muted" />
          </div>
        )}

        {!cargando && mensajes.length === 0 && enVuelo.length === 0 && (
          <div className="py-8 text-center">
            <MessageSquare size={34} className="mx-auto mb-3 text-swu-muted/30" />
            <p className="text-sm text-swu-text">Nadie ha escrito todavía</p>
            <p className="mx-auto mt-1 max-w-[16rem] text-[11px] text-swu-muted">
              {alcanceGente > 1
                ? `Hay ${alcanceGente} personas que van a leer lo que escribas.`
                : 'Cuando llegue más gente a esta sala, tu mensaje va a estar acá esperándola.'}
            </p>
          </div>
        )}

        {mensajes.map((m, i) => {
          const mio = m.autorId === miId
          // Los mensajes seguidos de la misma persona no repiten cabecera: es
          // lo que hace que una conversación se lea como conversación.
          const sigue = i > 0 && mensajes[i - 1].autorId === m.autorId
          return (
            <div key={m.id} className={`flex gap-2 ${mio ? 'flex-row-reverse' : ''}`}>
              <div className="w-7 flex-shrink-0">
                {!sigue && <Avatar avatar={m.autorAvatar} size={28} anillo={m.autorId} />}
              </div>
              <div className={`min-w-0 max-w-[78%] ${mio ? 'items-end' : 'items-start'} flex flex-col`}>
                {!sigue && (
                  <p className="mb-0.5 px-1 text-[10px] font-semibold text-swu-muted">
                    {mio ? 'Vos' : m.autorNombre}
                  </p>
                )}
                <div
                  className={`group relative rounded-2xl px-3 py-1.5 text-[13px] leading-snug ${
                    m.borrado
                      ? 'border border-dashed border-swu-border text-swu-muted italic'
                      : mio
                        ? 'bg-swu-accent/20 text-swu-text'
                        : 'bg-swu-bg text-swu-text'
                  }`}
                >
                  <span className="whitespace-pre-wrap break-words">
                    {m.borrado ? 'Mensaje retirado' : m.cuerpo}
                  </span>
                  {!m.borrado && (mio || soyAdmin) && (
                    <button
                      onClick={async () => {
                        if (!confirm('¿Retirar este mensaje?')) return
                        await retirar(m.id, miId)
                        await recargar()
                      }}
                      title="Retirar"
                      className="absolute -top-2 -right-2 hidden rounded-full bg-swu-surface p-1
                                 text-swu-muted shadow group-hover:block hover:text-swu-red"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 px-1 font-mono text-[9px] text-swu-muted/70">
                  {hora(m.creadoEn)}
                </p>
              </div>
            </div>
          )
        })}

        {/* Los que todavía van en camino */}
        {enVuelo.map(m => (
          <div key={m.clave} className="flex flex-row-reverse gap-2">
            <div className="w-7 flex-shrink-0" />
            <div className="flex max-w-[78%] flex-col items-end">
              <div className={`rounded-2xl px-3 py-1.5 text-[13px] leading-snug ${
                m.estado === 'falló'
                  ? 'border border-swu-red/50 bg-swu-red/10 text-swu-text'
                  : 'bg-swu-accent/10 text-swu-muted'
              }`}>
                <span className="whitespace-pre-wrap break-words">{m.cuerpo}</span>
              </div>
              <p className="mt-0.5 px-1 text-[9px] text-swu-muted">
                {m.estado === 'falló' ? 'No se envió' : 'Enviando…'}
              </p>
            </div>
          </div>
        ))}

        <div ref={finRef} />
      </div>

      {error && (
        <p className="border-t border-swu-red/30 bg-swu-red/10 px-3 py-1.5 text-[11px] text-swu-red-texto">
          {error}
        </p>
      )}

      {/* Escribir */}
      <div className="flex items-end gap-2 border-t border-swu-border p-2">
        <textarea
          value={borrador}
          onChange={e => setBorrador(e.target.value)}
          onKeyDown={e => {
            // Enter manda; Shift+Enter hace salto de línea. En táctil el teclado
            // trae su propio Enter de salto, así que no se pierde nada.
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void mandar() }
          }}
          rows={1}
          maxLength={1000}
          placeholder={`Escribir en ${sala.titulo}…`}
          className="max-h-24 min-h-[38px] flex-1 resize-none rounded-xl border border-swu-border
                     bg-swu-bg px-3 py-2 text-sm text-swu-text placeholder:text-swu-muted/60
                     focus:border-swu-accent focus:outline-none"
        />
        <button
          onClick={() => void mandar()}
          disabled={!borrador.trim()}
          aria-label="Enviar"
          className="rounded-xl bg-swu-accent p-2.5 text-swu-accent-fg disabled:opacity-30"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}

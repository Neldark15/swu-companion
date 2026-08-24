/**
 * La transmisión destacada: un directo de fuera, con su cuenta atrás.
 *
 * Nel: «me gustaría ligar o hacer un módulo especial para [el directo de FFG]…
 * para que programes y mandes notificación cuando comience y poder verlo, así
 * como el módulo de En Vivo».
 *
 * ── El reproductor va SIEMPRE, incluso antes de la hora ───────────────
 *
 * La tentación es enseñar una cuenta atrás y recién a la hora poner el video.
 * Pero YouTube ya hace eso: un directo programado, incrustado, muestra su
 * propia sala de espera y ARRANCA SOLO cuando empieza. Poner el reproductor
 * desde el principio significa que quien deje la pestaña abierta ve el
 * comienzo sin tener que recargar, que es exactamente lo que uno quiere de una
 * pantalla que dice «en vivo».
 *
 * La cuenta atrás de arriba es nuestra igual, porque la de YouTube está dentro
 * del iframe y no se ve en la tarjeta ni en la lista.
 */

import { useEffect, useState } from 'react'
import { Radio, Youtube, CalendarClock } from 'lucide-react'
import { urlIncrustarYoutube } from '../../types/stream'
import {
  transmisionDestacada, momentoDe, faltaTexto, horaLocal, type Transmision,
} from '../../services/transmisiones'
import { ChatTransmision } from './ChatTransmision'

export function TransmisionDestacada() {
  const [t, setT] = useState<Transmision | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    let vivo = true
    void transmisionDestacada().then(r => { if (vivo) setT(r) })
    return () => { vivo = false }
  }, [])

  /* El reloj corre siempre que haya algo que contar. Se apaga cuando no: un
     intervalo de un segundo vivo en una pantalla sin cuenta atrás es batería
     regalada. */
  useEffect(() => {
    if (!t) return
    const id = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [t])

  if (!t) return null

  const momento = momentoDe(t, ahora)
  if (momento === 'termino') return null

  const inicio = new Date(t.empiezaEn).getTime()
  const src = urlIncrustarYoutube(
    t.youtube, typeof window !== 'undefined' ? window.location.origin : undefined,
  )
  const enVivo = momento === 'envivo'

  return (
    <section className="overflow-hidden rounded-2xl border border-swu-border bg-swu-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-swu-border px-4 py-3">
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider
                      ${enVivo
                        ? 'bg-swu-red/20 text-swu-red-texto'
                        : 'bg-swu-amber/15 text-swu-amber'}`}
        >
          {enVivo
            ? <><Radio size={12} className="animate-pulse" /> En vivo</>
            : <><CalendarClock size={12} /> Programado</>}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-black text-swu-text">{t.titulo}</p>
          <p className="truncate text-[11px] text-swu-muted">{t.canal}</p>
        </div>
        {/* La cuenta atrás en cifras grandes: es el dato por el que alguien
            abre esta pantalla antes de la hora. */}
        {!enVivo && (
          <div className="text-right">
            <p className="text-[15px] font-black tabular-nums text-swu-amber">
              {faltaTexto(inicio - ahora)}
            </p>
            <p className="text-[10px] text-swu-muted">{horaLocal(t.empiezaEn)}</p>
          </div>
        )}
      </div>

      {src ? (
        <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
          <iframe
            key={t.id}
            src={src}
            title={t.titulo}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : null}

      {/* La salida de emergencia. Un canal puede prohibir que lo incrusten, y
          entonces el iframe de arriba sale en negro diciendo «ver en YouTube»
          en inglés y chiquito. Este enlace siempre funciona. */}
      <a
        href={`https://www.youtube.com/watch?v=${encodeURIComponent(t.youtube.replace(/^.*[?&]v=|^.*youtu\.be\//, ''))}`}
        target="_blank"
        rel="noopener noreferrer"
        className="m-3 flex min-h-[46px] items-center justify-center gap-2 rounded-xl
                   border border-swu-border bg-swu-bg px-4 py-2.5
                   text-[12px] font-black uppercase tracking-wider text-swu-text"
      >
        <Youtube size={16} className="text-swu-red-texto" />
        Abrirlo en YouTube
      </a>

      {/* El chat va DEBAJO del video y con su propio alto: así no lo tapa y no
          hay que mover la página para escribir. */}
      <ChatTransmision />
    </section>
  )
}

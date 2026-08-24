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

/** El id suelto, venga como id o como URL de cualquiera de las dos formas. */
function idYoutube(entrada: string): string {
  return entrada.replace(/^.*[?&]v=/, '').replace(/^.*youtu\.be\//, '').split(/[?&#]/)[0]
}

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
    /* ── QUE QUEPA EN LA PANTALLA ──
       Nel pidió que no haya que scrollear, y en el teléfono eso no sale solo:
       con el video, un botón de fila entera y un chat de alto fijo, la barra de
       escribir terminaba DEBAJO del borde. Así que la tarjeta se limita al alto
       del visor y reparte: el video manda su tamaño, el chat se queda con lo
       que sobre (`flex-1 min-h-0`) y su barra de escribir queda siempre a la
       vista. `dvh` y no `vh` porque en móvil la barra del navegador se mueve. */
    <section className="flex max-h-[calc(100dvh-8.5rem)] flex-col overflow-hidden
                        rounded-2xl border border-swu-border bg-swu-surface">
      {/* DOS FILAS, no una. En una sola, la cuenta atrás y el botón de YouTube
          le comían el ancho al título y en el teléfono quedaba en «S...». El
          título es lo que dice QUÉ vas a ver: no puede ser lo que se recorta. */}
      <div className="shrink-0 border-b border-swu-border px-4 py-3">
        <div className="flex items-center gap-2">
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

          {!enVivo && (
            <span className="text-[15px] font-black tabular-nums text-swu-amber">
              {faltaTexto(inicio - ahora)}
            </span>
          )}

          {/* La salida de emergencia: un canal puede prohibir que lo incrusten
              y entonces el reproductor sale en negro. Va de ícono y no de fila
              entera — una fila más era la que dejaba la barra de escribir del
              chat fuera de la pantalla. */}
          <a
            href={`https://www.youtube.com/watch?v=${encodeURIComponent(idYoutube(t.youtube))}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrirlo en YouTube"
            title="Abrirlo en YouTube"
            className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl
                       border border-swu-border text-swu-red-texto"
          >
            <Youtube size={18} />
          </a>
        </div>

        <p className="mt-1.5 text-[13px] font-black leading-tight text-swu-text">{t.titulo}</p>
        <p className="truncate text-[11px] text-swu-muted">
          {t.canal}{!enVivo && ` · ${horaLocal(t.empiezaEn)}`}
        </p>
      </div>

      {src ? (
        <div className="relative w-full shrink-0" style={{ aspectRatio: '16 / 9' }}>
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

      {/* El chat va DEBAJO del video y se queda con el alto que sobra: así no
          lo tapa y no hay que mover la página para escribir. */}
      <ChatTransmision />
    </section>
  )
}

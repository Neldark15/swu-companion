/**
 * El chat de la transmisión: la sala GLOBAL, debajo del video.
 *
 * Nel: «abajo del video en vivo un chat de la comunidad, solamente ahí, de
 * manera global — todos los sectores podrán conectarse en el mismo módulo para
 * ver el video y comentar. Un chat que no estorbe en el video y que no se tenga
 * que scrollear».
 *
 * ── Es la sala global de siempre, no una nueva ────────────────────────
 *
 * La tentación era crear una sala «transmisión». No: La Galaxia ya tiene una
 * sala `global` con su RLS, su tiempo real y su moderación, y abrir una segunda
 * partiría la conversación en dos — lo que se comente viendo el directo se
 * perdería en un cuarto que nadie vuelve a abrir. Acá se ve la MISMA sala, con
 * otra ropa. Un mensaje escrito desde el video aparece en La Galaxia y al
 * revés.
 *
 * ── Que no estorbe, y que no haya que scrollear la página ─────────────
 *
 * Las dos cosas salen de lo mismo: el chat tiene ALTURA PROPIA y scrollea
 * ADENTRO. El video queda arriba, entero; los mensajes corren en su caja; y la
 * barra de escribir está pegada al fondo de esa caja, así que nunca hay que
 * mover la página para llegar a ella. Un chat que crece hacia abajo empujaría
 * el video fuera de la pantalla, que es exactamente lo que se pidió evitar.
 *
 * ── Y baja solo, salvo que estés leyendo ──────────────────────────────
 *
 * Llega un mensaje y la caja baja al último... a menos que estés más arriba
 * leyendo algo. Arrastrarle la vista a alguien que está leyendo es de las cosas
 * más molestas que puede hacer un chat en vivo, así que si no está abajo se le
 * ofrece un botón y se le deja decidir.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Send, MessageSquare, ArrowDown } from 'lucide-react'
import { Avatar } from '../../components/ui/Avatar'
import { hora } from '../../services/horaSV'
import { useAuth } from '../../hooks/useAuth'
import { leerSala, enviar, escucharSala, type MensajeGalaxia } from '../../services/galaxiaChat'

/** Cuántos mensajes se traen. Es un chat de directo: la historia vieja sobra. */
const TOPE = 50
/** Margen para decidir «está mirando el fondo». Un píxel exacto nunca acierta. */
const CERCA_PX = 60

export function ChatTransmision() {
  const { currentProfileId } = useAuth()
  const [mensajes, setMensajes] = useState<MensajeGalaxia[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alFondo, setAlFondo] = useState(true)
  const cajaRef = useRef<HTMLDivElement>(null)

  /* Se sube para volver a leer. Es el patrón del resto del repo: llamar a una
     función async DESDE un efecto cuenta como escritura síncrona de estado y es
     error de lint acá. La dependencia real del efecto es este contador. */
  const [recarga, setRecarga] = useState(0)
  const recargar = useCallback(() => setRecarga(n => n + 1), [])

  useEffect(() => {
    let vivo = true
    void (async () => {
      const r = await leerSala('global', null, TOPE)
      if (vivo && r.ok) setMensajes(r.datos)
    })()
    return () => { vivo = false }
  }, [recarga])

  useEffect(() => escucharSala('global', null, recargar), [recargar])

  /* Bajar al último cuando llega algo, SOLO si ya estabas abajo. El efecto se
     dispara con los mensajes, no con un temporizador: así no hay ningún cuadro
     en el que el mensaje esté puesto y la vista todavía no. */
  useEffect(() => {
    const caja = cajaRef.current
    if (!caja || !alFondo) return
    caja.scrollTop = caja.scrollHeight
  }, [mensajes, alFondo])

  const alScrollear = useCallback(() => {
    const c = cajaRef.current
    if (!c) return
    setAlFondo(c.scrollHeight - c.scrollTop - c.clientHeight < CERCA_PX)
  }, [])

  const mandar = useCallback(async () => {
    const limpio = texto.trim()
    if (!limpio || !currentProfileId || enviando) return
    setEnviando(true); setError(null)
    const r = await enviar('global', null, currentProfileId, limpio)
    if (!r.ok) setError(r.mensaje)
    else {
      setTexto('')
      // Escribir SIEMPRE te lleva al fondo: acabás de hablar, querés verte.
      setAlFondo(true)
      recargar()
    }
    setEnviando(false)
  }, [texto, currentProfileId, enviando, recargar])

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-swu-border">
      <div className="flex shrink-0 items-center gap-2 px-4 py-2">
        <MessageSquare size={13} className="text-swu-muted" />
        <p className="text-[10px] font-black uppercase tracking-widest text-swu-muted">
          Chat de la comunidad
        </p>
        <span className="ml-auto text-[10px] text-swu-muted/70">Global · todos los sectores</span>
      </div>

      {/* La caja de mensajes se queda con el alto que sobra y scrollea ADENTRO.
          `min-h-0` es obligatorio: sin él, un hijo de un flex no se deja
          encoger por debajo de su contenido y la caja empuja la barra de
          escribir fuera de la pantalla — que es exactamente el bug que esto
          arregla. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={cajaRef}
          onScroll={alScrollear}
          className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto px-3 pb-2"
        >
          {mensajes.length === 0 ? (
            <p className="m-auto px-6 text-center text-[12px] text-swu-muted">
              Todavía no hay mensajes. Estrenalo vos.
            </p>
          ) : mensajes.map(m => (
            <div key={m.id} className="flex items-start gap-2">
              <Avatar avatar={m.autorAvatar} size={24} anillo={m.autorId} />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-1.5">
                  <span className="truncate text-[11px] font-black text-swu-text">{m.autorNombre}</span>
                  <span className="shrink-0 text-[9px] text-swu-muted/70">{hora(m.creadoEn)}</span>
                </p>
                <p className={`break-words text-[12px] leading-snug ${m.borrado ? 'italic text-swu-muted' : 'text-swu-text'}`}>
                  {m.borrado ? 'Mensaje retirado' : m.cuerpo}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* El botón de «bajar», solo cuando hace falta. */}
        {!alFondo && (
          <button
            type="button"
            onClick={() => { setAlFondo(true) }}
            className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1
                       rounded-full border border-swu-border bg-swu-surface px-3 py-1.5
                       text-[10px] font-bold text-swu-text shadow-lg"
          >
            <ArrowDown size={12} /> Últimos mensajes
          </button>
        )}
      </div>

      {/* La barra de escribir, pegada al fondo de la caja: nunca hay que mover
          la página para llegar a ella. */}
      {currentProfileId ? (
        <form
          onSubmit={e => { e.preventDefault(); void mandar() }}
          className="flex shrink-0 items-center gap-2 border-t border-swu-border px-3 py-2"
        >
          <input
            value={texto}
            onChange={e => setTexto(e.target.value.slice(0, 300))}
            placeholder="Escribí algo…"
            aria-label="Mensaje para el chat de la comunidad"
            className="min-w-0 flex-1 rounded-xl border border-swu-border bg-swu-bg px-3 py-2
                       text-[13px] text-swu-text outline-none focus:border-swu-accent"
          />
          <button
            type="submit"
            disabled={!texto.trim() || enviando}
            aria-label="Enviar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl
                       bg-swu-accent text-swu-bg disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </form>
      ) : (
        <Link
          to="/profile"
          className="flex min-h-[44px] shrink-0 items-center justify-center border-t
                     border-swu-border px-4 text-[12px] font-bold text-swu-cyan"
        >
          Entrá con tu cuenta para comentar
        </Link>
      )}

      {error && (
        <p className="px-4 pb-2 text-center text-[11px] text-swu-red-texto">{error}</p>
      )}
    </div>
  )
}

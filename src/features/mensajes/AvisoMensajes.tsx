/**
 * «Tenés mensajes» — la franja de Inicio y el toque de campana.
 *
 * ── Por qué NO alcanza con el push ───────────────────────────────────
 *
 * Es la misma cuenta que ya obligó a hacer esto con el sobre diario, y acá sale
 * peor. Medido contra la base: de 28 perfiles, 8 tienen alguna suscripción de
 * push. Y los tres primeros de México, España y Argentina —los que más falta
 * hace alcanzar, porque son uno solo por país y no tienen a nadie más con quien
 * hablar— tienen CERO. Un mensaje anunciado solo por push no le llega a
 * ninguno de los tres.
 *
 * Así que el aviso vive donde sí van a pasar: la pantalla de Inicio.
 *
 * ── La franja NO se puede cerrar, y es a propósito ───────────────────
 *
 * El aviso del sobre diario lleva una X porque su estado es «pasó algo hoy» y
 * cerrarlo no pierde nada: el sobre queda cobrado igual. Acá el estado es «hay
 * alguien esperando respuesta», y eso no se resuelve escondiéndolo. La franja
 * se va sola cuando se abre la conversación, porque `SalaChat` marca leída la
 * sala al entrar — el mismo mecanismo que las salas de país.
 *
 * ── La campana suena una vez por mensaje, no por arranque ────────────
 *
 * La clave de dedup es el id del ÚLTIMO mensaje. Un mensaje nuevo trae un id
 * nuevo y vuelve a sonar; abrir la app diez veces con el mismo mensaje sin leer
 * suena una sola. Derivarla del texto sería el error que documenta
 * `notificationService`: dos mensajes iguales de dos personas distintas serían
 * el mismo aviso.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, MessageCircle } from 'lucide-react'
import { Avatar } from '../../components/ui/Avatar'
import { useNotificationStore } from '../../services/notificationService'
import { misConversaciones, type Conversacion } from '../../services/chatPrivado'

interface Props {
  /** El id de auth de quien mira. Sin él no hay a quién preguntarle. */
  userId: string | null | undefined
}

export function AvisoMensajes({ userId }: Props) {
  const navigate = useNavigate()
  const addNotification = useNotificationStore(s => s.addNotification)
  const [pendientes, setPendientes] = useState<Conversacion[]>([])

  useEffect(() => {
    if (!userId) return
    let vivo = true
    void (async () => {
      const r = await misConversaciones(userId)
      if (!vivo || !r.ok) return
      const conDeuda = r.datos.filter(c => c.noLeidos > 0)
      setPendientes(conDeuda)

      // Un solo aviso aunque haya varias conversaciones: cinco toques de
      // campana seguidos al abrir la app es ruido, no información.
      const primero = conDeuda[0]
      if (!primero?.ultimo) return
      const total = conDeuda.reduce((n, c) => n + c.noLeidos, 0)
      addNotification({
        type: 'info',
        title: conDeuda.length === 1
          ? `Mensaje de ${primero.otro.name}`
          : `${total} mensajes sin leer`,
        message: conDeuda.length === 1
          ? recorte(primero.ultimo.cuerpo)
          : `De ${conDeuda.length} personas.`,
        link: '/mensajes',
        dedupKey: `dm:${primero.ultimo.id}`,
      })
    })()
    return () => { vivo = false }
  }, [userId, addNotification])

  if (!userId || pendientes.length === 0) return null

  const total = pendientes.reduce((n, c) => n + c.noLeidos, 0)
  const uno = pendientes.length === 1 ? pendientes[0] : null

  return (
    <button
      onClick={() => navigate(uno ? `/mensajes?sala=${uno.id}` : '/mensajes')}
      className="mb-3 flex w-full items-center gap-3 rounded-xl border border-swu-cyan/40
                 bg-swu-cyan/10 px-3 py-2.5 text-left transition-colors
                 hover:bg-swu-cyan/15 focus-visible:outline-none focus-visible:ring-2
                 focus-visible:ring-swu-accent"
    >
      {uno
        ? <Avatar avatar={uno.otro.avatar} size={34} anillo={uno.otro.id} />
        : (
          <span className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center
                           rounded-full bg-swu-cyan/20 text-swu-cyan">
            <MessageCircle size={17} />
          </span>
        )}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-black text-swu-text">
          {uno ? `${uno.otro.name} te escribió` : `${total} mensajes sin leer`}
        </span>
        <span className="block truncate text-[11px] text-swu-muted">
          {uno?.ultimo ? recorte(uno.ultimo.cuerpo) : `De ${pendientes.length} personas.`}
        </span>
      </span>

      <span className="flex flex-shrink-0 items-center gap-1.5">
        <span className="rounded-full bg-swu-cyan px-1.5 py-0.5 text-[10px] font-black
                         leading-none text-swu-bg">
          {total > 99 ? '99+' : total}
        </span>
        <ChevronRight size={16} className="text-swu-muted" />
      </span>
    </button>
  )
}

/** Un renglón, no un párrafo: la franja tiene una línea y el resto se lee dentro. */
function recorte(texto: string): string {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  return limpio.length > 64 ? `${limpio.slice(0, 63)}…` : limpio
}

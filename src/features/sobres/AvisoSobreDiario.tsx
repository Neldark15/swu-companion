/**
 * «Cayó tu sobre diario» — la franja de Inicio y el toque de campana.
 *
 * ── Por qué esto existe teniendo push ────────────────────────────────
 *
 * Porque el push llega a 4 de 26 perfiles. Medido hoy contra la base:
 * 26 en `profiles`, 4 en `push_subscriptions`. Un aviso que alcanza al 15% de
 * la comunidad no es el aviso de una función diaria, es un extra.
 *
 * Así que el cron manda el push a quien lo tenga y la app avisa a todos. Los
 * dos caminos leen el MISMO hecho —`sobres_saldo.diario_en`, el día que la base
 * efectivamente cobró—, así que no pueden contradecirse: si el cron no corrió,
 * acá tampoco se anuncia nada.
 *
 * ── Se anuncia una vez por día y por aparato ─────────────────────────
 *
 * La marca vive en `localStorage` (ver `sobreDiarioAnunciado`). No se usa el
 * `dedupKey` de las notificaciones: el store lo acepta en el tipo pero
 * `addNotification` no lo mira, así que la campana sonaría en cada montaje de
 * Inicio — que en una SPA es cada vez que se toca la pestaña de abajo.
 *
 * Se marca ANTES de tocar la campana, no después: el doble montaje del modo
 * estricto de React corre el efecto dos veces, y marcando al final se anuncia
 * dos veces en desarrollo, que es justo donde se revisa.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, X } from 'lucide-react'
import { CargoIcon } from '../../components/SWIcons'
import { useNotificationStore } from '../../services/notificationService'
import {
  estadoSobres, sobreDiarioAnunciado, marcarSobreDiarioAnunciado,
} from '../../services/sobres'

interface Props {
  /** El id de auth de quien mira. Sin él no hay a quién preguntarle. */
  userId: string
}

export function AvisoSobreDiario({ userId }: Props) {
  const navigate = useNavigate()
  const addNotification = useNotificationStore(s => s.addNotification)
  const [aviso, setAviso] = useState<{ dia: string; saldo: number } | null>(null)

  useEffect(() => {
    if (!userId) return
    let vivo = true
    void (async () => {
      const e = await estadoSobres(userId)
      if (!vivo) return
      if (!e.cayoHoy || sobreDiarioAnunciado(e.dia)) return

      // Marcar primero. Ver la cabecera: el doble montaje del modo estricto.
      marcarSobreDiarioAnunciado(e.dia)
      addNotification({
        type: 'gift',
        title: 'Cayó tu sobre diario',
        message: e.saldo === 1
          ? 'Te espera en La Bóveda.'
          : `Te esperan ${e.saldo} sobres en La Bóveda.`,
        link: '/sobres',
      })
      setAviso({ dia: e.dia, saldo: e.saldo })
    })()
    return () => { vivo = false }
  }, [userId, addNotification])

  if (!aviso) return null

  return (
    <FranjaSobreDiario
      saldo={aviso.saldo}
      alAbrir={() => navigate('/sobres')}
      alCerrar={() => setAviso(null)}
    />
  )
}

/**
 * La franja, sin nada que consultar.
 *
 * Está separada del componente de arriba para poder mirarla en `/banco-sobres`:
 * lo de arriba depende de una sesión, de una fila en `sobres_saldo` y de que el
 * cron haya corrido HOY. Sin esto, la única forma de ver esta franja sería
 * esperar a las 8 de la mañana con una cuenta de verdad — y en esta pantalla ya
 * se han colado un encabezado duplicado y un texto a 2,02:1 de contraste que
 * pasaron tipos, lint y build sin una queja.
 */
export function FranjaSobreDiario(
  { saldo, alAbrir, alCerrar }: { saldo: number; alAbrir: () => void; alCerrar: () => void },
) {
  return (
    <div className="px-4 pt-3">
      <div className="clip-hud flex w-full items-center gap-3 bg-swu-cyan/15 px-4 py-3">
        <button
          onClick={alAbrir}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <CargoIcon size={18} className="shrink-0 text-swu-cyan" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-swu-text">Cayó tu sobre diario</span>
            <span className="block text-[11px] text-swu-muted">
              {saldo === 1
                ? 'Te espera uno sin abrir en La Bóveda.'
                : `Tenés ${saldo} sin abrir en La Bóveda.`}
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-swu-muted" />
        </button>
        {/* Cerrar la franja NO gasta el sobre: sigue en la cuenta y la Bóveda
            lo enseña igual. Por eso se puede quitar sin preguntar nada.
            El área táctil va CABLEADA en 44×44 (`h-11 w-11`), no en padding:
            con `p-2` medía 32×32 en el banco, por debajo del mínimo que se
            respeta en el resto de la app. El margen negativo la mete dentro del
            relleno de la franja para que no la haga más alta. */}
        <button
          onClick={alCerrar}
          aria-label="Ocultar el aviso del sobre diario"
          className="-my-1 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-swu-muted hover:text-swu-text"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

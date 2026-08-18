/**
 * ChatRegion — el acceso directo a la sala de tu región, desde Inicio.
 *
 * No es un módulo más de la cuadrícula aunque viva entre ellos, y la
 * diferencia importa: los demás módulos son puertas fijas —«Contador» dice lo
 * mismo hoy que mañana— y este dice CUÁNTO te estás perdiendo. Un acceso a un
 * chat sin el contador de no leídos es una puerta que no avisa que tocaron.
 *
 * Por eso el rótulo tampoco es fijo: dice el país de la cuenta. «Chat» es una
 * categoría; «El Salvador» es un sitio al que se entra.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, MessageSquare } from 'lucide-react'
import { Carta3D } from '../../components/Carta3D'
import { HudPanel, HudCorners, HexIcon } from '../../components/Hud'
import { misSalas, estadoDeSalas, claveSala, type Sala } from '../../services/galaxiaChat'

interface Props {
  /** `null` mientras no hay sesión: entonces esto no se dibuja. */
  userId: string | null | undefined
}

export function ChatRegion({ userId }: Props) {
  const navigate = useNavigate()
  const [sala, setSala] = useState<Sala | null>(null)
  const [sinLeer, setSinLeer] = useState(0)

  useEffect(() => {
    // Sin sesión no hay nada que pedir NI que limpiar: el componente ya no se
    // dibuja (ver el `if` de más abajo), así que poner el estado en null acá
    // solo provocaría un render en cascada.
    if (!userId) return
    let vivo = true

    void (async () => {
      const salas = await misSalas(userId)
      if (!vivo) return

      // La sala de la REGIÓN es la de país. Si la cuenta no tiene país puesto,
      // `salasDe` no la incluye y se cae a la global, que siempre existe: es
      // preferible una puerta a la galaxia entera que ninguna puerta.
      const region = salas.find(x => x.alcance === 'pais') ?? salas.find(x => x.alcance === 'global')
      if (!region) return
      setSala(region)

      const estado = await estadoDeSalas(userId, [region])
      if (!vivo) return
      const e = estado.get(claveSala(region.alcance, region.ambito))
      // Una sala silenciada no grita desde Inicio. Silenciar tiene que
      // significar lo mismo en todas partes o no significa nada.
      setSinLeer(e && !e.silenciada ? e.sinLeer : 0)
    })()

    return () => { vivo = false }
  }, [userId])

  if (!userId || !sala) return null

  const destino = `/galaxy?vista=sala&sala=${encodeURIComponent(claveSala(sala.alcance, sala.ambito))}`

  return (
    <button onClick={() => navigate(destino)} className="text-left">
      <Carta3D brillo intensidad={6} className="h-full">
        <HudPanel tone="green" glow className="h-full">
          <div className="relative flex h-full items-center gap-2 p-2.5">
            <HudCorners tone="green" />
            <div className="relative flex-shrink-0">
              <HexIcon tone="green" size={38}><MessageSquare size={18} /></HexIcon>
              {sinLeer > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center
                                 rounded-full bg-swu-green px-1 text-[9px] font-black text-swu-bg">
                  {sinLeer > 99 ? '99+' : sinLeer}
                </span>
              )}
            </div>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block break-words text-[11px] font-bold text-white min-[360px]:text-[13px]">
                {sala.titulo}
              </span>
              <span className="block text-[9px] text-swu-muted min-[360px]:text-[10px]">
                {sinLeer > 0
                  ? `${sinLeer} sin leer`
                  : 'Chat de tu región'}
              </span>
            </span>
            <ChevronRight size={14} className="flex-shrink-0 text-swu-muted" aria-hidden />
          </div>
        </HudPanel>
      </Carta3D>
    </button>
  )
}

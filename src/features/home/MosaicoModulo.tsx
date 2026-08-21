/**
 * MosaicoModulo — una casilla de la consola de Inicio.
 *
 * Se sacó de `HomePage` sin cambiarle un píxel, por una razón concreta: la
 * puerta de instalación tapa Inicio en un navegador normal (§3d), así que la
 * ÚNICA forma de mirar cómo queda una casilla es un banco de pruebas — y un
 * banco que dibuja su propia imitación del mosaico no prueba nada. Ahora el
 * banco monta esta misma pieza.
 *
 * El tipo que pide es el mínimo que necesita para dibujarse. El `Sistema` de
 * Inicio lleva además `cat`, `auth` y `admin`, que no le importan a la casilla;
 * como TypeScript compara por forma, se le puede pasar tal cual.
 */

import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Carta3D } from '../../components/Carta3D'
import { HudPanel, HudCorners, HexIcon } from '../../components/Hud'
import type { HudTone } from '../../components/hudTones'
import { useT } from '../../services/i18n'
import { MOD_EN } from './modulosTexto'

/** Lo único que una casilla necesita saber de un módulo para dibujarse. */
export interface ModuloVisible {
  icon: (props: { size?: number; className?: string }) => React.ReactNode
  label: string
  tone: HudTone
  to: string
}


export function MosaicoModulo({ sys }: { sys: ModuloVisible }) {
  const navigate = useNavigate()
  const tI = useT()
  const Icon = sys.icon

  return (
    <button onClick={() => navigate(sys.to)} className="text-left">
      {/* El mismo 3D de las cartas, con menos ángulo: un panel de interfaz que
          se inclina como una carta se siente a juguete. Seis grados alcanzan
          para que responda al dedo. */}
      <Carta3D brillo intensidad={6} className="h-full">
        <HudPanel tone={sys.tone} glow className="h-full">
          <div className="relative h-full flex items-center gap-2 p-2.5">
            <HudCorners tone={sys.tone} />
            <HexIcon tone={sys.tone} size={38}><Icon size={18} /></HexIcon>
            {/* Solo el rótulo, en blanco: el color lo lleva el ícono. A 320 px
                la caja queda en 46 px y una palabra sola —«Contrabando» mide
                83— no tiene dónde partirse; `break-words` + `text-[11px]` le
                devuelven el aire y a partir de 360 vuelve a 13. */}
            <span className="min-w-0 flex-1 break-words text-[11px] font-bold text-white
                             leading-tight min-[360px]:text-[13px]">
              {tI(sys.label, MOD_EN[sys.label] ?? sys.label)}
            </span>
            <ChevronRight size={14} className="text-swu-muted flex-shrink-0" aria-hidden />
          </div>
        </HudPanel>
      </Carta3D>
    </button>
  )
}

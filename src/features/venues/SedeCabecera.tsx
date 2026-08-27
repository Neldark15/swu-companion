/**
 * SedeCabecera — la cara de una sede.
 *
 * Se comparte entre la página pública y la vista previa del panel, a propósito:
 * si fueran dos componentes, el administrador estaría personalizando algo que
 * no es exactamente lo que va a ver la gente.
 */

import { Store, MapPin } from 'lucide-react'
import { HudPanel, HudCorners } from '../../components/Hud'
import { HUD_TEXTO, type HudTone } from '../../components/hudTones'
import type { Sede } from '../../services/venuesService'

export function SedeCabecera({ sede, compacta = false }: { sede: Sede; compacta?: boolean }) {
  const tono = (sede.accent ?? 'cyan') as HudTone

  return (
    <HudPanel tone={tono} glow>
      <div className="relative overflow-hidden">
        <div className={compacta ? 'h-24' : 'h-36'}>
          {sede.banner_url ? (
            <img src={sede.banner_url} alt="" className="w-full h-full object-cover" />
          ) : (
            // Sin banner, una trama sutil: mejor un fondo con intención que un
            // hueco gris que parezca que algo falló.
            <div
              className="w-full h-full bg-swu-bg"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 10px)',
              }}
              aria-hidden
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-swu-surface via-swu-surface/70 to-transparent" />
        </div>
        <HudCorners tone={tono} />

        <div className="relative px-3 pb-3 -mt-9">
          <div className="flex items-end gap-2.5">
            <div className={`${compacta ? 'w-12 h-12' : 'w-16 h-16'} clip-hud-sm p-px flex-shrink-0 bg-swu-border`}>
              <div className="clip-hud-sm w-full h-full bg-swu-bg overflow-hidden flex items-center justify-center">
                {/* `object-contain`, NUNCA `cover`. El logo de un comercio es
                    un wordmark apaisado casi siempre: en un cuadrado con
                    recorte se pierde el 44 % del ancho y quedan dos letras del
                    nombre. Un avatar redondo sí se recorta —ahí cortar la cara
                    es correcto—; una MARCA recortada deja de identificar, que
                    es lo único que tenía que hacer. */}
                {sede.logo_url
                  ? <img src={sede.logo_url} alt="" className="w-full h-full object-contain p-0.5" />
                  : <Store size={compacta ? 18 : 24} className={HUD_TEXTO[tono]} aria-hidden />}
              </div>
            </div>
            <div className="min-w-0 flex-1 pb-0.5">
              <h2 className={`${compacta ? 'text-sm' : 'text-lg'} font-extrabold text-white leading-tight truncate`}>
                {sede.name || 'Tu tienda'}
              </h2>
              <p className="text-[11px] text-swu-muted flex items-center gap-1 truncate">
                <MapPin size={11} className="flex-shrink-0" aria-hidden />
                {sede.address || 'Dirección'}
                {sede.city && ` · ${sede.city}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </HudPanel>
  )
}
